/* ============================= APP ============================= */

export default function App({ userEmail, userName, onSignOut, userRole, isAdmin, userPlants }) {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [funds, setFunds] = useState([]);
  const [requests, setRequests] = useState([]);
  const [disbursements, setDisbursements] = useState([]);
  const [liquidations, setLiquidations] = useState([]);
  const [replenishments, setReplenishments] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [reimbursements, setReimbursements] = useState([]);
  const [role, setRole] = useState(userRole || "Accounting");
  /* Non-admins are locked to their assigned role; admins may view-as any role. */
  useEffect(() => { setRole(userRole || "Accounting"); }, [userRole]);
  const guardedSetRole = useCallback((r) => { if (isAdmin) setRole(r); }, [isAdmin]);
  const [historyFilter, setHistoryFilter] = useState(null);
  const [disburseTarget, setDisburseTarget] = useState(null);
  const [showEditBalances, setShowEditBalances] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [saveTick, setSaveTick] = useState(0);
  /* True when the concurrency-safe per-record store (pcp_records) is missing in
     the cloud database. Surfaces a banner so an admin runs the setup SQL. */
  const [recordsUnavailable, setRecordsUnavailable] = useState(false);

  /* Plant-level access scope for this user (list of allowed branch codes).
     For management (userPlants === "ALL") the scope is derived LIVE from the
     funds master data, so any plant newly created in Funds & Master Data is
     automatically included across the dashboard, aging report, notifications
     and management reports — with no code change. */
  const allowedPlants = useMemo(() => {
    if (userPlants === "ALL" || !userPlants) {
      const codes = new Set(PLANT_CODES);
      funds.forEach((f) => { if (f.branchCode) codes.add(f.branchCode); });
      return Array.from(codes);
    }
    /* Explicitly granted plants (custodians) — trusted as configured, including
       any new plant codes assigned to them. */
    return Array.from(new Set(userPlants));
  }, [userPlants, funds]);
  /* Plant selector options in canonical order, then any additional master-data
     plants appended so new plants surface automatically. */
  const plantOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    PLANTS.forEach((p) => { if (allowedPlants.includes(p.code) && !seen.has(p.code)) { seen.add(p.code); out.push({ code: p.code, label: p.label }); } });
    funds.forEach((f) => { if (allowedPlants.includes(f.branchCode) && !seen.has(f.branchCode)) { seen.add(f.branchCode); out.push({ code: f.branchCode, label: f.label || plantLabel(f.branchCode) || f.branchCode }); } });
    return out;
  }, [allowedPlants, funds]);
  const inScope = useCallback((code) => allowedPlants.includes(code), [allowedPlants]);
  /* PCF Requestor prepares transactions only: full Requests + Liquidation (minus
     approval, already gated by isLiquidationApprover), but no approve/reject/
     release rights and Release Ledger is view-only. Every other role keeps full
     edit/approve/release within its scope. Checked on BOTH the assigned role and
     the role being viewed so an admin's "view as Requestor" is an honest preview. */
  const isRequestor = (userRole || "") === "Requestor" || role === "Requestor";
  const canEdit = true;
  const canApprove = !isRequestor;
  const canRelease = !isRequestor;
  const canEditLedger = !isRequestor;

  /* ---- Delete rights ----
     Deleting records is reserved for the SuperAdmin role (window.PCP_USERS in
     index.html) — Accounting and Finance cannot delete. Gated on BOTH the user's
     assigned role and the role currently being viewed, so an admin using
     "view as Custodian" sees an honest preview with the delete actions hidden. */
  const isSuperAdmin = (userRole || "") === "SuperAdmin" && role === "SuperAdmin";

  /* The sole authorized Liquidation Approver — only Grace Gan may approve or
     reject a liquidation. Matched by display name or configured email, and
     enforced again inside rejectLiquidation so a bypassed UI still fails. */
  const isLiquidationApprover = useMemo(() => {
    const name = (userName || "").trim().toLowerCase();
    const email = (userEmail || "").trim().toLowerCase();
    return name === RECEIPT_APPROVER_NAME.toLowerCase()
      || LIQUIDATION_APPROVER_EMAILS.map((e) => e.toLowerCase()).includes(email);
  }, [userName, userEmail]);

  /* Append an entry to the immutable audit trail, tagged with the signed-in user. */
  const logAudit = useCallback((action, entity, remarks) => {
    setAuditLog((log) => [...log, {
      id: uid("aud"), ts: new Date().toISOString().slice(0, 19), user: userName || role, action, entity, remarks: remarks || "",
    }]);
  }, [role, userName]);

  /* Record sign-in once per session, and sign-out via a wrapped handler. */
  const loginLoggedRef = useRef(false);
  /* Last-synced snapshot for per-record change detection (concurrency-safe save). */
  const syncedRef = useRef(null);
  useEffect(() => {
    if (!loaded || loginLoggedRef.current) return;
    loginLoggedRef.current = true;
    setAuditLog((log) => [...log, {
      id: uid("aud"), ts: new Date().toISOString().slice(0, 19),
      user: userName || (userEmail || "User"), action: "Signed In",
      entity: userEmail || "—", remarks: `Role: ${ROLES[role] ? ROLES[role].label : role}`,
    }]);
  }, [loaded]); // eslint-disable-line

  const handleSignOut = useCallback(() => {
    setAuditLog((log) => {
      const next = [...log, {
        id: uid("aud"), ts: new Date().toISOString().slice(0, 19),
        user: userName || (userEmail || "User"), action: "Signed Out",
        entity: userEmail || "—", remarks: "",
      }];
      try { saveState({ dataVersion: DATA_VERSION, funds, requests, disbursements, liquidations, replenishments, auditLog: next, documents, reimbursements }); } catch (e) {}
      return next;
    });
    if (onSignOut) onSignOut();
  }, [onSignOut, userName, userEmail, funds, requests, disbursements, liquidations, replenishments, reimbursements]);

  useEffect(() => {
    (async () => {
      /* Read the shared blob AND the per-record rows, then merge. Per-record
         rows are authoritative (records win by id, soft-deletes drop the id), so
         even if the coarse blob was clobbered by a concurrent user its records
         are recovered from pcp_records — this is the fix for the multi-user
         data loss where whole-blob "last write wins" erased others' entries. */
      const [saved, rows] = await Promise.all([loadState(), loadRecords()]);
      /* Always keep the four master plant funds available, adding any missing. */
      const ensureFunds = (fs) => {
        const list = (fs && fs.length) ? fs.map((f) => ({ ...f })) : seedFunds();
        seedFunds().forEach((sf) => { if (!list.some((f) => f.branchCode === sf.branchCode)) list.push(sf); });
        return list;
      };

      /* CRITICAL: transactions are NEVER wiped on load. Whatever was previously
         saved is migrated forward verbatim (IDs, reference numbers and links
         preserved), regardless of the stored dataVersion. A version mismatch is
         a schema tag only — completed financial records must always survive an
         upgrade. (Previously a mismatch cleared every transaction, which is what
         made past records disappear after a deployment.) */
      const migrated = mergeRecordsIntoState(migrateState(saved), rows);

      /* Before touching the live record, snapshot whatever we found so any
         future incident is recoverable. */
      if (txnCount(migrated) > 0) { try { await backupState(migrated, "auto:on-load"); } catch (e) { /* best effort */ } }

      /* Self-healing: if the live record somehow came back emptier than a known
         backup (e.g. a prior bad wipe already ran), restore the richest copy. */
      let source = migrated;
      try {
        if (txnCount(migrated) === 0) {
          const best = await recoverBestState();
          if (best && best.txCount > 0) source = migrateState(best.state);
        }
      } catch (e) { /* best effort */ }

      const startFunds = ensureFunds(source.funds);
      setFunds(startFunds);
      setRequests(source.requests || []);
      setDisbursements(source.disbursements || []);
      setLiquidations(source.liquidations || []);
      setReplenishments(source.replenishments || []);
      setAuditLog(source.auditLog || []);
      setDocuments(source.documents || []);
      setReimbursements(source.reimbursements || []);

      /* Baseline for per-record change detection. Seed the cloud rows from
         whatever we loaded (idempotent upsert) so a first deploy migrates the
         existing blob into per-record rows, then only real changes are synced. */
      const startState = {
        funds: startFunds, requests: source.requests || [], disbursements: source.disbursements || [],
        liquidations: source.liquidations || [], replenishments: source.replenishments || [],
        auditLog: source.auditLog || [], documents: source.documents || [], reimbursements: source.reimbursements || [],
      };
      syncedRef.current = snapshotSync({});
      if (!rows.length && txnCount(startState) > 0) {
        try { syncRecords(diffSync(syncedRef.current, startState)); } catch (e) { /* best effort */ }
      } else {
        syncedRef.current = snapshotSync(startState);
      }
      setRecordsUnavailable(!!window.PCP_RECORDS_UNAVAILABLE);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const next = { dataVersion: DATA_VERSION, funds, requests, disbursements, liquidations, replenishments, auditLog, documents, reimbursements };
    /* Coarse blob write (local cache + shared backup). Kept as a safety net. */
    saveState(next);
    /* Authoritative concurrency-safe write: sync only the records that actually
       changed to their own rows, so concurrent users never overwrite each other. */
    try { syncRecords(diffSync(syncedRef.current, next)); } catch (e) { /* best effort */ }
  }, [funds, requests, disbursements, liquidations, replenishments, auditLog, documents, reimbursements, loaded]);

  /* ---- Requests ---- */
  const addRequest = useCallback((form) => {
    setRequests((rs) => [...rs, {
      id: uid("req"), requestNo: form.requestNo, date: form.date, employee: form.employee,
      department: form.department, branchCode: form.branchCode, purpose: form.purpose,
      purposeJustification: form.purposeJustification || "",
      amount: Number(form.amount), approver: form.approver, status: "Pending",
    }]);
    logAudit("Request Created", form.requestNo, `${form.employee} · ${peso(Number(form.amount))} · ${form.purpose}`);
  }, [logAudit]);

  const editRequest = useCallback((id, form) => {
    setRequests((rs) => rs.map((r) => (r.id === id ? {
      ...r, date: form.date, employee: form.employee, department: form.department,
      branchCode: form.branchCode, purpose: form.purpose,
      purposeJustification: form.purposeJustification || "", amount: Number(form.amount),
      approver: form.approver,
    } : r)));
    const r = requests.find((x) => x.id === id);
    logAudit("Edited", r ? r.requestNo : id, `Request updated · ${form.employee} · ${peso(Number(form.amount))}`);
  }, [logAudit, requests]);

  /* Simple single-step approve / reject (the multi-level approval matrix was removed). */
  const approveRequest = useCallback((id) => {
    setRequests((rs) => rs.map((r) => (r.id === id && r.status === "Pending" ? { ...r, status: "Approved" } : r)));
    const r = requests.find((x) => x.id === id);
    logAudit("Approved", r ? r.requestNo : id, "Request approved");
  }, [logAudit, requests]);

  const rejectRequest = useCallback((id) => {
    setRequests((rs) => rs.map((r) => (r.id === id && r.status === "Pending" ? { ...r, status: "Rejected" } : r)));
    const r = requests.find((x) => x.id === id);
    logAudit("Rejected", r ? r.requestNo : id, "Request rejected");
  }, [logAudit, requests]);

  /* ---- Disbursements ---- */
  const nextVoucherNo = "PCV-2026-" + String(disbursements.length + 1).padStart(4, "0");

  const confirmDisburse = useCallback((extra) => {
    const req = disburseTarget;
    if (!req) return;
    /* Policy: no new advance may be released while the employee still has an
       unliquidated (not fully liquidated) advance. */
    const outstanding = disbursements.filter(
      (d) => d.employee === req.employee && liqStatusFor(d, liquidations) !== "Fully Liquidated"
    );
    if (outstanding.length) {
      const vouchers = outstanding.map((d) => d.voucherNo).join(", ");
      window.alert(
        `Cannot release a new advance to ${req.employee}.\n\n` +
        `This employee has an unliquidated advance (${vouchers}). ` +
        `Per policy, the previous advance must be fully liquidated before a new one is released.`
      );
      logAudit("Release Blocked", req.requestNo, `${req.employee} has unliquidated advance(s): ${vouchers}`);
      return;
    }
    setDisbursements((ds) => [...ds, {
      id: uid("dv"), voucherNo: nextVoucherNo, date: extra.date, requestId: req.id,
      employee: req.employee, branchCode: req.branchCode, department: req.department,
      expenseCategory: extra.expenseCategory, amount: extra.amount, status: "Open",
      remarks: extra.remarks, billed: false,
    }]);
    setRequests((rs) => rs.map((r) => (r.id === req.id ? { ...r, status: "Disbursed" } : r)));
    logAudit("Released", nextVoucherNo, `Cash released to ${req.employee} · ${peso(extra.amount)}`);
    setDisburseTarget(null);
  }, [disburseTarget, nextVoucherNo, logAudit, disbursements, liquidations]);

  const updateRemarks = useCallback((id, remarks) => {
    setDisbursements((ds) => ds.map((d) => (d.id === id ? { ...d, remarks } : d)));
  }, []);

  const editDisbursement = useCallback((id, patch) => {
    setDisbursements((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  const toggleBilled = useCallback((id) => {
    setDisbursements((ds) => ds.map((d) => (d.id === id ? { ...d, billed: !d.billed } : d)));
  }, []);

  /* ---- Liquidation ----
     Receipt amounts live on each supporting document. Every change to one is
     stamped into that document's own amountHistory (previous amount, new
     amount, who changed it, when, and why) as well as the global audit trail,
     so a receipt can be audited independently of the liquidation header. */
  const saveLiquidation = useCallback((disbursementId, lines, attachments, opts) => {
    const o = opts || {};
    const ts = new Date().toISOString().slice(0, 19);
    const actor = userName || role;
    const prevLiq = liquidations.find((l) => l.disbursementId === disbursementId) || null;
    const prevById = {};
    ((prevLiq && prevLiq.attachments) || []).forEach((a) => { prevById[a.id] = a; });

    const changes = [];
    const atts = (attachments || []).map((a) => {
      const prev = prevById[a.id];
      const amount = round2(a.receiptAmount);
      const carried = (prev && prev.amountHistory) || a.amountHistory || [];
      /* Approval state is authoritative on the STORED record — an approval made
         while the worksheet had unsaved edits must not be clobbered. */
      const base = {
        ...a,
        receiptAmount: amount,
        approvalStatus: prev ? (prev.approvalStatus || "Pending") : (a.approvalStatus || "Pending"),
        approvalHistory: prev ? (prev.approvalHistory || []) : (a.approvalHistory || []),
      };
      const prevAmount = prev ? round2(prev.receiptAmount) : null;
      if (prev && prevAmount !== amount) {
        const entry = { prevAmount, newAmount: amount, user: actor, ts, reason: o.reason || "" };
        changes.push({ name: a.name, ...entry });
        return { ...base, amountHistory: [...carried, entry] };
      }
      if (!prev && amount > 0) {
        return { ...base, amountHistory: [...carried, { prevAmount: null, newAmount: amount, user: actor, ts, reason: o.reason || "Initial amount" }] };
      }
      return { ...base, amountHistory: carried };
    });

    setLiquidations((ls) => {
      const exists = ls.find((l) => l.disbursementId === disbursementId);
      if (exists) return ls.map((l) => (l.disbursementId === disbursementId ? { ...l, lines, attachments: atts } : l));
      return [...ls, { id: uid("liq"), disbursementId, createdDate: todayISO(), lines, attachments: atts, submissionStatus: "Draft" }];
    });
    setDisbursements((ds) => ds.map((d) => (d.id === disbursementId ? { ...d, status: "Closed" } : d)));
    const d = disbursements.find((x) => x.id === disbursementId);
    const voucher = d ? d.voucherNo : disbursementId;
    const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    const receiptTotal = atts.reduce((s, a) => s + ((a.approvalStatus === "Approved") ? round2(a.receiptAmount) : 0), 0);
    logAudit("Liquidated", voucher, `${lines.length} receipt line(s) · ${peso(total)}${atts.length ? ` · ${atts.length} document(s) · approved receipts ${peso(receiptTotal)}` : ""}`);
    changes.forEach((c) => logAudit(
      "Receipt Amount Changed", voucher,
      `${c.name}: ${c.prevAmount == null ? "—" : peso(c.prevAmount)} → ${peso(c.newAmount)}${c.reason ? ` · ${c.reason}` : ""}`
    ));
  }, [logAudit, disbursements, liquidations, userName, role]);

  /* Submit the final liquidation. Receipt amounts become read-only afterwards
     for everyone except a receipt approver. */
  const submitLiquidation = useCallback((disbursementId) => {
    const ts = new Date().toISOString().slice(0, 19);
    const actor = userName || role;
    setLiquidations((ls) => ls.map((l) => (
      l.disbursementId === disbursementId
        ? { ...l, submissionStatus: "Submitted", submittedBy: actor, submittedAt: ts }
        : l
    )));
    const d = disbursements.find((x) => x.id === disbursementId);
    const liq = liquidations.find((l) => l.disbursementId === disbursementId);
    const sum = receiptAmountSummary(liq);
    const rec = reconcileReceipts(d ? d.amount : 0, sum.approvedTotal);
    logAudit("Liquidation Submitted", d ? d.voucherNo : disbursementId,
      `Total receipts ${peso(sum.approvedTotal)} vs released ${peso(rec.released)}`
      + (rec.type === "excess" ? ` · refund due ${peso(rec.expected)}` : rec.type === "reimburse" ? ` · reimbursement due ${peso(rec.expected)} · FOR REVIEW` : " · exact"));
  }, [logAudit, disbursements, liquidations, userName, role]);

  /* Reopen a submitted liquidation for correction (receipt approvers only). */
  const reopenLiquidation = useCallback((disbursementId, reason) => {
    setLiquidations((ls) => ls.map((l) => (
      l.disbursementId === disbursementId ? { ...l, submissionStatus: "Draft" } : l
    )));
    const d = disbursements.find((x) => x.id === disbursementId);
    logAudit("Liquidation Reopened", d ? d.voucherNo : disbursementId, reason || "");
  }, [logAudit, disbursements]);

  /* Record that the refund or reimbursement cash has ACTUALLY changed hands.
     The actual amount is stored so it can be checked against the expected one. */
  const recordSettlement = useCallback((disbursementId, payload) => {
    const ts = new Date().toISOString().slice(0, 19);
    const actor = userName || role;
    setLiquidations((ls) => ls.map((l) => {
      if (l.disbursementId !== disbursementId) return l;
      const prev = l.settlement || {};
      return {
        ...l,
        settlement: {
          ...prev,
          completed: !!payload.completed,
          type: payload.type,
          expectedAmount: round2(payload.expectedAmount),
          actualAmount: round2(payload.actualAmount),
          recordedBy: payload.completed ? actor : "",
          recordedAt: payload.completed ? ts : "",
        },
      };
    }));
    const d = disbursements.find((x) => x.id === disbursementId);
    const label = payload.type === "excess" ? "excess cash returned" : "reimbursement paid";
    logAudit(
      payload.completed ? "Cash Settlement Recorded" : "Cash Settlement Cleared",
      d ? d.voucherNo : disbursementId,
      payload.completed
        ? `${label} · expected ${peso(payload.expectedAmount)} · actual ${peso(payload.actualAmount)}`
        : "Settlement record cleared"
    );
  }, [logAudit, disbursements, userName, role]);

  /* Reviewer sign-off on an over-liquidation. Without this the liquidation can
     never reach LIQUIDATED, so an excess claim is never auto-approved. */
  const reviewOverLiquidation = useCallback((disbursementId, remarks) => {
    const ts = new Date().toISOString().slice(0, 19);
    const actor = userName || role;
    setLiquidations((ls) => ls.map((l) => (
      l.disbursementId === disbursementId
        ? { ...l, settlement: { ...(l.settlement || {}), reviewedBy: actor, reviewedAt: ts, reviewRemarks: remarks || "" } }
        : l
    )));
    const d = disbursements.find((x) => x.id === disbursementId);
    logAudit("Over-Liquidation Reviewed", d ? d.voucherNo : disbursementId, remarks || "");
  }, [logAudit, disbursements, userName, role]);

  /* ---- Liquidation rejection (Grace Gan only) ----
     A rejection requires ONE standardized reason; the reviewer comment is
     optional and stored verbatim (empty stays empty — never a placeholder).
     Each rejection is appended as its own record and never overwrites an
     earlier one, and the liquidation returns to an editable state so the
     requestor can correct and resubmit. Authorization is re-checked here, so a
     bypassed UI cannot reject through this handler. */
  const rejectLiquidation = useCallback((disbursementId, payload) => {
    if (!isLiquidationApprover) {
      window.alert(`Only ${RECEIPT_APPROVER_NAME} is authorized to reject a liquidation.`);
      return;
    }
    const reason = String((payload && payload.reason) || "").trim();
    if (!isValidLiquidationRejectionReason(reason)) {
      window.alert("Please select a rejection reason.");
      return;
    }
    const comment = String((payload && payload.comment) || "").trim();
    const ts = new Date().toISOString().slice(0, 19);
    const actor = userName || role;
    const d = disbursements.find((x) => x.id === disbursementId);
    const liq = liquidations.find((l) => l.disbursementId === disbursementId);
    if (!liq) return;
    const req = d ? requests.find((r) => r.id === d.requestId) : null;
    const prevStatus = liqFinalStatus(d, liq);
    const record = {
      id: uid("rej"),
      liquidationId: liq.id,
      pcfRequestor: d ? d.employee : "",
      reimbursementRequestor: "",
      purpose: req ? req.purpose : "",
      amount: d ? d.amount : 0,
      reason,
      comment, // empty string when no comment — no placeholder text
      rejectedBy: actor,
      rejectedAt: ts,
      prevStatus,
      newStatus: "REJECTED",
    };
    setLiquidations((ls) => ls.map((l) => (
      l.disbursementId === disbursementId
        ? { ...l, submissionStatus: "Rejected", rejections: [...(l.rejections || []), record] }
        : l
    )));
    logAudit("Liquidation Rejected", d ? d.voucherNo : disbursementId,
      `Reason: ${reason}${comment ? ` · Comment: ${comment}` : ""} · ${prevStatus} → REJECTED`);
  }, [isLiquidationApprover, logAudit, disbursements, liquidations, requests, userName, role]);

  /* ---- Receipt approval (per uploaded Official Receipt / Sales Invoice) ----
     Approver is Grace Gan (super admin). Each decision is stamped into the
     receipt's own approval history and recorded in the audit trail. */
  const decideReceipt = useCallback((disbursementId, attachmentId, decision, remarks) => {
    if (!isLiquidationApprover) {
      window.alert(`Only ${RECEIPT_APPROVER_NAME} is authorized to review liquidation receipts.`);
      return;
    }
    const ts = new Date().toISOString().slice(0, 19);
    const approver = userName || role;
    let receiptName = attachmentId;
    setLiquidations((ls) => ls.map((l) => {
      if (l.disbursementId !== disbursementId) return l;
      const attachments = (l.attachments || []).map((a) => {
        if (a.id !== attachmentId) return a;
        receiptName = a.name || attachmentId;
        return {
          ...a,
          approvalStatus: decision,
          approvalHistory: [...(a.approvalHistory || []), { approver, ts, status: decision, remarks: remarks || "" }],
        };
      });
      return { ...l, attachments };
    }));
    const d = disbursements.find((x) => x.id === disbursementId);
    logAudit(
      decision === "Approved" ? "Receipt Approved" : "Receipt Rejected",
      d ? d.voucherNo : disbursementId,
      `${receiptName}${remarks ? ` · ${remarks}` : ""}`
    );
  }, [isLiquidationApprover, logAudit, disbursements, userName, role]);

  /* ---- Deletion (SuperAdmin only) ----
     Each delete leaves the surviving records consistent: a voucher takes its
     liquidation with it and frees the source request, and removing a liquidation
     reopens its voucher. Every deletion is written to the audit trail. Balances
     are always derived, never stored, so they re-compute on their own. */
  const deleteRequest = useCallback((id) => {
    const r = requests.find((x) => x.id === id);
    if (!r) return;
    /* A request that already produced a voucher must be deleted bottom-up, so
       the ledger never contains a voucher pointing at a missing request. */
    const linked = disbursements.filter((d) => d.requestId === id);
    if (linked.length) {
      window.alert(
        `"${r.requestNo}" cannot be deleted — cash has already been released against it `
        + `(${linked.map((d) => d.voucherNo).join(", ")}).\n\n`
        + "Delete the disbursement voucher first, then delete this request."
      );
      return;
    }
    if (!window.confirm(`Delete request ${r.requestNo}?\n\n${r.employee} · ${peso(r.amount)} · ${r.purpose}\n\nThis cannot be undone.`)) return;
    setRequests((rs) => rs.filter((x) => x.id !== id));
    logAudit("Deleted", r.requestNo, `Request deleted · ${r.employee} · ${peso(r.amount)}`);
  }, [logAudit, requests, disbursements]);

  const deleteDisbursement = useCallback((id) => {
    const d = disbursements.find((x) => x.id === id);
    if (!d) return;
    const liq = liquidations.find((l) => l.disbursementId === id);
    const req = requests.find((r) => r.id === d.requestId);
    let msg = `Delete voucher ${d.voucherNo}?\n\n${d.employee} · ${peso(d.amount)}\n\n`;
    if (liq) msg += `Its liquidation will also be deleted (${(liq.lines || []).length} expense line(s), ${(liq.attachments || []).length} supporting document(s)).\n`;
    if (req) msg += `Request ${req.requestNo} will return to "Approved" so it can be released again.\n`;
    msg += "\nThis cannot be undone.";
    if (!window.confirm(msg)) return;
    setDisbursements((ds) => ds.filter((x) => x.id !== id));
    if (liq) setLiquidations((ls) => ls.filter((l) => l.disbursementId !== id));
    if (req) setRequests((rs) => rs.map((r) => (r.id === req.id ? { ...r, status: "Approved" } : r)));
    logAudit("Deleted", d.voucherNo, `Disbursement deleted · ${d.employee} · ${peso(d.amount)}`
      + (liq ? " · liquidation removed" : "")
      + (req ? ` · ${req.requestNo} returned to Approved` : ""));
  }, [logAudit, disbursements, liquidations, requests]);

  const deleteLiquidation = useCallback((disbursementId) => {
    const liq = liquidations.find((l) => l.disbursementId === disbursementId);
    if (!liq) return;
    const d = disbursements.find((x) => x.id === disbursementId);
    const voucher = d ? d.voucherNo : disbursementId;
    if (!window.confirm(
      `Delete the liquidation for ${voucher}?\n\n`
      + `${(liq.lines || []).length} expense line(s) and ${(liq.attachments || []).length} supporting document(s) `
      + "will be removed, along with any recorded cash settlement. The voucher returns to the liquidation worklist.\n\n"
      + "This cannot be undone."
    )) return;
    setLiquidations((ls) => ls.filter((l) => l.disbursementId !== disbursementId));
    setDisbursements((ds) => ds.map((x) => (x.id === disbursementId ? { ...x, status: "Open" } : x)));
    logAudit("Deleted", voucher, `Liquidation deleted · ${(liq.lines || []).length} line(s) · ${(liq.attachments || []).length} document(s)`);
  }, [logAudit, liquidations, disbursements]);

  /* Audit entries are deletable by the SuperAdmin. One summary entry replaces
     what was removed so a deletion is not completely silent — note that the
     replacement entry can itself be deleted, so the trail is no longer
     tamper-evident once this is used. */
  const deleteAuditEntries = useCallback((ids) => {
    const set = new Set(ids || []);
    if (!set.size) return;
    const removed = auditLog.filter((a) => set.has(a.id));
    if (!removed.length) return;
    const ts = new Date().toISOString().slice(0, 19);
    const actor = userName || role;
    const detail = removed.slice(0, 6).map((a) => `${a.action} · ${a.entity}`).join("; ")
      + (removed.length > 6 ? ` …and ${removed.length - 6} more` : "");
    setAuditLog((log) => [
      ...log.filter((a) => !set.has(a.id)),
      {
        id: uid("aud"), ts, user: actor, action: "Audit Entry Deleted",
        entity: `${removed.length} entr${removed.length === 1 ? "y" : "ies"}`,
        remarks: detail,
      },
    ]);
  }, [auditLog, userName, role]);

  /* ---- Replenishment ---- */
  const addReplenishment = useCallback((form) => {
    setReplenishments((rs) => [...rs, { id: uid("rep"), ...form }]);
    logAudit("Replenished", form.replenishmentNo, `${peso(Number(form.amount))} · ${form.method}${form.checkNo ? ` · ${form.checkNo}` : ""} · ${form.status}`);
  }, [logAudit]);

  const editReplenishment = useCallback((id, form) => {
    setReplenishments((rs) => rs.map((r) => (r.id === id ? { ...r, ...form } : r)));
    logAudit("Edited", form.replenishmentNo || id, `Replenishment updated · ${peso(Number(form.amount))} · ${form.status}`);
  }, [logAudit]);

  const completeReplenishment = useCallback((id) => {
    setReplenishments((rs) => rs.map((r) => (r.id === id ? { ...r, status: "Completed" } : r)));
    const r = replenishments.find((x) => x.id === id);
    logAudit("Replenished", r ? r.replenishmentNo : id, `Marked completed${r ? ` · ${peso(Number(r.amount))}` : ""}`);
  }, [logAudit, replenishments]);

  const deleteReplenishment = useCallback((id) => {
    const r = replenishments.find((x) => x.id === id);
    setReplenishments((rs) => rs.filter((x) => x.id !== id));
    logAudit("Deleted", r ? r.replenishmentNo : id, "Replenishment record removed");
  }, [logAudit, replenishments]);

  const exportLiquidation = useCallback((disbursement, liq) => {
    const rows = buildLiquidationExportRows(disbursement, liq);
    const meta = [
      ["Petty Cash Liquidation — Acumatica Import Sheet"],
      ["Voucher No.", disbursement.voucherNo],
      ["Employee", disbursement.employee],
      ["Branch", disbursement.branchCode],
      ["Company", companyOfBranch(disbursement.branchCode)],
      ["Requested Amount", disbursement.amount],
      ["Total Liquidated", rows.reduce((s, r) => s + r.Amount, 0)],
      [],
    ];
    const ws = XLSX.utils.aoa_to_sheet(meta);
    XLSX.utils.sheet_add_json(ws, rows, { origin: -1, header: ACUMATICA_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Liquidation");
    downloadWorkbook(wb, `Liquidation_${disbursement.voucherNo}.xlsx`);
  }, []);

  const exportAllToAcumatica = useCallback(() => {
    const rows = buildAllAcumaticaExportRows(disbursements, liquidations);
    const ws = XLSX.utils.json_to_sheet(rows, { header: ACUMATICA_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, ACUMATICA_PO_SHEET_NAME);
    downloadWorkbook(wb, `Acumatica_PO_Export_All_${todayISO()}.xlsx`);
  }, [disbursements, liquidations]);

  /* ---- Funds ---- */
  const addFund = useCallback((f) => {
    setFunds((fs) => [...fs, { id: uid("fund"), ...f }]);
  }, []);
  const editFund = useCallback((id, f) => {
    setFunds((fs) => fs.map((x) => (x.id === id ? { ...x, ...f } : x)));
  }, []);
  const deleteFund = useCallback((id) => {
    setFunds((fs) => fs.filter((x) => x.id !== id));
  }, []);
  /* Bulk beginning-balance update from the Dashboard "Edit Balances" modal. */
  const saveBalances = useCallback((updates) => {
    const map = new Map(updates.map((u) => [u.id, u.beginningBalance]));
    setFunds((fs) => fs.map((x) => (map.has(x.id) ? { ...x, beginningBalance: map.get(x.id) } : x)));
  }, []);

  /* Restore a recovery snapshot (admin, from System Settings). Transactions are
     replaced wholesale from the snapshot; funds/audit are only replaced when the
     snapshot actually carries them, so a partial snapshot never blanks them. */
  const restoreState = useCallback((snap) => {
    if (!snap) return;
    if (Array.isArray(snap.requests)) setRequests(snap.requests);
    if (Array.isArray(snap.disbursements)) setDisbursements(snap.disbursements);
    if (Array.isArray(snap.liquidations)) setLiquidations(snap.liquidations);
    if (Array.isArray(snap.replenishments)) setReplenishments(snap.replenishments);
    if (Array.isArray(snap.documents)) setDocuments(snap.documents);
    if (Array.isArray(snap.reimbursements)) setReimbursements(snap.reimbursements);
    if (Array.isArray(snap.funds) && snap.funds.length) setFunds(snap.funds);
    logAudit("Data Restored", "recovery snapshot",
      `${(snap.requests || []).length} request(s), ${(snap.disbursements || []).length} release(s), ${(snap.liquidations || []).length} liquidation(s) restored`);
  }, [logAudit]);

  /* ---- PCF Documents ---- */
  const docTs = () => new Date().toISOString().slice(0, 19).replace("T", " ");
  const addDocuments = useCallback((docs) => {
    setDocuments((ds) => [...docs, ...ds]);
    docs.forEach((d) => logAudit("Document Uploaded", d.refNo, `${d.category} · ${d.name}`));
  }, [logAudit]);
  const updateDocument = useCallback((id, patch, action, remarks) => {
    const ts = docTs();
    setDocuments((ds) => ds.map((d) => {
      if (d.id !== id) return d;
      const next = { ...d, ...patch, lastModified: ts };
      if (action) next.activity = [...(d.activity || []), { action, user: userName || role, ts, ip: "Local" }];
      return next;
    }));
    if (action) { const d = documents.find((x) => x.id === id); logAudit("Document " + action, (d && d.refNo) || id, remarks || (d ? d.name : "")); }
  }, [documents, logAudit, userName, role]);
  const replaceDocument = useCallback((id, file, by) => {
    const ts = docTs();
    setDocuments((ds) => ds.map((d) => {
      if (d.id !== id) return d;
      const version = (d.version || 1) + 1;
      const versions = [...(d.versions || []), { version, name: file.name, size: file.size, uploadedBy: by, date: todayISO() }];
      return {
        ...d, name: file.name, size: file.size, type: file.type, dataUrl: file.dataUrl,
        version, versions, lastModified: ts,
        activity: [...(d.activity || []), { action: "Replaced", user: by || userName || role, ts, ip: "Local" }],
      };
    }));
    const d = documents.find((x) => x.id === id);
    logAudit("Document Replaced", (d && d.refNo) || id, file.name);
  }, [documents, logAudit, userName, role]);
  const deleteDocument = useCallback((id) => {
    const d = documents.find((x) => x.id === id);
    setDocuments((ds) => ds.filter((x) => x.id !== id));
    logAudit("Document Deleted", (d && d.refNo) || id, d ? d.name : "");
  }, [documents, logAudit]);
  const docActivity = useCallback((id, action, remarks) => {
    const ts = docTs();
    setDocuments((ds) => ds.map((d) => d.id === id
      ? { ...d, activity: [...(d.activity || []), { action, user: userName || role, ts, ip: "Local" }] }
      : d));
    const d = documents.find((x) => x.id === id);
    logAudit("Document " + action, (d && d.refNo) || id, remarks || (d ? d.name : ""));
  }, [documents, logAudit, userName, role]);

  /* ---- Reimbursement (AF P16) ----
     Independent of the Petty Cash Request flow: the employee already advanced
     the expense, so no Petty Cash Advance Form is created. After approval the
     request is handed off to Liquidation (status FOR LIQUIDATION), keeping the
     Reimbursement Request Number as the reference, then on to Payment. */
  const reimbTs = () => new Date().toISOString().slice(0, 19).replace("T", " ");
  const buildReimbFromForm = useCallback((form) => {
    const compliance = evaluateReimbursement(form, reimbursements, form.id);
    return {
      employee: form.employee, department: form.department, branchCode: form.branchCode,
      company: companyOfBranch(form.branchCode), purpose: form.purpose,
      requestDate: form.requestDate, remarks: form.remarks || "",
      lines: (form.lines || []).map((l) => ({ ...l, amount: Number(l.amount) || 0, account: l.account || accountForCategory(l.category) })),
      attachments: form.attachments || [],
      needsPO: !!form.needsPO, needsProof: !!form.needsProof,
      hasPersonal: !!form.hasPersonal, entertainmentNotPreApproved: !!form.entertainmentNotPreApproved, hasFines: !!form.hasFines,
      compliance,
    };
  }, [reimbursements]);

  const nextReimbNo = () => "REIM-2026-" + String(reimbursements.length + 1).padStart(6, "0");

  const addReimbursement = useCallback((form, submit) => {
    /* Backend enforcement (Section 7): a SUBMITTED reimbursement must carry one
       approved, ACTIVE purpose — never blank, free-text or injected. Drafts may
       still be saved with an incomplete purpose. */
    if (submit && !isActiveReimbPurpose((form.purpose || "").trim())) {
      window.alert((form.purpose || "").trim()
        ? "Invalid Purpose. Please select an approved expense category from the Purpose dropdown."
        : "Purpose is required. Please select an approved expense category.");
      return;
    }
    const reimbNo = nextReimbNo();
    const ts = reimbTs();
    const base = buildReimbFromForm(form);
    const status = submit ? REIMB_STATUS.SUBMITTED : REIMB_STATUS.DRAFT;
    const history = [{ ts, user: userName || role, action: submit ? "Submitted" : "Created (Draft)", prevStatus: "", newStatus: status, comments: "" }];
    setReimbursements((rs) => [...rs, {
      id: uid("reimb"), reimbNo, ...base, status,
      createdBy: userName || role, createdAt: ts,
      submittedBy: submit ? (userName || role) : "", submittedAt: submit ? ts : "",
      acumaticaStatus: "Not Yet Exported", payment: null, history,
    }]);
    logAudit(submit ? "Reimbursement Submitted" : "Reimbursement Drafted", reimbNo, `${form.employee} · ${peso(reimbTotal(base))}`);
  }, [buildReimbFromForm, logAudit, reimbursements, userName, role]);

  const updateReimbursement = useCallback((id, form, mode) => {
    /* Same backend purpose check as addReimbursement, applied on resubmission. */
    if (mode === "submit" && !isActiveReimbPurpose((form.purpose || "").trim())) {
      window.alert((form.purpose || "").trim()
        ? "Invalid Purpose. Please select an approved expense category from the Purpose dropdown."
        : "Purpose is required. Please select an approved expense category.");
      return;
    }
    const ts = reimbTs();
    const base = buildReimbFromForm({ ...form, id });
    setReimbursements((rs) => rs.map((r) => {
      if (r.id !== id) return r;
      const submit = mode === "submit";
      const status = submit ? REIMB_STATUS.SUBMITTED : (r.status === REIMB_STATUS.RETURNED ? REIMB_STATUS.DRAFT : r.status);
      const action = submit ? (r.status === REIMB_STATUS.RETURNED ? "Resubmitted" : "Submitted") : "Edited (Draft)";
      return {
        ...r, ...base, status,
        submittedBy: submit ? (userName || role) : r.submittedBy,
        submittedAt: submit ? ts : r.submittedAt,
        history: [...(r.history || []), { ts, user: userName || role, action, prevStatus: r.status, newStatus: status, comments: "" }],
      };
    }));
    const r = reimbursements.find((x) => x.id === id);
    logAudit(mode === "submit" ? "Reimbursement Submitted" : "Reimbursement Edited", r ? r.reimbNo : id, `${form.employee} · ${peso(reimbTotal(base))}`);
  }, [buildReimbFromForm, logAudit, reimbursements, userName, role]);

  /* Generic workflow transition with segregation-of-duties enforcement. */
  const reimbursementAction = useCallback((id, action, payload) => {
    const o = payload || {};
    const ts = reimbTs();
    const actor = userName || role;
    setReimbursements((rs) => rs.map((r) => {
      if (r.id !== id) return r;
      const prev = r.status;
      let next = prev, label = action;
      switch (action) {
        case "recommend": next = REIMB_STATUS.FOR_APPROVAL; label = "Recommended for Approval"; break;
        case "approve":
          /* Segregation of duties — an employee cannot approve their own request. */
          if ((r.createdBy || "").toLowerCase() === actor.toLowerCase() || (r.employee || "").toLowerCase() === actor.toLowerCase()) {
            window.alert("Segregation of duties: you cannot approve your own reimbursement request.");
            return r;
          }
          next = REIMB_STATUS.FOR_LIQUIDATION; label = "Approved → For Liquidation";
          break;
        case "return": next = REIMB_STATUS.RETURNED; label = "Returned for Revision"; break;
        case "reject": next = REIMB_STATUS.REJECTED; label = "Rejected"; break;
        case "liquidation-review": next = REIMB_STATUS.UNDER_REVIEW; label = "Liquidation Under Review"; break;
        case "liquidation-complete": next = REIMB_STATUS.LIQUIDATION_DONE; label = "Liquidation Completed"; break;
        case "for-payment": next = REIMB_STATUS.FOR_PAYMENT; label = "Moved to Payment"; break;
        case "complete": next = REIMB_STATUS.COMPLETED; label = "Completed"; break;
        default: return r;
      }
      if (next === prev) return r;
      const patch = { status: next, history: [...(r.history || []), { ts, user: actor, action: label, prevStatus: prev, newStatus: next, comments: o.comments || "" }] };
      if (action === "approve") { patch.approvedBy = actor; patch.approvedAt = ts; patch.liquidationRef = r.reimbNo; }
      if (action === "recommend") { patch.reviewedBy = actor; patch.reviewedAt = ts; }
      return { ...r, ...patch };
    }));
    const r = reimbursements.find((x) => x.id === id);
    logAudit("Reimbursement " + action.replace(/-/g, " "), r ? r.reimbNo : id, o.comments || "");
  }, [logAudit, reimbursements, userName, role]);

  const recordReimbursementPayment = useCallback((id, payment) => {
    const ts = reimbTs();
    const actor = userName || role;
    setReimbursements((rs) => rs.map((r) => {
      if (r.id !== id) return r;
      return {
        ...r, status: REIMB_STATUS.PAID, payment: { ...payment },
        history: [...(r.history || []), { ts, user: actor, action: "Payment Recorded", prevStatus: r.status, newStatus: REIMB_STATUS.PAID, comments: `${payment.method} · ${peso(payment.amount)}${payment.refNo ? ` · ${payment.refNo}` : ""}` }],
      };
    }));
    const r = reimbursements.find((x) => x.id === id);
    logAudit("Reimbursement Paid", r ? r.reimbNo : id, `${payment.method} · ${peso(payment.amount)}${payment.refNo ? ` · ${payment.refNo}` : ""}`);
  }, [logAudit, reimbursements, userName, role]);

  const deleteReimbursement = useCallback((id) => {
    const r = reimbursements.find((x) => x.id === id);
    if (!r) return;
    if (!window.confirm(`Delete reimbursement ${r.reimbNo}?\n\n${r.employee} · ${peso(reimbTotal(r))}\n\nThis cannot be undone.`)) return;
    setReimbursements((rs) => rs.filter((x) => x.id !== id));
    logAudit("Deleted", r.reimbNo, `Reimbursement deleted · ${r.employee} · ${peso(reimbTotal(r))}`);
  }, [logAudit, reimbursements]);

  const exportReimbursementAcumatica = useCallback((reimb) => {
    const rows = (reimb.lines || []).map((l) => ({
      "Branch": reimb.branchCode, "Employee": reimb.employee, "Company": companyOfBranch(reimb.branchCode),
      "Reference No.": reimb.reimbNo, "Expense Date": l.date, "GL Account": l.account || accountForCategory(l.category),
      "Subaccount": l.department, "Cost Center": l.costCenter || "", "Description": l.description,
      "Category": l.category, "Vendor/Payee": l.vendor || "", "Tax Category": l.taxCategory || "", "Amount": Number(l.amount) || 0,
    }));
    const meta = [
      ["Reimbursement — Acumatica Import Sheet"],
      ["Reimbursement No.", reimb.reimbNo], ["Employee", reimb.employee],
      ["Purpose", reimb.purpose || ""], ["Purpose Category", purposeCategory(reimb.purpose)],
      ["Company", companyOfBranch(reimb.branchCode)], ["Total", reimbTotal(reimb)], [],
    ];
    const ws = XLSX.utils.aoa_to_sheet(meta);
    XLSX.utils.sheet_add_json(ws, rows, { origin: -1 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reimbursement");
    downloadWorkbook(wb, `Reimbursement_${reimb.reimbNo}.xlsx`);
    setReimbursements((rs) => rs.map((r) => (r.id === reimb.id ? { ...r, acumaticaStatus: "Exported" } : r)));
    logAudit("Reimbursement Exported", reimb.reimbNo, "Acumatica export sheet generated");
  }, [logAudit]);

  const exportReimbursementReport = useCallback((list) => {
    const rows = (list || []).map((r) => ({
      "Reimb No.": r.reimbNo, "Employee": r.employee, "Department": deptDesc(r.department),
      "Company": companyOfBranch(r.branchCode), "Plant": plantLabel(r.branchCode),
      "Category": purposeCategory(r.purpose), "Purpose": r.purpose || "",
      "Request Date": r.requestDate, "Lines": (r.lines || []).length, "Total Amount": reimbTotal(r),
      "Compliance": (r.compliance && r.compliance.level) || "PASS", "Status": r.status,
      "Approved By": r.approvedBy || "", "Payment Date": (r.payment && r.payment.date) || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reimbursements");
    downloadWorkbook(wb, `Reimbursement_Summary_${todayISO()}.xlsx`);
  }, []);

  /* ---- Plant-scoped views ---- */
  /* Every module only receives data for plants the user is allowed to see, so a
     custodian can never view or edit another plant's records. */
  const visibleFunds = useMemo(() => funds.filter((f) => inScope(f.branchCode)), [funds, inScope]);
  const visibleRequests = useMemo(() => requests.filter((r) => inScope(r.branchCode)), [requests, inScope]);
  const visibleDisbursements = useMemo(() => disbursements.filter((d) => inScope(d.branchCode)), [disbursements, inScope]);
  const visibleReplenishments = useMemo(() => replenishments.filter((r) => inScope(r.branchCode)), [replenishments, inScope]);
  const visibleReimbursements = useMemo(() => reimbursements.filter((r) => inScope(r.branchCode)), [reimbursements, inScope]);
  const visibleLiquidations = useMemo(() => {
    const ids = new Set(visibleDisbursements.map((d) => d.id));
    return liquidations.filter((l) => ids.has(l.disbursementId));
  }, [liquidations, visibleDisbursements]);
  /* Dashboard plant tabs limited to the user's plants. */

  /* ---- Separate tab per plant ---- */
  /* The active tab is either a global module key ("audit") or a plant-scoped
     key ("A1+::requests"). Parse it so each module renders only its own plant. */
  const { plant: activePlant, module: activeModule } = parseTab(tab);
  const scopeCodes = useMemo(
    () => (activePlant && allowedPlants.includes(activePlant)) ? [activePlant] : allowedPlants,
    [activePlant, allowedPlants]
  );
  const scopedFunds = useMemo(() => visibleFunds.filter((f) => scopeCodes.includes(f.branchCode)), [visibleFunds, scopeCodes]);
  const scopedRequests = useMemo(() => visibleRequests.filter((r) => scopeCodes.includes(r.branchCode)), [visibleRequests, scopeCodes]);
  const scopedDisbursements = useMemo(() => visibleDisbursements.filter((d) => scopeCodes.includes(d.branchCode)), [visibleDisbursements, scopeCodes]);
  const scopedReplenishments = useMemo(() => visibleReplenishments.filter((r) => scopeCodes.includes(r.branchCode)), [visibleReplenishments, scopeCodes]);
  const scopedReimbursements = useMemo(() => visibleReimbursements.filter((r) => scopeCodes.includes(r.branchCode)), [visibleReimbursements, scopeCodes]);
  const scopedLiquidations = useMemo(() => {
    const ids = new Set(scopedDisbursements.map((d) => d.id));
    return visibleLiquidations.filter((l) => ids.has(l.disbursementId));
  }, [visibleLiquidations, scopedDisbursements]);
  /* Plant selector options limited to the active tab's plant so module forms
     default to the correct plant and the redundant in-page selector hides. */
  const scopedPlantOptions = useMemo(
    () => plantOptions.filter((p) => scopeCodes.includes(p.code)),
    [plantOptions, scopeCodes]
  );
  const activePlantLabel = activePlant ? plantLabel(activePlant) : "";
  /* Resolve the per-plant dashboard header from the canonical list, falling back
     to the funds master data so newly created plants get a working dashboard. */
  const activeBranch = useMemo(() => {
    if (!activePlant) return null;
    const db = DASHBOARD_BRANCHES.find((b) => b.branchCode === activePlant);
    if (db) return db;
    const f = funds.find((x) => x.branchCode === activePlant);
    return f ? { key: activePlant, label: f.label || plantLabel(activePlant) || activePlant, branchCode: activePlant } : null;
  }, [activePlant, funds]);

  /* ---- Roles, navigation & notifications ---- */
  const roleModuleKeys = (ROLES[role] || ROLES["Accounting"]).tabs;
  /* User's plants in canonical order, then any additional master-data plants so
     newly created plants automatically get their own sidebar group + dashboard. */
  const orderedPlants = useMemo(() => plantOptions, [plantOptions]);

  /* Build the grouped sidebar: an optional consolidated overview, one group per
     plant with that plant's modules, then the shared administration tabs. */
  const navGroups = useMemo(() => {
    const groups = [];
    const plantMods = PLANT_MODULES.filter((m) => roleModuleKeys.includes(m.key));
    if (orderedPlants.length > 1 && roleModuleKeys.includes("dashboard")) {
      groups.push({ key: "overview", label: "Overview", items: [
        { tabKey: "dashboard", label: "Consolidated Dashboard", icon: LayoutDashboard },
      ] });
    }
    orderedPlants.forEach((p) => {
      groups.push({
        key: "plant-" + p.code,
        label: p.label,
        items: plantMods.map((m) => ({ tabKey: plantTabKey(p.code, m.key), label: m.label, icon: m.icon })),
      });
    });
    const monMods = MONITORING_MODULES.filter((m) => roleModuleKeys.includes(m.key));
    if (monMods.length) {
      groups.push({ key: "monitoring", label: "Monitoring", items: monMods.map((m) => ({ tabKey: m.key, label: m.label, icon: m.icon })) });
    }
    const globalMods = GLOBAL_MODULES.filter((m) => roleModuleKeys.includes(m.key));
    if (globalMods.length) {
      groups.push({ key: "admin", label: "Administration", items: globalMods.map((m) => ({ tabKey: m.key, label: m.label, icon: m.icon })) });
    }
    return groups;
  }, [roleModuleKeys, orderedPlants]);

  /* Flat set of every valid tab key for this user — used to block navigation to
     unauthorized pages, including manual URL/state tampering. */
  const allowedTabs = useMemo(() => {
    const set = new Set();
    navGroups.forEach((g) => g.items.forEach((it) => set.add(it.tabKey)));
    return set;
  }, [navGroups]);
  const firstTab = (navGroups[0] && navGroups[0].items[0]) ? navGroups[0].items[0].tabKey : "dashboard";

  /* Keep the active tab valid whenever role/plants change. */
  useEffect(() => {
    if (loaded && !allowedTabs.has(tab)) setTab(firstTab);
  }, [role, loaded, allowedTabs]); // eslint-disable-line

  const navigate = useCallback((key, opts) => {
    /* Accept a bare module key from dashboard drill-downs and scope it to the
       plant currently in context (or the first allowed plant). */
    let target = key;
    if (!String(key).includes(TAB_SEP) && PLANT_MODULE_KEYS.includes(key)) {
      const cur = parseTab(tab).plant || (orderedPlants[0] && orderedPlants[0].code);
      if (cur) target = plantTabKey(cur, key);
    }
    if (!allowedTabs.has(target)) return;
    if (parseTab(target).module === "history") setHistoryFilter(opts && opts.type ? { type: opts.type } : null);
    setTab(target);
  }, [allowedTabs, tab, orderedPlants]);

  const notifications = useMemo(
    () => buildNotifications(visibleRequests, visibleDisbursements, visibleLiquidations, visibleReplenishments),
    [visibleRequests, visibleDisbursements, visibleLiquidations, visibleReplenishments]
  );

  const onNotifClick = useCallback((n) => {
    if (n.type === "approval" || n.type === "approved" || n.type === "rejected") navigate("requests");
    else if (n.type === "liquidation" || n.type === "overdue") navigate("liquidation");
    else if (n.type === "replenished" || n.type === "replenish-pending") navigate("replenishment");
  }, [navigate]);

  const uiValue = useMemo(() => ({ notifications, role, setRole: guardedSetRole, canSwitchRole: !!isAdmin, onNotifClick }), [notifications, role, guardedSetRole, isAdmin, onNotifClick]);

  if (!loaded) {
    return (
      <div className="pcp-root" style={{ alignItems: "center", justifyContent: "center" }}>
        <style>{CSS}</style>
        <div style={{ color: "var(--text-mut)", fontSize: 13 }}>Loading petty cash portal…</div>
      </div>
    );
  }

  return (
    <AppUI.Provider value={uiValue}>
    <div className="pcp-root">
      <style>{CSS}</style>
      <Sidebar tab={tab} setTab={setTab} role={role} navGroups={navGroups} userEmail={userEmail} userName={userName} onSignOut={handleSignOut} onChangePassword={() => setShowChangePw(true)} />
      <div className="pcp-main">
        {recordsUnavailable && isAdmin && (
          <div style={{ background: "#8a1020", color: "#fff", padding: "8px 16px", fontSize: 12.5, lineHeight: 1.5 }}>
            <b>Database setup incomplete:</b> the concurrency-safe <code>pcp_records</code> table is missing,
            so saves fall back to a shared blob. A safety net is preventing data loss, but please run the
            setup SQL (see README → Data Storage &amp; Login) in Supabase to fully restore multi-user safety.
            No existing data will be affected.
          </div>
        )}
        {activeModule === "dashboard" && (
          activePlant && activeBranch ? (
            <>
              <TopBar
                title={activeBranch.label + " Dashboard"}
                sub={"Real-time summary of petty cash activity for " + activeBranch.label}
                right={<button className="pcp-btn" onClick={() => setShowEditBalances(true)}><Edit3 size={14} /> Edit Beginning Balances</button>}
              />
              <div className="pcp-content">
                <BranchDashboard
                  label={activeBranch.label}
                  branchCode={activeBranch.branchCode}
                  funds={scopedFunds} requests={scopedRequests} disbursements={scopedDisbursements} liquidations={scopedLiquidations} replenishments={scopedReplenishments}
                  onNavigate={navigate}
                />
              </div>
            </>
          ) : (
            <>
              <TopBar
                title="Consolidated Dashboard"
                sub="Real-time summary of petty cash activity across your assigned plants"
                right={<button className="pcp-btn" onClick={() => setShowEditBalances(true)}><Edit3 size={14} /> Edit Beginning Balances</button>}
              />
              <div className="pcp-content">
                <Dashboard funds={scopedFunds} requests={scopedRequests} disbursements={scopedDisbursements} liquidations={scopedLiquidations} replenishments={scopedReplenishments} onNavigate={navigate} canEdit={canEdit} />
              </div>
            </>
          )
        )}
        {activeModule === "requests" && (
          <RequestsTab
            key={tab}
            requests={scopedRequests} funds={scopedFunds}
            onCreate={addRequest} onEdit={editRequest}
            onApprove={approveRequest} onReject={rejectRequest}
            onDisburse={(req) => setDisburseTarget(req)}
            plantOptions={scopedPlantOptions} canApprove={canApprove} canRelease={canRelease}
            plantTitle={activePlantLabel}
            canDelete={isSuperAdmin} onDelete={deleteRequest}
          />
        )}
        {activeModule === "disbursements" && (
          <DisbursementsTab
            key={tab}
            disbursements={scopedDisbursements} liquidations={scopedLiquidations} requests={scopedRequests}
            onUpdateRemarks={updateRemarks} onToggleBilled={toggleBilled} onEditDisbursement={editDisbursement}
            plantOptions={scopedPlantOptions}
            plantTitle={activePlantLabel}
            canEdit={canEditLedger}
            canDelete={isSuperAdmin} onDelete={deleteDisbursement}
          />
        )}
        {activeModule === "liquidation" && (
          <LiquidationTab
            key={tab}
            disbursements={scopedDisbursements} liquidations={scopedLiquidations}
            onSaveLiquidation={saveLiquidation} onExport={exportLiquidation}
            onExportAll={exportAllToAcumatica}
            onDecideReceipt={decideReceipt}
            onSubmitLiquidation={submitLiquidation}
            onReopenLiquidation={reopenLiquidation}
            onRecordSettlement={recordSettlement}
            onReviewOverLiquidation={reviewOverLiquidation}
            canDelete={isSuperAdmin} onDeleteLiquidation={deleteLiquidation}
            canApproveReceipts={isLiquidationApprover}
            canRejectLiquidation={isLiquidationApprover}
            onRejectLiquidation={rejectLiquidation}
            reimbursements={scopedReimbursements}
            onReimbursementAction={reimbursementAction}
            canFinance={["Accounting", "Finance", "SuperAdmin"].includes(role) || !!isAdmin}
            plantOptions={scopedPlantOptions}
            plantTitle={activePlantLabel}
          />
        )}
        {activeModule === "replenishment" && (
          <ReplenishmentTab
            key={tab}
            replenishments={scopedReplenishments} funds={scopedFunds}
            disbursements={scopedDisbursements} liquidations={scopedLiquidations}
            onCreate={addReplenishment} onEdit={editReplenishment}
            onComplete={completeReplenishment} onDelete={deleteReplenishment}
            plantOptions={scopedPlantOptions} canEdit={canEdit}
            plantTitle={activePlantLabel}
          />
        )}
        {activeModule === "reimbursement" && (
          <ReimbursementTab
            key={tab}
            reimbursements={scopedReimbursements}
            allReimbursements={reimbursements}
            plantOptions={scopedPlantOptions}
            plantTitle={activePlantLabel}
            currentUser={userName || role}
            canApprove={canApprove}
            canFinance={["Accounting", "Finance", "SuperAdmin"].includes(role) || !!isAdmin}
            canDelete={isSuperAdmin}
            onSaveDraft={(form) => addReimbursement(form, false)}
            onSubmit={(form) => addReimbursement(form, true)}
            onUpdate={(id, form, mode) => updateReimbursement(id, form, mode)}
            onAction={reimbursementAction}
            onRecordPayment={recordReimbursementPayment}
            onExportAcumatica={exportReimbursementAcumatica}
            onExportReport={exportReimbursementReport}
            onDelete={deleteReimbursement}
          />
        )}
        {activeModule === "history" && (
          <TransactionHistoryTab
            key={tab}
            requests={scopedRequests} disbursements={scopedDisbursements}
            liquidations={scopedLiquidations} replenishments={scopedReplenishments}
            initialFilter={historyFilter} plantOptions={scopedPlantOptions}
            plantTitle={activePlantLabel}
          />
        )}
        {activeModule === "report" && (
          <ManagementReportTab
            key={tab}
            funds={scopedFunds} requests={scopedRequests} disbursements={scopedDisbursements} liquidations={scopedLiquidations} replenishments={scopedReplenishments}
            auditLog={auditLog} generatedBy={userName || userEmail}
            plantTitle={activePlantLabel}
          />
        )}
        {activeModule === "aging" && (
          <LiquidationAgingTab
            funds={visibleFunds} requests={visibleRequests} disbursements={visibleDisbursements}
            liquidations={visibleLiquidations} replenishments={visibleReplenishments}
          />
        )}
        {activeModule === "audit" && (
          <AuditTrailTab auditLog={auditLog} canDelete={isSuperAdmin} onDelete={deleteAuditEntries} />
        )}
        {activeModule === "documents" && (
          <PcfDocumentsTab
            documents={documents} funds={funds} plantOptions={plantOptions}
            userName={userName} role={role} isAdmin={isAdmin}
            onAdd={addDocuments} onReplace={replaceDocument} onUpdate={updateDocument}
            onDelete={deleteDocument} onActivity={docActivity}
          />
        )}        {activeModule === "masterdata" && (
          <MasterDataTab
            funds={funds} disbursements={disbursements} liquidations={liquidations} replenishments={replenishments}
            onAddFund={addFund} onEditFund={editFund} onDeleteFund={deleteFund}
          />
        )}
        {activeModule === "users" && (
          <UserManagementTab currentEmail={userEmail} onChangePassword={() => setShowChangePw(true)} />
        )}
        {activeModule === "settings" && (
          <SystemSettingsTab
            userName={userName} userEmail={userEmail} role={role} plants={allowedPlants}
            isAdmin={isAdmin}
            requests={requests} disbursements={disbursements}
            liquidations={liquidations} replenishments={replenishments}
            onRestore={restoreState}
          />
        )}
      </div>

      {disburseTarget && (
        <DisburseModal
          request={disburseTarget}
          nextVoucherNo={nextVoucherNo}
          onClose={() => setDisburseTarget(null)}
          onConfirm={confirmDisburse}
        />
      )}
      {showEditBalances && (
        <EditBalancesModal
          funds={visibleFunds}
          onClose={() => setShowEditBalances(false)}
          onSave={(updates) => { saveBalances(updates); setShowEditBalances(false); }}
        />
      )}
      {showChangePw && (
        <ChangePasswordModal onClose={() => setShowChangePw(false)} onDone={(msg) => logAudit("Password Changed", userEmail || "—", msg || "Password updated")} />
      )}
    </div>
    </AppUI.Provider>
  );
}

