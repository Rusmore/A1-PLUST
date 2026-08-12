/* ============================= LIQUIDATION ============================= */

/* Only this named approver (Ma'am Grace Gan) may review and approve liquidation
   receipts before they are processed. */
const RECEIPT_APPROVER_NAME = "Grace Gan";

/* The cash settlement classification now derives from the per-document receipt
   amounts — see reconcileReceipts / settlementStateFor in 02-helpers.jsx. */

function emptyLine() {
  return { id: uid("ln"), date: todayISO(), expense: "", category: EXPENSE_CATEGORIES[0], department: SUBACCOUNTS[1].code, amount: "", taxCategory: "" };
}

/* Bring older stored documents up to the current shape so rows uploaded before
   receipt amounts existed still render and can be completed. */
function normalizeAttachment(a) {
  return {
    ...a,
    docType: a.docType || DEFAULT_DOC_TYPE,
    receiptNo: a.receiptNo || "",
    receiptAmount: a.receiptAmount == null ? "" : a.receiptAmount,
    amountHistory: a.amountHistory || [],
  };
}

function LiquidationWorksheet({
  disbursement, liquidation, onSave, onExport, canApproveReceipts, onDecideReceipt,
  liquidations, disbursements, onSubmitLiquidation, onReopenLiquidation,
  onRecordSettlement, onReviewOverLiquidation, canDelete, onDeleteLiquidation,
}) {
  const [lines, setLines] = useState(liquidation ? liquidation.lines.map((l) => ({ ...l })) : [emptyLine()]);
  const [attachments, setAttachments] = useState(
    liquidation && liquidation.attachments ? liquidation.attachments.map(normalizeAttachment) : []
  );
  const [saved, setSaved] = useState(true);
  const [uploadNote, setUploadNote] = useState("");
  const [dupNote, setDupNote] = useState("");
  /* Actual amount keyed in by the custodian when recording the settlement. */
  const [actualInput, setActualInput] = useState("");

  useEffect(() => {
    setLines(liquidation ? liquidation.lines.map((l) => ({ ...l })) : [emptyLine()]);
    setAttachments(liquidation && liquidation.attachments ? liquidation.attachments.map(normalizeAttachment) : []);
    setSaved(true);
    setUploadNote("");
    setDupNote("");
    setActualInput("");
  }, [disbursement.id]);

  const updateLine = (id, patch) => {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setSaved(false);
  };
  const addLine = () => { setLines((ls) => [...ls, emptyLine()]); setSaved(false); };
  const removeLine = (id) => { setLines((ls) => ls.filter((l) => l.id !== id)); setSaved(false); };

  /* Supporting documents (official receipts, sales invoices, etc.) are read as
     data URLs and stored with the liquidation. Capped per-file to keep the
     shared record from growing too large. */
  const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB per file
  const onPickFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploadNote("");
    files.forEach((file) => {
      if (file.size > MAX_FILE_BYTES) {
        setUploadNote(`"${file.name}" is larger than 2 MB and was skipped. Please compress it first.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const doc = {
          id: uid("att"), name: file.name, type: file.type || "file",
          size: file.size, data: reader.result, uploadedAt: todayISO(),
          approvalStatus: "Pending", approvalHistory: [],
          docType: DEFAULT_DOC_TYPE, receiptNo: "", receiptAmount: "", amountHistory: [],
        };
        /* Warn on a likely duplicate but still let the user proceed — the same
           file name can legitimately recur across different vouchers. */
        setAttachments((as) => {
          const hits = findDuplicateReceipts(doc, as, liquidations, disbursement.id);
          if (hits.length) {
            const h = hits[0];
            const other = (disbursements || []).find((x) => x.id === h.disbursementId);
            const where = h.disbursementId === disbursement.id
              ? "this liquidation"
              : `voucher ${other ? other.voucherNo : h.disbursementId}`;
            setDupNote(`Possible duplicate: "${file.name}" matches "${h.doc.name}" on ${where} (${h.reason}). Review before submitting.`);
          }
          return [...as, doc];
        });
        setSaved(false);
      };
      reader.readAsDataURL(file);
    });
  };
  const removeAttachment = (id) => { setAttachments((as) => as.filter((a) => a.id !== id)); setSaved(false); };

  /* Per-document field edits (document type, receipt no., receipt amount). */
  const updateAttachment = (id, patch) => {
    setAttachments((as) => as.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    setSaved(false);
  };
  /* Receipt amount accepts decimals but never a negative value. Kept as the raw
     string while typing so the field can be cleared, then normalized on save. */
  const setReceiptAmount = (id, raw) => {
    if (raw !== "") {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return;
    }
    updateAttachment(id, { receiptAmount: raw });
  };

  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const remaining = disbursement.amount - total;
  const validLines = lines.filter((l) => l.expense.trim() && Number(l.amount) > 0);

  /* Receipt approval state is read from the PERSISTED liquidation so that
     Grace Gan's decisions (saved immediately) are reflected here regardless of
     unsaved worksheet edits. */
  const persistedById = (id) => ((liquidation && liquidation.attachments) || []).find((a) => a.id === id);
  const approvalSummary = receiptApprovalSummary(liquidation);
  const overallApproval = liqApprovalStatus(liquidation);
  const canSubmitFinal = approvalSummary.total > 0 && approvalSummary.allApproved;

  /* Live view of the documents: receipt amounts come from the worksheet (so the
     totals recalculate as the requestor types) while approval state comes from
     the persisted record. Every figure below is derived from these documents —
     no total is stored on its own. */
  const mergedAtts = attachments.map((a) => {
    const pa = persistedById(a.id);
    return {
      ...a,
      approvalStatus: (pa && pa.approvalStatus) || a.approvalStatus || "Pending",
      approvalHistory: (pa && pa.approvalHistory) || a.approvalHistory || [],
    };
  });
  const liveLiq = { ...(liquidation || {}), attachments: mergedAtts };
  const receiptSummary = receiptAmountSummary(liveLiq);
  const st = settlementStateFor(disbursement, liveLiq);
  const finalStatus = liqFinalStatus(disbursement, liveLiq);
  const isDraft = liqIsDraft(liquidation);
  /* After submission the amounts are read-only; only a receipt approver may
     still correct them, and every such change is written to the audit trail. */
  const amountsLocked = !isDraft && !canApproveReceipts;
  /* The encoded expense lines should agree with the approved receipts. */
  const linesVsReceipts = round2(total - receiptSummary.approvedTotal);

  const submitBlockers = [];
  if (!receiptSummary.docCount) submitBlockers.push("upload at least one supporting document");
  if (receiptSummary.missing > 0) submitBlockers.push(`enter the receipt amount on ${receiptSummary.missing} document(s)`);
  if (receiptSummary.docCount > 0 && !approvalSummary.allApproved) submitBlockers.push(`await ${RECEIPT_APPROVER_NAME}'s approval of all receipts`);
  if (!saved) submitBlockers.push("save your changes first");
  const canSubmit = isDraft && submitBlockers.length === 0;

  const approveReceipt = (a) => onDecideReceipt && onDecideReceipt(disbursement.id, a.id, "Approved", "");
  const rejectReceipt = (a) => {
    if (!onDecideReceipt) return;
    const remarks = window.prompt(`Reason for rejecting "${a.name}" (required):`, "");
    if (remarks == null) return;
    if (!remarks.trim()) { window.alert("Rejection remarks are required."); return; }
    onDecideReceipt(disbursement.id, a.id, "Rejected", remarks.trim());
  };
  /* Approve every still-pending, already-saved receipt in one action. */
  const approveAllReceipts = () => {
    if (!onDecideReceipt) return;
    ((liquidation && liquidation.attachments) || []).forEach((a) => {
      if ((a.approvalStatus || "Pending") !== "Approved") {
        onDecideReceipt(disbursement.id, a.id, "Approved", "");
      }
    });
  };

  /* Which receipt amounts changed against the persisted record — drives the
     mandatory reason prompt for post-submission corrections. */
  const changedAmounts = attachments.filter((a) => {
    const pa = persistedById(a.id);
    return pa && round2(pa.receiptAmount) !== round2(a.receiptAmount);
  });

  const handleSave = () => {
    if (attachments.some((a) => a.receiptAmount !== "" && Number(a.receiptAmount) < 0)) {
      window.alert("Receipt amounts cannot be negative.");
      return;
    }
    let reason = "";
    /* A correction made after submission must carry a reason for the audit
       trail. Draft edits are free-form and logged without one. */
    if (!isDraft && changedAmounts.length) {
      const names = changedAmounts.map((a) => a.name).join(", ");
      const answer = window.prompt(
        `This liquidation is already submitted. Reason for changing the receipt amount on ${names} (required):`, ""
      );
      if (answer == null) return;
      if (!answer.trim()) { window.alert("A reason is required to change a receipt amount after submission."); return; }
      reason = answer.trim();
    }
    const cleanAtts = attachments.map((a) => ({
      ...a,
      docType: a.docType || DEFAULT_DOC_TYPE,
      receiptNo: (a.receiptNo || "").trim(),
      receiptAmount: round2(a.receiptAmount),
    }));
    onSave(disbursement.id, validLines.map((l) => ({ ...l, amount: Number(l.amount) })), cleanAtts, { reason });
    setSaved(true);
  };

  const handleSubmit = () => {
    if (!canSubmit || !onSubmitLiquidation) return;
    const warn = st.type === "reimburse"
      ? `\n\nWARNING: the receipt total exceeds the cash released by ${peso(st.expected)}. This liquidation will be flagged for review and will NOT be approved automatically.`
      : "";
    if (!window.confirm(
      `Submit this liquidation for ${disbursement.voucherNo}?\n\n`
      + `Total Receipt Amount: ${peso(receiptSummary.approvedTotal)}\n`
      + `PCF Released Amount: ${peso(disbursement.amount)}${warn}\n\n`
      + "Receipt amounts become read-only after submission."
    )) return;
    onSubmitLiquidation(disbursement.id);
  };

  const handleReopen = () => {
    if (!onReopenLiquidation) return;
    const reason = window.prompt("Reason for reopening this liquidation for editing (required):", "");
    if (reason == null) return;
    if (!reason.trim()) { window.alert("A reason is required to reopen a submitted liquidation."); return; }
    onReopenLiquidation(disbursement.id, reason.trim());
  };

  /* Recording the settlement asserts the cash HAS moved, so the actual amount
     is captured and must equal the expected amount before it counts as settled. */
  const handleRecordSettlement = () => {
    if (!onRecordSettlement) return;
    const actual = round2(actualInput === "" ? st.expected : actualInput);
    if (actual < 0) { window.alert("The actual amount cannot be negative."); return; }
    if (actual !== st.expected && !window.confirm(
      `The actual amount (${peso(actual)}) does not match the expected ${st.type === "excess" ? "return" : "reimbursement"} of ${peso(st.expected)}.\n\n`
      + "The liquidation will stay NOT YET LIQUIDATED until the amounts match. Record it anyway?"
    )) return;
    onRecordSettlement(disbursement.id, {
      completed: true, actualAmount: actual, expectedAmount: st.expected, type: st.type,
    });
    setActualInput("");
  };

  const handleUndoSettlement = () => {
    if (!onRecordSettlement) return;
    if (!window.confirm("Clear the recorded cash settlement? The liquidation will revert to NOT YET LIQUIDATED.")) return;
    onRecordSettlement(disbursement.id, { completed: false, actualAmount: 0, expectedAmount: st.expected, type: st.type });
  };

  const handleReview = () => {
    if (!onReviewOverLiquidation) return;
    const remarks = window.prompt(
      `Over-liquidation of ${peso(st.expected)} on ${disbursement.voucherNo}.\n`
      + "Record your review findings / approval remarks (required):", ""
    );
    if (remarks == null) return;
    if (!remarks.trim()) { window.alert("Review remarks are required."); return; }
    onReviewOverLiquidation(disbursement.id, remarks.trim());
  };

  return (
    <div className="pcp-card pcp-card-pad">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div className="pcp-eyebrow">Voucher {disbursement.voucherNo}</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{disbursement.employee}</div>
          <div style={{ fontSize: 12, color: "var(--text-mut)", marginTop: 2 }}>
            {disbursement.branchCode} · {companyOfBranch(disbursement.branchCode)} · {fmtDate(disbursement.date)}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 7 }}>
            <Badge status={finalStatus} />
            <Badge status={isDraft ? "Draft" : "Submitted"} />
            {!isDraft && liquidation && liquidation.submittedBy && (
              <span style={{ fontSize: 10.5, color: "var(--text-mut)" }}>
                submitted by {liquidation.submittedBy} · {(liquidation.submittedAt || "").replace("T", " ")}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button className="pcp-btn pcp-btn-sm" onClick={() => onExport(disbursement, { lines: validLines })} disabled={!validLines.length}>
            <Download size={12} /> Export to Excel
          </button>
          <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={handleSave}>
            {saved ? "Saved" : "Save Liquidation"}
          </button>
          {isDraft ? (
            <button
              className="pcp-btn pcp-btn-sm pcp-btn-primary"
              onClick={handleSubmit}
              disabled={!canSubmit}
              title={canSubmit ? "Submit the final liquidation" : `To submit: ${submitBlockers.join("; ")}`}
            >
              <Check size={12} /> Submit Liquidation
            </button>
          ) : canApproveReceipts && (
            <button className="pcp-btn pcp-btn-sm" onClick={handleReopen} title="Reopen for editing (recorded in the audit trail)">
              <Edit3 size={12} /> Reopen
            </button>
          )}
          {canDelete && onDeleteLiquidation && liquidation && (
            <button
              className="pcp-btn pcp-btn-sm pcp-btn-danger"
              onClick={() => onDeleteLiquidation(disbursement.id)}
              title="Delete this liquidation and return the voucher to the worklist (super admin)"
            >
              <Trash2 size={12} /> Delete Liquidation
            </button>
          )}
        </div>
      </div>

      {/* Reconciliation summary — the approved supporting documents measured
          against the cash actually released to the requestor. */}
      <div className="pcp-grid-3" style={{ marginBottom: 16 }}>
        <div className="pcp-card pcp-card-pad" style={{ background: "var(--paper)" }}>
          <div className="pcp-kpi-label">PCF Released Amount</div>
          <div className="pcp-kpi-value pcp-num">{peso(disbursement.amount)}</div>
        </div>
        <div className="pcp-card pcp-card-pad" style={{ background: "var(--paper)" }}>
          <div className="pcp-kpi-label">Total Receipt Amount</div>
          <div className="pcp-kpi-value pcp-num">{peso(receiptSummary.approvedTotal)}</div>
          <div style={{ fontSize: 10.5, color: "var(--text-mut)", marginTop: 2 }}>
            {receiptSummary.approvedCount} of {receiptSummary.docCount} document(s) approved
          </div>
        </div>
        <div
          className="pcp-card pcp-card-pad"
          style={{ background: st.type === "reimburse" ? "var(--red-bg)" : st.type === "excess" ? "var(--amber-bg)" : "var(--green-bg)" }}
        >
          <div className="pcp-kpi-label">
            {st.type === "excess" ? "Refund / Excess Cash" : st.type === "reimburse" ? "Reimbursement Required" : "Difference"}
          </div>
          <div
            className="pcp-kpi-value pcp-num"
            style={{ color: st.type === "reimburse" ? "var(--brand)" : st.type === "excess" ? "var(--amber)" : "var(--green)" }}
          >
            {peso(st.expected)}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-mut)", marginTop: 2 }}>
            {st.type === "exact" ? "Fully reconciled" : st.type === "excess" ? "To be returned to the PCF Custodian" : "Owed to the PCF Requestor"}
          </div>
        </div>
      </div>

      {/* Automated computation + receipt-approval gate. Every total is derived
          from the individual supporting documents and cannot be edited. */}
      <div className="pcp-card pcp-card-pad" style={{ marginBottom: 16, background: "var(--paper)" }}>
        <div className="pcp-section-title" style={{ margin: "0 0 10px" }}>Automated Computation &amp; Receipt Approval</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontSize: 12.5 }}>
          <div><div className="pcp-kpi-label">Total Receipt Amount (approved docs)</div><div className="pcp-num" style={{ fontWeight: 700 }}>{peso(receiptSummary.approvedTotal)} <span style={{ color: "var(--text-mut)", fontWeight: 500 }}>({receiptSummary.approvedCount} doc{receiptSummary.approvedCount === 1 ? "" : "s"})</span></div></div>
          <div><div className="pcp-kpi-label">All Documents Encoded</div><div className="pcp-num" style={{ fontWeight: 700 }}>{peso(receiptSummary.allTotal)} <span style={{ color: "var(--text-mut)", fontWeight: 500 }}>({receiptSummary.docCount} doc{receiptSummary.docCount === 1 ? "" : "s"})</span></div></div>
          <div><div className="pcp-kpi-label">Receipts Approved</div><div className="pcp-num" style={{ fontWeight: 700 }}>{approvalSummary.approved} / {approvalSummary.total}</div></div>
          <div>
            <div className="pcp-kpi-label">Amounts Captured</div>
            <div className="pcp-num" style={{ fontWeight: 700, color: receiptSummary.missing ? "var(--amber)" : "var(--green)" }}>
              {receiptSummary.amountBearing - receiptSummary.missing} / {receiptSummary.amountBearing}
            </div>
            {receiptSummary.exemptByType > 0 && (
              <div style={{ fontSize: 10, color: "var(--text-mut)", marginTop: 1 }}>
                {receiptSummary.exemptByType} supporting doc(s) need no amount
              </div>
            )}
          </div>
          <div><div className="pcp-kpi-label">Encoded Expense Lines</div><div className="pcp-num" style={{ fontWeight: 700 }}>{peso(total)} <span style={{ color: "var(--text-mut)", fontWeight: 500 }}>({validLines.length} line{validLines.length === 1 ? "" : "s"})</span></div></div>
        </div>

        {receiptSummary.missing > 0 && (
          <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: 8, fontSize: 12, background: "var(--amber-bg)", color: "var(--amber)" }}>
            <AlertTriangle size={13} style={{ verticalAlign: "-2px" }} /> <strong>{receiptSummary.missing} document(s) have no receipt amount.</strong> Every supporting document needs its actual amount before this liquidation can be submitted.
          </div>
        )}

        {/* The expense lines feed the COA / Acumatica export while the document
            amounts drive the cash settlement — they should agree. */}
        {receiptSummary.docCount > 0 && linesVsReceipts !== 0 && (
          <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: 8, fontSize: 12, background: "var(--amber-bg)", color: "var(--amber)" }}>
            <AlertTriangle size={13} style={{ verticalAlign: "-2px" }} /> <strong>Encoded expense lines ({peso(total)}) do not match the approved receipts ({peso(receiptSummary.approvedTotal)}).</strong> Difference of {peso(Math.abs(linesVsReceipts))} — the expense breakdown is what gets exported to Acumatica, so reconcile the two before submitting.
          </div>
        )}
        <div style={{ marginTop: 12, padding: "9px 12px", borderRadius: 8, fontSize: 12,
          background: overallApproval === "For Revision" ? "var(--red-bg)" : (canSubmitFinal ? "var(--green-bg)" : "var(--amber-bg)"),
          color: overallApproval === "For Revision" ? "var(--brand-dark)" : (canSubmitFinal ? "var(--green)" : "var(--amber)") }}>
          {approvalSummary.total === 0 && <>Upload each Official Receipt / Sales Invoice above. Every receipt must be reviewed and approved by {RECEIPT_APPROVER_NAME} before the liquidation can be submitted.</>}
          {approvalSummary.total > 0 && overallApproval === "For Revision" && <><AlertTriangle size={13} style={{ verticalAlign: "-2px" }} /> <strong>For Revision</strong> — {approvalSummary.rejected} receipt(s) were rejected. Replace or correct only the rejected receipt(s), then re-save.</>}
          {approvalSummary.total > 0 && overallApproval === "Pending Approval" && <><strong>Pending Approval</strong> — {approvalSummary.pending} receipt(s) awaiting {RECEIPT_APPROVER_NAME}'s approval. Final liquidation cannot be submitted yet.</>}
          {canSubmitFinal && <><Check size={13} style={{ verticalAlign: "-2px" }} /> <strong>All receipts approved</strong> — this liquidation is ready for final submission.</>}
        </div>
      </div>

      {/* Cash Settlement — the final step of the liquidation. The settlement
          type is auto-classified from the variance between the cash released and
          the approved receipt total and can never be hand-picked. Ticking the
          box asserts that the cash HAS actually moved, so the liquidation only
          becomes LIQUIDATED once the recorded actual amount equals the expected
          amount (and, for over-liquidation, a reviewer has signed off). */}
      <div className="pcp-card pcp-card-pad" style={{ marginBottom: 16, background: "var(--paper)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="pcp-section-title" style={{ margin: 0 }}>Cash Settlement</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-mut)" }}>Settlement Status</span>
            <Badge status={st.settled ? "SETTLED" : "UNSETTLED"} />
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontSize: 12.5, marginBottom: 12 }}>
          <div><div className="pcp-kpi-label">PCF Released Amount</div><div className="pcp-num" style={{ fontWeight: 700 }}>{peso(st.released)}</div></div>
          <div><div className="pcp-kpi-label">Total Receipt Amount</div><div className="pcp-num" style={{ fontWeight: 700 }}>{peso(st.receiptTotal)}</div></div>
          <div><div className="pcp-kpi-label">Difference</div><div className="pcp-num" style={{ fontWeight: 700, color: st.type === "reimburse" ? "var(--brand)" : st.type === "excess" ? "var(--amber)" : "var(--green)" }}>{st.difference < 0 ? "-" : ""}{peso(Math.abs(st.difference))}</div></div>
        </div>

        {/* Auto-classification of what has to happen, if anything. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { key: "excess", label: "Excess Cash Returned to PCF Custodian", desc: "Receipts came to less than the cash released — the requestor returns the unused cash." },
            { key: "reimburse", label: "Reimbursed by PCF Custodian to PCF Requestor", desc: "Receipts exceeded the cash released — the custodian reimburses the shortfall." },
            { key: "exact", label: "Exact Amount — No Refund, No Reimbursement", desc: "Receipts match the cash released exactly, so no cash settlement is required." },
          ].map((opt) => {
            const active = st.type === opt.key;
            /* For the two settlement types the tick means "already completed";
               for the exact case nothing needs to move, so it is inherently done. */
            const ticked = active && (opt.key === "exact" ? true : st.completed);
            return (
              <label key={opt.key} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "9px 11px", borderRadius: 8,
                border: "1px solid " + (active ? "var(--brand)" : "var(--line)"),
                background: active ? "var(--red-bg)" : "transparent", cursor: "default" }}>
                <input type="checkbox" checked={ticked} readOnly style={{ marginTop: 2, pointerEvents: "none" }} />
                <span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: active ? "var(--brand-dark)" : "var(--text)" }}>{opt.label}</span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--text-mut)", marginTop: 1 }}>{opt.desc}</span>
                </span>
              </label>
            );
          })}
        </div>

        {/* Expected vs actual — the control that turns an intention into a fact. */}
        {st.type !== "exact" && (
          <div style={{ marginTop: 12, padding: "11px 12px", borderRadius: 8, border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-end" }}>
              <div>
                <div className="pcp-kpi-label">{st.type === "excess" ? "Expected Return Amount" : "Expected Reimbursement"}</div>
                <div className="pcp-num" style={{ fontWeight: 700, fontSize: 14 }}>{peso(st.expected)}</div>
              </div>
              <div>
                <div className="pcp-kpi-label">{st.type === "excess" ? "Actual Return Amount" : "Actual Reimbursement"}</div>
                {st.completed ? (
                  <div className="pcp-num" style={{ fontWeight: 700, fontSize: 14, color: st.matches ? "var(--green)" : "var(--brand)" }}>
                    {peso(st.actual)}{!st.matches && " (does not match)"}
                  </div>
                ) : (
                  <input
                    type="number" min="0" step="0.01" className="pcp-input"
                    style={{ width: 140 }}
                    placeholder={String(st.expected.toFixed(2))}
                    value={actualInput}
                    onChange={(e) => setActualInput(e.target.value)}
                  />
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {st.completed ? (
                  <button className="pcp-btn pcp-btn-sm" onClick={handleUndoSettlement}>
                    <X size={12} /> Clear Settlement
                  </button>
                ) : (
                  <button
                    className="pcp-btn pcp-btn-sm pcp-btn-primary"
                    onClick={handleRecordSettlement}
                    disabled={!saved || !receiptSummary.complete || !approvalSummary.allApproved}
                    title={
                      !saved ? "Save your changes first"
                        : !receiptSummary.complete ? "Every document needs a receipt amount first"
                          : !approvalSummary.allApproved ? `All receipts must be approved by ${RECEIPT_APPROVER_NAME} first`
                            : "Confirm the cash has actually been settled"
                    }
                  >
                    <Check size={12} /> {st.type === "excess" ? "Record Cash Returned" : "Record Reimbursement Paid"}
                  </button>
                )}
              </div>
            </div>
            {st.completed && st.settlement && (
              <div style={{ fontSize: 10.5, color: "var(--text-mut)", marginTop: 7 }}>
                Recorded by {st.settlement.recordedBy} · {(st.settlement.recordedAt || "").replace("T", " ")}
              </div>
            )}
            {!st.completed && (
              <div style={{ fontSize: 11, color: "var(--text-mut)", marginTop: 7 }}>
                Tick this off only once the cash has physically changed hands. The liquidation stays <strong>NOT YET LIQUIDATED</strong> until then.
              </div>
            )}
          </div>
        )}

        {/* Over-liquidation must be investigated by an approver — it can never
            settle automatically. */}
        {st.needsReview && (
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "var(--red-bg)", color: "var(--brand-dark)", fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <AlertTriangle size={13} style={{ verticalAlign: "-2px" }} /> <strong>WARNING: total receipt amount exceeds the PCF released amount by {peso(st.expected)}.</strong>
                <div style={{ marginTop: 3 }}>
                  {st.reviewed
                    ? <>Reviewed by {st.settlement.reviewedBy} · {(st.settlement.reviewedAt || "").replace("T", " ")}{st.settlement.reviewRemarks ? ` · "${st.settlement.reviewRemarks}"` : ""}</>
                    : <>This liquidation will not be approved automatically. A reviewer must investigate the discrepancy before it can be liquidated.</>}
                </div>
              </div>
              {canApproveReceipts && !st.reviewed && (
                <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={handleReview}>
                  <ShieldCheck size={12} /> Record Review
                </button>
              )}
            </div>
          </div>
        )}

        {/* Final verdict. */}
        <div style={{ marginTop: 12, display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap", paddingTop: 11, borderTop: "1px solid var(--line)" }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Liquidation Status</span>
          <Badge status={finalStatus} />
          <span style={{ fontSize: 11.5, color: "var(--text-mut)" }}>
            {finalStatus === "LIQUIDATED" && (st.type === "exact"
              ? <>Receipts match the cash released exactly — no cash settlement was required.</>
              : st.type === "excess"
                ? <>{peso(st.actual)} in excess cash was returned to the PCF Custodian.</>
                : <>{peso(st.actual)} was reimbursed to the PCF Requestor.</>)}
            {finalStatus === "Under Review" && <>Awaiting a reviewer's findings on the over-liquidation.</>}
            {finalStatus === "For Revision" && <>{approvalSummary.rejected} receipt(s) were rejected — correct them and re-save.</>}
            {finalStatus === "Not Liquidated" && <>No supporting documents uploaded yet.</>}
            {finalStatus === "NOT YET LIQUIDATED" && (
              !receiptSummary.complete ? <>Capture the receipt amount on every supporting document.</>
                : !approvalSummary.allApproved ? <>Awaiting {RECEIPT_APPROVER_NAME}'s approval of all receipts.</>
                  : st.completed && !st.matches ? <>The actual amount recorded ({peso(st.actual)}) does not match the expected {peso(st.expected)}.</>
                    : <>{st.type === "excess" ? `${peso(st.expected)} in excess cash must be returned to the PCF Custodian.` : `${peso(st.expected)} must be reimbursed to the PCF Requestor.`}</>
            )}
          </span>
        </div>
      </div>

      <div className="pcp-liq-line-head">
        <div>Date</div><div>Expense</div><div>Expense Category (COA)</div><div>Department</div><div>Tax Category</div><div>Amount</div><div></div>
      </div>
      {lines.map((l) => (
        <div className="pcp-liq-line" key={l.id}>
          <input type="date" className="pcp-input" value={l.date} onChange={(e) => updateLine(l.id, { date: e.target.value })} />
          <input className="pcp-input" placeholder="e.g. Meals, Fuel, Toll Fee" value={l.expense} onChange={(e) => updateLine(l.id, { expense: e.target.value })} />
          <select className="pcp-select" value={l.category} onChange={(e) => updateLine(l.id, { category: e.target.value })}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="pcp-select" value={l.department} onChange={(e) => updateLine(l.id, { department: e.target.value })}>
            {SUBACCOUNTS.filter((s) => s.desc).map((s) => <option key={s.code} value={s.code}>{s.desc}</option>)}
          </select>
          <select className="pcp-select" value={l.taxCategory || ""} onChange={(e) => updateLine(l.id, { taxCategory: e.target.value })}>
            <option value="">— None —</option>
            {TAX_CATEGORIES.map((t) => <option key={t.code} value={t.code} title={t.desc}>{t.code} — {t.desc}</option>)}
          </select>
          <input type="number" min="0" step="0.01" className="pcp-input" placeholder="0.00" value={l.amount} onChange={(e) => updateLine(l.id, { amount: e.target.value })} />
          <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" onClick={() => removeLine(l.id)} disabled={lines.length === 1}>
            <Trash2 size={13} color="var(--brand)" />
          </button>
        </div>
      ))}
      <button className="pcp-btn pcp-btn-sm" onClick={addLine} style={{ marginTop: 4 }}><Plus size={12} /> Add Receipt Line</button>

      {/* Supporting documents */}
      <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="pcp-section-title" style={{ margin: 0 }}>
            <Receipt size={15} color="#c8102e" /> Supporting Documents
            <span style={{ fontSize: 11.5, color: "var(--text-mut)", fontWeight: 500, marginLeft: 6 }}>
              ({attachments.length}) — official receipts, sales invoices, etc. · Total Receipt Amount <strong className="pcp-num">{peso(receiptSummary.approvedTotal)}</strong>
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {canApproveReceipts && approvalSummary.total > 0 && approvalSummary.pending > 0 && (
              <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={approveAllReceipts} title={`Approve all pending receipts as ${RECEIPT_APPROVER_NAME}`}>
                <Check size={12} /> Approve All ({approvalSummary.pending})
              </button>
            )}
            <label
              className="pcp-btn pcp-btn-sm"
              style={{ cursor: amountsLocked ? "not-allowed" : "pointer", margin: 0, opacity: amountsLocked ? 0.5 : 1 }}
              title={amountsLocked ? "This liquidation has been submitted — ask a receipt approver to reopen it." : "Attach a supporting document"}
            >
              <Download size={12} style={{ transform: "rotate(180deg)" }} /> Upload
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                style={{ display: "none" }}
                disabled={amountsLocked}
                onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }}
              />
            </label>
          </div>
        </div>

        {uploadNote && (
          <div style={{ background: "var(--amber-bg)", color: "var(--amber)", fontSize: 11.5, padding: "8px 11px", borderRadius: 8, marginBottom: 10 }}>
            {uploadNote}
          </div>
        )}

        {dupNote && (
          <div style={{ background: "var(--red-bg)", color: "var(--brand-dark)", fontSize: 11.5, padding: "8px 11px", borderRadius: 8, marginBottom: 10, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            <span><AlertTriangle size={13} style={{ verticalAlign: "-2px" }} /> {dupNote}</span>
            <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" onClick={() => setDupNote("")} title="Dismiss"><X size={12} /></button>
          </div>
        )}

        {attachments.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {attachments.map((a) => {
              const pa = persistedById(a.id);
              const status = (pa && pa.approvalStatus) || a.approvalStatus || "Pending";
              const history = (pa && pa.approvalHistory) || a.approvalHistory || [];
              const amtHistory = (pa && pa.amountHistory) || a.amountHistory || [];
              const isSaved = !!pa;
              /* General supporting documents carry no peso figure, so their
                 amount and reference number stay optional. */
              const needsAmount = docRequiresAmount(a);
              const amountMissing = needsAmount && status !== "Rejected" && !(Number(a.receiptAmount) > 0);
              const isImage = (a.type || "").startsWith("image");
              const isPdf = (a.type || "").includes("pdf");
              return (
              <div key={a.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 11px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <FileText size={15} color="#2054a3" style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                    <div style={{ fontSize: 10.5, color: "var(--text-mut)" }}>
                      {(a.size / 1024).toFixed(0)} KB · {(a.type || "file")} · uploaded {fmtDate(a.uploadedAt)}
                    </div>
                  </div>
                  <Badge status={status} />
                  <a className="pcp-btn pcp-btn-sm" href={a.data} target="_blank" rel="noopener noreferrer" title="Open full size / zoom"><Search size={12} /> Zoom</a>
                  <a className="pcp-btn pcp-btn-sm" href={a.data} download={a.name} title="Download receipt"><Download size={12} /></a>
                  {canApproveReceipts && isSaved && (
                    <>
                      <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={() => approveReceipt(a)} disabled={status === "Approved"} title="Approve receipt"><Check size={12} /></button>
                      <button className="pcp-btn pcp-btn-sm pcp-btn-danger" onClick={() => rejectReceipt(a)} disabled={status === "Rejected"} title="Reject receipt"><X size={12} /></button>
                    </>
                  )}
                  <button
                    className="pcp-btn pcp-btn-sm pcp-btn-ghost"
                    onClick={() => removeAttachment(a.id)}
                    disabled={amountsLocked}
                    title={amountsLocked ? "This liquidation has been submitted" : "Remove"}
                  ><Trash2 size={13} color="var(--brand)" /></button>
                </div>

                {/* Receipt Amount is captured against THIS document, so the
                    liquidation total is always the sum of its own documents and
                    each receipt stays independently auditable. */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginTop: 8 }}>
                  <div style={{ minWidth: 200 }}>
                    <div className="pcp-kpi-label">Document Type</div>
                    <select
                      className="pcp-select" value={a.docType || DEFAULT_DOC_TYPE} disabled={amountsLocked}
                      onChange={(e) => updateAttachment(a.id, { docType: e.target.value })}
                    >
                      {RECEIPT_DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ minWidth: 145 }}>
                    <div className="pcp-kpi-label">
                      Receipt / Invoice No. <span style={{ color: "var(--text-mut)", fontWeight: 500 }}>(optional)</span>
                    </div>
                    <input
                      className="pcp-input" placeholder={needsAmount ? "e.g. OR-1234" : "—"} value={a.receiptNo || ""} readOnly={amountsLocked}
                      onChange={(e) => updateAttachment(a.id, { receiptNo: e.target.value })}
                    />
                  </div>
                  <div style={{ minWidth: 150 }}>
                    <div className="pcp-kpi-label">
                      Receipt Amount (&#8369;) {needsAmount
                        ? <span style={{ color: "var(--brand)" }}>*</span>
                        : <span style={{ color: "var(--text-mut)", fontWeight: 500 }}>(optional)</span>}
                    </div>
                    <input
                      type="number" min="0" step="0.01" className="pcp-input"
                      placeholder={needsAmount ? "0.00" : "—"}
                      value={a.receiptAmount == null ? "" : a.receiptAmount}
                      readOnly={amountsLocked}
                      onChange={(e) => setReceiptAmount(a.id, e.target.value)}
                      style={amountMissing ? { borderColor: "var(--brand)" } : undefined}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 130, textAlign: "right" }}>
                    <div className="pcp-kpi-label">Counted in Total</div>
                    <div className="pcp-num" style={{ fontWeight: 700, color: status === "Approved" ? "var(--green)" : "var(--text-mut)" }}>
                      {status === "Approved" ? peso(receiptAmountOf(a)) : "—"}
                    </div>
                  </div>
                </div>
                {amountMissing && (
                  <div style={{ fontSize: 10.5, color: "var(--brand)", marginTop: 5 }}>
                    Receipt amount is required before this liquidation can be submitted.
                  </div>
                )}
                {!needsAmount && !(Number(a.receiptAmount) > 0) && (
                  <div style={{ fontSize: 10.5, color: "var(--text-mut)", marginTop: 5 }}>
                    No amount needed for a general supporting document. Enter one only if this document shows a peso amount that forms part of the liquidation.
                  </div>
                )}
                {status !== "Approved" && status !== "Rejected" && Number(a.receiptAmount) > 0 && (
                  <div style={{ fontSize: 10.5, color: "var(--text-mut)", marginTop: 5 }}>
                    Excluded from the total until {RECEIPT_APPROVER_NAME} approves this document.
                  </div>
                )}
                {amountsLocked && (
                  <div style={{ fontSize: 10.5, color: "var(--text-mut)", marginTop: 5 }}>
                    Read-only — this liquidation has been submitted. A receipt approver can reopen it or correct the amount.
                  </div>
                )}

                {/* Inline preview — the receipt is visible directly on the page,
                    no "View" click needed (mirrors the reimbursement module). */}
                <div style={{ marginTop: 8, border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", background: "#f4f6f9" }}>
                  {isImage ? (
                    <img src={a.data} alt={a.name} style={{ display: "block", width: "100%", maxHeight: 320, objectFit: "contain" }} />
                  ) : isPdf ? (
                    <iframe title={a.name} src={a.data} style={{ width: "100%", height: 320, border: "none" }} />
                  ) : (
                    <div style={{ padding: 24, textAlign: "center", fontSize: 11.5, color: "var(--text-mut)" }}>
                      Preview not available for this file type — use Zoom or Download to open it.
                    </div>
                  )}
                </div>

                {canApproveReceipts && !isSaved && (
                  <div style={{ fontSize: 10.5, color: "var(--amber)", marginTop: 5 }}>Save the liquidation to enable approval of this receipt.</div>
                )}
                {history.length > 0 && (
                  <div style={{ marginTop: 7, borderTop: "1px dashed var(--line)", paddingTop: 6 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-mut)", marginBottom: 3 }}>Approval History</div>
                    {history.map((h, i) => (
                      <div key={i} style={{ fontSize: 10.5, color: "var(--text-mut)" }}>
                        <strong style={{ color: h.status === "Rejected" ? "var(--brand)" : "var(--green)" }}>{h.status}</strong> by {h.approver} · {h.ts.replace("T", " ")}{h.remarks ? ` · "${h.remarks}"` : ""}
                      </div>
                    ))}
                  </div>
                )}

                {/* Receipt-amount audit trail, tied to this document. */}
                {amtHistory.length > 0 && (
                  <div style={{ marginTop: 7, borderTop: "1px dashed var(--line)", paddingTop: 6 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-mut)", marginBottom: 3 }}>Receipt Amount History</div>
                    {amtHistory.map((h, i) => (
                      <div key={i} style={{ fontSize: 10.5, color: "var(--text-mut)" }}>
                        {h.prevAmount == null ? <>Set to <strong>{peso(h.newAmount)}</strong></> : <>{peso(h.prevAmount)} → <strong>{peso(h.newAmount)}</strong></>}
                        {" "}by {h.user} · {(h.ts || "").replace("T", " ")}{h.reason ? ` · "${h.reason}"` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              );
            })}

            {/* Total is recalculated from the document rows above. */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 24, borderTop: "2px solid var(--line)", paddingTop: 10, flexWrap: "wrap" }}>
              <div style={{ textAlign: "right" }}>
                <div className="pcp-kpi-label">All Documents</div>
                <div className="pcp-num" style={{ fontWeight: 700 }}>{peso(receiptSummary.allTotal)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="pcp-kpi-label">Total Receipt Amount (approved only)</div>
                <div className="pcp-num" style={{ fontWeight: 700, fontSize: 15 }}>{peso(receiptSummary.approvedTotal)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "var(--text-mut)", padding: "10px 0" }}>
            No documents attached yet. Click <strong>Upload</strong> to attach scanned receipts or invoices (images or PDF, up to 2 MB each).
          </div>
        )}
      </div>

      {remaining < 0 && (
        <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center", background: "var(--red-bg)", padding: "10px 12px", borderRadius: 8, fontSize: 12, color: "var(--brand-dark)" }}>
          <AlertTriangle size={15} /> The encoded expense lines ({peso(total)}) exceed the cash advance by {peso(Math.abs(remaining))}. Check them against the Cash Settlement above, which is computed from the approved receipt amounts.
        </div>
      )}
    </div>
  );
}

function LiquidationTab({
  disbursements, liquidations, onSaveLiquidation, onExport, onExportAll, plantOptions, plantTitle,
  canApproveReceipts, onDecideReceipt, onSubmitLiquidation, onReopenLiquidation,
  onRecordSettlement, onReviewOverLiquidation, canDelete, onDeleteLiquidation,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [plant, setPlant] = useState("ALL");

  const scoped = plant === "ALL" ? disbursements : disbursements.filter((d) => d.branchCode === plant);
  const enriched = scoped.map((d) => ({
    ...d,
    liqStatus: liqStatusFor(d, liquidations),
    finalStatus: liqFinalStatus(d, liquidationFor(d.id, liquidations)),
  }));
  /* A voucher stays on the worklist until it is genuinely LIQUIDATED — that is,
     until any refund or reimbursement has actually been settled. */
  const list = showAll ? enriched : enriched.filter((d) => d.finalStatus !== "LIQUIDATED");
  const selected = enriched.find((d) => d.id === selectedId) || list[0] || null;
  const exportableCount = disbursements.filter((d) => {
    const liq = liquidationFor(d.id, liquidations);
    return liq && liq.lines && liq.lines.length;
  }).length;

  return (
    <div>
      <TopBar
        title={(plantTitle ? plantTitle + " \u00b7 " : "") + "Liquidation"}
        sub="Break down each cash advance into itemized receipts and reconcile the balance"
        right={
          <button className="pcp-btn pcp-btn-primary" onClick={onExportAll} disabled={!exportableCount}>
            <Download size={14} /> Export All to Acumatica
          </button>
        }
      />
      <div className="pcp-content">
        <PlantScopeTabs plants={plantOptions} value={plant} onChange={(v) => { setPlant(v); setSelectedId(null); }} />
        <div className="pcp-grid-2" style={{ gridTemplateColumns: "340px 1fr" }}>
          <div className="pcp-card pcp-card-pad">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="pcp-section-title" style={{ margin: 0 }}>Vouchers</div>
              <label style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 5, color: "var(--text-mut)" }}>
                <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show all
              </label>
            </div>
            {list.length ? list.map((d) => (
              <div key={d.id} className={"pcp-voucher-card" + (selected && selected.id === d.id ? " active" : "")} onClick={() => setSelectedId(d.id)}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ fontSize: 12.5 }}>{d.voucherNo}</strong>
                  <span className="pcp-num" style={{ fontSize: 12.5, fontWeight: 700 }}>{peso(d.amount)}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-mut)", marginTop: 2 }}>{d.employee} · {d.branchCode}</div>
                <div style={{ marginTop: 6, display: "flex", gap: 5, flexWrap: "wrap" }}>
                  <Badge status={d.liqStatus} />
                  <Badge status={d.finalStatus} />
                </div>
              </div>
            )) : <div className="pcp-empty">{showAll ? "No vouchers yet" : "Every voucher is fully liquidated and settled"}</div>}
          </div>

          {selected ? (
            <LiquidationWorksheet
              disbursement={selected}
              liquidation={liquidationFor(selected.id, liquidations)}
              onSave={onSaveLiquidation}
              onExport={onExport}
              canApproveReceipts={canApproveReceipts}
              onDecideReceipt={onDecideReceipt}
              liquidations={liquidations}
              disbursements={disbursements}
              onSubmitLiquidation={onSubmitLiquidation}
              onReopenLiquidation={onReopenLiquidation}
              onRecordSettlement={onRecordSettlement}
              onReviewOverLiquidation={onReviewOverLiquidation}
              canDelete={canDelete}
              onDeleteLiquidation={onDeleteLiquidation}
            />
          ) : (
            <div className="pcp-card pcp-card-pad"><div className="pcp-empty">Select a voucher to begin liquidation</div></div>
          )}
        </div>
      </div>
    </div>
  );
}
