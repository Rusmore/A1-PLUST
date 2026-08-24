/* ============================= REIMBURSEMENT MODULE =============================
   Built to the Company's approved Petty Cash and Business Expense Reimbursement
   Policy (AF P16, Issue No. 1, Rev. 0). Operates INDEPENDENTLY of the Petty Cash
   Request module: the employee has already personally advanced the expense, so
   NO Petty Cash Advance Form is created. After approval the request carries its
   approved details + documents forward into the Liquidation stage (referenced by
   the Reimbursement Request Number) and on to Payment — never back to a Petty
   Cash Request.

   Every policy-dependent value lives in REIMBURSEMENT_POLICY below so the module
   can track future policy revisions without code changes. No reimbursement
   limit, approval threshold or rule is invented that the policy does not state.
------------------------------------------------------------------------------ */

/* ---- Configurable policy (baseline values are the approved AF P16 rules) ---- */
const REIMBURSEMENT_POLICY = {
  submissionWindowWorkingDays: 5,          // must submit within 5 working days of the transaction
  lateEnforcement: "warn",                 // "warn" (flag) or "block" (prevent) late submission
  approvalDays: [15, 30],                   // approvals processed every 15th and 30th
  requireOriginalReceipt: true,            // Original OR / Sales Invoice required
  blockDuplicates: true,                   // prevent an exact duplicate reimbursement
  maxFileBytes: 2 * 1024 * 1024,           // 2 MB per supporting document
  /* Section 9 — expenses that are NOT reimbursable. */
  nonReimbursable: [
    "Personal expenses",
    "Expenses without official receipt",
    "Expenses without proper approval",
    "Fines and penalties",
    "Entertainment expenses not pre-approved",
  ],
  /* Keyword hints used to surface a likely non-reimbursable expense for review. */
  nonReimbursableHints: ["fine", "penalty", "penalties", "personal", "entertainment"],
};

/* ---- Status workflow (Section 14) ---- */
const REIMB_STATUS = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  FOR_REVIEW: "FOR REVIEW",
  FOR_APPROVAL: "FOR APPROVAL",
  APPROVED: "APPROVED",
  RETURNED: "RETURNED FOR REVISION",
  REJECTED: "REJECTED",
  FOR_LIQUIDATION: "FOR LIQUIDATION",
  UNDER_REVIEW: "UNDER REVIEW",
  LIQUIDATION_DONE: "LIQUIDATION COMPLETED",
  FOR_PAYMENT: "FOR PAYMENT",
  PAID: "PAID",
  COMPLETED: "COMPLETED",
};

const REIMB_OPEN_STATUSES = [
  REIMB_STATUS.SUBMITTED, REIMB_STATUS.FOR_REVIEW, REIMB_STATUS.FOR_APPROVAL,
  REIMB_STATUS.APPROVED, REIMB_STATUS.FOR_LIQUIDATION, REIMB_STATUS.UNDER_REVIEW,
  REIMB_STATUS.LIQUIDATION_DONE, REIMB_STATUS.FOR_PAYMENT,
];

/* Reimbursement stages handled inside the Liquidation Module (Section 26). */
const REIMB_LIQUIDATION_STATUSES = [
  REIMB_STATUS.FOR_LIQUIDATION, REIMB_STATUS.UNDER_REVIEW, REIMB_STATUS.LIQUIDATION_DONE,
  REIMB_STATUS.FOR_PAYMENT, REIMB_STATUS.PAID, REIMB_STATUS.COMPLETED,
];

/* ---- Categories treated as reimbursement expense buckets on the form.
   These reuse the company chart-of-accounts expense categories so each line
   still maps to a GL account for Acumatica. ---- */
const REIMB_DOC_TYPES = ["Official Receipt", "Sales Invoice", "Approved Purchase Order", "Proof of Business Purpose", "Other"];

/* ============================= POLICY HELPERS ============================= */

/* Inclusive count of working days (Mon–Fri) between two ISO dates. Returns the
   number of working days ELAPSED from the expense date up to (and including) the
   submission date. Weekends are excluded per "working days". */
