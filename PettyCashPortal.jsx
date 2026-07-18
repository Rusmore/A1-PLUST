import React, { useState, useEffect, useMemo, useCallback, useContext, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard, FileText, Wallet, Receipt, Database, Plus, Download,
  Check, X, Search, AlertTriangle, TrendingUp, Users, Building2, Trash2,
  Edit3, ChevronRight, Banknote, ClipboardList, PiggyBank, CircleDollarSign,
  ArrowUpRight, ArrowDownRight, FileSpreadsheet, RefreshCw, Filter as FilterIcon,
  Printer, Bell, History, ShieldCheck, ArrowLeftRight, Clock, UserCog, Landmark, LogOut
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import * as XLSX from "xlsx";

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
]);

const seedRequests = () => ([
  {
    id: "req-1001", requestNo: "PCR-2026-0001", date: "2026-07-08",
    employee: "Juan Dela Cruz", department: "000-00003", branchCode: "WARNER",
    purpose: "Field sales trip — client meals and local transportation",
    amount: 5000, approver: "Angelita Bayani", status: "Disbursed",
    approvals: {
      "Manager": { status: "Approved", by: "Angelita Bayani", date: "2026-07-08" },
      "Director": { status: "Approved", by: "Director", date: "2026-07-08" },
      "Ma'am Grace": { status: "Approved", by: "Grace", date: "2026-07-08" },
      "Boss RTC": { status: "Approved", by: "RTC", date: "2026-07-08" },
    },
  },
]);

const seedDisbursements = () => ([
  {
    id: "dv-1001", voucherNo: "PCV-2026-0001", date: "2026-07-09", requestId: "req-1001",
    employee: "Juan Dela Cruz", branchCode: "WARNER", department: "000-00003",
    expenseCategory: "OE Transportation and travel", amount: 5000,
    status: "Closed", remarks: "Sales trip advance", billed: false,
  },
]);

const seedLiquidations = () => ([
  {
    id: "liq-1001", disbursementId: "dv-1001", createdDate: "2026-07-10",
    lines: [
      { id: "ln-1", date: "2026-07-10", expense: "Meals", category: "OE Meal Allowance", department: "000-00003", amount: 1200 },
      { id: "ln-2", date: "2026-07-10", expense: "Fuel", category: "OE Oil & Gasoline", department: "000-00008", amount: 2000 },
      { id: "ln-3", date: "2026-07-10", expense: "Toll Fee", category: "OE Toll Fee", department: "000-00008", amount: 300 },
      { id: "ln-4", date: "2026-07-10", expense: "Office Supplies", category: "OE Office Supplies", department: "000-00009", amount: 700 },
    ],
  },
]);

const seedReplenishments = () => ([
  {
    id: "rep-1001", replenishmentNo: "PCRP-2026-0001", date: "2026-07-12",
    branchCode: "WARNER", amount: 4200, preparedBy: "Angelita Bayani",
    approvedBy: "Grace", checkNo: "CHK-88213", method: "Check",
    status: "Completed", remarks: "Reimburse liquidated Warner expenses",
  },
]);

const seedAuditLog = () => ([
  { id: "aud-1", ts: "2026-07-08T09:12:00", user: "Requestor", action: "Request Created", entity: "PCR-2026-0001", remarks: "Field sales trip advance ₱5,000.00" },
  { id: "aud-2", ts: "2026-07-08T10:05:00", user: "Department Head", action: "Approved", entity: "PCR-2026-0001", remarks: "All 4 levels approved" },
  { id: "aud-3", ts: "2026-07-09T08:30:00", user: "Cashier", action: "Released", entity: "PCV-2026-0001", remarks: "Cash released to Juan Dela Cruz" },
  { id: "aud-4", ts: "2026-07-10T14:20:00", user: "Accounting", action: "Liquidated", entity: "PCV-2026-0001", remarks: "4 receipts itemized" },
  { id: "aud-5", ts: "2026-07-12T11:00:00", user: "Finance Manager", action: "Replenished", entity: "PCRP-2026-0001", remarks: "Check CHK-88213 · ₱4,200.00" },
]);

const STORAGE_KEY = "petty-cash-portal-state";

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

/* Column layout matches Acumatica's "Purchase Orders Template" import sheet exactly
   (same headers, same order, same static defaults) so this file can be dropped
   straight into Acumatica without reshaping. */
const ACUMATICA_PO_SHEET_NAME = "Purchase Orders Template";

const ACUMATICA_HEADERS = [
  "Branch", "Inventory ID", "Sub.", "Account", "Description", "Line Description",
  "UOM", "Order Qty.", "Unit Cost", "Ext. Cost", "Amount", "Qty. On Receipts",
  "Discount Percent", "Line Type", "Warehouse", "Discount Amount", "Manual Discount",
  "Discount Code", "Prepaid Qty.", "Prepaid Amount", "Alternate ID", "Min. Receipt (%)",
  "Max. Receipt (%)", "Receipt Action", "Complete On (%)", "Tax Category",
  "Accrual Account", "Accrual Sub.", "Requested", "Promised", "Completed", "Cancelled",
  "Closed", "Billed Qty.", "Billed Amount", "Unbilled Qty.", "Unbilled Amount",
  "Blanket PO Type", "Blanket PO Nbr.", "Billing Based On",
];

function buildAcumaticaLine(disb, line, refDateISO) {
  const iso = refDateISO || todayISO();
  const refDate = new Date(iso + "T00:00:00");
  const amount = Number(line.amount) || 0;
  return {
    "Branch": disb.branchCode,
    "Inventory ID": "",
    "Sub.": line.department,
    "Account": accountForCategory(line.category),
    "Description": line.category,
    /* Expense description + department description only — no code number. */
    "Line Description": `${(line.expense && line.expense.trim()) ? line.expense.trim() : line.category} — ${deptDesc(line.department)}`,
    "UOM": "PC",
    "Order Qty.": 1,
    "Unit Cost": amount,
    "Ext. Cost": amount,
    "Amount": amount,
    "Qty. On Receipts": 0,
    "Discount Percent": 0,
    "Line Type": "Service",
    "Warehouse": "",
    "Discount Amount": 0,
    "Manual Discount": "True",
    "Discount Code": "",
    "Prepaid Qty.": 0,
    "Prepaid Amount": 0,
    "Alternate ID": "",
    "Min. Receipt (%)": 0,
    "Max. Receipt (%)": 100,
    "Receipt Action": "Accept but Warn",
    "Complete On (%)": 100,
    "Tax Category": line.taxCategory || "",
    "Accrual Account": "",
    "Accrual Sub.": "",
    "Requested": refDate,
    "Promised": refDate,
    "Completed": "False",
    "Cancelled": "False",
    "Closed": "False",
    "Billed Qty.": 0,
    "Billed Amount": 0,
    "Unbilled Qty.": 1,
    "Unbilled Amount": amount,
    "Blanket PO Type": "",
    "Blanket PO Nbr.": "",
    "Billing Based On": "Order",
  };
}

function buildLiquidationExportRows(disb, liq) {
  const refDateISO = (liq && liq.createdDate) || todayISO();
  return (liq ? liq.lines : []).map((line) => buildAcumaticaLine(disb, line, refDateISO));
}

/* Every voucher that currently has liquidation lines, flattened into one sheet —
   used by "Export All to Acumatica" in the Liquidation tab. */
function buildAllAcumaticaExportRows(disbursements, liquidations) {
  const rows = [];
  disbursements.forEach((disb) => {
    const liq = liquidationFor(disb.id, liquidations);
    if (!liq || !liq.lines || !liq.lines.length) return;
    liq.lines.forEach((line) => rows.push(buildAcumaticaLine(disb, line, liq.createdDate)));
  });
  return rows;
}
const BRANCHES = [
  {
    "code": "ST",
    "name": "Starkson Paper And Plastic Corporation",
    "company": "Starkson Paper and Plastic Corporation"
  },
  {
    "code": "D1",
    "name": "Disney 1",
    "company": "Starkson Paper and Plastic Corporation"
  },
  {
    "code": "D2",
    "name": "Disney 2",
    "company": "Starkson Paper and Plastic Corporation"
  },
  {
    "code": "D3",
    "name": "Disney 3",
    "company": "Starkson Paper and Plastic Corporation"
  },
  {
    "code": "D8",
    "name": "Disney 8",
    "company": "Starkson Paper and Plastic Corporation"
  },
  {
    "code": "D5",
    "name": "Disney 5",
    "company": "Starkson Paper and Plastic Corporation"
  },
  {
    "code": "D6",
    "name": "Disney 6",
    "company": "Starkson Paper and Plastic Corporation"
  },
  {
    "code": "D7",
    "name": "Disney 7",
    "company": "Starkson Paper and Plastic Corporation"
  },
  {
    "code": "D9",
    "name": "Disney 9",
    "company": "Starkson Paper and Plastic Corporation"
  },
  {
    "code": "A1+",
    "name": "A1+ Paper And Plastic Inc.",
    "company": "A1+ Paper and Plastic Inc."
  },
  {
    "code": "EURASIA",
    "name": "Eurasia",
    "company": "A1+ Paper and Plastic Inc."
  },
  {
    "code": "HASBRO",
    "name": "Hasbro",
    "company": "A1+ Paper and Plastic Inc."
  },
  {
    "code": "SITIO",
    "name": "Sitio",
    "company": "A1+ Paper and Plastic Inc."
  },
  {
    "code": "MATTEL",
    "name": "Mattel",
    "company": "A1+ Paper and Plastic Inc."
  },
  {
    "code": "PERULANDIA",
    "name": "Perulandia",
    "company": "A1+ Paper and Plastic Inc."
  },
  {
    "code": "WARNER",
    "name": "Warner",
    "company": "A1+ Paper and Plastic Inc."
  },
  {
    "code": "HAMFI(HO)",
    "name": "Happy Alliance Mono Film, Inc.",
    "company": "Happy Alliance Mono Film, Inc."
  },
  {
    "code": "STINDUSTRY",
    "name": "Starkson Industries Inc.",
    "company": "Starkson Industries Inc."
  }
];

const COMPANIES = [
  "A1+ Paper and Plastic Inc.",
  "Starkson Paper and Plastic Corporation",
  "Happy Alliance Mono Film, Inc.",
  "Starkson Industries Inc."
];

const SUBACCOUNTS = [
  {
    "code": "000-00000",
    "desc": "Default"
  },
  {
    "code": "000-00001",
    "desc": "General Management"
  },
  {
    "code": "000-00002",
    "desc": "Creatives"
  },
  {
    "code": "000-00003",
    "desc": "Sales and Accounts Management"
  },
  {
    "code": "000-00004",
    "desc": "Production"
  },
  {
    "code": "000-00005",
    "desc": "RM Warehouse and Logistics"
  },
  {
    "code": "000-00006",
    "desc": "FG Warehouse and Logistics"
  },
  {
    "code": "000-00007",
    "desc": "Engineering"
  },
  {
    "code": "000-00008",
    "desc": "Motorpool"
  },
  {
    "code": "000-00009",
    "desc": "Accounting and Finance"
  },
  {
    "code": "000-00010",
    "desc": "Human Resources"
  },
  {
    "code": "000-00011",
    "desc": "Information Technology"
  },
  {
    "code": "000-00012",
    "desc": "Procurement"
  },
  {
    "code": "000-00013",
    "desc": "PPIC"
  },
  {
    "code": "000-00014",
    "desc": "Special Projects"
  },
  {
    "code": "000-00015",
    "desc": "Quality Assurance"
  },
  {
    "code": "000-00016",
    "desc": "Research & Development"
  },
  {
    "code": "000-00017",
    "desc": "Business Development"
  },
  {
    "code": "000-00018",
    "desc": "Farm"
  },
  {
    "code": "000-00019",
    "desc": "China Accounts"
  },
  {
    "code": "000-00020",
    "desc": "China Human Resources & Admin"
  },
  {
    "code": "000-00021",
    "desc": "China Enginering"
  },
  {
    "code": "000-00022",
    "desc": "China Quality Assurance"
  },
  {
    "code": "000-00023",
    "desc": "China Hand Sample"
  },
  {
    "code": "000-00024",
    "desc": "China Supply Chain Department"
  },
  {
    "code": "000-00025",
    "desc": "China Accounting and Finance"
  },
  {
    "code": "000-00026",
    "desc": "China Creatives"
  },
  {
    "code": "000-00027",
    "desc": "China Logistics and Shipment"
  },
  {
    "code": "000-00028",
    "desc": "DISNEY 3 Manufacturing"
  },
  {
    "code": "000-0002D",
    "desc": "Warehouse/Logistics"
  },
  {
    "code": "000-00030",
    "desc": "Research & Development"
  },
  {
    "code": "000-00031",
    "desc": "Engineering"
  },
  {
    "code": "000-00032",
    "desc": "Procurement"
  },
  {
    "code": "000-00033",
    "desc": "DISNEY 6 Manufacturing"
  },
  {
    "code": "000-00034",
    "desc": "WARNER Manufacturing"
  },
  {
    "code": "000-00040",
    "desc": "SITIO Accounting & Finance"
  },
  {
    "code": "000-00041",
    "desc": "DISNEY 6 Accounting & Finance"
  },
  {
    "code": "000-00050",
    "desc": "WARNER IT"
  },
  {
    "code": "000-00051",
    "desc": "HASBRO IT"
  },
  {
    "code": "000-00052",
    "desc": "DISNEY 1 IT"
  },
  {
    "code": "000-00053",
    "desc": "DISNEY 5 IT"
  },
  {
    "code": "000-00060",
    "desc": "HASBRO Human Resources"
  },
  {
    "code": "000-00061",
    "desc": "DISNEY 1 Human Resources"
  },
  {
    "code": "000-00070",
    "desc": "Creatives"
  },
  {
    "code": "000-00080",
    "desc": "Special Projects"
  },
  {
    "code": "000-0014E",
    "desc": "PERULANDIA Engineering"
  },
  {
    "code": "000-0014Q",
    "desc": "PERULANDIA Quality Assurance"
  },
  {
    "code": "000-0016E",
    "desc": "DISNEY 3 Engineering"
  },
  {
    "code": "000-0016P",
    "desc": "DISNEY 3 PPIC"
  },
  {
    "code": "000-0016Q",
    "desc": "DISNEY 3 Quality Assurance"
  },
  {
    "code": "000-0017E",
    "desc": "DISNEY 5 Engineering"
  },
  {
    "code": "000-0017P",
    "desc": "DISNEY 5 PPIC"
  },
  {
    "code": "000-0017Q",
    "desc": "DISNEY 5 Quality Assurance"
  },
  {
    "code": "000-0017R",
    "desc": "DISNEY 5 Research & Development"
  },
  {
    "code": "000-0018E",
    "desc": "DISNEY 6 Engineering"
  },
  {
    "code": "000-0018P",
    "desc": "DISNEY 6 PPIC"
  },
  {
    "code": "000-0018Q",
    "desc": "DISNEY 6 Quality Assurance"
  },
  {
    "code": "000-0018R",
    "desc": "DISNEY 6 Research & Development"
  },
  {
    "code": "000-0019E",
    "desc": "DISNEY 8 Engineering"
  },
  {
    "code": "000-0019P",
    "desc": "DISNEY 8 PPIC"
  },
  {
    "code": "000-0019Q",
    "desc": "DISNEY 8 Quality Assurance"
  },
  {
    "code": "000-0019R",
    "desc": "DISNEY 8 Research & Development"
  },
  {
    "code": "000-0019W",
    "desc": "DISNEY 8 Warehouse/Logistics"
  },
  {
    "code": "000-0020",
    "desc": "HASBRO Mat Prep"
  },
  {
    "code": "000-0020E",
    "desc": "HASBRO Engineering"
  },
  {
    "code": "000-0020P",
    "desc": "HASBRO PPIC"
  },
  {
    "code": "000-0020Q",
    "desc": "HASBRO Quality Assurance"
  },
  {
    "code": "000-0020R",
    "desc": "HASBRO Research & Development"
  },
  {
    "code": "000-0020W",
    "desc": "HASBRO Warehouse/Logistics"
  },
  {
    "code": "000-0021E",
    "desc": "SITIO Engineering"
  },
  {
    "code": "000-0021P",
    "desc": "SITIO PPIC"
  },
  {
    "code": "000-0021Q",
    "desc": "SITIO Quality Assurance"
  },
  {
    "code": "000-0021R",
    "desc": "SITIO Research & Development"
  },
  {
    "code": "000-0021W",
    "desc": "SITIO Warehouse/Logistics"
  },
  {
    "code": "000-0022E",
    "desc": "MATTEL Engineering"
  },
  {
    "code": "000-0022P",
    "desc": "MATTEL PPIC"
  },
  {
    "code": "000-0022Q",
    "desc": "MATTEL Quality Assurance"
  },
  {
    "code": "000-0022R",
    "desc": "MATTEL Research & Development"
  },
  {
    "code": "000-0022W",
    "desc": "MATTEL Warehouse/Logistics"
  },
  {
    "code": "000-0023A",
    "desc": "DISNEY 1 Engineering"
  },
  {
    "code": "000-0023B",
    "desc": "DISNEY 1 PPIC"
  },
  {
    "code": "000-0023C",
    "desc": "DISNEY 1 Quality Assurance"
  },
  {
    "code": "000-0023D",
    "desc": "DISNEY 1 Research & Development"
  },
  {
    "code": "000-0023E",
    "desc": "DISNEY 1 Warehouse/Logistics"
  },
  {
    "code": "000-0024E",
    "desc": "DISNEY 2 Engineering"
  },
  {
    "code": "000-0024P",
    "desc": "DISNEY 2 PPIC"
  },
  {
    "code": "000-0024Q",
    "desc": "DISNEY 2 Quality Assurance"
  },
  {
    "code": "000-0024R",
    "desc": "DISNEY 2 Research & Development"
  },
  {
    "code": "000-0024W",
    "desc": "DISNEY 2 Warehouse/Logistics"
  },
  {
    "code": "000-0026E",
    "desc": "DISNEY 7 Engineering"
  },
  {
    "code": "000-0026P",
    "desc": "DISNEY 7 PPIC"
  },
  {
    "code": "000-0026Q",
    "desc": "DISNEY 7 Quality Assurance"
  },
  {
    "code": "000-0026R",
    "desc": "DISNEY 7 Research & Development"
  },
  {
    "code": "000-0026W",
    "desc": "DISNEY 7 Warehouse/Logistics"
  },
  {
    "code": "000-0027E",
    "desc": "HAMFI Engineering"
  },
  {
    "code": "000-0027P",
    "desc": "HAMFI PPIC"
  },
  {
    "code": "000-0027Q",
    "desc": "HAMFI Quality Assurance"
  },
  {
    "code": "000-0027R",
    "desc": "HAMFI Research & Development"
  },
  {
    "code": "000-0027S",
    "desc": "HAMFI Sales"
  },
  {
    "code": "000-0027W",
    "desc": "HAMFI Warehouse/Logistics"
  },
  {
    "code": "000-0028A",
    "desc": "WARNER Accounting"
  },
  {
    "code": "000-0028E",
    "desc": "WARNER Engineering"
  },
  {
    "code": "000-0028H",
    "desc": "WARNER Human Resources"
  },
  {
    "code": "000-0028P",
    "desc": "WARNER PPIC"
  },
  {
    "code": "000-0028Q",
    "desc": "WARNER Quality Assurance"
  },
  {
    "code": "000-0028R",
    "desc": "WARNER Research & Development"
  },
  {
    "code": "000-0028S",
    "desc": "WARNER Sales and Accounts Management"
  },
  {
    "code": "000-0028W",
    "desc": "WARNER Warehouse/Logistics"
  },
  {
    "code": "000-0040",
    "desc": ""
  },
  {
    "code": "000-FXD",
    "desc": ""
  },
  {
    "code": "001-00000",
    "desc": ""
  },
  {
    "code": "001-C0010",
    "desc": "China Accounts"
  },
  {
    "code": "001-C0020",
    "desc": "China Human Resources & Admin"
  },
  {
    "code": "001-C0030",
    "desc": "China Engineering"
  },
  {
    "code": "001-C0040",
    "desc": "China Quality Assurance"
  },
  {
    "code": "001-C0050",
    "desc": "China Handsample Team"
  },
  {
    "code": "001-C0060",
    "desc": "China Supply Chain Department"
  },
  {
    "code": "001-C0070",
    "desc": "China Accounting and Finance"
  },
  {
    "code": "001-C0080",
    "desc": "China Creatives"
  },
  {
    "code": "001-C0090",
    "desc": "China Logistics and Shipment"
  },
  {
    "code": "002-00000",
    "desc": ""
  },
  {
    "code": "002-FLEXF",
    "desc": "Flexible Films"
  },
  {
    "code": "002-FLEXP",
    "desc": "Flexible Packaging"
  },
  {
    "code": "002-PCKGE",
    "desc": "Packaging"
  },
  {
    "code": "002-PREMI",
    "desc": "Premium"
  },
  {
    "code": "003-00000",
    "desc": ""
  },
  {
    "code": "004-00000",
    "desc": ""
  },
  {
    "code": "641-0030",
    "desc": ""
  },
  {
    "code": "641-0150",
    "desc": ""
  },
  {
    "code": "641-0190",
    "desc": ""
  },
  {
    "code": "641-0340",
    "desc": ""
  },
  {
    "code": "CH -INA",
    "desc": ""
  },
  {
    "code": "CHI-NA",
    "desc": ""
  },
  {
    "code": "DEL-FIXED",
    "desc": "DELIVERY FIXED RATE"
  },
  {
    "code": "DIS-NEY",
    "desc": ""
  },
  {
    "code": "DIS-NEY 3",
    "desc": ""
  },
  {
    "code": "HAS-BRO",
    "desc": ""
  },
  {
    "code": "PER-U",
    "desc": ""
  },
  {
    "code": "SEC-AGEN",
    "desc": "Security Agency Payroll"
  },
  {
    "code": "TOP-MAN",
    "desc": ""
  },
  {
    "code": "TOP-MANA",
    "desc": ""
  },
  {
    "code": "WAR-NER",
    "desc": ""
  }
];

