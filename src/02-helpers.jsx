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
/* Schema tag written into every saved blob. This is now ONLY metadata: a
   version mismatch NEVER discards transactions — historical financial records
   are always preserved and migrated forward (see migrateState). */
const DATA_VERSION = "2026-clean-1";

/* Keys used by the automatic backup / recovery system. Every load takes a
   timestamped snapshot BEFORE the app touches the live record, so a bad
   deployment or accidental wipe can always be rolled back. */
const BACKUP_PREFIX = "petty-cash-portal-backup-";
const BACKUP_INDEX_KEY = "petty-cash-portal-backups";
const MAX_BACKUPS = 12;

/* The transaction stores whose loss would destroy financial history. Used to
   count records so backups/guards can tell a real database from an empty one. */
const TXN_KEYS = ["requests", "disbursements", "liquidations", "replenishments", "documents", "reimbursements"];

function txnCount(state) {
  if (!state || typeof state !== "object") return 0;
  return TXN_KEYS.reduce((n, k) => n + (Array.isArray(state[k]) ? state[k].length : 0), 0);
}

/* ---- File payload stripping ----
   Uploaded files are stored as base64 data URLs INSIDE their transaction
   record: liquidations and reimbursements keep them in `attachments[].data`,
   PCF documents in `dataUrl`. A single scanned receipt is multiple megabytes,
   which is why a handful of rows accounts for almost all of the database.
   Returns a copy with the bytes blanked, leaving every other field (name, size,
   type, receipt no., amount, approval history) untouched. */
function stripFileBytes(rec) {
  if (!rec || typeof rec !== "object") return rec;
  let out = rec;
  if (Array.isArray(rec.attachments) && rec.attachments.some((a) => a && a.data)) {
    out = { ...out, attachments: rec.attachments.map((a) => (a && a.data ? { ...a, data: "" } : a)) };
  }
  if (out.dataUrl) out = { ...out, dataUrl: "" };
  return out;
}

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

/* ---- Forward-only migration ----
   Normalizes any previously-saved blob (regardless of its dataVersion) into the
   current shape WITHOUT dropping a single transaction. Missing arrays default to
   empty; existing arrays are carried over verbatim so IDs, reference numbers and
   relationships are preserved exactly. */
function migrateState(saved) {
  const arr = (v) => (Array.isArray(v) ? v : []);
  const out = {
    dataVersion: DATA_VERSION,
    funds: arr(saved && saved.funds),
    requests: arr(saved && saved.requests),
    disbursements: arr(saved && saved.disbursements),
    liquidations: arr(saved && saved.liquidations),
    replenishments: arr(saved && saved.replenishments),
    auditLog: arr(saved && saved.auditLog),
    documents: arr(saved && saved.documents),
    reimbursements: arr(saved && saved.reimbursements),
  };
  out._prevVersion = (saved && saved.dataVersion) || null;
  out._migrated = !!saved && saved.dataVersion !== DATA_VERSION;
  return out;
}

/* ---- Automatic backups ----
   Snapshots a non-empty state under a timestamped key and keeps a pruned index.
   Empty states are never snapshotted, so a backup can never overwrite good
   history with nothing. */
async function backupState(state, tag) {
  try {
    const count = txnCount(state);
    if (count === 0) return null; // never back up an empty database
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const key = BACKUP_PREFIX + stamp;
    const snapshot = { ...state, _backupAt: new Date().toISOString(), _txCount: count, _tag: tag || "" };
    await window.storage.set(key, JSON.stringify(snapshot), false);

    let index = [];
    try { const r = await window.storage.get(BACKUP_INDEX_KEY, false); if (r && r.value) index = JSON.parse(r.value); } catch (e) { /* fresh index */ }
    index = index.filter((b) => b && b.key !== key);
    index.push({ key, at: snapshot._backupAt, txCount: count, tag: tag || "" });
    while (index.length > MAX_BACKUPS) {
      const old = index.shift();
      try { await window.storage.set(old.key, "", false); } catch (e) { /* best effort */ }
      try { localStorage.removeItem(old.key); } catch (e) { /* best effort */ }
    }
    await window.storage.set(BACKUP_INDEX_KEY, JSON.stringify(index), false);
    return key;
  } catch (e) { return null; }
}