function workingDaysBetween(fromISO, toISO) {
  if (!fromISO || !toISO) return null;
  const a = new Date(fromISO + "T00:00:00");
  const b = new Date(toISO + "T00:00:00");
  if (isNaN(a) || isNaN(b) || b < a) return null;
  let count = 0;
  const d = new Date(a);
  while (d < b) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

/* The scheduled approval date for an expense, per Section 4:
   - approval on the 15th covers transactions from day 30 through day 14
   - approval on the 30th covers transactions from day 15 through day 29 */
function scheduledApprovalDate(expenseISO) {
  if (!expenseISO) return null;
  const d = new Date(expenseISO + "T00:00:00");
  if (isNaN(d)) return null;
  const day = d.getDate();
  const y = d.getFullYear();
  const m = d.getMonth();
  const endOfMonth = new Date(y, m + 1, 0).getDate();
  let approve;
  if (day >= 15 && day <= 29) {
    approve = new Date(y, m, Math.min(30, endOfMonth)); // 30th of same month
  } else {
    // day 30..end and day 1..14 -> covered by the 15th of the relevant month
    approve = (day >= 30) ? new Date(y, m + 1, 15) : new Date(y, m, 15);
  }
  return approve.toISOString().slice(0, 10);
}

const reimbLineAmount = (l) => Number(l.amount) || 0;
const reimbTotal = (r) => (r.lines || []).reduce((s, l) => s + reimbLineAmount(l), 0);

/* Duplicate detection (Section 4): same employee + expense date + vendor +
   amount + receipt/reference number already submitted or reimbursed. */
function findReimbursementDuplicates(candidate, allReimbursements, selfId) {
  const hits = [];
  (allReimbursements || []).forEach((r) => {
    if (selfId && r.id === selfId) return;
    if (r.status === REIMB_STATUS.REJECTED) return;
    const sameEmp = (r.employee || "").trim().toLowerCase() === (candidate.employee || "").trim().toLowerCase();
    if (!sameEmp) return;
    (r.lines || []).forEach((rl) => {
      (candidate.lines || []).forEach((cl) => {
        const sameDate = rl.date === cl.date;
        const sameAmt = round2(rl.amount) === round2(cl.amount) && round2(cl.amount) > 0;
        const sameVendor = (rl.vendor || "").trim().toLowerCase() === (cl.vendor || "").trim().toLowerCase() && (cl.vendor || "").trim();
        const sameRef = (rl.receiptNo || "").trim().toLowerCase() === (cl.receiptNo || "").trim().toLowerCase() && (cl.receiptNo || "").trim();
        if (sameDate && sameAmt && (sameVendor || sameRef)) {
          hits.push({ reimbNo: r.reimbNo, status: r.status, vendor: cl.vendor, amount: cl.amount, date: cl.date });
        }
      });
    });
  });
  return hits;
}

/* Policy validation engine (Sections 4, 16, 19). Returns a compliance object:
   { level: "PASS"|"WARNING"|"FAILED", issues: [{severity, code, message}] } */
function evaluateReimbursement(form, allReimbursements, selfId) {
  const issues = [];
  const add = (severity, code, message) => issues.push({ severity, code, message });
  const P = REIMBURSEMENT_POLICY;

  const lines = form.lines || [];
  const submitISO = form.requestDate || todayISO();

  // Eligibility / completeness
  if (!(form.employee || "").trim()) add("fail", "employee", "Employee name is required.");
  if (!(form.department || "").trim()) add("fail", "department", "Department charged is required.");
  if (!(form.branchCode || "").trim()) add("fail", "branch", "Company / plant is required.");
  if (!(form.purpose || "").trim()) add("fail", "purpose", "Description and purpose of the expense is required.");
  if (!lines.length) add("fail", "lines", "At least one expense line is required.");

  // Amount checks
  const total = reimbTotal(form);
  if (total <= 0) add("fail", "amount", "Total reimbursement amount must be greater than zero.");

  lines.forEach((l, i) => {
    const n = i + 1;
    if (!(l.date || "").trim()) add("fail", "line-date", `Line ${n}: expense date is required.`);
    else if (l.date > submitISO) add("fail", "line-date-future", `Line ${n}: expense date cannot be in the future.`);
    if (!(l.category || "").trim()) add("fail", "line-cat", `Line ${n}: expense category is required.`);
    if (!(l.description || "").trim()) add("fail", "line-desc", `Line ${n}: description is required.`);
    if (!(l.businessPurpose || "").trim()) add("warn", "line-purpose", `Line ${n}: business purpose is recommended.`);
    if (reimbLineAmount(l) <= 0) add("fail", "line-amt", `Line ${n}: amount must be greater than zero.`);
    if (!(l.account || "").trim()) add("warn", "line-acct", `Line ${n}: no GL account mapped for the selected category.`);
    // Non-reimbursable hints (Section 9)
    const hay = `${l.category} ${l.description} ${l.businessPurpose || ""}`.toLowerCase();
    P.nonReimbursableHints.forEach((kw) => {
      if (hay.includes(kw)) add("warn", "nonreimb-hint", `Line ${n}: "${kw}" may be a non-reimbursable expense (Section 9). Confirm it is business-related and pre-approved.`);
    });
  });

  // Timing — 5 working days after the transaction (uses the earliest expense date)
  const earliest = lines.map((l) => l.date).filter(Boolean).sort()[0];
  if (earliest) {
    const wd = workingDaysBetween(earliest, submitISO);
    if (wd != null && wd > P.submissionWindowWorkingDays) {
      const sev = P.lateEnforcement === "block" ? "fail" : "warn";
      add(sev, "late", `Submitted ${wd} working days after the earliest transaction (policy allows ${P.submissionWindowWorkingDays}). ${P.lateEnforcement === "block" ? "Late submission is blocked by policy." : "Flagged for Finance review."}`);
    }
  }

  // Documentation — Original OR / Sales Invoice required (Section 9 / 19)
  const atts = form.attachments || [];
  if (P.requireOriginalReceipt) {
    const hasReceipt = atts.some((a) => a.docType === "Official Receipt" || a.docType === "Sales Invoice");
    if (!hasReceipt) add("fail", "doc-receipt", "An Original Official Receipt or Sales Invoice must be attached (Section 9).");
  }
  if (form.needsPO && !atts.some((a) => a.docType === "Approved Purchase Order")) {
    add("fail", "doc-po", "An Approved Purchase Order is required for this request but is not attached.");
  }
  if (form.needsProof && !atts.some((a) => a.docType === "Proof of Business Purpose")) {
    add("warn", "doc-proof", "Proof of business purpose is marked as needed but not attached.");
  }

  // Non-reimbursable acknowledgements (Section 9)
  if (form.hasPersonal) add("fail", "nr-personal", "Personal expenses are not reimbursable (Section 9).");
  if (form.entertainmentNotPreApproved) add("fail", "nr-ent", "Entertainment expenses not pre-approved are not reimbursable (Section 9).");
  if (form.hasFines) add("fail", "nr-fines", "Fines and penalties are not reimbursable (Section 9).");

  // Duplicate detection (Section 4)
  if (P.blockDuplicates) {
    const dups = findReimbursementDuplicates(form, allReimbursements, selfId);
    dups.forEach((d) => add("fail", "dup", `Possible duplicate of ${d.reimbNo} (${d.vendor || "—"} · ${peso(d.amount)} · ${fmtDate(d.date)}). Duplicate reimbursement is not allowed.`));
  }

  const hasFail = issues.some((i) => i.severity === "fail");
  const hasWarn = issues.some((i) => i.severity === "warn");
  return { level: hasFail ? "FAILED" : hasWarn ? "WARNING" : "PASS", issues };
}

/* ============================= UI: COMPLIANCE PANEL ============================= */

function CompliancePill({ level }) {
  const tone = level === "PASS" ? "green" : level === "WARNING" ? "amber" : "red";
  return <span className={`pcp-badge pcp-badge-${tone}`}>Policy Compliance: {level}</span>;
}

function ComplianceList({ compliance }) {
  if (!compliance || !compliance.issues.length) {
    return <div style={{ fontSize: 12, color: "var(--text-mut)" }}>All policy checks passed. No warnings.</div>;
  }
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
      {compliance.issues.map((i, idx) => (
        <li key={idx} style={{ fontSize: 12, color: i.severity === "fail" ? "var(--brand)" : "#b9790a" }}>
          {i.severity === "fail" ? "\u274c " : "\u26a0\ufe0f "}{i.message}
        </li>
      ))}
    </ul>
  );
}