/* Tax categories mirror Acumatica's Tax Category master file. Used in the
   Liquidation worksheet and exported straight into the "Tax Category" column. */
const TAX_CATEGORIES = [
  { code: "CHN VAT8", desc: "CHN_VAT8%" },
  { code: "CHTX", desc: "CHINA TAXES" },
  { code: "LCBROKER", desc: "Landed Cost Brokerage - WC140" },
  { code: "LCBROKERVAT", desc: "Landed Cost Brokerage - WC140 and VAT" },
  { code: "LCMATERIAL", desc: "LANDED COST MATERIALS" },
  { code: "LCSHIPPING5WT", desc: "LANDED COST SHIPPPING - 5% WT AND VAT" },
  { code: "LCSTORAGE", desc: "Landed Cost Storage - VAT and WT" },
  { code: "LCTRUCKING", desc: "Landed Cost Trucking WC160" },
  { code: "LCVATEXSS", desc: "Landed Cost VAT – Exempt Services" },
  { code: "LCWHARFAGE", desc: "Landed Cost Wharfage/Arrastre WC160" },
  { code: "VATCE", desc: "VAT- Capital Goods Exceeding 1M" },
  { code: "VATEX", desc: "VAT – Exempt Goods" },
  { code: "VATEXC", desc: "Vat Excluded" },
  { code: "VATEXSS", desc: "VAT – Exempt Services" },
  { code: "VATGD", desc: "VAT – Vatable Goods" },
  { code: "VATIM", desc: "VAT – Importation" },
  { code: "VATNC", desc: "VAT- Capital Goods not Exceeding 1M" },
  { code: "VATSG", desc: "VAT – Sale to Government" },
  { code: "VATSS", desc: "VAT – Vatable Services" },
  { code: "VATWH", desc: "VAT - Withholding Tax Holiday" },
  { code: "VATXX", desc: "VAT - Exempt Transaction" },
  { code: "VATZR", desc: "VAT – Zero Rated" },
  { code: "WC860", desc: "Income payment of manufacturers & direct importers of fuels" },
];

const taxCategoryLabel = (code) => {
  if (!code) return "—";
  const t = TAX_CATEGORIES.find((x) => x.code === code);
  return t ? `${t.code} — ${t.desc}` : code;
};

/* ---- Approval matrix ---- */
const APPROVAL_LEVELS = ["Manager", "Director", "Ma'am Grace", "Boss RTC"];

function defaultApprovals() {
  const o = {};
  APPROVAL_LEVELS.forEach((lvl) => { o[lvl] = { status: "Pending", by: "", date: "" }; });
  return o;
}

function normalizeApprovals(ap) {
  const base = defaultApprovals();
  if (ap && typeof ap === "object") {
    APPROVAL_LEVELS.forEach((lvl) => {
      if (ap[lvl]) base[lvl] = { status: ap[lvl].status || "Pending", by: ap[lvl].by || "", date: ap[lvl].date || "" };
    });
  }
  return base;
}

/* Overall approval verdict derived from the four levels. */
function overallApprovalStatus(approvals) {
  const ap = normalizeApprovals(approvals);
  const states = APPROVAL_LEVELS.map((lvl) => ap[lvl].status);
  if (states.includes("Rejected")) return "Rejected";
  if (states.every((s) => s === "Approved")) return "Approved";
  return "Pending";
}

function approvedCount(approvals) {
  const ap = normalizeApprovals(approvals);
  return APPROVAL_LEVELS.filter((lvl) => ap[lvl].status === "Approved").length;
}

/* ============================= USER ROLES ============================= */

/* Each role only sees the nav tabs relevant to it. Administrator sees everything. */
const ROLES = {
  "Administrator":     { label: "Administrator",     tabs: ["dashboard", "requests", "disbursements", "liquidation", "replenishment", "history", "report", "audit", "masterdata"] },
  "Requestor":         { label: "Requestor",         tabs: ["dashboard", "requests", "history"] },
  "Department Head":   { label: "Department Head",   tabs: ["dashboard", "requests", "history", "report"] },
  "Cashier":           { label: "Cashier",           tabs: ["dashboard", "requests", "disbursements", "liquidation", "history"] },
  "Accounting":        { label: "Accounting",        tabs: ["dashboard", "requests", "disbursements", "liquidation", "replenishment", "history", "report", "audit", "masterdata"] },
  "Finance Manager":   { label: "Finance Manager",   tabs: ["dashboard", "requests", "disbursements", "liquidation", "replenishment", "history", "report", "audit"] },
};
const ROLE_NAMES = Object.keys(ROLES);

/* Decide a signed-in user's role and admin status from the config in index.html.
   Admins get full super access and can view-as any role; everyone else is
   locked to a single restricted role. In local (no-auth) mode, the operator
   is treated as an admin so the tool stays fully usable offline. */
function resolveUserAccess(email) {
  if (!email) return { role: "Administrator", isAdmin: true }; // local / no-auth mode
  const admins = (window.PCP_ADMIN_EMAILS || []).map((s) => String(s).toLowerCase());
  const map = window.PCP_USER_ROLES || {};
  const fallback = (window.PCP_DEFAULT_ROLE && ROLES[window.PCP_DEFAULT_ROLE]) ? window.PCP_DEFAULT_ROLE : "Requestor";
  const e = String(email).toLowerCase();
  const username = e.split("@")[0];
  if (admins.includes(e) || admins.includes(username)) return { role: "Administrator", isAdmin: true };
  const mapped = map[e] || map[username];
  return { role: (mapped && ROLES[mapped]) ? mapped : fallback, isAdmin: false };
}

/* Build the notification feed derived from current state — approvals awaiting
   action, overdue/pending liquidations, and completed replenishments. */
