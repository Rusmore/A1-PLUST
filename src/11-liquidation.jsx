/* ============================= LIQUIDATION ============================= */

/* Only this named approver (Ma'am Grace Gan) may review and approve liquidation
   receipts before they are processed. */
const RECEIPT_APPROVER_NAME = "Grace Gan";

/* Cash settlement classification derived from the variance between the cash
   released (advance) and the total liquidated expenses. Mirrors common petty
   cash voucher practice: a positive difference means unused cash is returned,
   a negative difference means the employee is reimbursed the shortfall. */
function cashSettlement(cashReleased, totalLiquidated) {
  const difference = Math.round((cashReleased - totalLiquidated) * 100) / 100;
  let type;
  if (difference > 0) type = "excess";        // released more than spent → return cash
  else if (difference < 0) type = "reimburse"; // spent more than released → reimburse employee
  else type = "exact";
  return { difference, type };
}

function emptyLine() {
  return { id: uid("ln"), date: todayISO(), expense: "", category: EXPENSE_CATEGORIES[0], department: SUBACCOUNTS[1].code, amount: "", taxCategory: "" };
}

function LiquidationWorksheet({ disbursement, liquidation, onSave, onExport, canApproveReceipts, onDecideReceipt }) {
  const [lines, setLines] = useState(liquidation ? liquidation.lines.map((l) => ({ ...l })) : [emptyLine()]);
  const [attachments, setAttachments] = useState(liquidation && liquidation.attachments ? liquidation.attachments : []);
  const [saved, setSaved] = useState(true);
  const [uploadNote, setUploadNote] = useState("");

  useEffect(() => {
    setLines(liquidation ? liquidation.lines.map((l) => ({ ...l })) : [emptyLine()]);
    setAttachments(liquidation && liquidation.attachments ? liquidation.attachments : []);
    setSaved(true);
    setUploadNote("");
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
        setAttachments((as) => [...as, {
          id: uid("att"), name: file.name, type: file.type || "file",
          size: file.size, data: reader.result, uploadedAt: todayISO(),
          approvalStatus: "Pending", approvalHistory: [],
        }]);
        setSaved(false);
      };
      reader.readAsDataURL(file);
    });
  };
  const removeAttachment = (id) => { setAttachments((as) => as.filter((a) => a.id !== id)); setSaved(false); };

  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const remaining = disbursement.amount - total;
  const validLines = lines.filter((l) => l.expense.trim() && Number(l.amount) > 0);

  /* Auto-computed cash settlement — the settlement type is derived, never
     hand-picked, so it always matches the variance between the released cash
     and the liquidated expenses. */
  const settlement = cashSettlement(disbursement.amount, total);

  /* Receipt approval state is read from the PERSISTED liquidation so that
     Grace Gan's decisions (saved immediately) are reflected here regardless of
     unsaved worksheet edits. */
  const persistedById = (id) => ((liquidation && liquidation.attachments) || []).find((a) => a.id === id);
  const approvalSummary = receiptApprovalSummary(liquidation);
  const overallApproval = liqApprovalStatus(liquidation);
  const canSubmitFinal = approvalSummary.total > 0 && approvalSummary.allApproved;

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

  const handleSave = () => {
    onSave(disbursement.id, validLines.map((l) => ({ ...l, amount: Number(l.amount) })), attachments);
    setSaved(true);
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
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="pcp-btn pcp-btn-sm" onClick={() => onExport(disbursement, { lines: validLines })} disabled={!validLines.length}>
            <Download size={12} /> Export to Excel
          </button>
          <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={handleSave}>
            {saved ? "Saved" : "Save Liquidation"}
          </button>
        </div>
      </div>

      <div className="pcp-grid-3" style={{ marginBottom: 16 }}>
        <div className="pcp-card pcp-card-pad" style={{ background: "var(--paper)" }}>
          <div className="pcp-kpi-label">Requested Amount</div>
          <div className="pcp-kpi-value pcp-num">{peso(disbursement.amount)}</div>
        </div>
        <div className="pcp-card pcp-card-pad" style={{ background: "var(--paper)" }}>
          <div className="pcp-kpi-label">Total Liquidated</div>
          <div className="pcp-kpi-value pcp-num">{peso(total)}</div>
        </div>
        <div className="pcp-card pcp-card-pad" style={{ background: remaining < 0 ? "var(--red-bg)" : "var(--green-bg)" }}>
          <div className="pcp-kpi-label">{remaining < 0 ? "Over-Liquidation" : "Remaining Cash"}</div>
          <div className="pcp-kpi-value pcp-num" style={{ color: remaining < 0 ? "var(--brand)" : "var(--green)" }}>
            {peso(Math.abs(remaining))}
          </div>
        </div>
      </div>

      {/* Automated computation + receipt-approval gate. Totals are computed
          automatically from the encoded receipt lines and cannot be edited. */}
      <div className="pcp-card pcp-card-pad" style={{ marginBottom: 16, background: "var(--paper)" }}>
        <div className="pcp-section-title" style={{ margin: "0 0 10px" }}>Automated Computation &amp; Receipt Approval</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontSize: 12.5 }}>
          <div><div className="pcp-kpi-label">Total Amount of Receipts</div><div className="pcp-num" style={{ fontWeight: 700 }}>{peso(total)} <span style={{ color: "var(--text-mut)", fontWeight: 500 }}>({validLines.length} line{validLines.length === 1 ? "" : "s"})</span></div></div>
          <div><div className="pcp-kpi-label">Receipts Approved</div><div className="pcp-num" style={{ fontWeight: 700 }}>{approvalSummary.approved} / {approvalSummary.total}</div></div>
          <div><div className="pcp-kpi-label">Reimbursable Amount</div><div className="pcp-num" style={{ fontWeight: 700 }}>{peso(total)}</div></div>
          <div><div className="pcp-kpi-label">Remaining Balance</div><div className="pcp-num" style={{ fontWeight: 700, color: remaining < 0 ? "var(--brand)" : "var(--green)" }}>{peso(Math.abs(remaining))}{remaining < 0 ? " (owed to employee)" : ""}</div></div>
        </div>
        <div style={{ marginTop: 12, padding: "9px 12px", borderRadius: 8, fontSize: 12,
          background: overallApproval === "For Revision" ? "var(--red-bg)" : (canSubmitFinal ? "var(--green-bg)" : "var(--amber-bg)"),
          color: overallApproval === "For Revision" ? "var(--brand-dark)" : (canSubmitFinal ? "var(--green)" : "var(--amber)") }}>
          {approvalSummary.total === 0 && <>Upload each Official Receipt / Sales Invoice above. Every receipt must be reviewed and approved by {RECEIPT_APPROVER_NAME} before the liquidation can be submitted.</>}
          {approvalSummary.total > 0 && overallApproval === "For Revision" && <><AlertTriangle size={13} style={{ verticalAlign: "-2px" }} /> <strong>For Revision</strong> — {approvalSummary.rejected} receipt(s) were rejected. Replace or correct only the rejected receipt(s), then re-save.</>}
          {approvalSummary.total > 0 && overallApproval === "Pending Approval" && <><strong>Pending Approval</strong> — {approvalSummary.pending} receipt(s) awaiting {RECEIPT_APPROVER_NAME}'s approval. Final liquidation cannot be submitted yet.</>}
          {canSubmitFinal && <><Check size={13} style={{ verticalAlign: "-2px" }} /> <strong>All receipts approved</strong> — this liquidation is ready for final submission.</>}
        </div>
      </div>

      {/* Cash Settlement — auto-classified from the variance between cash
          released and total liquidated expenses. The selected option is derived
          automatically and cannot be hand-picked. */}
      <div className="pcp-card pcp-card-pad" style={{ marginBottom: 16, background: "var(--paper)" }}>
        <div className="pcp-section-title" style={{ margin: "0 0 10px" }}>Cash Settlement</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontSize: 12.5, marginBottom: 12 }}>
          <div><div className="pcp-kpi-label">Cash Released (PCF)</div><div className="pcp-num" style={{ fontWeight: 700 }}>{peso(disbursement.amount)}</div></div>
          <div><div className="pcp-kpi-label">Total Liquidated Expenses</div><div className="pcp-num" style={{ fontWeight: 700 }}>{peso(total)}</div></div>
          <div><div className="pcp-kpi-label">Difference</div><div className="pcp-num" style={{ fontWeight: 700, color: settlement.type === "reimburse" ? "var(--brand)" : settlement.type === "excess" ? "var(--green)" : "var(--text)" }}>{settlement.difference < 0 ? "-" : ""}{peso(Math.abs(settlement.difference))}</div></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { key: "excess", label: "Excess Cash Returned", desc: "Employee returned the unused cash to the PCF Custodian." },
            { key: "reimburse", label: "Additional Reimbursement Required", desc: "Actual expenses exceeded the cash released and require reimbursement." },
            { key: "exact", label: "Exact Amount", desc: "No excess cash returned and no reimbursement required." },
          ].map((opt) => {
            const active = settlement.type === opt.key;
            return (
              <label key={opt.key} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "9px 11px", borderRadius: 8,
                border: "1px solid " + (active ? "var(--brand)" : "var(--line)"),
                background: active ? "var(--red-bg)" : "transparent", cursor: "default" }}>
                <input type="checkbox" checked={active} readOnly style={{ marginTop: 2, pointerEvents: "none" }} />
                <span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: active ? "var(--brand-dark)" : "var(--text)" }}>{opt.label}</span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--text-mut)", marginTop: 1 }}>{opt.desc}</span>
                </span>
              </label>
            );
          })}
        </div>
        <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--text-mut)" }}>
          {settlement.type === "excess" && <>Employee must return <strong>{peso(settlement.difference)}</strong> in unused cash to the PCF Custodian.</>}
          {settlement.type === "reimburse" && <>Employee is owed an additional reimbursement of <strong>{peso(Math.abs(settlement.difference))}</strong>.</>}
          {settlement.type === "exact" && <>Cash released matches the liquidated expenses exactly — no settlement required.</>}
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
              ({attachments.length}) — official receipts, sales invoices, etc.
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {canApproveReceipts && approvalSummary.total > 0 && approvalSummary.pending > 0 && (
              <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={approveAllReceipts} title={`Approve all pending receipts as ${RECEIPT_APPROVER_NAME}`}>
                <Check size={12} /> Approve All ({approvalSummary.pending})
              </button>
            )}
            <label className="pcp-btn pcp-btn-sm" style={{ cursor: "pointer", margin: 0 }}>
              <Download size={12} style={{ transform: "rotate(180deg)" }} /> Upload
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                style={{ display: "none" }}
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

        {attachments.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {attachments.map((a) => {
              const pa = persistedById(a.id);
              const status = (pa && pa.approvalStatus) || a.approvalStatus || "Pending";
              const history = (pa && pa.approvalHistory) || a.approvalHistory || [];
              const isSaved = !!pa;
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
                  <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" onClick={() => removeAttachment(a.id)} title="Remove"><Trash2 size={13} color="var(--brand)" /></button>
                </div>

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
              </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "var(--text-mut)", padding: "10px 0" }}>
            No documents attached yet. Click <strong>Upload</strong> to attach scanned receipts or invoices (images or PDF, up to 2 MB each).
          </div>
        )}
      </div>

      {remaining < 0 && (
        <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center", background: "var(--red-bg)", padding: "10px 12px", borderRadius: 8, fontSize: 12, color: "var(--brand-dark)" }}>
          <AlertTriangle size={15} /> Liquidated amount exceeds the cash advance. The custodian owes the employee {peso(Math.abs(remaining))}.
        </div>
      )}
    </div>
  );
}