/* ============================= REIMBURSEMENT FORM (WIZARD) ============================= */

function emptyReimbLine() {
  return {
    id: uid("rln"), date: todayISO(), category: EXPENSE_CATEGORIES[0],
    description: "", vendor: "", department: SUBACCOUNTS[1].code,
    costCenter: "", taxCategory: "", amount: "", businessPurpose: "", receiptNo: "",
  };
}

function ReimbursementFormModal({ onClose, onSaveDraft, onSubmit, reimb, nextReimbNo, plantOptions, allReimbursements, currentUser }) {
  const isEdit = !!reimb;
  const defaultBranch = (plantOptions && plantOptions[0]) ? plantOptions[0].code : BRANCHES[0].code;
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(
    reimb
      ? {
          employee: reimb.employee || "", department: reimb.department || SUBACCOUNTS[1].code,
          branchCode: reimb.branchCode || defaultBranch, purpose: reimb.purpose || "",
          requestDate: reimb.requestDate || todayISO(), remarks: reimb.remarks || "",
          lines: (reimb.lines || []).map((l) => ({ ...l })),
          attachments: (reimb.attachments || []).map((a) => ({ ...a })),
          needsPO: !!reimb.needsPO, needsProof: !!reimb.needsProof,
          hasPersonal: !!reimb.hasPersonal, entertainmentNotPreApproved: !!reimb.entertainmentNotPreApproved,
          hasFines: !!reimb.hasFines, certify: false,
        }
      : {
          employee: currentUser || "", department: SUBACCOUNTS[1].code, branchCode: defaultBranch,
          purpose: "", requestDate: todayISO(), remarks: "",
          lines: [emptyReimbLine()], attachments: [],
          needsPO: false, needsProof: false, hasPersonal: false,
          entertainmentNotPreApproved: false, hasFines: false, certify: false,
        }
  );
  const [uploadNote, setUploadNote] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setLine = (id, patch) => setForm((f) => ({
    ...f,
    lines: f.lines.map((l) => {
      if (l.id !== id) return l;
      const next = { ...l, ...patch };
      if (patch.category !== undefined) next.account = accountForCategory(patch.category);
      return next;
    }),
  }));
  const addLine = () => setForm((f) => ({ ...f, lines: [...f.lines, emptyReimbLine()] }));
  const removeLine = (id) => setForm((f) => ({ ...f, lines: f.lines.length > 1 ? f.lines.filter((l) => l.id !== id) : f.lines }));

  const onPickFiles = (fileList, docType) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploadNote("");
    files.forEach((file) => {
      if (file.size > REIMBURSEMENT_POLICY.maxFileBytes) {
        setUploadNote(`"${file.name}" is larger than 2 MB and was skipped. Please compress it first.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const doc = {
          id: uid("ratt"), name: file.name, type: file.type || "file", size: file.size,
          data: reader.result, uploadedAt: todayISO(), docType: docType || "Official Receipt", receiptNo: "",
        };
        setForm((f) => ({ ...f, attachments: [...f.attachments, doc] }));
      };
      reader.readAsDataURL(file);
    });
  };
  const removeAtt = (id) => setForm((f) => ({ ...f, attachments: f.attachments.filter((a) => a.id !== id) }));
  const setAttType = (id, docType) => setForm((f) => ({ ...f, attachments: f.attachments.map((a) => (a.id === id ? { ...a, docType } : a)) }));

  // Ensure each line carries its mapped account for validation/export.
  const normalizedForm = useMemo(() => ({
    ...form,
    lines: form.lines.map((l) => ({ ...l, account: l.account || accountForCategory(l.category), amount: Number(l.amount) || 0 })),
    company: companyOfBranch(form.branchCode),
  }), [form]);

  const compliance = useMemo(
    () => evaluateReimbursement(normalizedForm, allReimbursements, reimb && reimb.id),
    [normalizedForm, allReimbursements, reimb]
  );
  const total = reimbTotal(normalizedForm);
  const canSubmit = compliance.level !== "FAILED" && form.certify;

  const payload = () => ({ ...normalizedForm });

  const Stepper = () => {
    const steps = ["Expense Info", "Expense Lines", "Documents", "Review", "Submit"];
    return (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {steps.map((s, i) => (
          <button
            key={s}
            className={"pcp-tab" + (step === i + 1 ? " active" : "")}
            onClick={() => setStep(i + 1)}
            style={{ fontSize: 12 }}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, width: "94%" }}>
        <div className="pcp-modal-head">
          <h3>{isEdit ? `Edit Reimbursement · ${reimb.reimbNo}` : "New Reimbursement Request"}</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          <Stepper />

          {/* STEP 1 — Expense Information */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="pcp-field-row">
                <div className="pcp-field">
                  <label>Reimbursement No.</label>
                  <input className="pcp-input" value={isEdit ? reimb.reimbNo : nextReimbNo} disabled />
                </div>
                <div className="pcp-field">
                  <label>Request Date</label>
                  <input type="date" className="pcp-input" value={form.requestDate} onChange={(e) => set("requestDate", e.target.value)} />
                </div>
              </div>
              <div className="pcp-field-row">
                <div className="pcp-field">
                  <label>Employee Name</label>
                  <input className="pcp-input" placeholder="Full name" value={form.employee} onChange={(e) => set("employee", e.target.value)} />
                </div>
                <div className="pcp-field">
                  <label>Company / Plant</label>
                  <select className="pcp-select" value={form.branchCode} onChange={(e) => set("branchCode", e.target.value)}>
                    {plantOptions
                      ? plantOptions.map((p) => <option key={p.code} value={p.code}>{p.label} ({p.code})</option>)
                      : COMPANIES.map((c) => (
                          <optgroup label={c} key={c}>
                            {branchesForCompany(c).map((b) => <option key={b.code} value={b.code}>{b.name} ({b.code})</option>)}
                          </optgroup>
                        ))}
                  </select>
                </div>
              </div>
              <div className="pcp-field-row">
                <div className="pcp-field">
                  <label>Department Charged</label>
                  <select className="pcp-select" value={form.department} onChange={(e) => set("department", e.target.value)}>
                    {SUBACCOUNTS.filter((s) => s.desc).map((s) => <option key={s.code} value={s.code}>{s.desc} ({s.code})</option>)}
                  </select>
                </div>
                <div className="pcp-field">
                  <label>Company</label>
                  <input className="pcp-input" value={companyOfBranch(form.branchCode)} disabled />
                </div>
              </div>
              <div className="pcp-field">
                <label>Description &amp; Purpose of Expense</label>
                <textarea className="pcp-input" rows={2} placeholder="Overall business purpose of this reimbursement" value={form.purpose} onChange={(e) => set("purpose", e.target.value)} />
              </div>
              <div className="pcp-field">
                <label>Remarks (optional)</label>
                <input className="pcp-input" value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
              </div>
            </div>
          )}

          {/* STEP 2 — Expense Lines */}
          {step === 2 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Expense Lines</div>
                <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={addLine}><Plus size={13} /> Add Line</button>
              </div>
              <div className="pcp-table-wrap">
                <table className="pcp-table">
                  <thead>
                    <tr>
                      <th>Date</th><th>Category</th><th>Description</th><th>Vendor</th>
                      <th>Department</th><th>Cost Center</th><th>Tax</th><th>Business Purpose</th>
                      <th>Receipt No.</th><th>Amount</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.lines.map((l) => (
                      <tr key={l.id}>
                        <td><input type="date" className="pcp-input" style={{ minWidth: 130 }} value={l.date} onChange={(e) => setLine(l.id, { date: e.target.value })} /></td>
                        <td>
                          <select className="pcp-select" style={{ minWidth: 150 }} value={l.category} onChange={(e) => setLine(l.id, { category: e.target.value })}>
                            {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                          </select>
                        </td>
                        <td><input className="pcp-input" style={{ minWidth: 140 }} value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} /></td>
                        <td><input className="pcp-input" style={{ minWidth: 110 }} value={l.vendor} onChange={(e) => setLine(l.id, { vendor: e.target.value })} /></td>
                        <td>
                          <select className="pcp-select" style={{ minWidth: 150 }} value={l.department} onChange={(e) => setLine(l.id, { department: e.target.value })}>
                            {SUBACCOUNTS.filter((s) => s.desc).map((s) => <option key={s.code} value={s.code}>{s.desc}</option>)}
                          </select>
                        </td>
                        <td><input className="pcp-input" style={{ minWidth: 90 }} placeholder="optional" value={l.costCenter} onChange={(e) => setLine(l.id, { costCenter: e.target.value })} /></td>
                        <td>
                          <select className="pcp-select" style={{ minWidth: 90 }} value={l.taxCategory} onChange={(e) => setLine(l.id, { taxCategory: e.target.value })}>
                            <option value="">—</option>
                            {TAX_CATEGORIES.map((t) => <option key={t.code} value={t.code} title={t.desc}>{t.code}</option>)}
                          </select>
                        </td>
                        <td><input className="pcp-input" style={{ minWidth: 120 }} value={l.businessPurpose} onChange={(e) => setLine(l.id, { businessPurpose: e.target.value })} /></td>
                        <td><input className="pcp-input" style={{ minWidth: 90 }} value={l.receiptNo} onChange={(e) => setLine(l.id, { receiptNo: e.target.value })} /></td>
                        <td><input type="number" min="0" step="0.01" className="pcp-input" style={{ minWidth: 90 }} value={l.amount} onChange={(e) => setLine(l.id, { amount: e.target.value })} /></td>
                        <td><button className="pcp-btn pcp-btn-sm pcp-btn-ghost" onClick={() => removeLine(l.id)} title="Remove line"><Trash2 size={13} color="var(--brand)" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={9} style={{ textAlign: "right", fontWeight: 600 }}>Total Reimbursement</td>
                      <td className="pcp-num" style={{ fontWeight: 700 }}>{peso(total)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3 — Supporting Documents */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="pcp-field-row">
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <input type="checkbox" checked={form.needsPO} onChange={(e) => set("needsPO", e.target.checked)} /> An Approved Purchase Order applies
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <input type="checkbox" checked={form.needsProof} onChange={(e) => set("needsProof", e.target.checked)} /> Proof of business purpose is needed
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {REIMB_DOC_TYPES.map((dt) => (
                  <label key={dt} className="pcp-btn pcp-btn-sm" style={{ cursor: "pointer" }}>
                    <Upload size={13} /> {dt}
                    <input type="file" hidden multiple onChange={(e) => { onPickFiles(e.target.files, dt); e.target.value = ""; }} />
                  </label>
                ))}
              </div>
              {uploadNote && <div style={{ fontSize: 12, color: "var(--brand)" }}>{uploadNote}</div>}
              <div className="pcp-table-wrap">
                <table className="pcp-table">
                  <thead><tr><th>Document</th><th>Type</th><th>Size</th><th></th></tr></thead>
                  <tbody>
                    {form.attachments.length ? form.attachments.map((a) => (
                      <tr key={a.id}>
                        <td><a href={a.data} download={a.name} style={{ color: "var(--brand)" }}><Paperclip size={12} /> {a.name}</a></td>
                        <td>
                          <select className="pcp-select" value={a.docType} onChange={(e) => setAttType(a.id, e.target.value)}>
                            {REIMB_DOC_TYPES.map((dt) => <option key={dt}>{dt}</option>)}
                          </select>
                        </td>
                        <td>{(a.size / 1024).toFixed(0)} KB</td>
                        <td><button className="pcp-btn pcp-btn-sm pcp-btn-ghost" onClick={() => removeAtt(a.id)}><Trash2 size={13} color="var(--brand)" /></button></td>
                      </tr>
                    )) : <tr><td colSpan={4} className="pcp-empty">No documents attached. An Original OR / Sales Invoice is required.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4 — Review */}
          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Total: {peso(total)}</div>
                <CompliancePill level={compliance.level} />
              </div>
              <div className="pcp-card" style={{ padding: 12 }}>
                <div style={{ fontSize: 12, color: "var(--text-mut)" }}>
                  {form.employee || "—"} · {subaccountLabel(form.department)} · {plantLabel(form.branchCode)} ({companyOfBranch(form.branchCode)})
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{form.purpose || "—"}</div>
              </div>
              <div className="pcp-table-wrap">
                <table className="pcp-table">
                  <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Vendor</th><th>Account</th><th>Amount</th></tr></thead>
                  <tbody>
                    {normalizedForm.lines.map((l) => (
                      <tr key={l.id}>
                        <td>{fmtDate(l.date)}</td><td>{l.category}</td><td>{l.description}</td>
                        <td>{l.vendor || "—"}</td><td>{l.account || "—"}</td><td className="pcp-num">{peso(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pcp-card" style={{ padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Attachments ({form.attachments.length})</div>
                <div style={{ fontSize: 12, color: "var(--text-mut)" }}>{form.attachments.map((a) => `${a.name} (${a.docType})`).join(", ") || "None"}</div>
              </div>
              <div className="pcp-card" style={{ padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Applicable Approval Schedule</div>
                <div style={{ fontSize: 12, color: "var(--text-mut)" }}>
                  Approvals are processed on the 15th and 30th. Based on the earliest expense date, this request is scheduled for approval on{" "}
                  <b>{fmtDate(scheduledApprovalDate((normalizedForm.lines.map((l) => l.date).filter(Boolean).sort()[0]) || form.requestDate))}</b>.
                </div>
              </div>
              <div className="pcp-card" style={{ padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Policy Compliance</div>
                <ComplianceList compliance={compliance} />
              </div>
            </div>
          )}

          {/* STEP 5 — Submit */}
          {step === 5 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <CompliancePill level={compliance.level} />
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>Section 9 — Non-reimbursable acknowledgements</div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <input type="checkbox" checked={form.hasPersonal} onChange={(e) => set("hasPersonal", e.target.checked)} /> This request includes personal expenses
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <input type="checkbox" checked={form.entertainmentNotPreApproved} onChange={(e) => set("entertainmentNotPreApproved", e.target.checked)} /> Includes entertainment expenses that were NOT pre-approved
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <input type="checkbox" checked={form.hasFines} onChange={(e) => set("hasFines", e.target.checked)} /> Includes fines or penalties
              </label>
              {compliance.level === "FAILED" && (
                <div className="pcp-card" style={{ padding: 12, borderColor: "#f0c0c0" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--brand)", marginBottom: 6 }}>Submission blocked — resolve the following:</div>
                  <ComplianceList compliance={{ issues: compliance.issues.filter((i) => i.severity === "fail") }} />
                </div>
              )}
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 6 }}>
                <input type="checkbox" checked={form.certify} onChange={(e) => set("certify", e.target.checked)} />
                I certify that the information is accurate, the expenses were personally advanced for legitimate Company business, and the required documents are attached.
              </label>
            </div>
          )}
        </div>
        <div className="pcp-modal-foot" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="pcp-btn" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>Back</button>
            <button className="pcp-btn" onClick={() => setStep((s) => Math.min(5, s + 1))} disabled={step === 5}>Next</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="pcp-btn" onClick={() => onSaveDraft(payload())}>Save Draft</button>
            <button
              className="pcp-btn pcp-btn-primary"
              disabled={!canSubmit}
              title={!form.certify ? "Confirm the certification on the Submit step" : compliance.level === "FAILED" ? "Resolve policy failures before submitting" : ""}
              onClick={() => onSubmit(payload())}
            >
              {isEdit && reimb.status === REIMB_STATUS.RETURNED ? "Resubmit Request" : "Submit Request"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================= APPROVAL / DETAIL DRAWER ============================= */

function ReimbursementDetail({ reimb, onClose, onAction, onExportAcumatica, currentUser, canApprove, canFinance }) {
  const [comments, setComments] = useState("");
  const total = reimbTotal(reimb);
  const isOwn = (reimb.employee || "").trim().toLowerCase() === (currentUser || "").trim().toLowerCase()
    || (reimb.createdBy || "").trim().toLowerCase() === (currentUser || "").trim().toLowerCase();
  const st = reimb.status;

  const act = (action) => { onAction(reimb.id, action, { comments }); setComments(""); };

  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860, width: "94%" }}>
        <div className="pcp-modal-head">
          <h3>{reimb.reimbNo} · <Badge status={st} /></h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body" style={{ maxHeight: "72vh", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 13 }}>
              <b>{reimb.employee}</b> · {subaccountLabel(reimb.department)} · {plantLabel(reimb.branchCode)} ({companyOfBranch(reimb.branchCode)})
            </div>
            <CompliancePill level={(reimb.compliance && reimb.compliance.level) || "PASS"} />
          </div>
          <div style={{ fontSize: 12, color: "var(--text-mut)", marginBottom: 10 }}>{reimb.purpose}</div>

          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Vendor</th><th>Account</th><th>Dept</th><th>Amount</th></tr></thead>
              <tbody>
                {(reimb.lines || []).map((l) => (
                  <tr key={l.id}>
                    <td>{fmtDate(l.date)}</td><td>{l.category}</td><td>{l.description}</td>
                    <td>{l.vendor || "—"}</td><td>{l.account || "—"}</td><td>{deptDesc(l.department)}</td>
                    <td className="pcp-num">{peso(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={6} style={{ textAlign: "right", fontWeight: 600 }}>Total</td><td className="pcp-num" style={{ fontWeight: 700 }}>{peso(total)}</td></tr></tfoot>
            </table>
          </div>

          <div className="pcp-card" style={{ padding: 12, marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Supporting Documents</div>
            {(reimb.attachments || []).length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {reimb.attachments.map((a) => (
                  <a key={a.id} href={a.data} download={a.name} style={{ fontSize: 12, color: "var(--brand)" }}>
                    <Paperclip size={12} /> {a.name} · {a.docType}
                  </a>
                ))}
              </div>
            ) : <div style={{ fontSize: 12, color: "var(--text-mut)" }}>None</div>}
          </div>

          {reimb.payment && reimb.payment.date && (
            <div className="pcp-card" style={{ padding: 12, marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Payment</div>
              <div style={{ fontSize: 12, color: "var(--text-mut)" }}>
                {fmtDate(reimb.payment.date)} · {reimb.payment.method} · {reimb.payment.refNo || "—"} · {peso(reimb.payment.amount)} · by {reimb.payment.processedBy}
                {reimb.payment.remarks ? ` · ${reimb.payment.remarks}` : ""}
              </div>
            </div>
          )}

          <div className="pcp-card" style={{ padding: 12, marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Policy Compliance</div>
            <ComplianceList compliance={reimb.compliance} />
          </div>

          <div className="pcp-card" style={{ padding: 12, marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Approval &amp; Audit History</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {(reimb.history || []).map((h, i) => (
                <div key={i} style={{ fontSize: 11.5, color: "var(--text-mut)" }}>
                  {h.ts} · <b>{h.action}</b> · {h.user}{h.prevStatus ? ` · ${h.prevStatus} → ${h.newStatus}` : ""}{h.comments ? ` · "${h.comments}"` : ""}
                </div>
              ))}
              {!(reimb.history || []).length && <div style={{ fontSize: 12, color: "var(--text-mut)" }}>No history yet.</div>}
            </div>
          </div>

          <div className="pcp-card" style={{ padding: 12, marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Acumatica</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Badge status={reimb.acumaticaStatus || "Not Yet Exported"} />
              {canFinance && st === REIMB_STATUS.COMPLETED && (
                <button className="pcp-btn pcp-btn-sm" onClick={() => onExportAcumatica(reimb)}><Download size={13} /> Export to Acumatica</button>
              )}
            </div>
          </div>

          {/* Action comment box */}
          {(canApprove || canFinance) && REIMB_OPEN_STATUSES.includes(st) && (
            <div className="pcp-field" style={{ marginTop: 12 }}>
              <label>Comments (recorded in the audit trail)</label>
              <textarea className="pcp-input" rows={2} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Optional for approve · required to return/reject" />
            </div>
          )}
        </div>

        <div className="pcp-modal-foot" style={{ flexWrap: "wrap", gap: 8 }}>
          {/* Reviewer actions */}
          {canApprove && (st === REIMB_STATUS.SUBMITTED || st === REIMB_STATUS.FOR_REVIEW) && (
            <>
              <button className="pcp-btn pcp-btn-primary" onClick={() => act("recommend")}><Check size={13} /> Recommend for Approval</button>
              <button className="pcp-btn" onClick={() => act("return")} disabled={!comments.trim()}>Return for Revision</button>
              <button className="pcp-btn pcp-btn-danger" onClick={() => act("reject")} disabled={!comments.trim()}>Reject</button>
            </>
          )}
          {/* Approver actions — segregation of duties: cannot approve own request */}
          {canApprove && st === REIMB_STATUS.FOR_APPROVAL && (
            isOwn ? (
              <div style={{ fontSize: 12, color: "var(--brand)" }}>Segregation of duties: you cannot approve your own reimbursement.</div>
            ) : (
              <>
                <button className="pcp-btn pcp-btn-primary" onClick={() => act("approve")}><Check size={13} /> Approve</button>
                <button className="pcp-btn" onClick={() => act("return")} disabled={!comments.trim()}>Return for Revision</button>
                <button className="pcp-btn pcp-btn-danger" onClick={() => act("reject")} disabled={!comments.trim()}>Reject</button>
              </>
            )
          )}
          {/* Approved -> Liquidation handoff (automatic status FOR LIQUIDATION already set on approve).
             Finance completes the liquidation processing (also available in the Liquidation Module). */}
          {canFinance && (st === REIMB_STATUS.FOR_LIQUIDATION || st === REIMB_STATUS.UNDER_REVIEW) && (
            <button className="pcp-btn pcp-btn-primary" onClick={() => act("liquidation-complete")}><FileSpreadsheet size={13} /> Mark Liquidation Completed</button>
          )}
          {canFinance && st === REIMB_STATUS.LIQUIDATION_DONE && (
            <button className="pcp-btn pcp-btn-primary" onClick={() => act("for-payment")}><Banknote size={13} /> Move to Payment</button>
          )}
          {canFinance && st === REIMB_STATUS.FOR_PAYMENT && (
            <button className="pcp-btn pcp-btn-primary" onClick={() => act("pay")}><Banknote size={13} /> Record Payment</button>
          )}
          {canFinance && st === REIMB_STATUS.PAID && (
            <button className="pcp-btn pcp-btn-primary" onClick={() => act("complete")}><Check size={13} /> Mark Completed</button>
          )}
          <button className="pcp-btn" onClick={onClose} style={{ marginLeft: "auto" }}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ============================= PAYMENT MODAL ============================= */

function ReimbursementPaymentModal({ reimb, onClose, onConfirm, processedBy }) {
  const [form, setForm] = useState({
    date: todayISO(), method: "Cash", refNo: "", amount: reimbTotal(reimb), remarks: "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.date && Number(form.amount) > 0 && (form.method !== "Check" || form.refNo.trim());
  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3>Record Payment · {reimb.reimbNo}</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body">
          <div className="pcp-field-row">
            <div className="pcp-field"><label>Payment Date</label><input type="date" className="pcp-input" value={form.date} onChange={(e) => set("date", e.target.value)} /></div>
            <div className="pcp-field">
              <label>Payment Method</label>
              <select className="pcp-select" value={form.method} onChange={(e) => set("method", e.target.value)}>
                <option>Cash</option><option>Check</option>
              </select>
            </div>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field"><label>Reference / Check No. {form.method === "Check" && <span style={{ color: "var(--brand)" }}>*</span>}</label><input className="pcp-input" value={form.refNo} onChange={(e) => set("refNo", e.target.value)} /></div>
            <div className="pcp-field"><label>Payment Amount (₱)</label><input type="number" min="0" step="0.01" className="pcp-input" value={form.amount} onChange={(e) => set("amount", e.target.value)} /></div>
          </div>
          <div className="pcp-field"><label>Payment Remarks</label><input className="pcp-input" value={form.remarks} onChange={(e) => set("remarks", e.target.value)} /></div>
          <div style={{ fontSize: 12, color: "var(--text-mut)" }}>Processed by {processedBy}</div>
        </div>
        <div className="pcp-modal-foot">
          <button className="pcp-btn" onClick={onClose}>Cancel</button>
          <button className="pcp-btn pcp-btn-primary" disabled={!valid} onClick={() => onConfirm({ ...form, amount: Number(form.amount), processedBy })}>Confirm Payment</button>
        </div>
      </div>
    </div>
  );
}

/* ============================= REIMBURSEMENT TAB ============================= */

function reimbAgingBucket(reimb) {
  const base = reimb.requestDate || reimb.createdAt || todayISO();
  const days = Math.floor((Date.now() - new Date(base + "T00:00:00").getTime()) / 86400000);
  if (reimb.status === REIMB_STATUS.COMPLETED || reimb.status === REIMB_STATUS.PAID) return "Settled";
  if (days <= 3) return "0–3 Days";
  if (days <= 7) return "4–7 Days";
  if (days <= 15) return "8–15 Days";
  if (days <= 30) return "16–30 Days";
  return "Over 30 Days";
}

function ReimbursementTab({
  reimbursements, allReimbursements, onSaveDraft, onSubmit, onUpdate, onAction, onRecordPayment,
  onExportAcumatica, onExportReport, onDelete, plantOptions, plantTitle, currentUser,
  canApprove, canFinance, canDelete,
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [paying, setPaying] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [plant, setPlant] = useState("ALL");

  const seq = (allReimbursements || reimbursements).length + 1;
  const nextReimbNo = "REIM-2026-" + String(seq).padStart(6, "0");

  const filtered = reimbursements.filter((r) => {
    if (plant !== "ALL" && r.branchCode !== plant) return false;
    if (statusFilter !== "All" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(r.employee.toLowerCase().includes(q) || r.reimbNo.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const kpi = useMemo(() => {
    const by = (s) => reimbursements.filter((r) => r.status === s);
    const sum = (arr) => arr.reduce((s, r) => s + reimbTotal(r), 0);
    const pending = reimbursements.filter((r) => REIMB_OPEN_STATUSES.includes(r.status));
    const paid = by(REIMB_STATUS.PAID).concat(by(REIMB_STATUS.COMPLETED));
    return {
      pending: pending.length,
      forApproval: by(REIMB_STATUS.FOR_APPROVAL).length + by(REIMB_STATUS.SUBMITTED).length + by(REIMB_STATUS.FOR_REVIEW).length,
      approved: by(REIMB_STATUS.APPROVED).length + by(REIMB_STATUS.FOR_LIQUIDATION).length + by(REIMB_STATUS.UNDER_REVIEW).length + by(REIMB_STATUS.LIQUIDATION_DONE).length,
      forPayment: by(REIMB_STATUS.FOR_PAYMENT).length,
      paid: paid.length,
      rejected: by(REIMB_STATUS.REJECTED).length,
      returned: by(REIMB_STATUS.RETURNED).length,
      amtPending: sum(pending),
      amtPaid: sum(paid),
    };
  }, [reimbursements]);

  const formPlantOptions = (plantOptions && plantOptions.length)
    ? (plant !== "ALL" ? plantOptions.filter((p) => p.code === plant) : plantOptions)
    : null;

  const handleAction = (id, action, payload) => {
    if (action === "pay") { const r = reimbursements.find((x) => x.id === id); setDetail(null); setPaying(r); return; }
    onAction(id, action, payload);
    setDetail(null);
  };

  return (
    <div>
      <TopBar
        title={(plantTitle ? plantTitle + " \u00b7 " : "") + "Reimbursement"}
        sub="Request reimbursement for business expenses you personally advanced — no Petty Cash Advance required"
        right={<>
          <button className="pcp-btn" onClick={() => onExportReport(reimbursements)}><Download size={14} /> Export</button>
          <button className="pcp-btn pcp-btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={14} /> New Reimbursement</button>
        </>}
      />
      <div className="pcp-content">
        <PlantScopeTabs plants={plantOptions} value={plant} onChange={setPlant} />

        <div className="pcp-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
          <KpiCard label="Pending Reimbursements" value={kpi.pending} icon={ClipboardList} tint="#b9790a" foot={peso(kpi.amtPending)} />
          <KpiCard label="For Review / Approval" value={kpi.forApproval} icon={Check} tint="#2054a3" />
          <KpiCard label="Approved / For Liquidation" value={kpi.approved} icon={FileSpreadsheet} tint="#7c3aed" />
          <KpiCard label="For Payment" value={kpi.forPayment} icon={Banknote} tint="#0891b2" />
          <KpiCard label="Paid" value={kpi.paid} icon={CircleDollarSign} tint="#15803d" foot={peso(kpi.amtPaid)} />
          <KpiCard label="Rejected / Returned" value={kpi.rejected + kpi.returned} icon={X} tint="#c8102e" />
        </div>

        <div className="pcp-card">
          <div style={{ padding: "14px 18px", display: "flex", gap: 10, alignItems: "center", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
              <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#9098b3" }} />
              <input className="pcp-input" style={{ paddingLeft: 28 }} placeholder="Search employee or reimbursement no." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="pcp-select" style={{ width: 200 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {["All", ...Object.values(REIMB_STATUS)].map((s) => <option key={s}>{s}</option>)}
            </select>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-mut)" }}>{filtered.length} of {reimbursements.length}</div>
          </div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead>
                <tr>
                  <th>Reimb No.</th><th>Req Date</th><th>Employee</th><th>Department</th><th>Plant</th>
                  <th>Lines</th><th>Amount</th><th>Compliance</th><th>Status</th><th>Aging</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.reimbNo}</td>
                    <td>{fmtDate(r.requestDate)}</td>
                    <td>{r.employee}</td>
                    <td title={subaccountLabel(r.department)}>{deptDesc(r.department)}</td>
                    <td>{plantLabel(r.branchCode)}</td>
                    <td>{(r.lines || []).length}</td>
                    <td className="pcp-num">{peso(reimbTotal(r))}</td>
                    <td><CompliancePill level={(r.compliance && r.compliance.level) || "PASS"} /></td>
                    <td><Badge status={r.status} /></td>
                    <td>{reimbAgingBucket(r)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="pcp-btn pcp-btn-sm" onClick={() => setDetail(r)} title="View / action"><Eye size={12} /></button>
                        {(r.status === REIMB_STATUS.DRAFT || r.status === REIMB_STATUS.RETURNED) && (
                          <button className="pcp-btn pcp-btn-sm" onClick={() => { setEditing(r); setShowForm(true); }} title="Edit"><Edit3 size={12} /></button>
                        )}
                        {canDelete && onDelete && (
                          <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" onClick={() => onDelete(r.id)} title="Delete (super admin)"><Trash2 size={13} color="var(--brand)" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={11} className="pcp-empty">No reimbursement requests match your filters</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showForm && (
        <ReimbursementFormModal
          reimb={editing}
          nextReimbNo={nextReimbNo}
          plantOptions={formPlantOptions}
          allReimbursements={allReimbursements || reimbursements}
          currentUser={currentUser}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaveDraft={(form) => { editing ? onUpdate(editing.id, form, "draft") : onSaveDraft(form); setShowForm(false); setEditing(null); }}
          onSubmit={(form) => { editing ? onUpdate(editing.id, form, "submit") : onSubmit(form); setShowForm(false); setEditing(null); }}
        />
      )}
      {detail && (
        <ReimbursementDetail
          reimb={reimbursements.find((x) => x.id === detail.id) || detail}
          currentUser={currentUser}
          canApprove={canApprove}
          canFinance={canFinance}
          onExportAcumatica={onExportAcumatica}
          onAction={handleAction}
          onClose={() => setDetail(null)}
        />
      )}
      {paying && (
        <ReimbursementPaymentModal
          reimb={paying}
          processedBy={currentUser}
          onClose={() => setPaying(null)}
          onConfirm={(payment) => { onRecordPayment(paying.id, payment); setPaying(null); }}
        />
      )}
    </div>
  );
}