/* Lists every recoverable snapshot (cloud index + any local-only copies),
   richest first, so the most complete backup is easy to restore. */
async function listBackups() {
  const map = new Map();
  try {
    const r = await window.storage.get(BACKUP_INDEX_KEY, false);
    if (r && r.value) JSON.parse(r.value).forEach((b) => { if (b && b.key) map.set(b.key, b); });
  } catch (e) { /* ignore */ }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(BACKUP_PREFIX) === 0 && !map.has(k)) {
        try { const v = JSON.parse(localStorage.getItem(k)); map.set(k, { key: k, at: v._backupAt, txCount: v._txCount || txnCount(v), tag: v._tag || "" }); }
        catch (e) { /* skip corrupt */ }
      }
    }
  } catch (e) { /* ignore */ }
  return Array.from(map.values()).sort((a, b) => (b.txCount || 0) - (a.txCount || 0) || String(b.at).localeCompare(String(a.at)));
}

async function readBackup(key) {
  try {
    const r = await window.storage.get(key, false);
    if (r && r.value) return JSON.parse(r.value);
  } catch (e) { /* ignore */ }
  try { const v = localStorage.getItem(key); if (v) return JSON.parse(v); } catch (e) { /* ignore */ }
  return null;
}

/* Scans the live record and every backup and returns the richest one. Used to
   auto-recover when the live record is found emptier than a known backup. */
async function recoverBestState() {
  const candidates = [];
  const live = await loadState();
  if (live) candidates.push({ key: STORAGE_KEY, state: live, txCount: txnCount(live) });
  const backups = await listBackups();
  for (const b of backups) {
    const s = await readBackup(b.key);
    if (s) candidates.push({ key: b.key, state: s, txCount: txnCount(s) });
  }
  candidates.sort((a, b) => b.txCount - a.txCount);
  return candidates[0] || null;
}

/* ---- Per-record cloud sync (concurrency-safe) ----
   The transaction stores that must not clobber each other when multiple users
   are online. Each record is synced to its own row in the pcp_records table
   (keyed by id), so two people editing different records never overwrite one
   another — the root cause of the shared-blob data loss. */
const SYNC_COLLECTIONS = [
  "funds", "requests", "disbursements", "liquidations",
  "replenishments", "auditLog", "documents", "reimbursements",
];

/* Loads every per-record row from the cloud (empty array when unavailable). */
async function loadRecords() {
  try {
    if (window.storage && window.storage.records) return (await window.storage.records.getAll()) || [];
  } catch (e) { /* offline / not configured */ }
  return [];
}

/* Overlays per-record rows on top of a blob-derived state. Records win by id and
   soft-deleted rows (deleted === true) drop the id, so the merged result is the
   richest, most up-to-date view even if a blob write was clobbered. */
function mergeRecordsIntoState(blobState, rows) {
  const cols = {};
  SYNC_COLLECTIONS.forEach((c) => {
    const map = new Map();
    (Array.isArray(blobState && blobState[c]) ? blobState[c] : []).forEach((r) => { if (r && r.id != null) map.set(r.id, r); });
    cols[c] = map;
  });
  (rows || []).forEach((row) => {
    if (!row || !row.collection || row.id == null) return;
    const map = cols[row.collection];
    if (!map) return;
    if (row.deleted) map.delete(row.id);
    else map.set(row.id, row.data);
  });
  const out = { dataVersion: DATA_VERSION };
  SYNC_COLLECTIONS.forEach((c) => { out[c] = Array.from(cols[c].values()); });
  out.auditLog = out.auditLog || [];
  return out;
}

/* Snapshots a state into { collection: Map(id -> JSON) } for change detection. */
function snapshotSync(state) {
  const snap = {};
  SYNC_COLLECTIONS.forEach((c) => {
    const map = new Map();
    (Array.isArray(state && state[c]) ? state[c] : []).forEach((r) => { if (r && r.id != null) map.set(r.id, JSON.stringify(r)); });
    snap[c] = map;
  });
  return snap;
}

/* Diffs the current state against the last-synced snapshot and returns the rows
   that changed: adds/edits as { deleted:false }, removals as tombstones
   ({ deleted:true }). The snapshot is advanced in place so the next diff only
   sees fresh changes. Edits always clear the deleted flag so a later edit wins
   over a concurrent delete (records are preserved for audit). */