function buildNotifications(requests, disbursements, liquidations, replenishments) {
  const out = [];
  requests.forEach((r) => {
    if (r.status === "Pending") out.push({ id: "n-req-" + r.id, type: "approval", icon: "clip", title: "Approval required", text: `${r.requestNo} · ${r.employee} · ${peso(r.amount)}`, date: r.date });
    if (r.status === "Approved") out.push({ id: "n-appr-" + r.id, type: "approved", icon: "check", title: "Request approved — ready to release", text: `${r.requestNo} · ${r.employee}`, date: r.date });
    if (r.status === "Rejected") out.push({ id: "n-rej-" + r.id, type: "rejected", icon: "x", title: "Request rejected", text: `${r.requestNo} · ${r.employee}`, date: r.date });
  });
  disbursements.forEach((d) => {
    const status = liqStatusFor(d, liquidations);
    if (status === "Fully Liquidated") return;
    const ageDays = Math.floor((Date.now() - new Date((d.date || todayISO()) + "T00:00:00").getTime()) / 86400000);
    if (ageDays >= 15) out.push({ id: "n-over-" + d.id, type: "overdue", icon: "alert", title: "Liquidation overdue", text: `${d.voucherNo} · ${d.employee} · ${ageDays} days outstanding`, date: d.date });
    else out.push({ id: "n-liq-" + d.id, type: "liquidation", icon: "sheet", title: "Liquidation due", text: `${d.voucherNo} · ${d.employee} · ${peso(d.amount)}`, date: d.date });
  });
  (replenishments || []).forEach((r) => {
    if (r.status === "Completed") out.push({ id: "n-rep-" + r.id, type: "replenished", icon: "refresh", title: "Replenishment completed", text: `${r.replenishmentNo} · ${peso(r.amount)}`, date: r.date });
    else out.push({ id: "n-repp-" + r.id, type: "replenish-pending", icon: "refresh", title: "Replenishment pending", text: `${r.replenishmentNo} · ${peso(r.amount)}`, date: r.date });
  });
  return out.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

const EXPENSE_CATEGORIES = [
  "DL 13th month pay",
  "DL Contracted Support Services",
  "DL Employee's Benefit",
  "DL Govt Mandatory",
  "DL Retirement benefit",
  "DL Salaries and Wages",
  "DL Service Fee",
  "FOH - Indirect Salaries & Wages",
  "FOH - Manufacturing",
  "FOH Arrastre Fees",
  "FOH Brokerage Fees",
  "FOH Communication, Light & Water",
  "FOH Delivery Expense",
  "FOH Delivery Expense-Transpo",
  "FOH Demurrage",
  "FOH Depreciation - Bldg. Equipment",
  "FOH Depreciation - Building",
  "FOH Depreciation - Delivery Truck",
  "FOH Depreciation - Machineries",
  "FOH Depreciation - Motorcycle Services",
  "FOH Depreciation - Prod Equipment",
  "FOH Distribution Charge",
  "FOH Duties & Taxes",
  "FOH Freight In Charges",
  "FOH Handling Fees",
  "FOH Insurance",
  "FOH Licensing Fee",
  "FOH Miscellaneous",
  "FOH Oil & Gasoline",
  "FOH Other Charges",
  "FOH Production Tools",
  "FOH Rental",
  "FOH Rep & Main. - Bldg. Equipment",
  "FOH Rep & Main. - Building",
  "FOH Rep & Main. - Delivery Truck",
  "FOH Rep & Main. - Fire Truck",
  "FOH Rep & Main. - Inventory Discrepancy",
  "FOH Rep & Main. - Machineries",
  "FOH Rep & Main. - Motorcycle Services",
  "FOH Rep & Main. - Prod Equipment",
  "FOH Sec. Serv.-Agency Fee",
  "FOH Security services",
  "FOH Service Fee & Premium Bond",
  "FOH Storage Fees",
  "FOH Surcharges",
  "FOH Testing Fee",
  "FOH Toll Fee",
  "FOH Trucking",
  "FOH Wharfage Fee",
  "OE - Feeds",
  "OE 13th month pay",
  "OE Advertising and Promotion",
  "OE Audit Fee",
  "OE Bank Service Charges",
  "OE Commission Expense",
  "OE Communication, Light & Water",
  "OE Contracted Support Services",
  "OE Courier Services",
  "OE Depreciation - Building",
  "OE Depreciation - Company Car",
  "OE Depreciation - Furniture & Fixtures",
  "OE Depreciation - Land Improvement",
  "OE Depreciation - Office Equipment",
  "OE Depreciation - Residential & Leisure",
  "OE Depreciation - Software Licenses",
  "OE Documentary Stamp Tax",
  "OE Documentation, Registration",
  "OE Dues, Subscription and List",
  "OE Employee's Benefit",
  "OE Facilitation Fee",
  "OE Govt Mandatory",
  "OE Insurance",
  "OE Interest Expense",
  "OE Inventory Loss",
  "OE Inventory Obsolescence",
  "OE Janitorial Expense",
  "OE Legal fees",
  "OE Meal Allowance",
  "OE Miscellaneous",
  "OE OJT Allowance",
  "OE Office Supplies",
  "OE Oil & Gasoline",
  "OE Other Charges",
  "OE Penalties/Impounding/Towing Fees",
  "OE Printing, Supplies & Office",
  "OE Product Licensing/Patent Fee",
  "OE Professional Fees",
  "OE Provision for  Income Tax",
  "OE Rental",
  "OE Rep. & Main - Building",
  "OE Rep. & Main - Company Car",
  "OE Rep. & Main - Land Improvement",
  "OE Rep. & Main - Office Equipment",
  "OE Rep. & Main - Residential & Leisure",
  "OE Representation and Entertai",
  "OE Retirement Pay",
  "OE Salaries and wages",
  "OE Samples",
  "OE Scholar Allowance",
  "OE Scholar Tuition",
  "OE Security Services-Agency Fe",
  "OE Security services",
  "OE Seminars and Training Fee",
  "OE Separation Pay",
  "OE Service Fee",
  "OE Service and Other Charges",
  "OE Software Licenses",
  "OE Taxes and Licenses",
  "OE Testing Fee",
  "OE Toll Fee",
  "OE Transaction Loss",
  "OE Transportation and travel"
];

const EXPENSE_CATEGORY_ACCOUNTS = {
  "DL 13th month pay": "51110120",
  "DL Contracted Support Services": "51110160",
  "DL Employee's Benefit": "51110130",
  "DL Govt Mandatory": "51110140",
  "DL Retirement benefit": "51110150",
  "DL Salaries and Wages": "51110110",
  "DL Service Fee": "51110165",
  "FOH Handling Fees": "52110050",
  "FOH - Indirect Salaries & Wages": "51110168",
  "FOH - Manufacturing": "51110169",
  "FOH Arrastre Fees": "52110060",
  "FOH Brokerage Fees": "52110030",
  "FOH Communication, Light & Water": "51110350",
  "FOH Delivery Expense": "51110420",
  "FOH Delivery Expense-Transpo": "51110400",
  "FOH Demurrage": "52110090",
  "FOH Depreciation - Bldg. Equipment": "51110260",
  "FOH Depreciation - Building": "51110250",
  "FOH Depreciation - Delivery Truck": "51110290",
  "FOH Depreciation - Machineries": "51110280",
  "FOH Depreciation - Motorcycle Services": "51110300",
  "FOH Depreciation - Prod Equipment": "51110270",
  "FOH Distribution Charge": "52110110",
  "FOH Duties & Taxes": "52110100",
  "FOH Freight In Charges": "52110020",
  "FOH Insurance": "51110320",
  "FOH Licensing Fee": "51110380",
  "FOH Miscellaneous": "51110390",
  "FOH Oil & Gasoline": "51110310",
  "FOH Other Charges": "52110130",
  "FOH Production Tools": "51110240",
  "FOH Rental": "51110360",
  "FOH Rep & Main. - Bldg. Equipment": "51110180",
  "FOH Rep & Main. - Building": "51110170",
  "FOH Rep & Main. - Delivery Truck": "51110210",
  "FOH Rep & Main. - Fire Truck": "51110220",
  "FOH Rep & Main. - Inventory Discrepancy": "51110231",
  "FOH Rep & Main. - Machineries": "51110200",
  "FOH Rep & Main. - Motorcycle Services": "51110230",
  "FOH Rep & Main. - Prod Equipment": "51110190",
  "FOH Sec. Serv.-Agency Fee": "51110340",
  "FOH Security services": "51110330",
  "FOH Service Fee & Premium Bond": "52110010",
  "FOH Storage Fees": "52110040",
  "FOH Surcharges": "52110070",
  "FOH Testing Fee": "51110370",
  "FOH Toll Fee": "51110315",
  "FOH Trucking": "52110080",
  "FOH Wharfage Fee": "52110120",
  "OE - Feeds": "64110553",
  "OE 13th month pay": "64110020",
  "OE Advertising and Promotion": "64110220",
  "OE Audit Fee": "64110300",
  "OE Bank Service Charges": "64110270",
  "OE Commission Expense": "64110090",
  "OE Communication, Light & Water": "64110180",
  "OE Contracted Support Services": "64110120",
  "OE Courier Services": "64110570",
  "OE Depreciation - Building": "64110440",
  "OE Depreciation - Company Car": "64110460",
  "OE Depreciation - Furniture & Fixtures": "64110480",
  "OE Depreciation - Land Improvement": "64110430",
  "OE Depreciation - Office Equipment": "64110470",
  "OE Depreciation - Residential & Leisure": "64110450",
  "OE Depreciation - Software Licenses": "64110485",
  "OE Documentary Stamp Tax": "64110585",
  "OE Documentation, Registration": "64110240",
  "OE Dues, Subscription and List": "64110230",
  "OE Employee's Benefit": "64110030",
  "OE Facilitation Fee": "64110310",
  "OE Govt Mandatory": "64110040",
  "OE Insurance": "64110330",
  "OE Interest Expense": "64110210",
  "OE Inventory Loss": "64110360",
  "OE Inventory Obsolescence": "64110350",
  "OE Janitorial Expense": "64110370",
  "OE Legal fees": "64110080",
  "OE Meal Allowance": "64110060",
  "OE Miscellaneous": "64110280",
  "OE Office Supplies": "64110140",
  "OE Oil & Gasoline": "64110170",
  "OE OJT Allowance": "64110015",
  "OE Other Charges": "64110340",
  "OE Penalties/Impounding/Towing Fees": "64110580",
  "OE Printing, Supplies & Office": "64110150",
  "OE Product Licensing/Patent Fee": "64110500",
  "OE Professional Fees": "64110070",
  "OE Provision for  Income Tax": "64110520",
  "OE Rental": "64110290",
  "OE Rep. & Main - Building": "64110390",
  "OE Rep. & Main - Company Car": "64110410",
  "OE Rep. & Main - Land Improvement": "64110380",
  "OE Rep. & Main - Office Equipment": "64110420",
  "OE Rep. & Main - Residential & Leisure": "64110400",
  "OE Representation and Entertai": "64110250",
  "OE Retirement Pay": "64110055",
  "OE Salaries and wages": "64110010",
  "OE Samples": "64110321",
  "OE Scholar Allowance": "64110551",
  "OE Scholar Tuition": "64110552",
  "OE Security services": "64110100",
  "OE Security Services-Agency Fe": "64110110",
  "OE Seminars and Training Fee": "64110260",
  "OE Separation Pay": "64110050",
  "OE Service and Other Charges": "64110510",
  "OE Service Fee": "64110130",
  "OE Software Licenses": "64110490",
  "OE Taxes and Licenses": "64110190",
  "OE Testing Fee": "64110320",
  "OE Toll Fee": "64110175",
  "OE Transaction Loss": "64110200",
  "OE Transportation and travel": "64110160",
};

function accountForCategory(category) {
  return EXPENSE_CATEGORY_ACCOUNTS[category] || "";
}

const LOGO_SPI = "data:image/png;base64,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";
const LOGO_A1 = "data:image/png;base64,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";
/* ============================= STYLES ============================= */

const CSS = `
  :root {
    --ink: #12172a;
    --ink-2: #1c2440;
    --paper: #f3f4f7;
    --card: #ffffff;
    --line: #e3e5ea;
    --text: #1c2130;
    --text-mut: #6b7182;
    --brand: #c8102e;
    --brand-dark: #970c22;
    --amber: #b9790a;
    --green: #15803d;
    --green-bg: #e8f5ec;
    --red-bg: #fbe9e9;
    --amber-bg: #fdf3e0;
    --blue-bg: #eaf1fb;
    --blue: #2054a3;
  }
  * { box-sizing: border-box; }
  .pcp-root {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: var(--paper);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    font-size: 13.5px;
    line-height: 1.45;
  }
  .pcp-root * { font-variant-numeric: tabular-nums; }
  .pcp-num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }

  /* ---- Sidebar ---- */
  .pcp-sidebar {
    width: 232px;
    flex-shrink: 0;
    background: var(--ink);
    color: #cfd3e0;
    display: flex;
    flex-direction: column;
    padding: 18px 14px;
    position: sticky;
    top: 0;
    height: 100vh;
  }
  .pcp-brand-row {
    display: flex; align-items: center; gap: 10px;
    padding: 4px 6px 18px 6px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    margin-bottom: 14px;
  }
  .pcp-brand-mark {
    width: 34px; height: 34px; border-radius: 8px;
    background: linear-gradient(135deg, var(--brand), var(--brand-dark));
    display: flex; align-items: center; justify-content: center;
    color: white; flex-shrink: 0;
  }
  .pcp-brand-title { font-weight: 700; font-size: 14.5px; color: #fff; letter-spacing: 0.2px; }
  .pcp-brand-sub { font-size: 10.5px; color: #8891a8; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 1px; }

  .pcp-nav { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }
  .pcp-nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 11px; border-radius: 8px; cursor: pointer;
    color: #b7bccd; font-size: 13px; font-weight: 500;
    transition: background 0.12s, color 0.12s;
    border: none; background: transparent; text-align: left; width: 100%;
  }
  .pcp-nav-item:hover { background: rgba(255,255,255,0.06); color: #fff; }
  .pcp-nav-item.active { background: var(--brand); color: #fff; }
  .pcp-nav-item svg { flex-shrink: 0; }

  .pcp-sidebar-foot {
    margin-top: auto; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.08);
  }
  .pcp-logos-strip { display: flex; align-items: center; gap: 12px; padding: 10px 6px; }
  .pcp-logos-strip img { max-height: 40px; max-width: 104px; object-fit: contain; filter: brightness(0) invert(1); opacity: 0.9; }

  /* ---- Main ---- */
  .pcp-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .pcp-topbar {
    background: var(--card); border-bottom: 1px solid var(--line);
    padding: 14px 26px; display: flex; align-items: center; justify-content: space-between;
    position: sticky; top: 0; z-index: 5;
  }
  .pcp-topbar h1 { font-size: 18px; font-weight: 700; margin: 0; letter-spacing: -0.2px; }
  .pcp-topbar-sub { font-size: 12px; color: var(--text-mut); margin-top: 2px; }
  .pcp-content { padding: 22px 26px 60px 26px; }

  .pcp-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: 7px; border: 1px solid var(--line);
    background: #fff; color: var(--text); font-size: 12.5px; font-weight: 600;
    cursor: pointer; transition: all 0.12s; white-space: nowrap;
  }
  .pcp-btn:hover { border-color: #c7cad3; background: #fafafb; }
  .pcp-btn-primary { background: var(--brand); border-color: var(--brand); color: #fff; }
  .pcp-btn-primary:hover { background: var(--brand-dark); border-color: var(--brand-dark); }
  .pcp-btn-ghost { border-color: transparent; background: transparent; }
  .pcp-btn-ghost:hover { background: var(--paper); }
  .pcp-btn-sm { padding: 5px 10px; font-size: 11.5px; }
  .pcp-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .pcp-btn-danger { color: var(--brand); }

  .pcp-card {
    background: var(--card); border: 1px solid var(--line); border-radius: 12px;
  }
  .pcp-card-pad { padding: 18px 20px; }

  .pcp-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
  .pcp-kpi {
    background: var(--card); border: 1px solid var(--line); border-radius: 12px;
    padding: 15px 17px; position: relative; overflow: hidden;
  }
  .pcp-kpi-label { font-size: 11px; color: var(--text-mut); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .pcp-kpi-value { font-size: 21px; font-weight: 700; margin-top: 6px; letter-spacing: -0.3px; }
  .pcp-kpi-icon {
    position: absolute; right: 14px; top: 14px; width: 30px; height: 30px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
  }
  .pcp-kpi-foot { font-size: 11px; margin-top: 6px; color: var(--text-mut); }

  .pcp-section-title { font-size: 14px; font-weight: 700; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px; }
  .pcp-eyebrow { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; color: var(--brand); margin-bottom: 4px; }

  .pcp-grid-2 { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; }
  .pcp-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

  table.pcp-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  table.pcp-table thead th {
    text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px;
    color: var(--text-mut); font-weight: 700; padding: 9px 10px; border-bottom: 1px solid var(--line);
    background: #fafbfc; white-space: nowrap;
  }
  table.pcp-table tbody td { padding: 9px 10px; border-bottom: 1px solid #eef0f3; vertical-align: middle; }
  table.pcp-table tbody tr:hover { background: #fafbfd; }
  table.pcp-table tbody tr:last-child td { border-bottom: none; }
  .pcp-table-wrap { overflow-x: auto; }

  .pcp-badge {
    display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 99px;
    font-size: 10.5px; font-weight: 700; white-space: nowrap; letter-spacing: 0.2px;
  }
  .pcp-badge-green { background: var(--green-bg); color: var(--green); }
  .pcp-badge-amber { background: var(--amber-bg); color: var(--amber); }
  .pcp-badge-red { background: var(--red-bg); color: var(--brand); }
  .pcp-badge-blue { background: var(--blue-bg); color: var(--blue); }
  .pcp-badge-gray { background: #eef0f3; color: var(--text-mut); }

  .pcp-input, .pcp-select, textarea.pcp-input {
    width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: 7px;
    font-size: 12.5px; background: #fff; color: var(--text); font-family: inherit;
  }
  .pcp-input:focus, .pcp-select:focus, textarea.pcp-input:focus { outline: 2px solid var(--brand); outline-offset: 0; border-color: var(--brand); }
  .pcp-field { margin-bottom: 12px; }
  .pcp-field label { display: block; font-size: 11.5px; font-weight: 600; color: var(--text-mut); margin-bottom: 5px; }
  .pcp-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  .pcp-modal-backdrop {
    position: fixed; inset: 0; background: rgba(15,18,30,0.55); display: flex;
    align-items: flex-start; justify-content: center; z-index: 50; padding: 40px 20px; overflow-y: auto;
  }
  .pcp-modal {
    background: #fff; border-radius: 14px; width: 100%; max-width: 620px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  }
  .pcp-modal-head {
    padding: 18px 22px; border-bottom: 1px solid var(--line); display: flex;
    align-items: center; justify-content: space-between;
  }
  .pcp-modal-head h3 { margin: 0; font-size: 15px; font-weight: 700; }
  .pcp-modal-body { padding: 20px 22px; max-height: 65vh; overflow-y: auto; }
  .pcp-modal-foot { padding: 14px 22px; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; gap: 8px; }

  .pcp-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin-bottom: 18px; }
  .pcp-tab {
    padding: 9px 14px; font-size: 12.5px; font-weight: 600; color: var(--text-mut);
    cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; background: none; border-left:none;border-right:none;border-top:none;
  }
  .pcp-tab.active { color: var(--brand); border-bottom-color: var(--brand); }

  .pcp-empty { text-align: center; padding: 40px 20px; color: var(--text-mut); }
  .pcp-flow {
    display: flex; align-items: stretch; gap: 0; background: var(--ink);
    border-radius: 12px; overflow: hidden; margin-bottom: 18px;
  }
  .pcp-flow-step { flex: 1; padding: 16px 20px; position: relative; color: #fff; }
  .pcp-flow-step + .pcp-flow-step { border-left: 1px solid rgba(255,255,255,0.12); }
  .pcp-flow-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.6px; color: #9098b3; font-weight: 700; }
  .pcp-flow-value { font-size: 19px; font-weight: 700; margin-top: 6px; }
  .pcp-flow-arrow { position: absolute; right: -11px; top: 50%; transform: translateY(-50%); z-index: 2; color: #676f8c; }

  .pcp-liq-line { display: grid; grid-template-columns: 100px 1fr 1.1fr 1fr 0.85fr 100px 32px; gap: 8px; align-items: center; margin-bottom: 8px; }
  .pcp-liq-line-head { display: grid; grid-template-columns: 100px 1fr 1.1fr 1fr 0.85fr 100px 32px; gap: 8px; font-size: 10.5px; text-transform: uppercase; color: var(--text-mut); font-weight: 700; margin-bottom: 8px; letter-spacing: 0.4px;}

  .pcp-chip-list { display: flex; flex-wrap: wrap; gap: 8px; }
  .pcp-voucher-card {
    border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; cursor: pointer;
    transition: all 0.12s; margin-bottom: 8px;
  }
  .pcp-voucher-card:hover { border-color: var(--brand); }
  .pcp-voucher-card.active { border-color: var(--brand); background: var(--red-bg); }

  ::-webkit-scrollbar { width: 9px; height: 9px; }
  ::-webkit-scrollbar-thumb { background: #d3d6de; border-radius: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }

  /* ---- Approval matrix ---- */
  .pcp-appr-chips { display: flex; gap: 4px; flex-wrap: wrap; }
  .pcp-appr-chip {
    display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 99px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.2px; white-space: nowrap;
  }
  .pcp-appr-approved { background: var(--green-bg); color: var(--green); }
  .pcp-appr-pending { background: var(--amber-bg); color: var(--amber); }
  .pcp-appr-rejected { background: var(--red-bg); color: var(--brand); }
  .pcp-appr-row {
    display: grid; grid-template-columns: 150px 1fr auto; gap: 10px; align-items: center;
    padding: 10px 0; border-bottom: 1px solid #eef0f3;
  }
  .pcp-appr-row:last-child { border-bottom: none; }
  .pcp-appr-level { font-weight: 700; font-size: 12.5px; }

  /* ---- Notifications & role ---- */
  .pcp-notif-dot {
    position: absolute; top: 1px; right: 1px; min-width: 15px; height: 15px; padding: 0 3px;
    background: var(--brand); color: #fff; border-radius: 99px; font-size: 9px; font-weight: 800;
    display: flex; align-items: center; justify-content: center; line-height: 1;
  }
  .pcp-notif-panel {
    position: absolute; right: 0; top: calc(100% + 8px); width: 340px; background: #fff;
    border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 16px 44px rgba(0,0,0,0.18);
    z-index: 60; overflow: hidden;
  }
  .pcp-notif-head { padding: 12px 16px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; }
  .pcp-notif-list { max-height: 400px; overflow-y: auto; }
  .pcp-notif-item { display: flex; gap: 10px; padding: 11px 16px; border-bottom: 1px solid #f0f1f4; cursor: pointer; }
  .pcp-notif-item:hover { background: #fafbfd; }
  .pcp-notif-item:last-child { border-bottom: none; }
  .pcp-notif-ic { width: 28px; height: 28px; border-radius: 7px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .pcp-role-select { width: auto; min-width: 150px; font-weight: 600; }
  .pcp-role-pill {
    display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 7px;
    background: var(--blue-bg); color: var(--blue); font-size: 12px; font-weight: 700; white-space: nowrap;
  }
  .pcp-role-badge {
    display: flex; align-items: center; gap: 6px; padding: 7px 10px; margin: 0 6px 10px 6px;
    background: rgba(255,255,255,0.06); border-radius: 8px; color: #cfd3e0; font-size: 11.5px; font-weight: 600;
  }
  .pcp-user-row {
    display: flex; align-items: center; gap: 6px; padding: 6px 8px 6px 10px; margin: 0 6px 10px 6px;
    background: rgba(255,255,255,0.04); border-radius: 8px;
  }
  .pcp-user-email { flex: 1; min-width: 0; color: #9098b3; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pcp-kpi-click { cursor: pointer; transition: border-color 0.12s, box-shadow 0.12s; }
  .pcp-kpi-click:hover { border-color: var(--brand); box-shadow: 0 4px 14px rgba(200,16,46,0.10); }

  /* ---- Login ---- */
  .pcp-login-wrap { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; min-height: 100vh; }
  .pcp-login-card {
    width: 100%; max-width: 380px; background: var(--card); border: 1px solid var(--line);
    border-radius: 14px; box-shadow: 0 18px 50px rgba(15,18,30,0.12); overflow: hidden;
  }
  .pcp-login-head { background: var(--ink); color: #fff; padding: 22px 24px; }
  .pcp-login-head .pcp-brand-mark { margin-bottom: 12px; }
  .pcp-login-title { font-size: 16px; font-weight: 700; }
  .pcp-login-sub { font-size: 11.5px; color: #9098b3; margin-top: 3px; }
  .pcp-login-body { padding: 22px 24px; }
  .pcp-login-err { background: var(--red-bg); color: var(--brand); font-size: 12px; padding: 9px 12px; border-radius: 8px; margin-bottom: 12px; }
  .pcp-login-ok { background: var(--green-bg); color: var(--green); font-size: 12px; padding: 9px 12px; border-radius: 8px; margin-bottom: 12px; }
  .pcp-login-foot { font-size: 11px; color: var(--text-mut); text-align: center; margin-top: 14px; }
  .pcp-link-btn { background: none; border: none; color: var(--brand); font-size: 11.5px; cursor: pointer; padding: 0; font-weight: 600; }

  /* ---- Report ---- */
  .pcp-report-head { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
  .pcp-report-head img { max-height: 46px; max-width: 130px; object-fit: contain; }
  .pcp-report-title { font-size: 17px; font-weight: 800; letter-spacing: -0.2px; }
  .pcp-report-sub { font-size: 11.5px; color: var(--text-mut); }
  table.pcp-table tfoot td { padding: 9px 10px; border-top: 2px solid var(--line); font-weight: 800; background: #fafbfc; }

  @media (max-width: 980px) {
    .pcp-kpi-grid { grid-template-columns: repeat(2, 1fr); }
    .pcp-grid-2, .pcp-grid-3 { grid-template-columns: 1fr; }
    .pcp-sidebar { width: 74px; }
    .pcp-brand-title, .pcp-brand-sub, .pcp-nav-item span, .pcp-logos-strip { display: none; }
  }

  /* ---- Print (management report) ---- */
  @media print {
    .pcp-sidebar, .pcp-topbar, .pcp-tabs, .pcp-no-print { display: none !important; }
    .pcp-root { display: block; }
    .pcp-content { padding: 0 !important; }
    .pcp-card { border: 1px solid #ccc; break-inside: avoid; }
    body, .pcp-root { background: #fff !important; }
    table.pcp-table thead th { background: #f0f0f0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "requests", label: "Petty Cash Requests", icon: ClipboardList },
  { key: "disbursements", label: "Release Ledger", icon: Receipt },
  { key: "liquidation", label: "Liquidation", icon: FileSpreadsheet },
  { key: "replenishment", label: "Replenishment", icon: RefreshCw },
  { key: "history", label: "Transaction History", icon: History },
  { key: "report", label: "Reports", icon: FileText },
  { key: "audit", label: "Audit Trail", icon: ShieldCheck },
  { key: "masterdata", label: "Funds & Master Data", icon: Database },
];

function Sidebar({ tab, setTab, role, navItems, userEmail, onSignOut }) {
  const items = navItems || NAV_ITEMS;
  return (
    <aside className="pcp-sidebar">
      <div className="pcp-brand-row">
        <div className="pcp-brand-mark"><Wallet size={18} /></div>
        <div>
          <div className="pcp-brand-title">Petty Cash System</div>
          <div className="pcp-brand-sub">Imprest Fund System</div>
        </div>
      </div>
      <nav className="pcp-nav">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              className={"pcp-nav-item" + (tab === item.key ? " active" : "")}
              onClick={() => setTab(item.key)}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="pcp-sidebar-foot">
        {role && (
          <div className="pcp-role-badge" title="Signed-in role">
            <UserCog size={13} /> <span>{role}</span>
          </div>
        )}
        {userEmail && (
          <div className="pcp-user-row">
            <span className="pcp-user-email" title={userEmail}>{userEmail}</span>
            <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" style={{ color: "#cfd3e0" }} onClick={onSignOut} title="Sign out">
              <LogOut size={13} />
            </button>
          </div>
        )}
        <div className="pcp-logos-strip">
          <img src={LOGO_A1} alt="A1+ Paper and Plastic Inc." />
          <img src={LOGO_SPI} alt="Starkson Paper and Plastic Corporation" />
        </div>
        <div style={{ fontSize: 10.5, color: "#6b7290", padding: "2px 6px" }}>
          A1+ Paper &amp; Plastic Inc. · Starkson Paper &amp; Plastic Corp.
        </div>
      </div>
    </aside>
  );
}

/* Shared UI context so every tab's TopBar can render the global notification
   bell and role switcher without threading props through each component. */
const AppUI = React.createContext(null);

const NOTIF_ICON = { clip: ClipboardList, check: Check, x: X, alert: AlertTriangle, sheet: FileSpreadsheet, refresh: RefreshCw };

function NotificationBell() {
  const ui = useContext(AppUI);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  if (!ui) return null;
  const notes = ui.notifications || [];
  const count = notes.length;
  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button className="pcp-btn pcp-btn-ghost" style={{ position: "relative", padding: "8px 10px" }} onClick={() => setOpen((o) => !o)} title="Notifications">
        <Bell size={16} />
        {count > 0 && <span className="pcp-notif-dot">{count > 9 ? "9+" : count}</span>}
      </button>
      {open && (
        <div className="pcp-notif-panel">
          <div className="pcp-notif-head">
            <strong>Notifications</strong>
            <span style={{ fontSize: 11, color: "var(--text-mut)" }}>{count} active</span>
          </div>
          <div className="pcp-notif-list">
            {notes.length ? notes.map((n) => {
              const Icon = NOTIF_ICON[n.icon] || Bell;
              const tint = n.type === "overdue" || n.type === "rejected" ? "var(--brand)"
                : n.type === "approved" || n.type === "replenished" ? "var(--green)"
                : n.type === "approval" ? "var(--amber)" : "var(--blue)";
              return (
                <div key={n.id} className="pcp-notif-item" onClick={() => { if (ui.onNotifClick) ui.onNotifClick(n); setOpen(false); }}>
                  <div className="pcp-notif-ic" style={{ background: tint + "18", color: tint }}><Icon size={14} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-mut)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.text}</div>
                    <div style={{ fontSize: 10, color: "#9098b3" }}>{fmtDate(n.date)}</div>
                  </div>
                </div>
              );
            }) : <div className="pcp-empty" style={{ padding: 24 }}>You're all caught up</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function RoleSelector() {
  const ui = useContext(AppUI);
  if (!ui) return null;
  if (!ui.canSwitchRole) {
    return (
      <span className="pcp-role-pill" title="Your access level (set by your administrator)">
        <ShieldCheck size={13} /> {ui.role}
      </span>
    );
  }
  return (
    <select className="pcp-select pcp-role-select" value={ui.role} onChange={(e) => ui.setRole(e.target.value)} title="Super admin — view the system as any role">
      {ROLE_NAMES.map((r) => <option key={r} value={r}>{r === "Administrator" ? "Administrator (super)" : "View as: " + r}</option>)}
    </select>
  );
}

function TopBar({ title, sub, right }) {
  return (
    <div className="pcp-topbar">
      <div>
        <h1>{title}</h1>
        {sub && <div className="pcp-topbar-sub">{sub}</div>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {right}
        <NotificationBell />
        <RoleSelector />
      </div>
    </div>
  );
}

function Badge({ status }) {
  const map = {
    Pending: "amber", Approved: "blue", Rejected: "red", Disbursed: "green",
    Open: "blue", Closed: "gray",
    "Not Liquidated": "amber", "Partially Liquidated": "blue",
    "Fully Liquidated": "green", "Over-Liquidated": "red",
    Draft: "gray", Submitted: "amber", Verified: "blue", Completed: "green", Released: "green",
  };
  const cls = map[status] || "gray";
  return <span className={`pcp-badge pcp-badge-${cls}`}>{status}</span>;
}
/* ============================= DASHBOARD ============================= */

const CHART_COLORS = ["#c8102e", "#2054a3", "#b9790a", "#15803d", "#7c3aed", "#0891b2", "#be185d", "#4b5563"];

function KpiCard({ label, value, icon: Icon, tint, foot, onClick }) {
  return (
    <div className={"pcp-kpi" + (onClick ? " pcp-kpi-click" : "")} onClick={onClick}>
      <div className="pcp-kpi-icon" style={{ background: tint + "22", color: tint }}>
        <Icon size={16} />
      </div>
      <div className="pcp-kpi-label">{label}</div>
      <div className="pcp-kpi-value pcp-num">{value}</div>
      {foot && <div className="pcp-kpi-foot">{foot}</div>}
    </div>
  );
}

function groupSum(items, keyFn, valFn) {
  const map = new Map();
  items.forEach((it) => {
    const k = keyFn(it) || "Unassigned";
    map.set(k, (map.get(k) || 0) + (valFn ? valFn(it) : 1));
  });
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

function MiniBarChart({ data, height = 220, layout = "vertical" }) {
  if (!data.length) return <div className="pcp-empty">No data yet</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout === "vertical" ? "vertical" : "horizontal"} margin={{ left: 8, right: 18, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" horizontal={layout !== "vertical"} vertical={layout === "vertical"} />
        {layout === "vertical" ? (
          <>
            <XAxis type="number" tickFormatter={shortPeso} fontSize={10.5} stroke="#9098b3" />
            <YAxis type="category" dataKey="name" width={120} fontSize={10.5} stroke="#9098b3" />
          </>
        ) : (
          <>
            <XAxis dataKey="name" fontSize={10.5} stroke="#9098b3" />
            <YAxis tickFormatter={shortPeso} fontSize={10.5} stroke="#9098b3" />
          </>
        )}
        <Tooltip formatter={(v) => peso(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e3e5ea" }} />
        <Bar dataKey="value" fill="#c8102e" radius={[4, 4, 4, 4]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const DASHBOARD_BRANCHES = [
  { key: "MNL", label: "Manila", branchCode: "A1+" },
  { key: "WARNER", label: "Warner", branchCode: "WARNER" },
  { key: "DISNEY", label: "Disney", branchCode: "D1" },
];

function Dashboard({ funds, requests, disbursements, liquidations, replenishments, onNavigate }) {
  const m = useMemo(() => computeMetrics(funds, requests, disbursements, liquidations, replenishments), [funds, requests, disbursements, liquidations, replenishments]);

  const byBranch = useMemo(() => groupSum(disbursements, (d) => d.branchCode, (d) => d.amount), [disbursements]);
  const byCompany = useMemo(() => groupSum(disbursements, (d) => companyOfBranch(d.branchCode), (d) => d.amount), [disbursements]);
  const byDept = useMemo(() => groupSum(disbursements, (d) => {
    const s = SUBACCOUNTS.find((x) => x.code === d.department);
    return s ? s.desc || s.code : d.department;
  }, (d) => d.amount), [disbursements]);
  const byCategory = useMemo(() => groupSum(disbursements, (d) => d.expenseCategory, (d) => d.amount), [disbursements]);

  const allLines = useMemo(() => liquidations.flatMap((l) => l.lines), [liquidations]);
  const topCategories = useMemo(() => {
    const g = groupSum(allLines, (l) => l.category, (l) => l.amount);
    return g.sort((a, b) => b.value - a.value).slice(0, 6);
  }, [allLines]);

  const monthlyTrend = useMemo(() => {
    const map = new Map();
    allLines.forEach((l) => {
      const month = (l.date || "").slice(0, 7);
      if (!month) return;
      map.set(month, (map.get(month) || 0) + (Number(l.amount) || 0));
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([month, value]) => ({ month, value }));
  }, [allLines]);

  const liqStatusCounts = useMemo(() => {
    const g = groupSum(disbursements, (d) => liqStatusFor(d, liquidations));
    return g;
  }, [disbursements, liquidations]);

  const recentDisbursements = useMemo(() =>
    [...disbursements].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5),
    [disbursements]);

  const recentLiquidations = useMemo(() =>
    [...liquidations].sort((a, b) => (b.createdDate || "").localeCompare(a.createdDate || "")).slice(0, 5),
    [liquidations]);

  return (
    <div>
      <div className="pcp-flow">
        <div className="pcp-flow-step">
          <div className="pcp-flow-label">Beginning Balance</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalFund)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step">
          <div className="pcp-flow-label">Total Disbursed</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalDisbursed)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step">
          <div className="pcp-flow-label">Total Liquidated</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalLiquidated)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step">
          <div className="pcp-flow-label">Available Balance</div>
          <div className="pcp-flow-value pcp-num" style={{ color: m.availableBalance < 0 ? "#ff8080" : "#8fffb0" }}>
            {peso(m.availableBalance)}
          </div>
        </div>
      </div>

      <div className="pcp-kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <KpiCard label="Current Petty Cash Balance" value={peso(m.availableBalance)} icon={CircleDollarSign}
          tint={m.availableBalance < 0 ? "#c8102e" : "#15803d"}
          foot={m.availableBalance < 0 ? "Over committed — replenish soon" : "Cash on hand across custodians"} />
        <KpiCard label="Pending Requests" value={m.pendingRequests} icon={ClipboardList} tint="#b9790a" foot="Awaiting approval" onClick={onNavigate ? () => onNavigate("requests") : undefined} />
        <KpiCard label="Approved Requests" value={m.approvedRequests} icon={Check} tint="#2054a3" foot="Ready for release" onClick={onNavigate ? () => onNavigate("requests") : undefined} />
        <KpiCard label="Pending Liquidations" value={m.pendingLiquidationCount} icon={FileSpreadsheet} tint="#2054a3" foot="Vouchers not fully liquidated" onClick={onNavigate ? () => onNavigate("liquidation") : undefined} />
        <KpiCard label="Pending Replenishments" value={m.pendingReplenishments} icon={RefreshCw} tint="#b9790a" foot="Awaiting completion" onClick={onNavigate ? () => onNavigate("replenishment") : undefined} />
        <KpiCard label="Monthly Expenses" value={peso(m.monthlyExpenses)} icon={TrendingUp} tint="#c8102e" foot="Liquidated this month" onClick={onNavigate ? () => onNavigate("history") : undefined} />
        <KpiCard label="Active Petty Cash Funds" value={funds.length + " Funds"} icon={PiggyBank} tint="#7c3aed" foot="Across all plants" onClick={onNavigate ? () => onNavigate("masterdata") : undefined} />
        <KpiCard label="Total Disbursed" value={peso(m.totalDisbursed)} icon={ArrowUpRight} tint="#b9790a" foot="Released to date" onClick={onNavigate ? () => onNavigate("disbursements") : undefined} />
        <KpiCard label="Employees w/ Active Advances" value={m.activeEmployeeCount} icon={Users} tint="#15803d" />
      </div>

      <div className="pcp-grid-2" style={{ marginBottom: 16 }}>
        <div className="pcp-card pcp-card-pad">
          <div className="pcp-section-title"><TrendingUp size={15} color="#c8102e" /> Monthly Expense Trend</div>
          {monthlyTrend.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyTrend} margin={{ left: 8, right: 18, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                <XAxis dataKey="month" fontSize={10.5} stroke="#9098b3" />
                <YAxis tickFormatter={shortPeso} fontSize={10.5} stroke="#9098b3" />
                <Tooltip formatter={(v) => peso(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e3e5ea" }} />
                <Line type="monotone" dataKey="value" stroke="#c8102e" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="pcp-empty">No liquidated expenses recorded yet</div>}
        </div>
        <div className="pcp-card pcp-card-pad">
          <div className="pcp-section-title"><FileSpreadsheet size={15} color="#c8102e" /> Liquidation Status</div>
          {liqStatusCounts.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={liqStatusCounts} dataKey="value" nameKey="name" innerRadius={45} outerRadius={78} paddingAngle={2}>
                  {liqStatusCounts.map((entry, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e3e5ea" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="pcp-empty">No vouchers yet</div>}
        </div>
      </div>

      <div className="pcp-grid-3" style={{ marginBottom: 16 }}>
        <div className="pcp-card pcp-card-pad">
          <div className="pcp-section-title">Disbursements by Branch</div>
          <MiniBarChart data={byBranch} />
        </div>
        <div className="pcp-card pcp-card-pad">
          <div className="pcp-section-title">Disbursements by Company</div>
          <MiniBarChart data={byCompany} />
        </div>
        <div className="pcp-card pcp-card-pad">
          <div className="pcp-section-title">Disbursements by Department</div>
          <MiniBarChart data={byDept} />
        </div>
      </div>

      <div className="pcp-grid-2" style={{ marginBottom: 16 }}>
        <div className="pcp-card pcp-card-pad">
          <div className="pcp-section-title">Top Expense Categories (Liquidated)</div>
          <MiniBarChart data={topCategories} />
        </div>
        <div className="pcp-card pcp-card-pad">
          <div className="pcp-section-title">Disbursements by Expense Category</div>
          <MiniBarChart data={byCategory} />
        </div>
      </div>

      <div className="pcp-grid-2">
        <div className="pcp-card pcp-card-pad">
          <div className="pcp-section-title">Recent Transactions</div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead><tr><th>Voucher</th><th>Employee</th><th>Branch</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {recentDisbursements.length ? recentDisbursements.map((d) => (
                  <tr key={d.id}>
                    <td>{d.voucherNo}</td>
                    <td>{d.employee}</td>
                    <td>{d.branchCode}</td>
                    <td className="pcp-num">{peso(d.amount)}</td>
                    <td><Badge status={liqStatusFor(d, liquidations)} /></td>
                  </tr>
                )) : <tr><td colSpan={5} className="pcp-empty">No disbursements recorded</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="pcp-card pcp-card-pad">
          <div className="pcp-section-title">Recent Liquidations</div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead><tr><th>Voucher</th><th>Date</th><th>Liquidated</th><th>Remaining</th></tr></thead>
              <tbody>
                {recentLiquidations.length ? recentLiquidations.map((l) => {
                  const disb = disbursements.find((d) => d.id === l.disbursementId);
                  const total = liquidatedTotal(l);
                  const remaining = disb ? disb.amount - total : 0;
                  return (
                    <tr key={l.id}>
                      <td>{disb ? disb.voucherNo : "—"}</td>
                      <td>{fmtDate(l.createdDate)}</td>
                      <td className="pcp-num">{peso(total)}</td>
                      <td className="pcp-num" style={{ color: remaining < 0 ? "#c8102e" : "inherit" }}>{peso(remaining)}</td>
                    </tr>
                  );
                }) : <tr><td colSpan={4} className="pcp-empty">No liquidations recorded</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Single-branch dashboard (Manila / Warner / Disney) — same KPI set as the
   consolidated view, scoped to one branch's funds, requests, disbursements
   and liquidations. */
function BranchDashboard({ label, branchCode, funds, requests, disbursements, liquidations, replenishments }) {
  const fundsForBranch = useMemo(() => funds.filter((f) => f.branchCode === branchCode), [funds, branchCode]);
  const requestsForBranch = useMemo(() => requests.filter((r) => r.branchCode === branchCode), [requests, branchCode]);
  const disbForBranch = useMemo(() => disbursements.filter((d) => d.branchCode === branchCode), [disbursements, branchCode]);
  const repForBranch = useMemo(() => (replenishments || []).filter((r) => r.branchCode === branchCode), [replenishments, branchCode]);
  const liqForBranch = useMemo(() => {
    const disbIds = new Set(disbForBranch.map((d) => d.id));
    return liquidations.filter((l) => disbIds.has(l.disbursementId));
  }, [liquidations, disbForBranch]);

  const m = useMemo(
    () => computeMetrics(fundsForBranch, requestsForBranch, disbForBranch, liqForBranch, repForBranch),
    [fundsForBranch, requestsForBranch, disbForBranch, liqForBranch, repForBranch]
  );

  const custodians = fundsForBranch.map((f) => f.custodian).filter(Boolean).join(", ");
  const recentDisbursements = useMemo(() =>
    [...disbForBranch].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5),
    [disbForBranch]);

  return (
    <div>
      <div className="pcp-flow">
        <div className="pcp-flow-step">
          <div className="pcp-flow-label">Beginning Balance</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalFund)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step">
          <div className="pcp-flow-label">Total Disbursed</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalDisbursed)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step">
          <div className="pcp-flow-label">Total Liquidated</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalLiquidated)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step">
          <div className="pcp-flow-label">Available Balance</div>
          <div className="pcp-flow-value pcp-num" style={{ color: m.availableBalance < 0 ? "#ff8080" : "#8fffb0" }}>
            {peso(m.availableBalance)}
          </div>
        </div>
      </div>

      {(fundsForBranch.length > 0 || custodians) && (
        <div className="pcp-eyebrow" style={{ marginBottom: 10 }}>
          {branchCode} · {companyOfBranch(branchCode)}{custodians ? ` · Custodian: ${custodians}` : ""}
        </div>
      )}

      <div className="pcp-kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <KpiCard label="Beginning Balance" value={peso(m.totalFund)} icon={Banknote} tint="#2054a3" />
        <KpiCard label="Total Disbursed" value={peso(m.totalDisbursed)} icon={ArrowUpRight} tint="#b9790a" />
        <KpiCard label="Total Liquidated" value={peso(m.totalLiquidated)} icon={ArrowDownRight} tint="#15803d" />
        <KpiCard label="Available Balance" value={peso(m.availableBalance)} icon={CircleDollarSign}
          tint={m.availableBalance < 0 ? "#c8102e" : "#15803d"}
          foot={m.availableBalance < 0 ? "Over committed — replenish soon" : "Cash on hand"} />
        <KpiCard label="Completed & Billed" value={m.completedBilled} icon={Check} tint="#15803d" foot="Exported to Acumatica" />
        <KpiCard label="Pending Requests" value={m.pendingRequests} icon={ClipboardList} tint="#b9790a" foot="Awaiting approval" />
        <KpiCard label="Pending Liquidation" value={m.pendingLiquidationCount} icon={FileSpreadsheet} tint="#2054a3" foot="Vouchers not fully liquidated" />
        <KpiCard label="Employees w/ Active Advances" value={m.activeEmployeeCount} icon={Users} tint="#7c3aed" />
      </div>

      <div className="pcp-card pcp-card-pad" style={{ marginTop: 16 }}>
        <div className="pcp-section-title">Recent Transactions — {label}</div>
        <div className="pcp-table-wrap">
          <table className="pcp-table">
            <thead><tr><th>Voucher</th><th>Employee</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {recentDisbursements.length ? recentDisbursements.map((d) => (
                <tr key={d.id}>
                  <td>{d.voucherNo}</td>
                  <td>{d.employee}</td>
                  <td className="pcp-num">{peso(d.amount)}</td>
                  <td><Badge status={liqStatusFor(d, liqForBranch)} /></td>
                </tr>
              )) : <tr><td colSpan={4} className="pcp-empty">No disbursements recorded for {label}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
/* ============================= REQUESTS ============================= */

function RequestFormModal({ onClose, onSave, nextRequestNo, request }) {
  const isEdit = !!request;
  const [form, setForm] = useState(
    request
      ? {
          date: request.date, employee: request.employee, department: request.department,
          branchCode: request.branchCode, purpose: request.purpose,
          amount: request.amount, approver: request.approver || "",
        }
      : {
          date: todayISO(), employee: "", department: SUBACCOUNTS[1].code,
          branchCode: BRANCHES[0].code, purpose: "", amount: "", approver: "",
        }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.employee.trim() && form.purpose.trim() && Number(form.amount) > 0 && form.approver.trim();

  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3>{isEdit ? "Edit Petty Cash Request" : "New Petty Cash Request"}</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body">
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Request No.</label>
              <input className="pcp-input" value={isEdit ? request.requestNo : nextRequestNo} disabled />
            </div>
            <div className="pcp-field">
              <label>Date</label>
              <input type="date" className="pcp-input" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Employee</label>
              <input className="pcp-input" placeholder="Full name" value={form.employee} onChange={(e) => set("employee", e.target.value)} />
            </div>
            <div className="pcp-field">
              <label>Approver</label>
              <input className="pcp-input" placeholder="Approver name" value={form.approver} onChange={(e) => set("approver", e.target.value)} />
            </div>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Company / Branch</label>
              <select className="pcp-select" value={form.branchCode} onChange={(e) => set("branchCode", e.target.value)}>
                {COMPANIES.map((c) => (
                  <optgroup label={c} key={c}>
                    {branchesForCompany(c).map((b) => <option key={b.code} value={b.code}>{b.name} ({b.code})</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="pcp-field">
              <label>Department</label>
              <select className="pcp-select" value={form.department} onChange={(e) => set("department", e.target.value)}>
                {SUBACCOUNTS.filter((s) => s.desc).map((s) => <option key={s.code} value={s.code}>{s.desc} ({s.code})</option>)}
              </select>
            </div>
          </div>
          <div className="pcp-field">
            <label>Purpose</label>
            <textarea className="pcp-input" rows={2} placeholder="What is this cash advance for?" value={form.purpose} onChange={(e) => set("purpose", e.target.value)} />
          </div>
          <div className="pcp-field">
            <label>Amount Requested (₱)</label>
            <input type="number" min="0" step="0.01" className="pcp-input" placeholder="0.00" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
          </div>
        </div>
        <div className="pcp-modal-foot">
          <button className="pcp-btn" onClick={onClose}>Cancel</button>
          <button className="pcp-btn pcp-btn-primary" disabled={!valid} onClick={() => onSave(form)}>{isEdit ? "Save Changes" : "Submit Request"}</button>
        </div>
      </div>
    </div>
  );
}

/* Four-level approval chain: Manager → Director → Ma'am Grace → Boss RTC. */
function ApprovalModal({ request, onClose, onApproveLevel, onRejectLevel }) {
  const ap = normalizeApprovals(request.approvals);
  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3>Approval Matrix — {request.requestNo}</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body">
          <div style={{ background: "var(--paper)", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12.5 }}>
            <div><strong>{request.employee}</strong> · {request.branchCode} · {peso(request.amount)}</div>
            <div style={{ color: "var(--text-mut)", marginTop: 3 }}>{request.purpose}</div>
          </div>
          {APPROVAL_LEVELS.map((lvl) => {
            const st = ap[lvl].status;
            const cls = st === "Approved" ? "pcp-appr-approved" : st === "Rejected" ? "pcp-appr-rejected" : "pcp-appr-pending";
            const locked = request.status === "Disbursed";
            return (
              <div className="pcp-appr-row" key={lvl}>
                <div className="pcp-appr-level">{lvl}</div>
                <div>
                  <span className={`pcp-appr-chip ${cls}`}>{st}</span>
                  {ap[lvl].by ? <span style={{ fontSize: 11, color: "var(--text-mut)", marginLeft: 8 }}>by {ap[lvl].by}{ap[lvl].date ? ` · ${fmtDate(ap[lvl].date)}` : ""}</span> : null}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="pcp-btn pcp-btn-sm" disabled={locked || st === "Approved"} onClick={() => onApproveLevel(request.id, lvl)} title="Approve"><Check size={12} /></button>
                  <button className="pcp-btn pcp-btn-sm pcp-btn-danger" disabled={locked || st === "Rejected"} onClick={() => onRejectLevel(request.id, lvl)} title="Reject"><X size={12} /></button>
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--text-mut)" }}>
            A request must be approved by all {APPROVAL_LEVELS.length} levels before it can be disbursed.
          </div>
        </div>
        <div className="pcp-modal-foot">
          <button className="pcp-btn pcp-btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

function ApprovalChips({ approvals }) {
  const ap = normalizeApprovals(approvals);
  const short = { "Manager": "Mgr", "Director": "Dir", "Ma'am Grace": "Grace", "Boss RTC": "RTC" };
  return (
    <div className="pcp-appr-chips">
      {APPROVAL_LEVELS.map((lvl) => {
        const st = ap[lvl].status;
        const cls = st === "Approved" ? "pcp-appr-approved" : st === "Rejected" ? "pcp-appr-rejected" : "pcp-appr-pending";
        const mark = st === "Approved" ? "✓" : st === "Rejected" ? "✕" : "•";
        return <span className={`pcp-appr-chip ${cls}`} key={lvl} title={`${lvl}: ${st}`}>{short[lvl]} {mark}</span>;
      })}
    </div>
  );
}

function RequestsTab({ requests, funds, onCreate, onEdit, onApproveLevel, onRejectLevel, onDisburse }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [approving, setApproving] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  const nextRequestNo = "PCR-2026-" + String(requests.length + 1).padStart(4, "0");

  /* Keep the approval modal in sync with the latest request state after each click. */
  const approvingLive = approving ? requests.find((r) => r.id === approving.id) : null;

  const filtered = requests.filter((r) => {
    if (statusFilter !== "All" && r.status !== statusFilter) return false;
    if (search && !(r.employee.toLowerCase().includes(search.toLowerCase()) || r.requestNo.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  return (
    <div>
      <TopBar
        title="Petty Cash Requests"
        sub="Submit and approve cash advance requests before disbursement"
        right={<button className="pcp-btn pcp-btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> New Request</button>}
      />
      <div className="pcp-content">
        <div className="pcp-card">
          <div style={{ padding: "14px 18px", display: "flex", gap: 10, alignItems: "center", borderBottom: "1px solid var(--line)" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
              <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#9098b3" }} />
              <input className="pcp-input" style={{ paddingLeft: 28 }} placeholder="Search employee or request no." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="pcp-select" style={{ width: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {["All", "Pending", "Approved", "Rejected", "Disbursed"].map((s) => <option key={s}>{s}</option>)}
            </select>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-mut)" }}>{filtered.length} of {requests.length} requests</div>
          </div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead>
                <tr>
                  <th>Request No.</th><th>Date</th><th>Employee</th><th>Department</th><th>Branch</th>
                  <th>Purpose</th><th>Amount</th><th>Approval Matrix</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.requestNo}</td>
                    <td>{fmtDate(r.date)}</td>
                    <td>{r.employee}</td>
                    <td title={subaccountLabel(r.department)}>{subaccountLabel(r.department)}</td>
                    <td>{r.branchCode}</td>
                    <td style={{ maxWidth: 220, whiteSpace: "normal" }}>{r.purpose}</td>
                    <td className="pcp-num">{peso(r.amount)}</td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <ApprovalChips approvals={r.approvals} />
                        <span style={{ fontSize: 10.5, color: "var(--text-mut)" }}>{approvedCount(r.approvals)} / {APPROVAL_LEVELS.length} approved</span>
                      </div>
                    </td>
                    <td><Badge status={r.status} /></td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {r.status !== "Disbursed" && (
                          <button className="pcp-btn pcp-btn-sm" onClick={() => setApproving(r)} title="Manage approvals"><ClipboardList size={12} /></button>
                        )}
                        {r.status !== "Disbursed" && (
                          <button className="pcp-btn pcp-btn-sm" onClick={() => setEditing(r)} title="Edit request"><Edit3 size={12} /></button>
                        )}
                        {r.status === "Approved" && (
                          <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={() => onDisburse(r)}>Disburse</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={10} className="pcp-empty">No requests match your filters</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {showForm && (
        <RequestFormModal
          nextRequestNo={nextRequestNo}
          onClose={() => setShowForm(false)}
          onSave={(form) => { onCreate({ ...form, requestNo: nextRequestNo }); setShowForm(false); }}
        />
      )}
      {editing && (
        <RequestFormModal
          request={editing}
          onClose={() => setEditing(null)}
          onSave={(form) => { onEdit(editing.id, form); setEditing(null); }}
        />
      )}
      {approvingLive && (
        <ApprovalModal
          request={approvingLive}
          onClose={() => setApproving(null)}
          onApproveLevel={onApproveLevel}
          onRejectLevel={onRejectLevel}
        />
      )}
    </div>
  );
}
/* ============================= DISBURSEMENTS ============================= */

function DisburseModal({ request, onClose, onConfirm, nextVoucherNo }) {
  const [amount, setAmount] = useState(request.amount);
  const [expenseCategory, setExpenseCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [date, setDate] = useState(todayISO());
  const [remarks, setRemarks] = useState("");

  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3>Disburse Cash Advance</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body">
          <div style={{ background: "var(--paper)", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12.5 }}>
            <div><strong>{request.requestNo}</strong> — {request.employee}</div>
            <div style={{ color: "var(--text-mut)", marginTop: 3 }}>{request.purpose}</div>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Voucher No.</label>
              <input className="pcp-input" value={nextVoucherNo} disabled />
            </div>
            <div className="pcp-field">
              <label>Disbursement Date</label>
              <input type="date" className="pcp-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Amount Disbursed (₱)</label>
              <input type="number" className="pcp-input" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="pcp-field">
              <label>Expense Category (anticipated)</label>
              <select className="pcp-select" value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="pcp-field">
            <label>Remarks</label>
            <input className="pcp-input" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional notes" />
          </div>
        </div>
        <div className="pcp-modal-foot">
          <button className="pcp-btn" onClick={onClose}>Cancel</button>
          <button className="pcp-btn pcp-btn-primary" onClick={() => onConfirm({ amount: Number(amount), expenseCategory, date, remarks })}>
            Confirm Disbursement
          </button>
        </div>
      </div>
    </div>
  );
}

function EditDisbursementModal({ disbursement, onClose, onSave }) {
  const [form, setForm] = useState({
    date: disbursement.date, employee: disbursement.employee, branchCode: disbursement.branchCode,
    department: disbursement.department, expenseCategory: disbursement.expenseCategory,
    amount: disbursement.amount, remarks: disbursement.remarks || "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.employee.trim() && Number(form.amount) > 0;

  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3>Edit Disbursement — {disbursement.voucherNo}</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body">
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Disbursement Date</label>
              <input type="date" className="pcp-input" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div className="pcp-field">
              <label>Employee</label>
              <input className="pcp-input" value={form.employee} onChange={(e) => set("employee", e.target.value)} />
            </div>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Company / Branch</label>
              <select className="pcp-select" value={form.branchCode} onChange={(e) => set("branchCode", e.target.value)}>
                {COMPANIES.map((c) => (
                  <optgroup label={c} key={c}>
                    {branchesForCompany(c).map((b) => <option key={b.code} value={b.code}>{b.name} ({b.code})</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="pcp-field">
              <label>Department</label>
              <select className="pcp-select" value={form.department} onChange={(e) => set("department", e.target.value)}>
                {SUBACCOUNTS.filter((s) => s.desc).map((s) => <option key={s.code} value={s.code}>{s.desc} ({s.code})</option>)}
              </select>
            </div>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Amount Disbursed (₱)</label>
              <input type="number" min="0" step="0.01" className="pcp-input" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
            </div>
            <div className="pcp-field">
              <label>Expense Category</label>
              <select className="pcp-select" value={form.expenseCategory} onChange={(e) => set("expenseCategory", e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="pcp-field">
            <label>Remarks</label>
            <input className="pcp-input" value={form.remarks} onChange={(e) => set("remarks", e.target.value)} placeholder="Optional notes" />
          </div>
        </div>
        <div className="pcp-modal-foot">
          <button className="pcp-btn" onClick={onClose}>Cancel</button>
          <button className="pcp-btn pcp-btn-primary" disabled={!valid} onClick={() => onSave(disbursement.id, { ...form, amount: Number(form.amount) })}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

const SORT_FIELDS = {
  voucherNo: (d) => d.voucherNo, date: (d) => d.date, employee: (d) => d.employee,
  branchCode: (d) => d.branchCode, amount: (d) => d.amount,
};

function DisbursementsTab({ disbursements, liquidations, requests, onUpdateRemarks, onToggleBilled, onEditDisbursement }) {
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editDisb, setEditDisb] = useState(null);

  const rows = useMemo(() => {
    let list = disbursements.map((d) => ({ ...d, liqStatus: liqStatusFor(d, liquidations) }));
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((d) => d.voucherNo.toLowerCase().includes(s) || d.employee.toLowerCase().includes(s));
    }
    if (branchFilter !== "All") list = list.filter((d) => d.branchCode === branchFilter);
    if (statusFilter !== "All") list = list.filter((d) => d.liqStatus === statusFilter);
    const fn = SORT_FIELDS[sortKey] || SORT_FIELDS.date;
    list.sort((a, b) => {
      const av = fn(a), bv = fn(b);
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [disbursements, liquidations, search, branchFilter, statusFilter, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const exportLedger = () => {
    const data = rows.map((d) => ({
      "Voucher No.": d.voucherNo, "Date": d.date, "Employee": d.employee,
      "Branch": d.branchCode, "Company": companyOfBranch(d.branchCode),
      "Department": subaccountLabel(d.department), "Expense Category": d.expenseCategory,
      "Amount": d.amount, "Status": d.status, "Liquidation Status": d.liqStatus, "Remarks": d.remarks || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Disbursement Ledger");
    downloadWorkbook(wb, `Disbursement_Ledger_${todayISO()}.xlsx`);
  };

  const Th = ({ field, children }) => (
    <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort(field)}>
      {children}{sortKey === field ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <div>
      <TopBar
        title="Petty Cash Release"
        sub="Full transaction history of all petty cash releases (vouchers)"
        right={
          <>
            <button className="pcp-btn" onClick={() => window.print()}><Printer size={14} /> Print</button>
            <button className="pcp-btn pcp-btn-primary" onClick={exportLedger}><Download size={14} /> Export to Excel</button>
          </>
        }
      />
      <div className="pcp-content">
        <div className="pcp-card">
          <div style={{ padding: "14px 18px", display: "flex", gap: 10, alignItems: "center", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 280 }}>
              <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#9098b3" }} />
              <input className="pcp-input" style={{ paddingLeft: 28 }} placeholder="Search voucher or employee" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="pcp-select" style={{ width: 160 }} value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
              <option>All</option>
              {BRANCHES.map((b) => <option key={b.code} value={b.code}>{b.code}</option>)}
            </select>
            <select className="pcp-select" style={{ width: 180 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {["All", "Not Liquidated", "Partially Liquidated", "Fully Liquidated", "Over-Liquidated"].map((s) => <option key={s}>{s}</option>)}
            </select>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-mut)" }}>{rows.length} of {disbursements.length} vouchers</div>
          </div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead>
                <tr>
                  <Th field="voucherNo">Voucher No.</Th>
                  <Th field="date">Date</Th>
                  <Th field="employee">Employee</Th>
                  <Th field="branchCode">Branch</Th>
                  <th>Company</th><th>Department</th><th>Expense Category</th>
                  <Th field="amount">Amount</Th>
                  <th>Liquidation Status</th><th>Billed</th><th>Remarks</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((d) => (
                  <tr key={d.id}>
                    <td>{d.voucherNo}</td>
                    <td>{fmtDate(d.date)}</td>
                    <td>{d.employee}</td>
                    <td>{d.branchCode}</td>
                    <td style={{ fontSize: 11.5, color: "var(--text-mut)" }}>{companyOfBranch(d.branchCode)}</td>
                    <td title={subaccountLabel(d.department)} style={{ maxWidth: 140, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subaccountLabel(d.department)}</td>
                    <td style={{ maxWidth: 150, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={d.expenseCategory}>{d.expenseCategory}</td>
                    <td className="pcp-num">{peso(d.amount)}</td>
                    <td><Badge status={d.liqStatus} /></td>
                    <td>
                      <button className="pcp-btn pcp-btn-sm" onClick={() => onToggleBilled(d.id)} title="Toggle billed">
                        {d.billed ? <Check size={12} color="#15803d" /> : <span style={{ color: "#9098b3" }}>—</span>}
                      </button>
                    </td>
                    <td style={{ minWidth: 150 }}>
                      {editingId === d.id ? (
                        <input
                          className="pcp-input" autoFocus value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => { onUpdateRemarks(d.id, editValue); setEditingId(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                        />
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }} onClick={() => { setEditingId(d.id); setEditValue(d.remarks || ""); }}>
                          <span style={{ color: d.remarks ? "inherit" : "var(--text-mut)" }}>{d.remarks || "Add remarks…"}</span>
                          <Edit3 size={11} color="#9098b3" />
                        </div>
                      )}
                    </td>
                    <td>
                      <button className="pcp-btn pcp-btn-sm" onClick={() => setEditDisb(d)} title="Edit disbursement"><Edit3 size={12} /></button>
                    </td>
                  </tr>
                )) : <tr><td colSpan={12} className="pcp-empty">No disbursements match your filters</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {editDisb && (
        <EditDisbursementModal
          disbursement={editDisb}
          onClose={() => setEditDisb(null)}
          onSave={(id, patch) => { onEditDisbursement(id, patch); setEditDisb(null); }}
        />
      )}
    </div>
  );
}
/* ============================= LIQUIDATION ============================= */

function emptyLine() {
  return { id: uid("ln"), date: todayISO(), expense: "", category: EXPENSE_CATEGORIES[0], department: SUBACCOUNTS[1].code, amount: "", taxCategory: "" };
}

function LiquidationWorksheet({ disbursement, liquidation, onSave, onExport }) {
  const [lines, setLines] = useState(liquidation ? liquidation.lines.map((l) => ({ ...l })) : [emptyLine()]);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    setLines(liquidation ? liquidation.lines.map((l) => ({ ...l })) : [emptyLine()]);
    setSaved(true);
  }, [disbursement.id]);

  const updateLine = (id, patch) => {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setSaved(false);
  };
  const addLine = () => { setLines((ls) => [...ls, emptyLine()]); setSaved(false); };
  const removeLine = (id) => { setLines((ls) => ls.filter((l) => l.id !== id)); setSaved(false); };

  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const remaining = disbursement.amount - total;
  const validLines = lines.filter((l) => l.expense.trim() && Number(l.amount) > 0);

  const handleSave = () => {
    onSave(disbursement.id, validLines.map((l) => ({ ...l, amount: Number(l.amount) })));
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


      {remaining < 0 && (
        <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center", background: "var(--red-bg)", padding: "10px 12px", borderRadius: 8, fontSize: 12, color: "var(--brand-dark)" }}>
          <AlertTriangle size={15} /> Liquidated amount exceeds the cash advance. The custodian owes the employee {peso(Math.abs(remaining))}.
        </div>
      )}
    </div>
  );
}

function LiquidationTab({ disbursements, liquidations, onSaveLiquidation, onExport, onExportAll }) {
  const [selectedId, setSelectedId] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const enriched = disbursements.map((d) => ({ ...d, liqStatus: liqStatusFor(d, liquidations) }));
  const list = showAll ? enriched : enriched.filter((d) => d.liqStatus !== "Fully Liquidated");
  const selected = enriched.find((d) => d.id === selectedId) || list[0] || null;
  const exportableCount = disbursements.filter((d) => {
    const liq = liquidationFor(d.id, liquidations);
    return liq && liq.lines && liq.lines.length;
  }).length;

  return (
    <div>
      <TopBar
        title="Liquidation"
        sub="Break down each cash advance into itemized receipts and reconcile the balance"
        right={
          <button className="pcp-btn pcp-btn-primary" onClick={onExportAll} disabled={!exportableCount}>
            <Download size={14} /> Export All to Acumatica
          </button>
        }
      />
      <div className="pcp-content">
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
            />
          ) : (
            <div className="pcp-card pcp-card-pad"><div className="pcp-empty">Select a voucher to begin liquidation</div></div>
          )}
        </div>
      </div>
    </div>
  );
}
/* ============================= MASTER DATA ============================= */

function FundFormModal({ onClose, onSave, fund }) {
  const [form, setForm] = useState(fund || { branchCode: BRANCHES[0].code, label: "", custodian: "", beginningBalance: "" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.label.trim() && form.custodian.trim() && Number(form.beginningBalance) >= 0;

  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3>{fund ? "Edit Petty Cash Fund" : "New Petty Cash Fund"}</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body">
          <div className="pcp-field">
            <label>Plant / Fund Name</label>
            <input className="pcp-input" placeholder="e.g. Manila" value={form.label} onChange={(e) => set("label", e.target.value)} />
          </div>
          <div className="pcp-field">
            <label>Branch (ERP Code)</label>
            <select className="pcp-select" value={form.branchCode} onChange={(e) => set("branchCode", e.target.value)}>
              {COMPANIES.map((c) => (
                <optgroup label={c} key={c}>
                  {branchesForCompany(c).map((b) => <option key={b.code} value={b.code}>{b.name} ({b.code})</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Custodian</label>
              <input className="pcp-input" placeholder="Full name" value={form.custodian} onChange={(e) => set("custodian", e.target.value)} />
            </div>
            <div className="pcp-field">
              <label>Beginning Balance (₱)</label>
              <input type="number" min="0" step="0.01" className="pcp-input" value={form.beginningBalance} onChange={(e) => set("beginningBalance", e.target.value)} />
            </div>
          </div>
        </div>
        <div className="pcp-modal-foot">
          <button className="pcp-btn" onClick={onClose}>Cancel</button>
          <button className="pcp-btn pcp-btn-primary" disabled={!valid} onClick={() => onSave({ ...form, beginningBalance: Number(form.beginningBalance) })}>Save Fund</button>
        </div>
      </div>
    </div>
  );
}

function ReferenceTable({ title, columns, rows }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = q ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q.toLowerCase())) : rows;
  return (
    <div className="pcp-card" style={{ marginBottom: 14 }}>
      <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{title} <span style={{ color: "var(--text-mut)", fontWeight: 500 }}>({rows.length})</span></div>
        <ChevronRight size={16} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
      </div>
      {open && (
        <div style={{ borderTop: "1px solid var(--line)" }}>
          <div style={{ padding: "10px 18px" }}>
            <input className="pcp-input" placeholder={`Search ${title.toLowerCase()}...`} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
          </div>
          <div className="pcp-table-wrap" style={{ maxHeight: 340, overflowY: "auto" }}>
            <table className="pcp-table">
              <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i}>{columns.map((c) => <td key={c.key}>{r[c.key]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MasterDataTab({ funds, disbursements, liquidations, replenishments, onAddFund, onEditFund, onDeleteFund }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  return (
    <div>
      <TopBar
        title="Funds & Master Data"
        sub="Manage petty cash funds and view reference data used across the system"
        right={<button className="pcp-btn pcp-btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> New Fund</button>}
      />
      <div className="pcp-content">
        <div className="pcp-card" style={{ marginBottom: 18 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", fontWeight: 700, fontSize: 13 }}>
            Petty Cash Funds (Plants)
          </div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead><tr><th>Plant</th><th>Branch</th><th>Company</th><th>Custodian</th><th>Beginning Balance</th><th>Available Balance</th><th></th></tr></thead>
              <tbody>
                {funds.map((f) => {
                  const mon = monitoringForFund(f, disbursements, liquidations, replenishments);
                  return (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>{f.label}</td>
                    <td>{f.branchCode}</td>
                    <td style={{ fontSize: 11.5, color: "var(--text-mut)" }}>{companyOfBranch(f.branchCode)}</td>
                    <td>{f.custodian}</td>
                    <td className="pcp-num">{peso(f.beginningBalance)}</td>
                    <td className="pcp-num" style={{ fontWeight: 700, color: mon.available < 0 ? "var(--brand)" : "var(--green)" }}>{peso(mon.available)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="pcp-btn pcp-btn-sm" onClick={() => setEditing(f)} title="Edit fund"><Edit3 size={12} /></button>
                        <button className="pcp-btn pcp-btn-sm pcp-btn-danger" onClick={() => onDeleteFund(f.id)} title="Delete fund"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pcp-eyebrow" style={{ marginBottom: 8 }}>Reference Data (from Acumatica master files)</div>
        <ReferenceTable
          title="Branches"
          columns={[{ key: "code", label: "Branch ID" }, { key: "name", label: "Branch Name" }, { key: "company", label: "Company" }]}
          rows={BRANCHES}
        />
        <ReferenceTable
          title="Departments (Subaccounts)"
          columns={[{ key: "code", label: "Code" }, { key: "desc", label: "Description" }]}
          rows={SUBACCOUNTS.filter((s) => s.desc)}
        />
        <ReferenceTable
          title="Expense Categories"
          columns={[{ key: "account", label: "Account" }, { key: "name", label: "Expense Category" }]}
          rows={EXPENSE_CATEGORIES.map((c) => ({ name: c, account: accountForCategory(c) }))}
        />
        <ReferenceTable
          title="Tax Categories"
          columns={[{ key: "code", label: "Tax Category ID" }, { key: "desc", label: "Description" }]}
          rows={TAX_CATEGORIES}
        />
      </div>
      {showForm && (
        <FundFormModal onClose={() => setShowForm(false)} onSave={(f) => { onAddFund(f); setShowForm(false); }} />
      )}
      {editing && (
        <FundFormModal fund={editing} onClose={() => setEditing(null)} onSave={(f) => { onEditFund(editing.id, f); setEditing(null); }} />
      )}
    </div>
  );
}
/* ============================= MANAGEMENT REPORT ============================= */

/* Quick editor for the (editable) beginning balances, launched from the Dashboard. */
function EditBalancesModal({ funds, onClose, onSave }) {
  const [rows, setRows] = useState(funds.map((f) => ({ id: f.id, label: f.label, branchCode: f.branchCode, custodian: f.custodian, beginningBalance: f.beginningBalance })));
  const set = (id, v) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, beginningBalance: v } : r)));
  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3>Edit Beginning Balances</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body">
          {rows.map((r) => (
            <div className="pcp-field" key={r.id}>
              <label>{r.label} — {companyOfBranch(r.branchCode)}{r.custodian ? ` · ${r.custodian}` : ""}</label>
              <input type="number" min="0" step="0.01" className="pcp-input" value={r.beginningBalance} onChange={(e) => set(r.id, e.target.value)} />
            </div>
          ))}
          {!rows.length && <div className="pcp-empty">No funds to edit</div>}
        </div>
        <div className="pcp-modal-foot">
          <button className="pcp-btn" onClick={onClose}>Cancel</button>
          <button className="pcp-btn pcp-btn-primary" onClick={() => onSave(rows.map((r) => ({ id: r.id, beginningBalance: Number(r.beginningBalance) || 0 })))}>Save Balances</button>
        </div>
      </div>
    </div>
  );
}

/* Report for top management: PCF monitoring per fund + every transaction.
   Printable, and exportable to a multi-sheet Excel workbook. */
function ManagementReportTab({ funds, requests, disbursements, liquidations, replenishments }) {
  const m = useMemo(() => computeMetrics(funds, requests, disbursements, liquidations, replenishments), [funds, requests, disbursements, liquidations, replenishments]);

  const monitoring = useMemo(
    () => funds.map((f) => ({ fund: f, ...monitoringForFund(f, disbursements, liquidations, replenishments) })),
    [funds, disbursements, liquidations, replenishments]
  );
  const totals = useMemo(() => monitoring.reduce((t, r) => ({
    beginning: t.beginning + r.beginning, disbursed: t.disbursed + r.disbursed,
    liquidated: t.liquidated + r.liquidated, outstanding: t.outstanding + r.outstanding,
    replenished: t.replenished + r.replenished, available: t.available + r.available,
  }), { beginning: 0, disbursed: 0, liquidated: 0, outstanding: 0, replenished: 0, available: 0 }), [monitoring]);

  const disbRows = useMemo(
    () => [...disbursements].sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    [disbursements]
  );
  const liqRows = useMemo(() => {
    const out = [];
    disbursements.forEach((d) => {
      const liq = liquidationFor(d.id, liquidations);
      if (!liq || !liq.lines) return;
      liq.lines.forEach((l) => {
        const expenseDesc = (l.expense && l.expense.trim()) ? l.expense.trim() : l.category;
        out.push({
          voucherNo: d.voucherNo, branchCode: d.branchCode, date: l.date, employee: d.employee,
          lineDescription: `${expenseDesc} — ${deptDesc(l.department)}`,
          category: l.category, department: deptDesc(l.department),
          taxCategory: l.taxCategory || "", amount: Number(l.amount) || 0,
        });
      });
    });
    return out.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [disbursements, liquidations]);

  const exportReport = useCallback(() => {
    const wb = XLSX.utils.book_new();

    const monRows = monitoring.map((r) => ({
      "Plant / Fund": r.fund.label, "Branch": r.fund.branchCode, "Company": companyOfBranch(r.fund.branchCode),
      "Custodian": r.fund.custodian, "Beginning Balance": r.beginning, "Total Disbursed": r.disbursed,
      "Total Liquidated": r.liquidated, "Total Replenished": r.replenished, "Outstanding": r.outstanding, "Available Balance": r.available,
    }));
    monRows.push({
      "Plant / Fund": "TOTAL", "Branch": "", "Company": "", "Custodian": "",
      "Beginning Balance": totals.beginning, "Total Disbursed": totals.disbursed,
      "Total Liquidated": totals.liquidated, "Total Replenished": totals.replenished, "Outstanding": totals.outstanding, "Available Balance": totals.available,
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monRows), "PCF Monitoring");

    const dRows = disbRows.map((d) => ({
      "Voucher No.": d.voucherNo, "Date": d.date, "Employee": d.employee, "Branch": d.branchCode,
      "Company": companyOfBranch(d.branchCode), "Department": deptDesc(d.department),
      "Expense Category": d.expenseCategory, "Amount": d.amount,
      "Liquidation Status": liqStatusFor(d, liquidations), "Billed": d.billed ? "Yes" : "No", "Remarks": d.remarks || "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dRows.length ? dRows : [{}]), "Disbursements");

    const lRows = liqRows.map((l) => ({
      "Voucher No.": l.voucherNo, "Branch": l.branchCode, "Date": l.date, "Employee": l.employee,
      "Line Description": l.lineDescription, "Expense Category": l.category, "Department": l.department,
      "Tax Category": l.taxCategory, "Amount": l.amount,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lRows.length ? lRows : [{}]), "Liquidation Details");

    const rRows = requests.map((r) => ({
      "Request No.": r.requestNo, "Date": r.date, "Employee": r.employee, "Branch": r.branchCode,
      "Department": deptDesc(r.department), "Purpose": r.purpose, "Amount": r.amount, "Status": r.status,
      "Manager": (normalizeApprovals(r.approvals)["Manager"] || {}).status,
      "Director": (normalizeApprovals(r.approvals)["Director"] || {}).status,
      "Ma'am Grace": (normalizeApprovals(r.approvals)["Ma'am Grace"] || {}).status,
      "Boss RTC": (normalizeApprovals(r.approvals)["Boss RTC"] || {}).status,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rRows.length ? rRows : [{}]), "Requests");

    const repRows = (replenishments || []).map((r) => ({
      "Replenishment No.": r.replenishmentNo, "Date": r.date, "Branch": r.branchCode,
      "Company": companyOfBranch(r.branchCode), "Amount": r.amount, "Prepared By": r.preparedBy,
      "Approved By": r.approvedBy, "Method": r.method, "Check / Ref. No.": r.checkNo,
      "Status": r.status, "Remarks": r.remarks || "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(repRows.length ? repRows : [{}]), "Replenishments");

    downloadWorkbook(wb, `PCF_Management_Report_${todayISO()}.xlsx`);
  }, [monitoring, totals, disbRows, liqRows, requests, liquidations, replenishments]);

  return (
    <div>
      <TopBar
        title="Management Report"
        sub="PCF monitoring and complete transaction report for top management"
        right={
          <>
            <button className="pcp-btn" onClick={() => window.print()}><Printer size={14} /> Print</button>
            <button className="pcp-btn pcp-btn-primary" onClick={exportReport}><Download size={14} /> Export to Excel</button>
          </>
        }
      />
      <div className="pcp-content">
        <div className="pcp-card pcp-card-pad" style={{ marginBottom: 16 }}>
          <div className="pcp-report-head">
            <img src={LOGO_A1} alt="A1+ Paper and Plastic Inc." />
            <img src={LOGO_SPI} alt="Starkson Paper and Plastic Corporation" />
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div className="pcp-report-title">Petty Cash Fund — Management Report</div>
              <div className="pcp-report-sub">Generated {fmtDate(todayISO())} · A1+ Paper &amp; Plastic Inc. · Starkson Paper &amp; Plastic Corp.</div>
            </div>
          </div>
        </div>

        <div className="pcp-kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <KpiCard label="Beginning Balance" value={peso(m.totalFund)} icon={Banknote} tint="#2054a3" />
          <KpiCard label="Total Disbursed" value={peso(m.totalDisbursed)} icon={ArrowUpRight} tint="#b9790a" />
          <KpiCard label="Total Liquidated" value={peso(m.totalLiquidated)} icon={ArrowDownRight} tint="#15803d" />
          <KpiCard label="Available Balance" value={peso(m.availableBalance)} icon={CircleDollarSign} tint={m.availableBalance < 0 ? "#c8102e" : "#15803d"} />
        </div>

        <div className="pcp-card" style={{ marginBottom: 16 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", fontWeight: 700, fontSize: 13 }}>PCF Monitoring — by Fund</div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead>
                <tr>
                  <th>Plant / Fund</th><th>Company</th><th>Custodian</th><th>Beginning</th>
                  <th>Disbursed</th><th>Liquidated</th><th>Replenished</th><th>Outstanding</th><th>Available</th>
                </tr>
              </thead>
              <tbody>
                {monitoring.length ? monitoring.map((r) => (
                  <tr key={r.fund.id}>
                    <td style={{ fontWeight: 600 }}>{r.fund.label}</td>
                    <td style={{ fontSize: 11.5, color: "var(--text-mut)" }}>{companyOfBranch(r.fund.branchCode)}</td>
                    <td>{r.fund.custodian}</td>
                    <td className="pcp-num">{peso(r.beginning)}</td>
                    <td className="pcp-num">{peso(r.disbursed)}</td>
                    <td className="pcp-num">{peso(r.liquidated)}</td>
                    <td className="pcp-num">{peso(r.replenished)}</td>
                    <td className="pcp-num">{peso(r.outstanding)}</td>
                    <td className="pcp-num" style={{ fontWeight: 700, color: r.available < 0 ? "var(--brand)" : "var(--green)" }}>{peso(r.available)}</td>
                  </tr>
                )) : <tr><td colSpan={9} className="pcp-empty">No funds configured</td></tr>}
              </tbody>
              {monitoring.length ? (
                <tfoot>
                  <tr>
                    <td colSpan={3}>TOTAL</td>
                    <td className="pcp-num">{peso(totals.beginning)}</td>
                    <td className="pcp-num">{peso(totals.disbursed)}</td>
                    <td className="pcp-num">{peso(totals.liquidated)}</td>
                    <td className="pcp-num">{peso(totals.replenished)}</td>
                    <td className="pcp-num">{peso(totals.outstanding)}</td>
                    <td className="pcp-num">{peso(totals.available)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>

        <div className="pcp-card" style={{ marginBottom: 16 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", fontWeight: 700, fontSize: 13 }}>All Disbursements ({disbRows.length})</div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead>
                <tr>
                  <th>Voucher No.</th><th>Date</th><th>Employee</th><th>Branch</th><th>Company</th>
                  <th>Department</th><th>Expense Category</th><th>Amount</th><th>Liquidation Status</th><th>Billed</th>
                </tr>
              </thead>
              <tbody>
                {disbRows.length ? disbRows.map((d) => (
                  <tr key={d.id}>
                    <td>{d.voucherNo}</td>
                    <td>{fmtDate(d.date)}</td>
                    <td>{d.employee}</td>
                    <td>{d.branchCode}</td>
                    <td style={{ fontSize: 11.5, color: "var(--text-mut)" }}>{companyOfBranch(d.branchCode)}</td>
                    <td>{deptDesc(d.department)}</td>
                    <td>{d.expenseCategory}</td>
                    <td className="pcp-num">{peso(d.amount)}</td>
                    <td><Badge status={liqStatusFor(d, liquidations)} /></td>
                    <td>{d.billed ? <Check size={13} color="#15803d" /> : <span style={{ color: "#9098b3" }}>—</span>}</td>
                  </tr>
                )) : <tr><td colSpan={10} className="pcp-empty">No disbursements recorded</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pcp-card">
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", fontWeight: 700, fontSize: 13 }}>Liquidation Details ({liqRows.length})</div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead>
                <tr>
                  <th>Voucher No.</th><th>Date</th><th>Employee</th><th>Branch</th>
                  <th>Line Description</th><th>Expense Category</th><th>Tax Category</th><th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {liqRows.length ? liqRows.map((l, i) => (
                  <tr key={i}>
                    <td>{l.voucherNo}</td>
                    <td>{fmtDate(l.date)}</td>
                    <td>{l.employee}</td>
                    <td>{l.branchCode}</td>
                    <td>{l.lineDescription}</td>
                    <td>{l.category}</td>
                    <td title={taxCategoryLabel(l.taxCategory)}>{l.taxCategory || "—"}</td>
                    <td className="pcp-num">{peso(l.amount)}</td>
                  </tr>
                )) : <tr><td colSpan={8} className="pcp-empty">No liquidation lines recorded</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
/* ============================= REPLENISHMENT ============================= */

const REPLENISH_METHODS = ["Check", "Bank Transfer", "Cash"];
const REPLENISH_STATUSES = ["Pending", "Approved", "Completed"];

/* Amount already liquidated for a branch that has not yet been reimbursed by a
   completed replenishment — the natural amount to replenish next. */
function suggestedReplenishment(branchCode, disbursements, liquidations, replenishments) {
  const liquidated = disbursements
    .filter((d) => d.branchCode === branchCode)
    .reduce((s, d) => s + liquidatedTotal(liquidationFor(d.id, liquidations)), 0);
  const replenished = replenishments
    .filter((r) => r.branchCode === branchCode && r.status === "Completed")
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  return Math.max(0, liquidated - replenished);
}

function ReplenishmentFormModal({ onClose, onSave, nextNo, funds, disbursements, liquidations, replenishments, replenishment }) {
  const isEdit = !!replenishment;
  const [form, setForm] = useState(
    replenishment
      ? { ...replenishment, amount: replenishment.amount }
      : {
          date: todayISO(), branchCode: funds[0] ? funds[0].branchCode : BRANCHES[0].code,
          amount: "", preparedBy: "", approvedBy: "", checkNo: "", method: "Check",
          status: "Pending", remarks: "",
        }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const suggested = useMemo(() => suggestedReplenishment(form.branchCode, disbursements, liquidations, replenishments), [form.branchCode, disbursements, liquidations, replenishments]);
  const valid = form.preparedBy.trim() && Number(form.amount) > 0;

  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3>{isEdit ? "Edit Replenishment" : "New Replenishment"}</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body">
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Replenishment No.</label>
              <input className="pcp-input" value={isEdit ? replenishment.replenishmentNo : nextNo} disabled />
            </div>
            <div className="pcp-field">
              <label>Date</label>
              <input type="date" className="pcp-input" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Fund / Branch</label>
              <select className="pcp-select" value={form.branchCode} onChange={(e) => set("branchCode", e.target.value)}>
                {COMPANIES.map((c) => (
                  <optgroup label={c} key={c}>
                    {branchesForCompany(c).map((b) => <option key={b.code} value={b.code}>{b.name} ({b.code})</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="pcp-field">
              <label>Amount (₱)</label>
              <input type="number" min="0" step="0.01" className="pcp-input" placeholder="0.00" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
              <div style={{ fontSize: 11, color: "var(--text-mut)", marginTop: 4 }}>
                Suggested (unreimbursed liquidations): <strong>{peso(suggested)}</strong>
                {suggested > 0 && <button className="pcp-btn pcp-btn-sm" style={{ marginLeft: 8 }} onClick={() => set("amount", suggested)}>Use</button>}
              </div>
            </div>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Prepared By</label>
              <input className="pcp-input" placeholder="Full name" value={form.preparedBy} onChange={(e) => set("preparedBy", e.target.value)} />
            </div>
            <div className="pcp-field">
              <label>Approved By</label>
              <input className="pcp-input" placeholder="Full name" value={form.approvedBy} onChange={(e) => set("approvedBy", e.target.value)} />
            </div>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Release Method</label>
              <select className="pcp-select" value={form.method} onChange={(e) => set("method", e.target.value)}>
                {REPLENISH_METHODS.map((mth) => <option key={mth}>{mth}</option>)}
              </select>
            </div>
            <div className="pcp-field">
              <label>Check / Reference No.</label>
              <input className="pcp-input" placeholder="e.g. CHK-00123" value={form.checkNo} onChange={(e) => set("checkNo", e.target.value)} />
            </div>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Status</label>
              <select className="pcp-select" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {REPLENISH_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="pcp-field">
              <label>Remarks</label>
              <input className="pcp-input" placeholder="Optional notes" value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
            </div>
          </div>
        </div>
        <div className="pcp-modal-foot">
          <button className="pcp-btn" onClick={onClose}>Cancel</button>
          <button className="pcp-btn pcp-btn-primary" disabled={!valid} onClick={() => onSave({ ...form, amount: Number(form.amount) })}>{isEdit ? "Save Changes" : "Create Replenishment"}</button>
        </div>
      </div>
    </div>
  );
}

function ReplenishmentTab({ replenishments, funds, disbursements, liquidations, onCreate, onEdit, onComplete, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  const nextNo = "PCRP-2026-" + String(replenishments.length + 1).padStart(4, "0");
  const totalCompleted = replenishments.filter((r) => r.status === "Completed").reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalPending = replenishments.filter((r) => r.status !== "Completed").reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const filtered = replenishments.filter((r) => {
    if (statusFilter !== "All" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(r.replenishmentNo.toLowerCase().includes(q) || (r.preparedBy || "").toLowerCase().includes(q) || (r.checkNo || "").toLowerCase().includes(q))) return false;
    }
    return true;
  }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div>
      <TopBar
        title="Replenishment"
        sub="Reimburse funds for liquidated expenses to restore the imprest balance"
        right={<button className="pcp-btn pcp-btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> New Replenishment</button>}
      />
      <div className="pcp-content">
        <div className="pcp-kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <KpiCard label="Total Replenished" value={peso(totalCompleted)} icon={RefreshCw} tint="#15803d" foot="Completed reimbursements" />
          <KpiCard label="Pending Replenishments" value={replenishments.filter((r) => r.status !== "Completed").length} icon={Clock} tint="#b9790a" foot={peso(totalPending) + " in progress"} />
          <KpiCard label="Replenishment Records" value={replenishments.length} icon={Landmark} tint="#2054a3" />
        </div>
        <div className="pcp-card">
          <div style={{ padding: "14px 18px", display: "flex", gap: 10, alignItems: "center", borderBottom: "1px solid var(--line)" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
              <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#9098b3" }} />
              <input className="pcp-input" style={{ paddingLeft: 28 }} placeholder="Search no., preparer or check no." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="pcp-select" style={{ width: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {["All", ...REPLENISH_STATUSES].map((s) => <option key={s}>{s}</option>)}
            </select>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-mut)" }}>{filtered.length} of {replenishments.length} records</div>
          </div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead>
                <tr>
                  <th>Replenishment No.</th><th>Date</th><th>Fund / Branch</th><th>Amount</th>
                  <th>Prepared By</th><th>Approved By</th><th>Method</th><th>Check / Ref.</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.replenishmentNo}</td>
                    <td>{fmtDate(r.date)}</td>
                    <td>{r.branchCode} <span style={{ fontSize: 11, color: "var(--text-mut)" }}>· {companyOfBranch(r.branchCode)}</span></td>
                    <td className="pcp-num">{peso(r.amount)}</td>
                    <td>{r.preparedBy || "—"}</td>
                    <td>{r.approvedBy || "—"}</td>
                    <td>{r.method}</td>
                    <td>{r.checkNo || "—"}</td>
                    <td><Badge status={r.status} /></td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {r.status !== "Completed" && (
                          <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={() => onComplete(r.id)} title="Mark completed"><Check size={12} /></button>
                        )}
                        <button className="pcp-btn pcp-btn-sm" onClick={() => setEditing(r)} title="Edit"><Edit3 size={12} /></button>
                        <button className="pcp-btn pcp-btn-sm pcp-btn-danger" onClick={() => onDelete(r.id)} title="Delete"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={10} className="pcp-empty">No replenishment records match your filters</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {showForm && (
        <ReplenishmentFormModal
          nextNo={nextNo} funds={funds} disbursements={disbursements} liquidations={liquidations} replenishments={replenishments}
          onClose={() => setShowForm(false)}
          onSave={(form) => { onCreate({ ...form, replenishmentNo: nextNo }); setShowForm(false); }}
        />
      )}
      {editing && (
        <ReplenishmentFormModal
          replenishment={editing} funds={funds} disbursements={disbursements} liquidations={liquidations} replenishments={replenishments}
          onClose={() => setEditing(null)}
          onSave={(form) => { onEdit(editing.id, form); setEditing(null); }}
        />
      )}
    </div>
  );
}

/* ============================= TRANSACTION HISTORY ============================= */

/* Flatten every request, release, liquidation line and replenishment into one
   unified, filterable transaction feed. */
function buildTransactionFeed(requests, disbursements, liquidations, replenishments) {
  const rows = [];
  requests.forEach((r) => rows.push({
    id: "t-req-" + r.id, type: "Request", date: r.date, ref: r.requestNo,
    party: r.employee, branchCode: r.branchCode, department: r.department,
    category: "", amount: Number(r.amount) || 0, status: r.status,
  }));
  disbursements.forEach((d) => rows.push({
    id: "t-rel-" + d.id, type: "Release", date: d.date, ref: d.voucherNo,
    party: d.employee, branchCode: d.branchCode, department: d.department,
    category: d.expenseCategory, amount: Number(d.amount) || 0, status: liqStatusFor(d, liquidations),
  }));
  disbursements.forEach((d) => {
    const liq = liquidationFor(d.id, liquidations);
    if (!liq || !liq.lines) return;
    liq.lines.forEach((l) => rows.push({
      id: "t-liq-" + l.id, type: "Liquidation", date: l.date, ref: d.voucherNo,
      party: d.employee, branchCode: d.branchCode, department: l.department,
      category: l.category, amount: Number(l.amount) || 0, status: "Liquidated",
    }));
  });
  (replenishments || []).forEach((r) => rows.push({
    id: "t-rep-" + r.id, type: "Replenishment", date: r.date, ref: r.replenishmentNo,
    party: r.preparedBy, branchCode: r.branchCode, department: "",
    category: r.method, amount: Number(r.amount) || 0, status: r.status,
  }));
  return rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function TransactionHistoryTab({ requests, disbursements, liquidations, replenishments, initialFilter }) {
  const [type, setType] = useState("All");
  const [company, setCompany] = useState("All");
  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minAmt, setMinAmt] = useState("");
  const [maxAmt, setMaxAmt] = useState("");

  useEffect(() => { if (initialFilter && initialFilter.type) setType(initialFilter.type); }, [initialFilter]);

  const feed = useMemo(() => buildTransactionFeed(requests, disbursements, liquidations, replenishments), [requests, disbursements, liquidations, replenishments]);

  const filtered = useMemo(() => feed.filter((t) => {
    if (type !== "All" && t.type !== type) return false;
    if (company !== "All" && companyOfBranch(t.branchCode) !== company) return false;
    if (status !== "All" && t.status !== status) return false;
    if (from && (t.date || "") < from) return false;
    if (to && (t.date || "") > to) return false;
    if (minAmt !== "" && t.amount < Number(minAmt)) return false;
    if (maxAmt !== "" && t.amount > Number(maxAmt)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!((t.ref || "").toLowerCase().includes(q) || (t.party || "").toLowerCase().includes(q) || (t.category || "").toLowerCase().includes(q))) return false;
    }
    return true;
  }), [feed, type, company, status, from, to, minAmt, maxAmt, search]);

  const total = filtered.reduce((s, t) => s + t.amount, 0);

  const exportExcel = useCallback(() => {
    const rows = filtered.map((t) => ({
      "Date": t.date, "Type": t.type, "Reference": t.ref, "Party": t.party,
      "Branch": t.branchCode, "Company": companyOfBranch(t.branchCode),
      "Department": deptDesc(t.department), "Category / Method": t.category,
      "Amount": t.amount, "Status": t.status,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), "Transaction History");
    downloadWorkbook(wb, `Transaction_History_${todayISO()}.xlsx`);
  }, [filtered]);

  const reset = () => { setType("All"); setCompany("All"); setStatus("All"); setSearch(""); setFrom(""); setTo(""); setMinAmt(""); setMaxAmt(""); };

  return (
    <div>
      <TopBar
        title="Transaction History"
        sub="Every request, release, liquidation and replenishment in one filterable ledger"
        right={<button className="pcp-btn pcp-btn-primary" onClick={exportExcel}><FileSpreadsheet size={14} /> Export to Excel</button>}
      />
      <div className="pcp-content">
        <div className="pcp-card" style={{ marginBottom: 16 }}>
          <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Type</label>
              <select className="pcp-select" value={type} onChange={(e) => setType(e.target.value)}>
                {["All", "Request", "Release", "Liquidation", "Replenishment"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Company</label>
              <select className="pcp-select" value={company} onChange={(e) => setCompany(e.target.value)}>
                {["All", ...COMPANIES].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Status</label>
              <select className="pcp-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                {["All", "Pending", "Approved", "Rejected", "Disbursed", "Liquidated", "Completed", "Not Liquidated", "Partially Liquidated", "Fully Liquidated"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Search</label>
              <input className="pcp-input" placeholder="Reference, party or category" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>From Date</label>
              <input type="date" className="pcp-input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>To Date</label>
              <input type="date" className="pcp-input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Min Amount</label>
              <input type="number" className="pcp-input" placeholder="0" value={minAmt} onChange={(e) => setMinAmt(e.target.value)} />
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Max Amount</label>
              <input type="number" className="pcp-input" placeholder="∞" value={maxAmt} onChange={(e) => setMaxAmt(e.target.value)} />
            </div>
          </div>
          <div style={{ padding: "0 18px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <button className="pcp-btn pcp-btn-sm" onClick={reset}><FilterIcon size={12} /> Reset Filters</button>
            <div style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--text-mut)" }}>
              {filtered.length} of {feed.length} transactions · Total <strong style={{ color: "var(--text)" }}>{peso(total)}</strong>
            </div>
          </div>
        </div>
        <div className="pcp-card">
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead>
                <tr>
                  <th>Date</th><th>Type</th><th>Reference</th><th>Party</th><th>Branch</th>
                  <th>Department</th><th>Category / Method</th><th>Amount</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? filtered.map((t) => (
                  <tr key={t.id}>
                    <td>{fmtDate(t.date)}</td>
                    <td><span className={"pcp-badge pcp-badge-" + (t.type === "Request" ? "amber" : t.type === "Release" ? "blue" : t.type === "Liquidation" ? "gray" : "green")}>{t.type}</span></td>
                    <td>{t.ref}</td>
                    <td>{t.party || "—"}</td>
                    <td>{t.branchCode}</td>
                    <td>{t.department ? deptDesc(t.department) : "—"}</td>
                    <td style={{ maxWidth: 200, whiteSpace: "normal" }}>{t.category || "—"}</td>
                    <td className="pcp-num">{peso(t.amount)}</td>
                    <td><Badge status={t.status} /></td>
                  </tr>
                )) : <tr><td colSpan={9} className="pcp-empty">No transactions match your filters</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================= AUDIT TRAIL ============================= */

const AUDIT_ACTIONS = ["Request Created", "Edited", "Approved", "Rejected", "Released", "Liquidated", "Replenished", "Deleted"];

function AuditTrailTab({ auditLog }) {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("All");

  const rows = useMemo(() => [...auditLog].sort((a, b) => (b.ts || "").localeCompare(a.ts || "")), [auditLog]);
  const filtered = rows.filter((a) => {
    if (action !== "All" && a.action !== action) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!((a.entity || "").toLowerCase().includes(q) || (a.user || "").toLowerCase().includes(q) || (a.remarks || "").toLowerCase().includes(q) || (a.action || "").toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const fmtTs = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString("en-PH", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const exportExcel = useCallback(() => {
    const out = filtered.map((a) => ({ "Date & Time": fmtTs(a.ts), "User": a.user, "Action": a.action, "Reference": a.entity, "Remarks": a.remarks }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(out.length ? out : [{}]), "Audit Trail");
    downloadWorkbook(wb, `Audit_Trail_${todayISO()}.xlsx`);
  }, [filtered]);

  return (
    <div>
      <TopBar
        title="Audit Trail"
        sub="Complete chronological history of every action taken in the system"
        right={<button className="pcp-btn pcp-btn-primary" onClick={exportExcel}><FileSpreadsheet size={14} /> Export to Excel</button>}
      />
      <div className="pcp-content">
        <div className="pcp-card">
          <div style={{ padding: "14px 18px", display: "flex", gap: 10, alignItems: "center", borderBottom: "1px solid var(--line)" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
              <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#9098b3" }} />
              <input className="pcp-input" style={{ paddingLeft: 28 }} placeholder="Search user, reference or remarks" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="pcp-select" style={{ width: 180 }} value={action} onChange={(e) => setAction(e.target.value)}>
              {["All", ...AUDIT_ACTIONS].map((s) => <option key={s}>{s}</option>)}
            </select>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-mut)" }}>{filtered.length} of {auditLog.length} entries</div>
          </div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead><tr><th>Date &amp; Time</th><th>User</th><th>Action</th><th>Reference</th><th>Remarks</th></tr></thead>
              <tbody>
                {filtered.length ? filtered.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: "nowrap" }}><Clock size={12} style={{ verticalAlign: "-2px", marginRight: 5, color: "#9098b3" }} />{fmtTs(a.ts)}</td>
                    <td>{a.user}</td>
                    <td><span className={"pcp-badge pcp-badge-" + (a.action === "Rejected" || a.action === "Deleted" ? "red" : a.action === "Approved" || a.action === "Released" || a.action === "Replenished" ? "green" : a.action === "Liquidated" ? "blue" : "gray")}>{a.action}</span></td>
                    <td>{a.entity}</td>
                    <td style={{ whiteSpace: "normal" }}>{a.remarks}</td>
                  </tr>
                )) : <tr><td colSpan={5} className="pcp-empty">No audit entries match your filters</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================= APP ============================= */

export default function App({ userEmail, onSignOut, userRole, isAdmin }) {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [dashboardBranch, setDashboardBranch] = useState("ALL");
  const [funds, setFunds] = useState([]);
  const [requests, setRequests] = useState([]);
  const [disbursements, setDisbursements] = useState([]);
  const [liquidations, setLiquidations] = useState([]);
  const [replenishments, setReplenishments] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [role, setRole] = useState(userRole || "Administrator");
  /* Non-admins are locked to their assigned role; admins may view-as any role. */
  useEffect(() => { setRole(userRole || "Administrator"); }, [userRole]);
  const guardedSetRole = useCallback((r) => { if (isAdmin) setRole(r); }, [isAdmin]);
  const [historyFilter, setHistoryFilter] = useState(null);
  const [disburseTarget, setDisburseTarget] = useState(null);
  const [showEditBalances, setShowEditBalances] = useState(false);
  const [saveTick, setSaveTick] = useState(0);

  /* Append an entry to the immutable audit trail, tagged with the active role. */
  const logAudit = useCallback((action, entity, remarks) => {
    setAuditLog((log) => [...log, {
      id: uid("aud"), ts: new Date().toISOString().slice(0, 19), user: role, action, entity, remarks: remarks || "",
    }]);
  }, [role]);

  useEffect(() => {
    (async () => {
      const saved = await loadState();
      /* Backfill the approval matrix on any request saved before it existed. */
      const migrateRequests = (rs) => (rs || []).map((r) => {
        const approvals = normalizeApprovals(r.approvals);
        /* Legacy requests already marked Approved/Disbursed count as fully approved. */
        if (!r.approvals && (r.status === "Approved" || r.status === "Disbursed")) {
          APPROVAL_LEVELS.forEach((lvl) => { approvals[lvl] = { status: "Approved", by: r.approver || lvl, date: r.date || "" }; });
        }
        return { ...r, approvals };
      });
      if (saved) {
        setFunds(saved.funds || seedFunds());
        setRequests(migrateRequests(saved.requests || seedRequests()));
        setDisbursements(saved.disbursements || seedDisbursements());
        setLiquidations(saved.liquidations || seedLiquidations());
        setReplenishments(saved.replenishments || seedReplenishments());
        setAuditLog(saved.auditLog || seedAuditLog());
        /* Role is derived per-user from login, not from the shared blob. */
      } else {
        setFunds(seedFunds());
        setRequests(migrateRequests(seedRequests()));
        setDisbursements(seedDisbursements());
        setLiquidations(seedLiquidations());
        setReplenishments(seedReplenishments());
        setAuditLog(seedAuditLog());
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveState({ funds, requests, disbursements, liquidations, replenishments, auditLog });
  }, [funds, requests, disbursements, liquidations, replenishments, auditLog, loaded]);

  /* ---- Requests ---- */
  const addRequest = useCallback((form) => {
    setRequests((rs) => [...rs, {
      id: uid("req"), requestNo: form.requestNo, date: form.date, employee: form.employee,
      department: form.department, branchCode: form.branchCode, purpose: form.purpose,
      amount: Number(form.amount), approver: form.approver, status: "Pending",
      approvals: defaultApprovals(),
    }]);
    logAudit("Request Created", form.requestNo, `${form.employee} · ${peso(Number(form.amount))} · ${form.purpose}`);
  }, [logAudit]);

  const editRequest = useCallback((id, form) => {
    setRequests((rs) => rs.map((r) => (r.id === id ? {
      ...r, date: form.date, employee: form.employee, department: form.department,
      branchCode: form.branchCode, purpose: form.purpose, amount: Number(form.amount),
      approver: form.approver,
    } : r)));
    const r = requests.find((x) => x.id === id);
    logAudit("Edited", r ? r.requestNo : id, `Request updated · ${form.employee} · ${peso(Number(form.amount))}`);
  }, [logAudit, requests]);

  /* Set one approval level, then recompute the overall request status. */
  const setApprovalLevel = useCallback((id, level, status, by) => {
    setRequests((rs) => rs.map((r) => {
      if (r.id !== id || r.status === "Disbursed") return r;
      const approvals = normalizeApprovals(r.approvals);
      approvals[level] = { status, by: by || level, date: todayISO() };
      const nextStatus = overallApprovalStatus(approvals);
      const r2 = requests.find((x) => x.id === id);
      logAudit(status === "Approved" ? "Approved" : "Rejected", r2 ? r2.requestNo : id, `${level} ${status.toLowerCase()}${nextStatus !== "Pending" ? ` · overall ${nextStatus}` : ""}`);
      return { ...r, approvals, status: nextStatus };
    }));
  }, [logAudit, requests]);

  const approveLevel = useCallback((id, level) => setApprovalLevel(id, level, "Approved", level), [setApprovalLevel]);
  const rejectLevel = useCallback((id, level) => setApprovalLevel(id, level, "Rejected", level), [setApprovalLevel]);

  /* ---- Disbursements ---- */
  const nextVoucherNo = "PCV-2026-" + String(disbursements.length + 1).padStart(4, "0");

  const confirmDisburse = useCallback((extra) => {
    const req = disburseTarget;
    if (!req) return;
    setDisbursements((ds) => [...ds, {
      id: uid("dv"), voucherNo: nextVoucherNo, date: extra.date, requestId: req.id,
      employee: req.employee, branchCode: req.branchCode, department: req.department,
      expenseCategory: extra.expenseCategory, amount: extra.amount, status: "Open",
      remarks: extra.remarks, billed: false,
    }]);
    setRequests((rs) => rs.map((r) => (r.id === req.id ? { ...r, status: "Disbursed" } : r)));
    logAudit("Released", nextVoucherNo, `Cash released to ${req.employee} · ${peso(extra.amount)}`);
    setDisburseTarget(null);
  }, [disburseTarget, nextVoucherNo, logAudit]);

  const updateRemarks = useCallback((id, remarks) => {
    setDisbursements((ds) => ds.map((d) => (d.id === id ? { ...d, remarks } : d)));
  }, []);

  const editDisbursement = useCallback((id, patch) => {
    setDisbursements((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  const toggleBilled = useCallback((id) => {
    setDisbursements((ds) => ds.map((d) => (d.id === id ? { ...d, billed: !d.billed } : d)));
  }, []);

  /* ---- Liquidation ---- */
  const saveLiquidation = useCallback((disbursementId, lines) => {
    setLiquidations((ls) => {
      const exists = ls.find((l) => l.disbursementId === disbursementId);
      if (exists) return ls.map((l) => (l.disbursementId === disbursementId ? { ...l, lines } : l));
      return [...ls, { id: uid("liq"), disbursementId, createdDate: todayISO(), lines }];
    });
    setDisbursements((ds) => ds.map((d) => (d.id === disbursementId ? { ...d, status: "Closed" } : d)));
    const d = disbursements.find((x) => x.id === disbursementId);
    const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    logAudit("Liquidated", d ? d.voucherNo : disbursementId, `${lines.length} receipt line(s) · ${peso(total)}`);
  }, [logAudit, disbursements]);

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

  /* ---- Roles, navigation & notifications ---- */
  const allowedTabs = (ROLES[role] || ROLES["Administrator"]).tabs;
  const navItems = useMemo(() => NAV_ITEMS.filter((it) => allowedTabs.includes(it.key)), [allowedTabs]);

  /* Keep the active tab valid whenever the role (and its allowed tabs) changes. */
  useEffect(() => {
    if (loaded && !allowedTabs.includes(tab)) setTab(allowedTabs[0] || "dashboard");
  }, [role, loaded]); // eslint-disable-line

  const navigate = useCallback((key, opts) => {
    if (!allowedTabs.includes(key)) return;
    if (key === "history") setHistoryFilter(opts && opts.type ? { type: opts.type } : null);
    setTab(key);
  }, [allowedTabs]);

  const notifications = useMemo(
    () => buildNotifications(requests, disbursements, liquidations, replenishments),
    [requests, disbursements, liquidations, replenishments]
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
      <Sidebar tab={tab} setTab={setTab} role={role} navItems={navItems} userEmail={userEmail} onSignOut={onSignOut} />
      <div className="pcp-main">
        {tab === "dashboard" && (
          <>
            <TopBar
              title="Dashboard"
              sub="Real-time summary of all petty cash activity across every plant and company"
              right={<button className="pcp-btn" onClick={() => setShowEditBalances(true)}><Edit3 size={14} /> Edit Beginning Balances</button>}
            />
            <div className="pcp-content">
              <div className="pcp-tabs">
                <button
                  className={"pcp-tab" + (dashboardBranch === "ALL" ? " active" : "")}
                  onClick={() => setDashboardBranch("ALL")}
                >
                  Consolidated
                </button>
                {DASHBOARD_BRANCHES.map((b) => (
                  <button
                    key={b.key}
                    className={"pcp-tab" + (dashboardBranch === b.key ? " active" : "")}
                    onClick={() => setDashboardBranch(b.key)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              {dashboardBranch === "ALL" ? (
                <Dashboard funds={funds} requests={requests} disbursements={disbursements} liquidations={liquidations} replenishments={replenishments} onNavigate={navigate} />
              ) : (
                (() => {
                  const b = DASHBOARD_BRANCHES.find((x) => x.key === dashboardBranch);
                  return (
                    <BranchDashboard
                      label={b.label}
                      branchCode={b.branchCode}
                      funds={funds} requests={requests} disbursements={disbursements} liquidations={liquidations} replenishments={replenishments}
                    />
                  );
                })()
              )}
            </div>
          </>
        )}
        {tab === "requests" && (
          <RequestsTab
            requests={requests} funds={funds}
            onCreate={addRequest} onEdit={editRequest}
            onApproveLevel={approveLevel} onRejectLevel={rejectLevel}
            onDisburse={(req) => setDisburseTarget(req)}
          />
        )}
        {tab === "disbursements" && (
          <DisbursementsTab
            disbursements={disbursements} liquidations={liquidations} requests={requests}
            onUpdateRemarks={updateRemarks} onToggleBilled={toggleBilled} onEditDisbursement={editDisbursement}
          />
        )}
        {tab === "liquidation" && (
          <LiquidationTab
            disbursements={disbursements} liquidations={liquidations}
            onSaveLiquidation={saveLiquidation} onExport={exportLiquidation}
            onExportAll={exportAllToAcumatica}
          />
        )}
        {tab === "replenishment" && (
          <ReplenishmentTab
            replenishments={replenishments} funds={funds}
            disbursements={disbursements} liquidations={liquidations}
            onCreate={addReplenishment} onEdit={editReplenishment}
            onComplete={completeReplenishment} onDelete={deleteReplenishment}
          />
        )}
        {tab === "history" && (
          <TransactionHistoryTab
            requests={requests} disbursements={disbursements}
            liquidations={liquidations} replenishments={replenishments}
            initialFilter={historyFilter}
          />
        )}
        {tab === "report" && (
          <ManagementReportTab
            funds={funds} requests={requests} disbursements={disbursements} liquidations={liquidations} replenishments={replenishments}
          />
        )}
        {tab === "audit" && (
          <AuditTrailTab auditLog={auditLog} />
        )}
        {tab === "masterdata" && (
          <MasterDataTab
            funds={funds} disbursements={disbursements} liquidations={liquidations} replenishments={replenishments}
            onAddFund={addFund} onEditFund={editFund} onDeleteFund={deleteFund}
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
          funds={funds}
          onClose={() => setShowEditBalances(false)}
          onSave={(updates) => { saveBalances(updates); setShowEditBalances(false); }}
        />
      )}
    </div>
    </AppUI.Provider>
  );
}

/* ============================= AUTH GATE ============================= */

/* Email/password sign-in screen shown when a Supabase database is configured.
   Accounts are provisioned by an admin in the Supabase dashboard. */
function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setNotice(""); setBusy(true);
    try {
      const res = await window.PCP_AUTH.signIn(email.trim(), password);
      if (res && res.error) setError(res.error.message || "Sign-in failed.");
      /* On success, onAuthStateChange in <Root/> swaps in the app. */
    } catch (err) {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setError(""); setNotice("");
    if (!email.trim()) { setError("Enter your email first, then click Forgot password."); return; }
    try {
      const res = await window.PCP_AUTH.resetPassword(email.trim());
      if (res && res.error) setError(res.error.message);
      else setNotice("If that email has an account, a reset link is on its way.");
    } catch (err) {
      setError("Could not send the reset email.");
    }
  };

  return (
    <div className="pcp-root">
      <style>{CSS}</style>
      <div className="pcp-login-wrap">
        <div className="pcp-login-card">
          <div className="pcp-login-head">
            <div className="pcp-brand-mark"><Wallet size={18} /></div>
            <div className="pcp-login-title">Petty Cash Management System</div>
            <div className="pcp-login-sub">Sign in to continue</div>
          </div>
          <form className="pcp-login-body" onSubmit={submit}>
            {error && <div className="pcp-login-err">{error}</div>}
            {notice && <div className="pcp-login-ok">{notice}</div>}
            <div className="pcp-field">
              <label>Email</label>
              <input type="email" className="pcp-input" autoComplete="username" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="pcp-field">
              <label>Password</label>
              <input type="password" className="pcp-input" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="pcp-btn pcp-btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 4 }} disabled={busy}>
              {busy ? "Signing in…" : "Sign In"}
            </button>
            <div className="pcp-login-foot">
              <button type="button" className="pcp-link-btn" onClick={forgot}>Forgot password?</button>
            </div>
            <div className="pcp-login-foot" style={{ marginTop: 8 }}>
              Access is provided by your administrator.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* Root decides between the login screen and the app. When no cloud database
   is configured (local-only mode), it renders the app directly with no login. */
function Root() {
  const authEnabled = !!(window.PCP_AUTH && window.PCP_AUTH.enabled);
  const [checking, setChecking] = useState(authEnabled);
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!authEnabled) return;
    let active = true;
    window.PCP_AUTH.getUser().then((u) => { if (active) { setUser(u); setChecking(false); } });
    window.PCP_AUTH.onChange((session) => { if (active) { setUser(session ? session.user : null); setChecking(false); } });
    return () => { active = false; };
  }, [authEnabled]);

  const signOut = useCallback(() => { window.PCP_AUTH.signOut(); }, []);

  if (authEnabled && checking) {
    return (
      <div className="pcp-root" style={{ alignItems: "center", justifyContent: "center" }}>
        <style>{CSS}</style>
        <div style={{ color: "var(--text-mut)", fontSize: 13 }}>Checking sign-in…</div>
      </div>
    );
  }
  if (authEnabled && !user) return <LoginScreen />;

  const access = resolveUserAccess(user ? user.email : null);
  return <App userEmail={user ? user.email : null} onSignOut={authEnabled ? signOut : null} userRole={access.role} isAdmin={access.isAdmin} />;
}

/* ============================= MOUNT ============================= */

createRoot(document.getElementById("root")).render(<Root />);