function LiquidationTab({ disbursements, liquidations, onSaveLiquidation, onExport, onExportAll, plantOptions, plantTitle, canApproveReceipts, onDecideReceipt }) {
  const [selectedId, setSelectedId] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [plant, setPlant] = useState("ALL");

  const scoped = plant === "ALL" ? disbursements : disbursements.filter((d) => d.branchCode === plant);
  const enriched = scoped.map((d) => ({ ...d, liqStatus: liqStatusFor(d, liquidations) }));
  const list = showAll ? enriched : enriched.filter((d) => d.liqStatus !== "Fully Liquidated");
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
                <div style={{ marginTop: 6 }}><Badge status={d.liqStatus} /></div>
              </div>
            )) : <div className="pcp-empty">{showAll ? "No vouchers yet" : "Every voucher is fully liquidated"}</div>}
          </div>

          {selected ? (
            <LiquidationWorksheet
              disbursement={selected}
              liquidation={liquidationFor(selected.id, liquidations)}
              onSave={onSaveLiquidation}
              onExport={onExport}
              canApproveReceipts={canApproveReceipts}
              onDecideReceipt={onDecideReceipt}
            />
          ) : (
            <div className="pcp-card pcp-card-pad"><div className="pcp-empty">Select a voucher to begin liquidation</div></div>
          )}
        </div>
      </div>
    </div>
  );
}
