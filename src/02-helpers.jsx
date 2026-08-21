/* ============================= HELPERS ============================= */

const peso = (n) => {
  const v = Number(n) || 0;
  return "₱" + v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const shortPeso = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000000) return "₱" + (v / 1000000).toFixed(2) + "M";
  if (Math.abs(v) >= 1000) return "₱" + (v / 1000).toFixed(1) + "K";
  return "₱" + v.toFixed(0);
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
};

const uid = (prefix) => prefix + "-" + Math.random().toString(36).slice(2, 9).toUpperCase();

/* ============================= CASH DENOMINATION (Section 23) ============================= */

/* Standard Philippine peso denominations, largest first. */
const PESO_DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 1];

/* Sum of (denomination x quantity) from a { denom: qty } map. */
function denominationTotal(counts) {
  return PESO_DENOMINATIONS.reduce((s, d) => s + d * (Number((counts || {})[d]) || 0), 0);
}

/* Human-readable breakdown for audit remarks, e.g. "2x1000, 1x500". */
function denominationSummary(counts) {
  return PESO_DENOMINATIONS
    .filter((d) => Number((counts || {})[d]) > 0)
    .map((d) => `${Number(counts[d])}x${d}`)
    .join(", ");
}

const branchByCode = (code) => BRANCHES.find((b) => b.code === code);
const companyOfBranch = (code) => branchByCode(code)?.company || "—";
const subaccountLabel = (code) => {
  const s = SUBACCOUNTS.find((x) => x.code === code);
  if (!s) return code || "—";
  return s.desc ? `${s.code} — ${s.desc}` : s.code;
};
/* Department description only — no code number (used for report line descriptions). */
const deptDesc = (code) => {
  const s = SUBACCOUNTS.find((x) => x.code === code);
  return (s && s.desc) ? s.desc : (code || "");
};

const branchesForCompany = (company) => BRANCHES.filter((b) => b.company === company);

/* ============================= SEED DATA ============================= */

const seedFunds = () => ([
  { id: "fund-MNL", branchCode: "A1+", label: "Manila", custodian: "Maureen Felix", beginningBalance: 600000 },
  { id: "fund-DIS", branchCode: "D1", label: "Disney", custodian: "Pura Barloso", beginningBalance: 704035.23 },
  { id: "fund-WAR", branchCode: "WARNER", label: "Warner", custodian: "Angelita Bayani", beginningBalance: 150000 },
  { id: "fund-RG", branchCode: "RG", label: "RG and Co.", custodian: "Pura Barloso", beginningBalance: 300000 },
]);

/* Transaction stores start EMPTY — the system begins with a clean database and
   only master data (plants, users, chart of accounts) is pre-seeded. */
const seedRequests = () => ([]);

const seedDisbursements = () => ([]);

const seedLiquidations = () => ([]);

const seedReplenishments = () => ([]);

const seedAuditLog = () => ([]);

const STORAGE_KEY = "petty-cash-portal-state";
/* Bump this whenever transaction data must be wiped for a clean start on
   already-deployed databases. Loading a state with an older version keeps the
   master data (funds) but clears all recorded transactions. */
const DATA_VERSION = "2026-clean-1";

async function loadState() {
  try {
    const res = await window.storage.get(STORAGE_KEY, false);
    if (res && res.value) return JSON.parse(res.value);
  } catch (e) { /* not found or storage unavailable */ }
  return null;
}

async function saveState(state) {
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify(state), false);
  } catch (e) { /* best effort */ }
}

/* ============================= DERIVED METRICS ============================= */

function liquidationFor(disbursementId, liquidations) {
  return liquidations.find((l) => l.disbursementId === disbursementId) || null;
}

function liquidatedTotal(liq) {
  if (!liq) return 0;
  return liq.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
}

function liqStatusFor(disb, liquidations) {
  const liq = liquidationFor(disb.id, liquidations);
  const total = liquidatedTotal(liq);
  if (total === 0) return "Not Liquidated";
  if (total < disb.amount) return "Partially Liquidated";
  if (total === disb.amount) return "Fully Liquidated";
  return "Over-Liquidated";
}

/* ---- Receipt (Official Receipt / Sales Invoice) approval helpers ----
   Every uploaded receipt carries its own approvalStatus (Pending/Approved/
   Rejected). These derive the roll-up used to gate final liquidation submission
   and to drive dashboard widgets. */
function receiptApprovalSummary(liq) {
  const atts = (liq && liq.attachments) || [];
  let approved = 0, rejected = 0, pending = 0;
  atts.forEach((a) => {
    const s = a.approvalStatus || "Pending";
    if (s === "Approved") approved++;
    else if (s === "Rejected") rejected++;
    else pending++;
  });
  const total = atts.length;
  return {
    total, approved, rejected, pending,
    allApproved: total > 0 && approved === total,
    anyRejected: rejected > 0,
  };
}

/* Overall approval state of a liquidation's receipts. */
function liqApprovalStatus(liq) {
  const s = receiptApprovalSummary(liq);
  if (s.total === 0) return "No Receipts";
  if (s.anyRejected) return "For Revision";
  if (s.allApproved) return "Receipts Approved";
  return "Pending Approval";
}