function diffSync(snap, state) {
  const rows = [];
  const nowIso = new Date().toISOString();
  SYNC_COLLECTIONS.forEach((c) => {
    const prev = snap[c] || new Map();
    const next = new Map();
    (Array.isArray(state && state[c]) ? state[c] : []).forEach((r) => { if (r && r.id != null) next.set(r.id, r); });
    next.forEach((rec, id) => {
      const js = JSON.stringify(rec);
      if (prev.get(id) !== js) rows.push({ id, collection: c, data: rec, deleted: false, updated_at: nowIso });
    });
    prev.forEach((js, id) => {
      if (!next.has(id)) {
        let data = {};
        try { data = JSON.parse(js); } catch (e) { /* keep empty */ }
        /* Keep the deleted record's fields for audit, but drop the base64 file
           payloads. Tombstones are never pruned, so a deleted receipt would
           otherwise occupy the database forever; the metadata an audit actually
           needs (name, size, who uploaded it, when) is all retained. */
        data = stripFileBytes(data);
        rows.push({ id, collection: c, data, deleted: true, updated_at: nowIso });
      }
    });
    const advanced = new Map();
    next.forEach((rec, id) => advanced.set(id, JSON.stringify(rec)));
    snap[c] = advanced;
  });
  return rows;
}

/* Queues changed records for their per-record cloud upsert (no-op when the
   per-record store is unavailable). */
function syncRecords(rows) {
  if (!rows || !rows.length) return;
  try { if (window.storage && window.storage.records) window.storage.records.put(rows); }
  catch (e) { /* best effort — the blob write in saveState is the fallback */ }
}

/* ---- Cross-module integrity / reconciliation ----
   Walks the Request → Release → Liquidation → Replenishment chain and reports
   completeness, orphans and duplicates. Pure function — safe to unit test. */
