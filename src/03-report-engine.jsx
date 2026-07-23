/* ============================= REPORT ENGINE ============================= */

const COMPANY_MAIN = "STARKSON PAPER AND PLASTIC CORPORATION";
const PORTAL_NAME = "PETTY CASH FUND (PCF) PORTAL";

/* Company logo for the reports — resolved from the actual PNG that ships beside
   index.html so it renders on screen AND inside the print window (a new window
   opened on about:blank cannot resolve relative paths, so we hand it a fully
   qualified URL). Falls back to the plain relative path if resolution fails. */
const REPORT_LOGO = (() => {
  try { return new URL(encodeURI("SPI PAPER LOGO.png"), document.baseURI).href; }
  catch (e) { return "SPI PAPER LOGO.png"; }
})();
const REPORT_LOGO_A1 = (() => {
  try { return new URL(encodeURI("A1 PAPER LOGO.png"), document.baseURI).href; }
  catch (e) { return "A1 PAPER LOGO.png"; }
})();

/* The header company name + logo follow the report's scope: A1+ reports show the
   A1+ company/logo, everything else falls back to the Starkson parent. */
const companyHeaderName = (company) => (company ? String(company).toUpperCase() : COMPANY_MAIN);
const logoForCompany = (company) => (company && /a1\+/i.test(String(company)) ? REPORT_LOGO_A1 : REPORT_LOGO);

/* Currency formatted exactly as requested in the report spec: PHP 1,234,567.89
   (negatives are parenthesised, accounting style). */
const money = (n) => {
  const v = Number(n) || 0;
  const s = Math.abs(v).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(PHP ${s})` : `PHP ${s}`;
};

/* Human readable "printed on" stamp — e.g. Jul 23, 2026, 02:15 PM. */
const nowStamp = () => new Date().toLocaleString("en-PH", {
  year: "numeric", month: "short", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: true,
});

/* Stable-ish verification reference for a generated report (shown in header,
   footer and export — used in place of a scannable QR for offline verification). */
const makeReportRef = (code) => {
  const d = new Date();
  const stamp = d.toISOString().slice(0, 10).replace(/-/g, "") + "-" +
    String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0");
  return `PCF-${code}-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
};