/* ---- Receipt amounts at the SUPPORTING DOCUMENT level ----
   Each uploaded document carries its own receiptAmount, so the liquidation
   total is always recalculated from the individual documents rather than being
   stored as a standalone figure. This keeps every receipt independently
   auditable and lets totals be re-derived at any time. */

/* Document classifications available for each supporting document. */
const RECEIPT_DOC_TYPES = [
  "Official Receipt",
  "Sales Invoice",
  "Cash Invoice",
  "Acknowledgement Receipt",
  "Delivery Receipt",
  "Provisional Receipt",
  "Billing Statement",
  "Other Supporting Document",
];
const DEFAULT_DOC_TYPE = "Official Receipt";

/* Document types that merely SUPPORT the liquidation and carry no peso amount
   of their own (approval sheets, permits, photos, correspondence…). Their
   Receipt Amount is optional — still counted if one is entered, but never
   required and never a reason to block submission. Add a type here to exempt
   it. */
const NON_AMOUNT_DOC_TYPES = ["Other Supporting Document"];
const docRequiresAmount = (a) => !NON_AMOUNT_DOC_TYPES.includes((a && a.docType) || DEFAULT_DOC_TYPE);

/* Peso amounts are held to centavos so comparisons never fail on float dust. */
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* Only approved documents count toward the final liquidation total — pending,
   rejected and voided documents are excluded from the computation. */
function isCountableReceipt(a) {
  return !!a && (a.approvalStatus || "Pending") === "Approved";
}

function receiptAmountOf(a) {
  const n = Number(a && a.receiptAmount);
  return Number.isFinite(n) && n > 0 ? round2(n) : 0;
}

/* Roll-up of the per-document receipt amounts. `approvedTotal` is the figure
   used for reconciliation; `missing` counts documents still awaiting an amount.
   Rejected documents are exempt because they never enter the total, and so are
   the non-amount supporting types (see NON_AMOUNT_DOC_TYPES). */
function receiptAmountSummary(liq) {
  const atts = (liq && liq.attachments) || [];
  let approvedTotal = 0, allTotal = 0, missing = 0, approvedCount = 0, amountBearing = 0, exemptByType = 0;
  atts.forEach((a) => {
    const amt = receiptAmountOf(a);
    allTotal += amt;
    if (!docRequiresAmount(a)) exemptByType++;
    const needsAmount = (a.approvalStatus || "Pending") !== "Rejected" && docRequiresAmount(a);
    if (needsAmount) {
      amountBearing++;
      if (!(Number(a.receiptAmount) > 0)) missing++;
    }
    if (isCountableReceipt(a)) { approvedTotal += amt; approvedCount++; }
  });
  return {
    docCount: atts.length, approvedCount, amountBearing, exemptByType,
    approvedTotal: round2(approvedTotal), allTotal: round2(allTotal),
    missing, complete: atts.length > 0 && missing === 0,
  };
}

/* Variance between the cash released and the approved receipt total.
     difference > 0 → requestor holds excess cash to return
     difference < 0 → requestor spent more and must be reimbursed
     difference = 0 → nothing to settle */
function reconcileReceipts(released, receiptTotal) {
  const rel = round2(released), rec = round2(receiptTotal);
  const difference = round2(rel - rec);
  let type, expected;
  if (difference > 0) { type = "excess"; expected = difference; }
  else if (difference < 0) { type = "reimburse"; expected = round2(-difference); }
  else { type = "exact"; expected = 0; }
  return { released: rel, receiptTotal: rec, difference, type, expected };
}

/* Full cash-settlement state for a liquidation. The settlement flag means the
   cash has ACTUALLY moved, not that someone intends to move it — so a
   liquidation only settles when the recorded actual amount equals the expected
   amount. Over-liquidation additionally needs a reviewer's acknowledgement so
   it can never settle automatically. */
function settlementStateFor(disb, liq) {
  const summary = receiptAmountSummary(liq);
  const rec = reconcileReceipts(disb ? disb.amount : 0, summary.approvedTotal);
  const s = (liq && liq.settlement) || null;
  const completed = !!(s && s.completed);
  const actual = round2(s ? s.actualAmount : 0);
  const needsReview = rec.type === "reimburse";
  const reviewed = !!(s && s.reviewedBy);
  const matches = rec.type === "exact" ? true : (completed && actual === rec.expected);
  return {
    ...rec, summary, settlement: s, completed, actual, matches, needsReview, reviewed,
    settled: rec.type === "exact" ? true : (matches && (!needsReview || reviewed)),
  };
}

/* Final liquidation status under the cash-settlement rule: a liquidation is
   LIQUIDATED once every receipt amount is captured and approved and any
   resulting refund or reimbursement has actually been completed. */