function buildIntegrityReport(requests, disbursements, liquidations, replenishments) {
  const reqs = requests || [], disbs = disbursements || [], liqs = liquidations || [], reps = replenishments || [];
  const disbByReq = new Map();
  disbs.forEach((d) => { if (d.requestId) { if (!disbByReq.has(d.requestId)) disbByReq.set(d.requestId, []); disbByReq.get(d.requestId).push(d); } });
  const liqByDisb = new Map();
  liqs.forEach((l) => { if (l.disbursementId) { if (!liqByDisb.has(l.disbursementId)) liqByDisb.set(l.disbursementId, []); liqByDisb.get(l.disbursementId).push(l); } });
  const repByBranch = new Map();
  reps.forEach((r) => { const b = r.branchCode || "—"; repByBranch.set(b, (repByBranch.get(b) || 0) + 1); });

  const rows = reqs.map((r) => {
    const ds = disbByReq.get(r.id) || [];
    const hasRelease = ds.length > 0;
    const hasLiquidation = ds.some((d) => (liqByDisb.get(d.id) || []).length > 0);
    const hasReplenishment = ds.some((d) => repByBranch.has(d.branchCode)) || repByBranch.has(r.branchCode);
    let status;
    if (!hasRelease) status = "Missing Release";
    else if (!hasLiquidation) status = "Missing Liquidation";
    else status = "Complete";
    return {
      ref: r.requestNo || r.id, request: true, release: hasRelease,
      liquidation: hasLiquidation, replenishment: hasReplenishment, status,
    };
  });

  const reqIds = new Set(reqs.map((r) => r.id));
  const disbIds = new Set(disbs.map((d) => d.id));
  const orphanDisbursements = disbs.filter((d) => !d.requestId || !reqIds.has(d.requestId)).map((d) => d.voucherNo || d.id);
  const orphanLiquidations = liqs.filter((l) => !l.disbursementId || !disbIds.has(l.disbursementId)).map((l) => l.id);

  const dup = (list, key) => {
    const seen = new Map();
    list.forEach((x) => { const k = x[key]; if (k) seen.set(k, (seen.get(k) || 0) + 1); });
    return Array.from(seen.entries()).filter(([, n]) => n > 1).map(([k]) => k);
  };
  const duplicateRequestNos = dup(reqs, "requestNo");
  const duplicateVoucherNos = dup(disbs, "voucherNo");
  const duplicateReplenishmentNos = dup(reps, "replenishmentNo");

  const multiLiquidations = Array.from(liqByDisb.entries()).filter(([, arr]) => arr.length > 1).map(([id]) => id);

  return {
    rows,
    counts: {
      requests: reqs.length, disbursements: disbs.length, liquidations: liqs.length, replenishments: reps.length,
      complete: rows.filter((r) => r.status === "Complete").length,
      missingRelease: rows.filter((r) => r.status === "Missing Release").length,
      missingLiquidation: rows.filter((r) => r.status === "Missing Liquidation").length,
    },
    orphanDisbursements, orphanLiquidations,
    duplicateRequestNos, duplicateVoucherNos, duplicateReplenishmentNos,
    duplicateLiquidations: multiLiquidations,
    healthy: orphanDisbursements.length === 0 && orphanLiquidations.length === 0
      && duplicateRequestNos.length === 0 && duplicateVoucherNos.length === 0
      && duplicateReplenishmentNos.length === 0 && multiLiquidations.length === 0,
  };
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

/* ---- Standardized liquidation rejection reasons ----
   When the authorized Liquidation Approver (Grace Gan) rejects a liquidation
   she must pick ONE of these controlled reasons. The reason is the official
   classification of why the liquidation was rejected; the Reviewer Comment is
   an optional free-text explanation stored separately. */
const LIQUIDATION_REJECTION_REASONS = [
  { group: "Receipt / Documentation", reasons: [
    "Missing Receipt",
    "Invalid Receipt",
    "Unreadable Receipt",
    "Incomplete Receipt Details",
    "Duplicate Receipt",
    "Receipt Does Not Match Expense",
    "Missing Required Supporting Document",
    "Unsupported Expense Documentation",
  ] },
  { group: "Requestor", reasons: [
    "Incorrect PCF Requestor",
    "PCF Requestor Information Incomplete",
    "Incorrect Reimbursement Requestor",
    "Reimbursement Requestor Information Incomplete",
    "Requestor Clarification Required",
  ] },
  { group: "Expense", reasons: [
    "Non-Allowable Expense",
    "Incorrect Expense Classification",
    "Expense Not Related to Company Business",
    "Expense Outside PCF Policy",
    "Expense Requires Additional Approval",
  ] },
  { group: "Amount / Transaction", reasons: [
    "Incorrect Amount",
    "Overclaimed Amount",
    "Duplicate Reimbursement",
    "Incorrect Transaction Reference",
  ] },
  { group: "Approval / Process", reasons: [
    "Missing Required Approval",
    "Incorrect Approval",
    "Liquidation Submitted Incorrectly",
    "Liquidation Requires Correction",
  ] },
  { group: "Other", reasons: [
    "Insufficient Supporting Information",
    "Other Accounting/Finance Review Finding",
  ] },
];
const LIQUIDATION_REJECTION_REASON_SET = new Set(
  LIQUIDATION_REJECTION_REASONS.reduce((acc, g) => acc.concat(g.reasons), [])
);
/* Backend-side validation: the rejection reason must be one of the approved
   values above, so an unauthorized or malformed rejection is refused. */
const isValidLiquidationRejectionReason = (reason) =>
  LIQUIDATION_REJECTION_REASON_SET.has(String(reason || "").trim());

/* Every rejection kept as its own record — the ordered rejection history. */
const liqRejections = (liq) => ((liq && liq.rejections) || []);
const liqIsRejected = (liq) => ((liq && liq.submissionStatus) || "Draft") === "Rejected";

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
  /* A standing rejection takes precedence until the requestor corrects and
     resubmits (which flips submissionStatus back to Submitted). */
  if ((liq.submissionStatus || "Draft") === "Rejected") return "REJECTED";
  const approval = receiptApprovalSummary(liq);
  const st = settlementStateFor(disb, liq);
  if (approval.anyRejected) return "For Revision";
  if (!st.summary.complete || !approval.allApproved) return "NOT YET LIQUIDATED";
  if (st.needsReview && !st.reviewed) return "Under Review";
  return st.settled ? "LIQUIDATED" : "NOT YET LIQUIDATED";
}

/* A liquidation is editable by its requestor while still in Draft, or after a
   rejection so the requestor can correct it and resubmit. */
function liqIsDraft(liq) {
  const s = (liq && liq.submissionStatus) || "Draft";
  return !liq || s === "Draft" || s === "Rejected";
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