/* Escape text for safe insertion into the generated print document. */
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* CSV download from column labels + rows (array of arrays). BOM keeps Excel happy. */
function downloadCsv(filename, headers, rows) {
  const cell = (v) => {
    const s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [headers.map(cell).join(",")];
  rows.forEach((r) => lines.push(r.map(cell).join(",")));
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* The catalogue of professional reports offered by the Report Center. Each entry
   drives the report-type selector and its default page orientation. */
const REPORT_TYPES = [
  { code: "LEDGER",  label: "Petty Cash Ledger",             orientation: "landscape" },
  { code: "DISB",    label: "Cash Disbursement Report",      orientation: "landscape" },
  { code: "LIQ",     label: "Liquidation Report",            orientation: "landscape" },
  { code: "REPL",    label: "Replenishment Report",          orientation: "portrait"  },
  { code: "OUT",     label: "Outstanding Liquidation Report", orientation: "landscape" },
  { code: "EXPSUM",  label: "Expense Summary",               orientation: "portrait"  },
  { code: "EXPCAT",  label: "Expense by Category",           orientation: "portrait"  },
  { code: "EXPACC",  label: "Expense by Account",            orientation: "portrait"  },
  { code: "MONTH",   label: "Monthly Summary",               orientation: "portrait"  },
  { code: "DASH",    label: "Dashboard Summary Report",      orientation: "portrait"  },
  { code: "AUDIT",   label: "Audit Trail Report",            orientation: "landscape" },
  { code: "HIST",    label: "Transaction History",           orientation: "landscape" },
  { code: "CASHPOS", label: "Cash Position Report",          orientation: "landscape" },
  { code: "BEGBAL",  label: "Beginning Balance Report",      orientation: "portrait"  },
  { code: "FUNDMOV", label: "Fund Movement Report",          orientation: "landscape" },
];

/* Build a normalized report descriptor { columns, rows, totalsRow, count } from
   the live data (D), the active filter set (F) and report type. Columns carry
   money/alignment metadata; rows are keyed objects (money values stay numeric so
   they can be formatted for screen, print, Excel and CSV from one source). */
function buildReport(type, D, F) {
  const { funds, requests, disbursements, liquidations, replenishments, auditLog } = D;
  const reps = replenishments || [];

  const custodianOf = (code) => (funds.find((f) => f.branchCode === code) || {}).custodian || "";
  const okBranch = (code) => {
    if (F.company && companyOfBranch(code) !== F.company) return false;
    if (F.plant && code !== F.plant) return false;
    if (F.branch && code !== F.branch) return false;
    if (F.custodian && custodianOf(code) !== F.custodian) return false;
    return true;
  };
  const okDate = (iso) => {
    if (!iso) return !(F.from || F.to);
    if (F.from && iso < F.from) return false;
    if (F.to && iso > F.to) return false;
    return true;
  };

  const fFunds = funds.filter((f) => okBranch(f.branchCode));
  const fDisb = disbursements.filter((d) => okBranch(d.branchCode) && okDate(d.date));
  const fRepl = reps.filter((r) => okBranch(r.branchCode) && okDate(r.date));
  const fReq = requests.filter((r) => okBranch(r.branchCode) && okDate(r.date));
  const fDisbIds = new Set(fDisb.map((d) => d.id));
  const fLiq = liquidations.filter((l) => fDisbIds.has(l.disbursementId));

  const c = (key, label, opt = {}) => ({
    key, label,
    align: opt.align || (opt.money ? "right" : "left"),
    money: !!opt.money, width: opt.width,
  });
  const fin = (columns, rows, count, totalLabel) => {
    let totalsRow = null;
    if (totalLabel) {
      totalsRow = { _total: true };
      columns.forEach((col) => {
        if (col.money) {
          totalsRow[col.key] = rows
            .filter((r) => !r._skipTotal && !r._group && !r._subtotal)
            .reduce((s, r) => s + (Number(r[col.key]) || 0), 0);
        }
      });
      totalsRow[columns[0].key] = totalLabel;
    }
    return { columns, rows, count, totalsRow };
  };
  const scopeCodes = [...new Set(funds.map((f) => f.branchCode))].filter(okBranch);

  switch (type) {
    case "LEDGER": {
      const columns = [
        c("date", "Date"), c("ref", "Reference"), c("particulars", "Particulars", { width: "34%" }),
        c("type", "Type", { align: "center" }),
        c("cashIn", "Cash In", { money: true }), c("cashOut", "Cash Out", { money: true }),
        c("balance", "Balance", { money: true }),
      ];
      const rows = []; let count = 0;
      scopeCodes.forEach((code) => {
        const fund = funds.find((f) => f.branchCode === code);
        let bal = Number(fund && fund.beginningBalance) || 0;
        const evts = [];
        disbursements.filter((d) => d.branchCode === code && okDate(d.date)).forEach((d) =>
          evts.push({ d: d.date, ref: d.voucherNo, particulars: `${d.employee} — ${d.expenseCategory || deptDesc(d.department)}`, type: "Disbursement", in: 0, out: Number(d.amount) || 0 }));
        reps.filter((r) => r.branchCode === code && r.status === "Completed" && okDate(r.date)).forEach((r) =>
          evts.push({ d: r.date, ref: r.replenishmentNo, particulars: `Replenishment — ${r.preparedBy || ""}`, type: "Replenishment", in: Number(r.amount) || 0, out: 0 }));
        evts.sort((a, b) => (a.d || "").localeCompare(b.d || ""));
        rows.push({ _group: true, particulars: `${(fund && fund.label) || code} (${code}) — ${companyOfBranch(code)}` });
        rows.push({ date: "", ref: "", particulars: "Beginning Balance", type: "Opening", cashIn: null, cashOut: null, balance: bal, _skipTotal: true });
        evts.forEach((e) => { bal += e.in - e.out; count++; rows.push({ date: fmtDate(e.d), ref: e.ref, particulars: e.particulars, type: e.type, cashIn: e.in || null, cashOut: e.out || null, balance: bal }); });
        rows.push({ _subtotal: true, particulars: `Ending Balance — ${(fund && fund.label) || code}`, cashIn: evts.reduce((s, e) => s + e.in, 0), cashOut: evts.reduce((s, e) => s + e.out, 0), balance: bal, _skipTotal: true });
      });
      return fin(columns, rows, count, null);
    }

    case "DISB": {
      const columns = [
        c("voucher", "Voucher No."), c("date", "Date"), c("employee", "Employee"),
        c("branch", "Branch"), c("company", "Company"), c("dept", "Department"),
        c("category", "Expense Category", { width: "18%" }), c("status", "Liq. Status", { align: "center" }),
        c("amount", "Amount", { money: true }),
      ];
      const arr = fDisb.filter((d) =>
        (!F.category || d.expenseCategory === F.category) &&
        (!F.account || accountForCategory(d.expenseCategory) === F.account) &&
        (!F.status || liqStatusFor(d, liquidations) === F.status)
      ).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      const rows = arr.map((d) => ({
        voucher: d.voucherNo, date: fmtDate(d.date), employee: d.employee, branch: d.branchCode,
        company: companyOfBranch(d.branchCode), dept: deptDesc(d.department), category: d.expenseCategory,
        status: liqStatusFor(d, liquidations), amount: Number(d.amount) || 0,
      }));
      return fin(columns, rows, rows.length, "GRAND TOTAL");
    }

    case "LIQ": {
      const columns = [
        c("voucher", "Voucher No."), c("date", "Date"), c("employee", "Employee"), c("branch", "Branch"),
        c("description", "Description", { width: "24%" }), c("category", "Expense Category", { width: "16%" }),
        c("tax", "Tax Category", { align: "center" }), c("amount", "Amount", { money: true }),
      ];
      const tmp = [];
      disbursements.forEach((d) => {
        if (!okBranch(d.branchCode)) return;
        const liq = liquidationFor(d.id, liquidations);
        if (!liq || !liq.lines) return;
        liq.lines.forEach((l) => {
          if (!okDate(l.date)) return;
          if (F.category && l.category !== F.category) return;
          if (F.account && accountForCategory(l.category) !== F.account) return;
          const desc = (l.expense && l.expense.trim()) ? l.expense.trim() : l.category;
          tmp.push({ _d: l.date, voucher: d.voucherNo, date: fmtDate(l.date), employee: d.employee, branch: d.branchCode, description: `${desc} — ${deptDesc(l.department)}`, category: l.category, tax: l.taxCategory || "—", amount: Number(l.amount) || 0 });
        });
      });
      tmp.sort((a, b) => (a._d || "").localeCompare(b._d || ""));
      return fin(columns, tmp, tmp.length, "GRAND TOTAL");
    }

    case "REPL": {
      const columns = [
        c("no", "Replenish No."), c("date", "Date"), c("branch", "Branch"), c("company", "Company"),
        c("method", "Method", { align: "center" }), c("preparedBy", "Prepared By"),
        c("status", "Status", { align: "center" }), c("amount", "Amount", { money: true }),
      ];
      const arr = fRepl.filter((r) => !F.status || (r.status || "") === F.status)
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      const rows = arr.map((r) => ({
        no: r.replenishmentNo, date: fmtDate(r.date), branch: r.branchCode, company: companyOfBranch(r.branchCode),
        method: r.method || "—", preparedBy: r.preparedBy || "—", status: r.status || "—", amount: Number(r.amount) || 0,
      }));
      return fin(columns, rows, rows.length, "GRAND TOTAL");
    }

    case "OUT": {
      const columns = [
        c("voucher", "Voucher No."), c("date", "Date"), c("employee", "Employee"), c("branch", "Branch"),
        c("age", "Age (days)", { align: "center" }), c("status", "Status", { align: "center" }),
        c("disbursed", "Disbursed", { money: true }), c("liquidated", "Liquidated", { money: true }),
        c("outstanding", "Outstanding", { money: true }),
      ];
      const today = todayISO();
      const arr = fDisb.filter((d) => liqStatusFor(d, liquidations) !== "Fully Liquidated" && (!F.status || liqStatusFor(d, liquidations) === F.status))
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      const rows = arr.map((d) => {
        const liq = liquidatedTotal(liquidationFor(d.id, liquidations));
        const age = d.date ? Math.max(0, Math.round((new Date(today) - new Date(d.date)) / 86400000)) : 0;
        return { voucher: d.voucherNo, date: fmtDate(d.date), employee: d.employee, branch: d.branchCode, age, status: liqStatusFor(d, liquidations), disbursed: Number(d.amount) || 0, liquidated: liq, outstanding: Math.max(0, (Number(d.amount) || 0) - liq) };
      });
      return fin(columns, rows, rows.length, "GRAND TOTAL");
    }

    case "EXPSUM": {
      const columns = [
        c("plant", "Plant / Fund"), c("company", "Company"), c("custodian", "Custodian"),
        c("txns", "Transactions", { align: "right" }), c("amount", "Total Expense", { money: true }),
      ];
      const rows = fFunds.map((f) => {
        const lines = fLiq.filter((l) => { const d = disbursements.find((x) => x.id === l.disbursementId); return d && d.branchCode === f.branchCode; })
          .reduce((s, l) => s + l.lines.filter((ln) => okDate(ln.date)).length, 0);
        const amt = fLiq.filter((l) => { const d = disbursements.find((x) => x.id === l.disbursementId); return d && d.branchCode === f.branchCode; })
          .reduce((s, l) => s + l.lines.filter((ln) => okDate(ln.date)).reduce((a, ln) => a + (Number(ln.amount) || 0), 0), 0);
        return { plant: f.label, company: companyOfBranch(f.branchCode), custodian: f.custodian, txns: lines, amount: amt };
      });
      return fin(columns, rows, rows.length, "GRAND TOTAL");
    }

    case "EXPCAT":
    case "EXPACC": {
      const byAccount = type === "EXPACC";
      const columns = byAccount ? [
        c("account", "Account Code"), c("category", "Expense Category / Description", { width: "40%" }),
        c("txns", "Count", { align: "right" }), c("amount", "Amount", { money: true }), c("pct", "% of Total", { align: "right" }),
      ] : [
        c("category", "Expense Category", { width: "34%" }), c("account", "Account Code"),
        c("txns", "Count", { align: "right" }), c("amount", "Amount", { money: true }), c("pct", "% of Total", { align: "right" }),
      ];
      const map = {};
      disbursements.forEach((d) => {
        if (!okBranch(d.branchCode)) return;
        const liq = liquidationFor(d.id, liquidations);
        if (!liq || !liq.lines) return;
        liq.lines.forEach((l) => {
          if (!okDate(l.date)) return;
          const cat = l.category || "(Uncategorized)";
          const acct = accountForCategory(cat) || "—";
          if (F.category && cat !== F.category) return;
          if (F.account && acct !== F.account) return;
          const key = byAccount ? acct : cat;
          if (!map[key]) map[key] = { account: acct, category: cat, txns: 0, amount: 0 };
          map[key].txns += 1; map[key].amount += Number(l.amount) || 0;
        });
      });
      const list = Object.values(map).sort((a, b) => b.amount - a.amount);
      const grand = list.reduce((s, r) => s + r.amount, 0) || 1;
      const rows = list.map((r) => ({ ...r, pct: ((r.amount / grand) * 100).toFixed(1) + "%" }));
      return fin(columns, rows, rows.length, "GRAND TOTAL");
    }

    case "MONTH": {
      const columns = [
        c("month", "Month"), c("disbursed", "Disbursed", { money: true }), c("liquidated", "Liquidated", { money: true }),
        c("replenished", "Replenished", { money: true }), c("net", "Net Movement", { money: true }),
      ];
      const map = {};
      const bump = (m, key, v) => { if (!m) return; (map[m] = map[m] || { disbursed: 0, liquidated: 0, replenished: 0 })[key] += v; };
      fDisb.forEach((d) => bump((d.date || "").slice(0, 7), "disbursed", Number(d.amount) || 0));
      fLiq.forEach((l) => l.lines.forEach((ln) => { if (okDate(ln.date)) bump((ln.date || "").slice(0, 7), "liquidated", Number(ln.amount) || 0); }));
      fRepl.filter((r) => r.status === "Completed").forEach((r) => bump((r.date || "").slice(0, 7), "replenished", Number(r.amount) || 0));
      const rows = Object.keys(map).sort().map((mo) => {
        const v = map[mo];
        const label = new Date(mo + "-01T00:00:00").toLocaleDateString("en-PH", { year: "numeric", month: "long" });
        return { month: label, disbursed: v.disbursed, liquidated: v.liquidated, replenished: v.replenished, net: v.replenished - v.disbursed };
      });
      return fin(columns, rows, rows.length, "GRAND TOTAL");
    }

    case "DASH": {
      const columns = [c("metric", "Metric", { width: "60%" }), c("value", "Value", { align: "right" })];
      const m = computeMetrics(fFunds, fReq, fDisb, fLiq, fRepl);
      const rows = [
        { metric: "Total Fund (Beginning Balance)", value: money(m.totalFund) },
        { metric: "Total Disbursed", value: money(m.totalDisbursed) },
        { metric: "Total Liquidated", value: money(m.totalLiquidated) },
        { metric: "Total Replenished", value: money(m.totalReplenished) },
        { metric: "Outstanding Liquidation", value: money(m.outstanding) },
        { metric: "Available Balance", value: money(m.availableBalance) },
        { metric: "Expenses This Month", value: money(m.monthlyExpenses) },
        { metric: "Pending Requests", value: String(m.pendingRequests) },
        { metric: "Approved Requests", value: String(m.approvedRequests) },
        { metric: "Pending Liquidations", value: String(m.pendingLiquidationCount) },
        { metric: "Pending Replenishments", value: String(m.pendingReplenishments) },
        { metric: "Active Employees (unliquidated)", value: String(m.activeEmployeeCount) },
      ];
      return fin(columns, rows, rows.length, null);
    }

    case "AUDIT": {
      const columns = [
        c("ts", "Timestamp"), c("user", "User"), c("action", "Action"),
        c("entity", "Entity"), c("remarks", "Remarks", { width: "38%" }),
      ];
      const arr = [...(auditLog || [])]
        .filter((a) => okDate((a.ts || "").slice(0, 10)))
        .sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
      const rows = arr.map((a) => ({
        ts: (a.ts || "").replace("T", " "), user: a.user || "—", action: a.action || "—",
        entity: a.entity || "—", remarks: a.remarks || "",
      }));
      return fin(columns, rows, rows.length, null);
    }

    case "HIST": {
      const columns = [
        c("date", "Date"), c("type", "Type", { align: "center" }), c("ref", "Reference"),
        c("branch", "Branch"), c("description", "Description", { width: "30%" }),
        c("status", "Status", { align: "center" }), c("amount", "Amount", { money: true }),
      ];
      const evts = [];
      fReq.forEach((r) => evts.push({ _d: r.date, date: fmtDate(r.date), type: "Request", ref: r.requestNo, branch: r.branchCode, description: `${r.employee} — ${r.purpose || ""}`, status: r.status || "—", amount: Number(r.amount) || 0 }));
      fDisb.forEach((d) => evts.push({ _d: d.date, date: fmtDate(d.date), type: "Disbursement", ref: d.voucherNo, branch: d.branchCode, description: `${d.employee} — ${d.expenseCategory || ""}`, status: liqStatusFor(d, liquidations), amount: Number(d.amount) || 0 }));
      fLiq.forEach((l) => { const d = disbursements.find((x) => x.id === l.disbursementId); if (!d) return; evts.push({ _d: (l.lines[0] && l.lines[0].date) || d.date, date: fmtDate((l.lines[0] && l.lines[0].date) || d.date), type: "Liquidation", ref: d.voucherNo, branch: d.branchCode, description: `${d.employee} — ${l.lines.length} line(s)`, status: "Liquidated", amount: liquidatedTotal(l) }); });
      fRepl.forEach((r) => evts.push({ _d: r.date, date: fmtDate(r.date), type: "Replenishment", ref: r.replenishmentNo, branch: r.branchCode, description: `Replenishment — ${r.preparedBy || ""}`, status: r.status || "—", amount: Number(r.amount) || 0 }));
      evts.sort((a, b) => (b._d || "").localeCompare(a._d || ""));
      return fin(columns, evts, evts.length, null);
    }

    case "CASHPOS": {
      const columns = [
        c("plant", "Plant / Fund"), c("company", "Company"), c("custodian", "Custodian"),
        c("beginning", "Beginning", { money: true }), c("disbursed", "Disbursed", { money: true }),
        c("liquidated", "Liquidated", { money: true }), c("replenished", "Replenished", { money: true }),
        c("outstanding", "Outstanding", { money: true }), c("available", "Available", { money: true }),
      ];
      const rows = fFunds.map((f) => ({ plant: f.label, company: companyOfBranch(f.branchCode), custodian: f.custodian, ...monitoringForFund(f, disbursements, liquidations, reps) }));
      return fin(columns, rows, rows.length, "GRAND TOTAL");
    }

    case "BEGBAL": {
      const columns = [
        c("plant", "Plant / Fund"), c("branch", "Branch"), c("company", "Company"),
        c("custodian", "Custodian"), c("beginning", "Beginning Balance", { money: true }),
      ];
      const rows = fFunds.map((f) => ({ plant: f.label, branch: f.branchCode, company: companyOfBranch(f.branchCode), custodian: f.custodian, beginning: Number(f.beginningBalance) || 0 }));
      return fin(columns, rows, rows.length, "GRAND TOTAL");
    }

    case "FUNDMOV": {
      const columns = [
        c("plant", "Plant / Fund"), c("company", "Company"), c("beginning", "Beginning", { money: true }),
        c("cashOut", "Cash Out (Disbursed)", { money: true }), c("cashIn", "Cash In (Replenished)", { money: true }),
        c("net", "Net Movement", { money: true }), c("ending", "Ending (Available)", { money: true }),
      ];
      const rows = fFunds.map((f) => {
        const mv = monitoringForFund(f, disbursements, liquidations, reps);
        return { plant: f.label, company: companyOfBranch(f.branchCode), beginning: mv.beginning, cashOut: mv.disbursed, cashIn: mv.replenished, net: mv.replenished - mv.disbursed, ending: mv.available };
      });
      return fin(columns, rows, rows.length, "GRAND TOTAL");
    }

    default:
      return { columns: [c("info", "Info")], rows: [{ info: "Select a report type." }], count: 0, totalsRow: null };
  }
}

/* Flatten a report descriptor into a header row + data rows for Excel / CSV. */
function reportMatrix(doc, moneyAsNumber) {
  const headers = doc.columns.map((col) => col.label);
  const fmt = (row) => doc.columns.map((col) => {
    let v = row[col.key];
    if (col.money) { if (v == null || v === "") return ""; return moneyAsNumber ? (Number(v) || 0) : money(v); }
    return v == null ? "" : String(v);
  });
  const rows = [];
  doc.rows.forEach((r) => {
    if (r._group) { const a = headers.map(() => ""); a[0] = r.particulars || r[doc.columns[0].key] || ""; rows.push(a); }
    else rows.push(fmt(r));
  });
  if (doc.totalsRow) rows.push(fmt(doc.totalsRow));
  return { headers, rows };
}

function exportReportCsv(doc) {
  const { headers, rows } = reportMatrix(doc, true);
  downloadCsv(`${doc.title.replace(/\s+/g, "_")}_${todayISO()}.csv`, headers, rows);
}

function exportReportExcel(doc) {
  const { headers, rows } = reportMatrix(doc, true);
  const aoa = [[doc.company ? companyHeaderName(doc.company) : COMPANY_MAIN], [PORTAL_NAME], [doc.title], []];
  Object.entries(doc.meta || {}).forEach(([k, v]) => aoa.push([k, v]));
  aoa.push([]);
  aoa.push(headers);
  rows.forEach((r) => aoa.push(r));
  aoa.push([]);
  aoa.push([`Transaction Count: ${doc.count}`]);
  aoa.push([`Reference: ${doc.reference}`]);
  aoa.push([`Printed: ${nowStamp()}`]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  downloadWorkbook(wb, `${doc.title.replace(/\s+/g, "_")}_${todayISO()}.xlsx`);
}

/* Build a fully self-contained, print-ready HTML document for one report.
   Uses the thead/tfoot repeating-group technique so the report header, column
   headers and footer repeat automatically on every printed page. */
function reportPrintHTML(doc) {
  const N = doc.columns.length;
  const colHead = doc.columns.map((col) => `<th class="a-${col.align}">${esc(col.label)}</th>`).join("");
  const cellHTML = (row) => doc.columns.map((col) => {
    let v = row[col.key];
    if (col.money) v = (v == null || v === "") ? "" : money(v);
    else v = (v == null) ? "" : esc(v);
    return `<td class="a-${col.align}">${v}</td>`;
  }).join("");
  const bodyRows = doc.rows.map((row) => {
    if (row._group) return `<tr class="grp"><td colspan="${N}">${esc(row.particulars || row[doc.columns[0].key] || "")}</td></tr>`;
    const cls = row._subtotal ? "sub" : "";
    return `<tr class="${cls}">${cellHTML(row)}</tr>`;
  }).join("");
  const nf = `<tr class="nf"><td colspan="${N}">\u2014\u2014\u2014  NOTHING FOLLOWS  \u2014\u2014\u2014</td></tr>`;
  const totalRow = doc.totalsRow ? `<tr class="tot">${cellHTML(doc.totalsRow)}</tr>` : "";
  const metaHTML = Object.entries(doc.meta || {})
    .map(([k, v]) => `<div><b>${esc(k)}:</b> ${esc(v)}</div>`).join("");
  const wm = doc.watermark ? `<div class="wm">CONFIDENTIAL</div>` : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(doc.title)} — ${esc(doc.reference)}</title>
<style>
  @page { size: A4 ${doc.orientation}; margin: 12mm 10mm 15mm 10mm; }
  @page { @bottom-right { content: "Page " counter(page) " of " counter(pages); font-family: Calibri, Arial, sans-serif; font-size: 8pt; color: #555; } }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Calibri, Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 10.5px; }
  table.rpt { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  thead .head-cell, tfoot .foot-cell { border: none; padding: 0; }
  .rhead { display: flex; align-items: center; gap: 14px; padding-bottom: 8px; border-bottom: 2.5px solid #111; }
  .rh-logo img { height: 54px; max-width: 150px; object-fit: contain; }
  .rh-center { flex: 1; text-align: center; }
  .rh-company { font-size: 16px; font-weight: 800; letter-spacing: 0.4px; }
  .rh-portal { font-size: 11px; font-weight: 700; color: #c8102e; letter-spacing: 1px; margin-top: 1px; }
  .rh-title { font-size: 13px; font-weight: 800; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .rh-ref { min-width: 130px; text-align: right; font-size: 8px; color: #555; line-height: 1.5; }
  .rh-ref .ref-no { font-weight: 700; color: #111; font-size: 9px; }
  .rmeta { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 22px; padding: 9px 2px 4px; font-size: 9.5px; }
  .rmeta b { display: inline-block; min-width: 96px; color: #333; }
  .rcount { text-align: right; font-size: 9.5px; font-weight: 700; padding: 0 2px 8px; color: #1f2d3d; }
  tr.cols th { background: #1f2d3d; color: #fff; font-size: 9.5px; font-weight: 700; padding: 6px 7px; border: 1px solid #1f2d3d; }
  tbody td { padding: 5px 7px; border: 1px solid #d5d9e0; font-size: 9.5px; vertical-align: top; word-break: break-word; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  tbody tr:nth-child(even) td { background: #f4f6f9; }
  .a-right { text-align: right; } .a-center { text-align: center; } .a-left { text-align: left; }
  tr.grp td { background: #e8edf3; font-weight: 800; font-size: 10px; }
  tr.sub td { background: #eef1f5; font-weight: 800; }
  tr.tot td { background: #1f2d3d; color: #fff; font-weight: 800; font-size: 10.5px; border-color: #1f2d3d; }
  tr.nf td { text-align: center; font-style: italic; color: #666; letter-spacing: 2px; background: #fff; padding: 6px; }
  .foot-inner { border-top: 1.5px solid #111; margin-top: 5px; padding-top: 4px; font-size: 8.5px; color: #444; display: flex; justify-content: space-between; }
  .sign { display: flex; justify-content: space-between; gap: 24px; margin-top: 34px; page-break-inside: avoid; }
  .sign .box { flex: 1; text-align: center; font-size: 9.5px; }
  .sign .who { color: #333; margin-bottom: 30px; }
  .sign .line { border-top: 1px solid #111; padding-top: 3px; font-weight: 700; }
  .sign .role { font-size: 8.5px; color: #555; }
  .wm { position: fixed; top: 40%; left: 8%; font-size: 130px; color: rgba(200,16,46,0.08); font-weight: 800; transform: rotate(-30deg); z-index: 0; pointer-events: none; }
</style></head>
<body>
  ${wm}
  <table class="rpt">
    <thead>
      <tr><td class="head-cell" colspan="${N}">
        <div class="rhead">
          <div class="rh-logo"><img src="${doc.logo || logoForCompany(doc.company)}" alt="Company logo"/></div>
          <div class="rh-center">
            <div class="rh-company">${esc(companyHeaderName(doc.company))}</div>
            <div class="rh-portal">${esc(PORTAL_NAME)}</div>
            <div class="rh-title">${esc(doc.title)}</div>
          </div>
          <div class="rh-ref">
            <div class="ref-no">Ref: ${esc(doc.reference)}</div>
            <div>Verification No.</div>
          </div>
        </div>
        <div class="rmeta">${metaHTML}</div>
        <div class="rcount">Transaction Count: ${doc.count}</div>
      </td></tr>
      <tr class="cols">${colHead}</tr>
    </thead>
    <tfoot>
      <tr><td class="foot-cell" colspan="${N}">
        <div class="foot-inner">
          <span>Generated from PCF Portal &middot; ${esc(PORTAL_NAME)}</span>
          <span>Printed on: ${esc(nowStamp())} &middot; Ref: ${esc(doc.reference)}</span>
        </div>
      </td></tr>
    </tfoot>
    <tbody>
      ${bodyRows}
      ${nf}
      ${totalRow}
    </tbody>
  </table>
  <div class="sign">
    <div class="box"><div class="who">Prepared by:</div><div class="line">${esc((doc.meta && doc.meta.Custodian) || "")}</div><div class="role">Custodian</div></div>
    <div class="box"><div class="who">Reviewed by:</div><div class="line">&nbsp;</div><div class="role">Accounting Manager</div></div>
    <div class="box"><div class="who">Approved by:</div><div class="line">&nbsp;</div><div class="role">Finance Director</div></div>
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print();},350);};window.onafterprint=function(){setTimeout(function(){window.close();},100);};</script>
</body></html>`;
}

/* Open the generated report in a new window and trigger the print / Save-as-PDF
   dialog. The same path serves both "Print" and "Save as PDF". */
function printReportDocument(doc) {
  const w = window.open("", "_blank", "width=1100,height=800");
  if (!w) { alert("Please allow pop-ups for this site to print or save the report as PDF."); return; }
  w.document.open();
  w.document.write(reportPrintHTML(doc));
  w.document.close();
  w.focus();
}

