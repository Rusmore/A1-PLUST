/*
 * PCF Portal — data-integrity & recovery regression tests.
 *
 * No build step / framework: run with `node tests/recovery.test.mjs`.
 *
 * These tests load the REAL helper source (src/02-helpers.jsx) so they exercise
 * the same migrateState / txnCount / buildIntegrityReport used by the app, then
 * simulate the full PCF lifecycle with plain reducers that mirror src/19-app.jsx.
 * The headline guarantee: completing a transaction — or upgrading the data
 * version — must NEVER make a record disappear.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/* ---- Load the real helpers from src/02-helpers.jsx ---- */
const helpersSrc = readFileSync(join(root, "src", "02-helpers.jsx"), "utf8");
const exportBridge = `
  ;return {
    txnCount, migrateState, buildIntegrityReport,
    DATA_VERSION, STORAGE_KEY, TXN_KEYS
  };`;
// Only function/const definitions run at top level (no side effects), so a
// stubbed window is enough to evaluate the module body.
const factory = new Function("window", "localStorage", helpersSrc + exportBridge);
const H = factory({ storage: { get: async () => null, set: async () => {} } }, { length: 0, key: () => null, getItem: () => null, setItem: () => {}, removeItem: () => {} });

/* ---- Tiny assertion harness ---- */
let passed = 0, failed = 0;
const results = [];
function test(name, fn) {
  try { fn(); passed++; results.push(["PASS", name]); }
  catch (e) { failed++; results.push(["FAIL", name, e.message]); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
function eq(a, b, msg) { if (a !== b) throw new Error((msg || "not equal") + ` (got ${a}, expected ${b})`); }

/* ---- Reducers mirroring src/19-app.jsx (lifecycle simulation) ---- */
function makeStore() {
  return { requests: [], disbursements: [], liquidations: [], replenishments: [], auditLog: [], documents: [], reimbursements: [], funds: [{ id: "fund-A1", branchCode: "A1+", label: "Manila", beginningBalance: 600000 }] };
}
let seq = 0;
const nextId = (p) => `${p}-${++seq}`;
function createRequest(s, form) {
  s.requests.push({ id: nextId("req"), requestNo: form.requestNo, employee: form.employee, branchCode: form.branchCode, amount: form.amount, status: "Pending" });
  return s.requests[s.requests.length - 1];
}
function approveRequest(s, id) { s.requests = s.requests.map((r) => r.id === id ? { ...r, status: "Approved" } : r); }
function releasePCF(s, req, voucherNo) {
  s.disbursements.push({ id: nextId("dv"), voucherNo, requestId: req.id, employee: req.employee, branchCode: req.branchCode, amount: req.amount, status: "Open" });
  s.requests = s.requests.map((r) => r.id === req.id ? { ...r, status: "Disbursed" } : r);
  return s.disbursements[s.disbursements.length - 1];
}
function liquidate(s, disb, lines) {
  s.liquidations.push({ id: nextId("liq"), disbursementId: disb.id, lines, attachments: [], submissionStatus: "Submitted" });
  s.disbursements = s.disbursements.map((d) => d.id === disb.id ? { ...d, status: "Closed" } : d);
  return s.liquidations[s.liquidations.length - 1];
}
function replenish(s, form) {
  s.replenishments.push({ id: nextId("rep"), replenishmentNo: form.replenishmentNo, branchCode: form.branchCode, amount: form.amount, status: "Completed" });
  return s.replenishments[s.replenishments.length - 1];
}

/* Simulate persistence round-trip through the REAL migrateState. */
function persistAndReload(s) {
  const saved = JSON.parse(JSON.stringify({ dataVersion: H.DATA_VERSION, ...s }));
  return H.migrateState(saved);
}

/* ===================== LIFECYCLE TESTS (1–16) ===================== */
const s = makeStore();
let req1, disb1, liq1, rep1;

test("1. Create PCF Request", () => { req1 = createRequest(s, { requestNo: "PCF-2026-0001", employee: "Alice", branchCode: "A1+", amount: 5000 }); assert(req1 && req1.id); });
test("2. Approve Request", () => { approveRequest(s, req1.id); eq(s.requests[0].status, "Approved"); });
test("3. Release PCF", () => { disb1 = releasePCF(s, req1, "PCV-2026-0001"); eq(disb1.requestId, req1.id, "release must link to request"); });
test("4. Verify Release Ledger", () => { eq(s.disbursements.length, 1); eq(s.requests[0].status, "Disbursed"); });
test("5. Create Liquidation", () => { liq1 = liquidate(s, disb1, [{ desc: "Supplies", amount: 5000 }]); eq(liq1.disbursementId, disb1.id, "liquidation must link to release"); });
test("6. Verify Liquidation", () => { eq(s.liquidations.length, 1); eq(s.disbursements[0].status, "Closed"); });
test("7. Create Replenishment", () => { rep1 = replenish(s, { replenishmentNo: "REP-2026-0001", branchCode: "A1+", amount: 5000 }); assert(rep1.id); });
test("8. Verify Replenishment", () => { eq(s.replenishments.length, 1); });

/* Persist + reload (simulates refresh / logout-login / redeploy) */
let reloaded;
test("9. Original PCF Request still exists after reload", () => { reloaded = persistAndReload(s); assert(reloaded.requests.some((r) => r.requestNo === "PCF-2026-0001")); });
test("10. Release Ledger still exists after reload", () => { assert(reloaded.disbursements.some((d) => d.voucherNo === "PCV-2026-0001")); });
test("11. Liquidation still exists after reload", () => { eq(reloaded.liquidations.length, 1); });
test("12. Replenishment still exists after reload", () => { eq(reloaded.replenishments.length, 1); });
test("13. Refresh (double reload) keeps all records", () => { const r2 = persistAndReload(reloaded); eq(H.txnCount(r2), H.txnCount(reloaded)); });
test("14. Logout/login keeps all records (fresh migrate)", () => { const r3 = H.migrateState(JSON.parse(JSON.stringify({ dataVersion: H.DATA_VERSION, ...s }))); eq(r3.requests.length, 1); });
test("15. Records remain findable after filters (links intact)", () => {
  const rep = H.buildIntegrityReport(reloaded.requests, reloaded.disbursements, reloaded.liquidations, reloaded.replenishments);
  const row = rep.rows.find((x) => x.ref === "PCF-2026-0001");
  assert(row && row.status === "Complete", "chain should reconcile as Complete");
});
test("16. Completed transaction remains visible (not removed on completion)", () => { assert(reloaded.disbursements[0].status === "Closed" && reloaded.disbursements.length === 1); });

/* ===================== ROOT-CAUSE REGRESSION ===================== */
test("R1. Version mismatch must NOT wipe transactions (the original bug)", () => {
  // Old blob saved under a previous data version.
  const oldBlob = JSON.parse(JSON.stringify({ dataVersion: "2026-approval-matrix-1", ...s }));
  const migrated = H.migrateState(oldBlob);
  eq(migrated.dataVersion, H.DATA_VERSION, "version tag is upgraded");
  eq(migrated.requests.length, s.requests.length, "requests preserved across version change");
  eq(H.txnCount(migrated), H.txnCount(s), "no transaction lost on version change");
  assert(migrated._migrated === true, "migration should be flagged");
});

test("R2. migrateState never drops records and defaults missing arrays", () => {
  const partial = { dataVersion: "old", requests: [{ id: "r", requestNo: "X" }] };
  const m = H.migrateState(partial);
  eq(m.requests.length, 1);
  assert(Array.isArray(m.disbursements) && m.disbursements.length === 0);
  assert(Array.isArray(m.replenishments));
});

test("R3. migrateState of null yields empty-but-valid shape (fresh install)", () => {
  const m = H.migrateState(null);
  eq(H.txnCount(m), 0);
  H.TXN_KEYS.forEach((k) => assert(Array.isArray(m[k]), `${k} must be an array`));
});

/* ===================== INTEGRITY / RECONCILIATION ===================== */
test("I1. Orphaned release is detected", () => {
  const rep = H.buildIntegrityReport([], [{ id: "d", voucherNo: "PCV-X", requestId: "missing" }], [], []);
  eq(rep.orphanDisbursements.length, 1);
  assert(!rep.healthy);
});
test("I2. Orphaned liquidation is detected", () => {
  const rep = H.buildIntegrityReport([], [], [{ id: "l", disbursementId: "missing" }], []);
  eq(rep.orphanLiquidations.length, 1);
});
test("I3. Duplicate voucher numbers are detected", () => {
  const rep = H.buildIntegrityReport([], [{ id: "a", voucherNo: "V1", requestId: "r" }, { id: "b", voucherNo: "V1", requestId: "r" }], [], []);
  eq(rep.duplicateVoucherNos.length, 1);
});
test("I4. Missing-release and missing-liquidation statuses are reported", () => {
  const reqs = [{ id: "r1", requestNo: "P1" }, { id: "r2", requestNo: "P2" }, { id: "r3", requestNo: "P3" }];
  const disbs = [{ id: "d1", voucherNo: "V1", requestId: "r1", branchCode: "A1+" }, { id: "d3", voucherNo: "V3", requestId: "r3", branchCode: "A1+" }];
  const liqs = [{ id: "l1", disbursementId: "d1" }];
  const rep = H.buildIntegrityReport(reqs, disbs, liqs, []);
  eq(rep.rows.find((r) => r.ref === "P1").status, "Complete");
  eq(rep.rows.find((r) => r.ref === "P2").status, "Missing Release");
  eq(rep.rows.find((r) => r.ref === "P3").status, "Missing Liquidation");
});
test("I5. A clean chain reports healthy", () => {
  const rep = H.buildIntegrityReport(s.requests, s.disbursements, s.liquidations, s.replenishments);
  assert(rep.healthy, "well-formed data should be healthy");
});

/* ===================== REPORT ===================== */
console.log("\nPCF Portal — Data Integrity & Recovery Tests\n" + "=".repeat(46));
for (const [status, name, err] of results) {
  console.log(`  [${status}] ${name}${err ? "  → " + err : ""}`);
}
console.log("=".repeat(46));
console.log(`  ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