function liqFinalStatus(disb, liq) {
  if (!liq || !((liq.attachments || []).length)) return "Not Liquidated";
  const approval = receiptApprovalSummary(liq);
  const st = settlementStateFor(disb, liq);
  if (approval.anyRejected) return "For Revision";
  if (!st.summary.complete || !approval.allApproved) return "NOT YET LIQUIDATED";
  if (st.needsReview && !st.reviewed) return "Under Review";
  return st.settled ? "LIQUIDATED" : "NOT YET LIQUIDATED";
}

/* A liquidation is editable by its requestor only while still in Draft. */
function liqIsDraft(liq) {
  return !liq || (liq.submissionStatus || "Draft") === "Draft";
}

/* ---- Duplicate supporting-document detection ----
   Checks the candidate against the documents on this liquidation and on every
   other liquidation, using whichever identifying information is available:
   receipt number + document type, file name, or an identical amount/size pair.
   Returns the matches so the UI can warn before the user proceeds. */
function findDuplicateReceipts(candidate, currentAttachments, liquidations, currentDisbursementId) {
  const hits = [];
  const name = String(candidate.name || "").trim().toLowerCase();
  const rno = String(candidate.receiptNo || "").trim().toLowerCase();
  const amt = receiptAmountOf(candidate);
  const check = (a, disbursementId) => {
    if (!a || a.id === candidate.id) return;
    const aName = String(a.name || "").trim().toLowerCase();
    const aRno = String(a.receiptNo || "").trim().toLowerCase();
    let reason = "";
    if (rno && aRno && rno === aRno && (a.docType || "") === (candidate.docType || "")) {
      reason = `same receipt no. (${a.receiptNo}) and document type`;
    } else if (name && aName === name) {
      reason = "same file name";
    } else if (amt > 0 && receiptAmountOf(a) === amt && a.size && candidate.size && a.size === candidate.size) {
      reason = "same amount and identical file size";
    }
    if (reason) hits.push({ doc: a, disbursementId, reason });
  };
  (currentAttachments || []).forEach((a) => check(a, currentDisbursementId));
  (liquidations || []).forEach((l) => {
    if (l.disbursementId === currentDisbursementId) return;
    (l.attachments || []).forEach((a) => check(a, l.disbursementId));
  });
  return hits;
}

function computeMetrics(funds, requests, disbursements, liquidations, replenishments) {
  const reps = replenishments || [];
  const totalFund = funds.reduce((s, f) => s + (Number(f.beginningBalance) || 0), 0);
  const totalDisbursed = disbursements.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const totalLiquidated = liquidations.reduce((s, l) => s + liquidatedTotal(l), 0);
  const totalReplenished = reps
    .filter((r) => r.status === "Completed")
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);

  let outstanding = 0;
  const activeEmployees = new Set();
  disbursements.forEach((d) => {
    const status = liqStatusFor(d, liquidations);
    if (status !== "Fully Liquidated") {
      const already = liquidatedTotal(liquidationFor(d.id, liquidations));
      outstanding += Math.max(0, d.amount - already);
      activeEmployees.add(d.employee);
    }
  });

  const availableBalance = totalFund - totalLiquidated - outstanding + totalReplenished;
  const pendingRequests = requests.filter((r) => r.status === "Pending").length;
  const approvedRequests = requests.filter((r) => r.status === "Approved").length;
  const pendingLiquidationCount = disbursements.filter((d) => liqStatusFor(d, liquidations) !== "Fully Liquidated").length;
  const pendingReplenishments = reps.filter((r) => r.status !== "Completed").length;
  const completedBilled = disbursements.filter((d) => d.billed).length;

  const nowMonth = todayISO().slice(0, 7);
  const monthlyExpenses = liquidations.reduce((s, l) =>
    s + l.lines.reduce((ls, ln) => ls + ((ln.date || "").slice(0, 7) === nowMonth ? (Number(ln.amount) || 0) : 0), 0), 0);

  return {
    totalFund, totalDisbursed, totalLiquidated, totalReplenished, outstanding, availableBalance,
    pendingRequests, approvedRequests, pendingLiquidationCount, pendingReplenishments,
    monthlyExpenses, completedBilled,
    activeEmployeeCount: activeEmployees.size,
  };
}

/* Per-fund PCF monitoring — disbursed, liquidated, outstanding and available
   balance scoped to one fund's branch. Mirrors computeMetrics' logic. */
function monitoringForFund(fund, disbursements, liquidations, replenishments) {
  const reps = replenishments || [];
  const disb = disbursements.filter((d) => d.branchCode === fund.branchCode);
  let disbursed = 0, liquidated = 0, outstanding = 0;
  disb.forEach((d) => {
    disbursed += Number(d.amount) || 0;
    const already = liquidatedTotal(liquidationFor(d.id, liquidations));
    liquidated += already;
    if (liqStatusFor(d, liquidations) !== "Fully Liquidated") {
      outstanding += Math.max(0, (Number(d.amount) || 0) - already);
    }
  });
  const replenished = reps
    .filter((r) => r.branchCode === fund.branchCode && r.status === "Completed")
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const beginning = Number(fund.beginningBalance) || 0;
  const available = beginning - liquidated - outstanding + replenished;
  return { beginning, disbursed, liquidated, outstanding, replenished, available };
}

function downloadWorkbook(wb, filename) {
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

