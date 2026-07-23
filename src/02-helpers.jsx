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

