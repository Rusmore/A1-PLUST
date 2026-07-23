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

/* ============================= LIQUIDATION AGING ============================= */

/* Calendar days after cash release that a liquidation is due. The aging engine
   is intentionally data-driven: it derives the plant list from live disbursement
   and fund (master data) records, so a newly created plant in Funds & Master
   Data automatically appears in the aging report, dashboard, charts and exports
   with no code change. */
const AGING_DUE_DAYS = 15;

/* Ordered aging buckets used for filtering and analytics. Fully settled
   vouchers are reported as "Completed" and excluded from the outstanding
   buckets below. */
const AGING_BUCKETS = ["Not Yet Due", "1-30 Days", "31-60 Days", "61-90 Days", "Over 90 Days"];

const daysBetween = (fromISO, toISO) => {
  const a = new Date((fromISO || todayISO()) + "T00:00:00").getTime();
  const b = new Date((toISO || todayISO()) + "T00:00:00").getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
};

const addDaysISO = (iso, days) => {
  const d = new Date((iso || todayISO()) + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

function agingBucketOf(overdueDays, isPastDue) {
  if (!isPastDue) return "Not Yet Due";
  if (overdueDays <= 30) return "1-30 Days";
  if (overdueDays <= 60) return "31-60 Days";
  if (overdueDays <= 90) return "61-90 Days";
  return "Over 90 Days";
}

/* Build one aging record per disbursement. Each record is tagged with its
   plant, company, custodian, outstanding amount, due date, overdue status and
   aging bucket. Plants are resolved from the funds master data so newly added
   plants are picked up automatically. */
function buildAgingRecords(disbursements, liquidations, funds, requests, today) {
  const t = today || todayISO();
  const fundByBranch = new Map((funds || []).map((f) => [f.branchCode, f]));
  const reqById = new Map((requests || []).map((r) => [r.id, r]));
  return (disbursements || []).map((d) => {
    const liq = liquidationFor(d.id, liquidations);
    const liquidated = liquidatedTotal(liq);
    const amount = Number(d.amount) || 0;
    const status = liqStatusFor(d, liquidations);
    const fullyLiquidated = status === "Fully Liquidated" || status === "Over-Liquidated";
    const outstanding = fullyLiquidated ? 0 : Math.max(0, amount - liquidated);
    const releaseDate = d.date || t;
    const dueDate = addDaysISO(releaseDate, AGING_DUE_DAYS);
    const dueDelta = daysBetween(dueDate, t); // >0 means past due
    const ageDays = Math.max(0, daysBetween(releaseDate, t));
    const overdueDays = Math.max(0, dueDelta);
    const isPastDue = !fullyLiquidated && dueDelta > 0;
    const isDueToday = !fullyLiquidated && dueDelta === 0;
    const isPending = !fullyLiquidated;
    const fund = fundByBranch.get(d.branchCode);
    const req = reqById.get(d.requestId);
    return {
      id: d.id, voucherNo: d.voucherNo, releaseDate, dueDate,
      employee: d.employee,
      requestor: (req && req.employee) || d.employee,
      department: d.department,
      branchCode: d.branchCode,
      plantLabel: (fund && fund.label) || plantLabel(d.branchCode) || d.branchCode,
      company: companyOfBranch(d.branchCode),
      custodian: (fund && fund.custodian) || "\u2014",
      amount, liquidated, outstanding, status, fullyLiquidated,
      ageDays, overdueDays, isPastDue, isDueToday, isPending,
      agingBucket: fullyLiquidated ? "Completed" : agingBucketOf(overdueDays, isPastDue),
      liqStatus: fullyLiquidated ? "Completed" : (isPastDue ? "Overdue" : (isDueToday ? "Due Today" : "Pending")),
      expenseCategory: d.expenseCategory || "",
    };
  });
}

/* Roll aging records up to one row per plant. Every fund/plant is seeded first
   so plants with no transactions yet still appear (compliance shown as 100%). */
function summarizeAgingByPlant(records, funds) {
  const map = new Map();
  const blank = (branchCode, plantLabelStr, company, custodian, beginning) => ({
    branchCode, plantLabel: plantLabelStr, company, custodian, beginning: beginning || 0,
    released: 0, liquidated: 0, outstanding: 0,
    pending: 0, dueToday: 0, overdue: 0, completed: 0, total: 0,
  });
  (funds || []).forEach((f) => {
    map.set(f.branchCode, blank(
      f.branchCode, f.label || plantLabel(f.branchCode) || f.branchCode,
      companyOfBranch(f.branchCode), f.custodian || "\u2014", Number(f.beginningBalance) || 0
    ));
  });
  records.forEach((r) => {
    let row = map.get(r.branchCode);
    if (!row) { row = blank(r.branchCode, r.plantLabel, r.company, r.custodian, 0); map.set(r.branchCode, row); }
    row.released += r.amount;
    row.liquidated += r.liquidated;
    row.outstanding += r.outstanding;
    row.total += 1;
    if (r.fullyLiquidated) row.completed += 1;
    else {
      row.pending += 1;
      if (r.isDueToday) row.dueToday += 1;
      if (r.isPastDue) row.overdue += 1;
    }
  });
  return Array.from(map.values())
    .map((row) => ({ ...row, compliance: row.total ? (row.completed / row.total) * 100 : 100 }))
    .sort((a, b) => b.outstanding - a.outstanding);
}

/* Trigger a browser download for an arbitrary text/binary payload (used for the
   CSV export; the Excel path reuses downloadWorkbook). */
function downloadTextFile(text, filename, mime) {
  const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* Consolidated, enterprise-wide Liquidation Aging monitoring across every
   company, plant and branch — with per-plant drill-down, filters, analytics
   charts and PDF / Excel / CSV exports. */
function LiquidationAgingTab({ funds, requests, disbursements, liquidations, replenishments }) {
  const today = todayISO();
  const [filters, setFilters] = useState({
    company: "ALL", plant: "ALL", branch: "ALL", custodian: "ALL",
    requestor: "ALL", department: "ALL", status: "ALL", bucket: "ALL",
    from: "", to: "",
  });
  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const resetFilters = () => setFilters({
    company: "ALL", plant: "ALL", branch: "ALL", custodian: "ALL",
    requestor: "ALL", department: "ALL", status: "ALL", bucket: "ALL", from: "", to: "",
  });

  /* Every voucher as an aging record — recomputed against today's date on each
     render, so the aging effectively "runs" every day the report is opened. */
  const allRecords = useMemo(
    () => buildAgingRecords(disbursements, liquidations, funds, requests, today),
    [disbursements, liquidations, funds, requests, today]
  );

  /* Option lists derived live from data + master data (auto-includes new plants). */
  const opts = useMemo(() => {
    const companies = new Set(), plants = new Map(), branches = new Set(),
      custodians = new Set(), requestors = new Set(), departments = new Set();
    (funds || []).forEach((f) => {
      plants.set(f.branchCode, f.label || plantLabel(f.branchCode) || f.branchCode);
      companies.add(companyOfBranch(f.branchCode));
      branches.add(f.branchCode);
      if (f.custodian) custodians.add(f.custodian);
    });
    allRecords.forEach((r) => {
      companies.add(r.company); plants.set(r.branchCode, r.plantLabel); branches.add(r.branchCode);
      if (r.custodian && r.custodian !== "\u2014") custodians.add(r.custodian);
      if (r.requestor) requestors.add(r.requestor);
      if (r.department) departments.add(r.department);
    });
    return {
      companies: Array.from(companies).sort(),
      plants: Array.from(plants.entries()).map(([code, label]) => ({ code, label })).sort((a, b) => a.label.localeCompare(b.label)),
      branches: Array.from(branches).sort(),
      custodians: Array.from(custodians).sort(),
      requestors: Array.from(requestors).sort(),
      departments: Array.from(departments).sort(),
    };
  }, [allRecords, funds]);

  const records = useMemo(() => allRecords.filter((r) => {
    if (filters.company !== "ALL" && r.company !== filters.company) return false;
    if (filters.plant !== "ALL" && r.branchCode !== filters.plant) return false;
    if (filters.branch !== "ALL" && r.branchCode !== filters.branch) return false;
    if (filters.custodian !== "ALL" && r.custodian !== filters.custodian) return false;
    if (filters.requestor !== "ALL" && r.requestor !== filters.requestor) return false;
    if (filters.department !== "ALL" && r.department !== filters.department) return false;
    if (filters.status !== "ALL" && r.liqStatus !== filters.status) return false;
    if (filters.bucket !== "ALL" && r.agingBucket !== filters.bucket) return false;
    if (filters.from && r.releaseDate < filters.from) return false;
    if (filters.to && r.releaseDate > filters.to) return false;
    return true;
  }), [allRecords, filters]);

  /* Only the funds within the current company/plant/branch filter feed the
     per-plant roll-up so beginning balances line up with the filtered records. */
  const scopedFunds = useMemo(() => (funds || []).filter((f) => {
    if (filters.company !== "ALL" && companyOfBranch(f.branchCode) !== filters.company) return false;
    if (filters.plant !== "ALL" && f.branchCode !== filters.plant) return false;
    if (filters.branch !== "ALL" && f.branchCode !== filters.branch) return false;
    if (filters.custodian !== "ALL" && f.custodian !== filters.custodian) return false;
    return true;
  }), [funds, filters]);

  const byPlant = useMemo(() => summarizeAgingByPlant(records, scopedFunds), [records, scopedFunds]);

  const cards = useMemo(() => {
    let released = 0, outstanding = 0, pending = 0, dueToday = 0, overdue = 0, completed = 0;
    records.forEach((r) => {
      released += r.amount; outstanding += r.outstanding;
      if (r.fullyLiquidated) completed += 1;
      else { pending += 1; if (r.isDueToday) dueToday += 1; if (r.isPastDue) overdue += 1; }
    });
    return { released, outstanding, pending, dueToday, overdue, completed };
  }, [records]);

  /* ---- Analytics datasets ---- */
  const overdueByPlant = useMemo(
    () => byPlant.filter((p) => p.overdue > 0).map((p) => ({ name: p.plantLabel, value: p.overdue })).sort((a, b) => b.value - a.value),
    [byPlant]
  );
  const complianceByPlant = useMemo(
    () => byPlant.map((p) => ({ name: p.plantLabel, value: Math.round(p.compliance * 10) / 10 })),
    [byPlant]
  );
  const outstandingByPlant = useMemo(
    () => byPlant.filter((p) => p.outstanding > 0).map((p) => ({ name: p.plantLabel, value: p.outstanding })),
    [byPlant]
  );
  const monthlyTrend = useMemo(() => {
    const map = new Map();
    records.forEach((r) => {
      const liq = liquidationFor(r.id, liquidations);
      if (!liq || !liq.lines) return;
      liq.lines.forEach((l) => {
        const month = (l.date || "").slice(0, 7);
        if (!month) return;
        map.set(month, (map.get(month) || 0) + (Number(l.amount) || 0));
      });
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([month, value]) => ({ month, value }));
  }, [records, liquidations]);
  const topPlantsOutstanding = useMemo(() => outstandingByPlant.slice(0, 10), [outstandingByPlant]);
  const topEmployeesOverdue = useMemo(() => {
    const map = new Map();
    records.forEach((r) => {
      if (!r.isPastDue) return;
      map.set(r.employee, (map.get(r.employee) || 0) + r.outstanding);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [records]);

  const detailRows = useMemo(
    () => [...records].sort((a, b) => (b.overdueDays - a.overdueDays) || (b.outstanding - a.outstanding)),
    [records]
  );

  /* ---- Exports ---- */
  const buildExportSheets = useCallback(() => {
    const plantRows = byPlant.map((p) => ({
      "Plant": p.plantLabel, "Company": p.company, "Custodian": p.custodian,
      "Beginning Balance": p.beginning, "Released": p.released, "Liquidated": p.liquidated,
      "Outstanding": p.outstanding, "Pending": p.pending, "Due Today": p.dueToday,
      "Overdue": p.overdue, "Completed": p.completed, "Compliance %": Math.round(p.compliance * 10) / 10,
    }));
    const detail = detailRows.map((r) => ({
      "Voucher No.": r.voucherNo, "Plant": r.plantLabel, "Company": r.company, "Branch": r.branchCode,
      "Custodian": r.custodian, "Requestor": r.requestor, "Employee": r.employee,
      "Department": deptDesc(r.department), "Release Date": r.releaseDate, "Due Date": r.dueDate,
      "Amount Released": r.amount, "Liquidated": r.liquidated, "Outstanding": r.outstanding,
      "Age (days)": r.ageDays, "Overdue (days)": r.overdueDays, "Aging Bucket": r.agingBucket,
      "Status": r.liqStatus,
    }));
    return { plantRows, detail };
  }, [byPlant, detailRows]);

  const exportExcel = useCallback(() => {
    const { plantRows, detail } = buildExportSheets();
    const wb = XLSX.utils.book_new();
    const summary = [
      { Metric: "Total Released Funds", Value: cards.released },
      { Metric: "Total Outstanding Amount", Value: cards.outstanding },
      { Metric: "Total Pending Liquidations", Value: cards.pending },
      { Metric: "Total Due Today", Value: cards.dueToday },
      { Metric: "Total Overdue Liquidations", Value: cards.overdue },
      { Metric: "Total Completed Liquidations", Value: cards.completed },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(plantRows.length ? plantRows : [{}]), "Aging by Plant");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail.length ? detail : [{}]), "Aging Detail");
    downloadWorkbook(wb, `Liquidation_Aging_Report_${today}.xlsx`);
  }, [buildExportSheets, cards, today]);

  const exportCsv = useCallback(() => {
    const { detail } = buildExportSheets();
    const ws = XLSX.utils.json_to_sheet(detail.length ? detail : [{}]);
    downloadTextFile(XLSX.utils.sheet_to_csv(ws), `Liquidation_Aging_Detail_${today}.csv`, "text/csv;charset=utf-8");
  }, [buildExportSheets, today]);

  const selectedPlant = filters.plant !== "ALL" ? (opts.plants.find((p) => p.code === filters.plant) || null) : null;
  const bucketBadge = (r) => {
    if (r.fullyLiquidated) return "green";
    if (r.isPastDue) return "red";
    if (r.isDueToday) return "amber";
    return "blue";
  };

  return (
    <div>
      <TopBar
        title="Liquidation Aging — All Plants"
        sub="Centralized, enterprise-wide liquidation aging across every company, plant and branch"
        right={
          <>
            <button className="pcp-btn" onClick={() => window.print()}><Printer size={14} /> Print / PDF</button>
            <button className="pcp-btn" onClick={exportCsv}><FileText size={14} /> CSV</button>
            <button className="pcp-btn pcp-btn-primary" onClick={exportExcel}><Download size={14} /> Excel</button>
          </>
        }
      />
      <div className="pcp-content">
        <div className="pcp-card pcp-card-pad" style={{ marginBottom: 16 }}>
          <div className="pcp-report-head">
            <img src={LOGO_A1} alt="A1+ Paper and Plastic Inc." />
            <img src={LOGO_SPI} alt="Starkson Paper and Plastic Corporation" />
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div className="pcp-report-title">Liquidation Aging Report</div>
              <div className="pcp-report-sub">
                Generated {fmtDate(today)} · Liquidation due {AGING_DUE_DAYS} days after release · {opts.plants.length} plant(s) monitored
              </div>
            </div>
          </div>
        </div>

        {/* ---- Filters ---- */}
        <div className="pcp-card pcp-card-pad pcp-no-print" style={{ marginBottom: 16 }}>
          <div className="pcp-section-title"><FilterIcon size={15} color="#c8102e" /> Filters</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Company</label>
              <select className="pcp-select" value={filters.company} onChange={(e) => setF("company", e.target.value)}>
                <option value="ALL">All Companies</option>
                {opts.companies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Plant</label>
              <select className="pcp-select" value={filters.plant} onChange={(e) => setF("plant", e.target.value)}>
                <option value="ALL">All Plants</option>
                {opts.plants.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
              </select>
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Branch</label>
              <select className="pcp-select" value={filters.branch} onChange={(e) => setF("branch", e.target.value)}>
                <option value="ALL">All Branches</option>
                {opts.branches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Custodian</label>
              <select className="pcp-select" value={filters.custodian} onChange={(e) => setF("custodian", e.target.value)}>
                <option value="ALL">All Custodians</option>
                {opts.custodians.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Requestor</label>
              <select className="pcp-select" value={filters.requestor} onChange={(e) => setF("requestor", e.target.value)}>
                <option value="ALL">All Requestors</option>
                {opts.requestors.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Department</label>
              <select className="pcp-select" value={filters.department} onChange={(e) => setF("department", e.target.value)}>
                <option value="ALL">All Departments</option>
                {opts.departments.map((c) => <option key={c} value={c}>{deptDesc(c) || c}</option>)}
              </select>
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Status</label>
              <select className="pcp-select" value={filters.status} onChange={(e) => setF("status", e.target.value)}>
                <option value="ALL">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Due Today">Due Today</option>
                <option value="Overdue">Overdue</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Aging Bucket</label>
              <select className="pcp-select" value={filters.bucket} onChange={(e) => setF("bucket", e.target.value)}>
                <option value="ALL">All Buckets</option>
                {AGING_BUCKETS.map((b) => <option key={b} value={b}>{b}</option>)}
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Released From</label>
              <input type="date" className="pcp-input" value={filters.from} onChange={(e) => setF("from", e.target.value)} />
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Released To</label>
              <input type="date" className="pcp-input" value={filters.to} onChange={(e) => setF("to", e.target.value)} />
            </div>
            <div className="pcp-field" style={{ margin: 0, display: "flex", alignItems: "flex-end" }}>
              <button className="pcp-btn" style={{ width: "100%", justifyContent: "center" }} onClick={resetFilters}>
                <RefreshCw size={14} /> Reset
              </button>
            </div>
          </div>
        </div>

        {/* ---- Consolidated dashboard cards ---- */}
        <div className="pcp-kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <KpiCard label="Total Released Funds" value={peso(cards.released)} icon={ArrowUpRight} tint="#2054a3" foot="Cash released across all plants" />
          <KpiCard label="Total Pending Liquidations" value={cards.pending} icon={FileSpreadsheet} tint="#b9790a" foot="Vouchers not yet fully liquidated" />
          <KpiCard label="Total Due Today" value={cards.dueToday} icon={Clock} tint="#0891b2" foot="Liquidations due today" />
          <KpiCard label="Total Overdue Liquidations" value={cards.overdue} icon={AlertTriangle} tint="#c8102e" foot={`Past ${AGING_DUE_DAYS}-day due date`} />
          <KpiCard label="Total Completed Liquidations" value={cards.completed} icon={Check} tint="#15803d" foot="Fully liquidated vouchers" />
          <KpiCard label="Total Outstanding Amount" value={peso(cards.outstanding)} icon={CircleDollarSign} tint={cards.outstanding > 0 ? "#c8102e" : "#15803d"} foot="Unliquidated balance" />
        </div>

        {/* ---- Aging by plant (drill-down) ---- */}
        <div className="pcp-card" style={{ marginBottom: 16 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span><Building2 size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Aging by Plant ({byPlant.length})</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-mut)" }}>Click a plant to drill down into its transactions</span>
          </div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead>
                <tr>
                  <th>Plant</th><th>Beginning</th><th>Released</th><th>Liquidated</th><th>Outstanding</th>
                  <th>Pending</th><th>Due Today</th><th>Overdue</th><th>Compliance</th>
                </tr>
              </thead>
              <tbody>
                {byPlant.length ? byPlant.map((p) => (
                  <tr key={p.branchCode} style={{ cursor: "pointer", background: filters.plant === p.branchCode ? "var(--red-bg)" : undefined }}
                    onClick={() => setF("plant", filters.plant === p.branchCode ? "ALL" : p.branchCode)}>
                    <td style={{ fontWeight: 600 }}>
                      {p.plantLabel}
                      <div style={{ fontSize: 11, color: "var(--text-mut)", fontWeight: 400 }}>{p.company}</div>
                    </td>
                    <td className="pcp-num">{peso(p.beginning)}</td>
                    <td className="pcp-num">{peso(p.released)}</td>
                    <td className="pcp-num">{peso(p.liquidated)}</td>
                    <td className="pcp-num" style={{ fontWeight: 700, color: p.outstanding > 0 ? "var(--brand)" : "inherit" }}>{peso(p.outstanding)}</td>
                    <td className="pcp-num">{p.pending}</td>
                    <td className="pcp-num">{p.dueToday ? <span className="pcp-badge pcp-badge-amber">{p.dueToday}</span> : 0}</td>
                    <td className="pcp-num">{p.overdue ? <span className="pcp-badge pcp-badge-red">{p.overdue}</span> : 0}</td>
                    <td className="pcp-num" style={{ fontWeight: 700, color: p.compliance >= 80 ? "var(--green)" : (p.compliance >= 50 ? "var(--amber)" : "var(--brand)") }}>
                      {p.compliance.toFixed(1)}%
                    </td>
                  </tr>
                )) : <tr><td colSpan={9} className="pcp-empty">No plants configured</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- Analytics ---- */}
        <div className="pcp-grid-2" style={{ marginBottom: 16 }}>
          <div className="pcp-card pcp-card-pad">
            <div className="pcp-section-title"><AlertTriangle size={15} color="#c8102e" /> Overdue Liquidations by Plant</div>
            <MiniBarChart data={overdueByPlant} />
          </div>
          <div className="pcp-card pcp-card-pad">
            <div className="pcp-section-title"><ShieldCheck size={15} color="#15803d" /> Liquidation Compliance by Plant (%)</div>
            {complianceByPlant.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={complianceByPlant} layout="vertical" margin={{ left: 8, right: 18, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical />
                  <XAxis type="number" domain={[0, 100]} fontSize={10.5} stroke="#9098b3" />
                  <YAxis type="category" dataKey="name" width={120} fontSize={10.5} stroke="#9098b3" />
                  <Tooltip formatter={(v) => v + "%"} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e3e5ea" }} />
                  <Bar dataKey="value" fill="#15803d" radius={[4, 4, 4, 4]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="pcp-empty">No data yet</div>}
          </div>
        </div>

        <div className="pcp-grid-2" style={{ marginBottom: 16 }}>
          <div className="pcp-card pcp-card-pad">
            <div className="pcp-section-title"><CircleDollarSign size={15} color="#c8102e" /> Outstanding Amount by Plant</div>
            <MiniBarChart data={outstandingByPlant} />
          </div>
          <div className="pcp-card pcp-card-pad">
            <div className="pcp-section-title"><TrendingUp size={15} color="#c8102e" /> Monthly Liquidation Trend</div>
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
        </div>

        <div className="pcp-grid-2" style={{ marginBottom: 16 }}>
          <div className="pcp-card pcp-card-pad">
            <div className="pcp-section-title"><Building2 size={15} color="#c8102e" /> Top 10 Plants — Highest Outstanding</div>
            <MiniBarChart data={topPlantsOutstanding} />
          </div>
          <div className="pcp-card pcp-card-pad">
            <div className="pcp-section-title"><Users size={15} color="#c8102e" /> Top 10 Employees — Overdue Liquidations</div>
            <MiniBarChart data={topEmployeesOverdue} />
          </div>
        </div>

        {/* ---- Detail transactions ---- */}
        <div className="pcp-card">
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", fontWeight: 700, fontSize: 13 }}>
            {selectedPlant ? `${selectedPlant.label} \u2014 ` : ""}Aging Detail ({detailRows.length})
          </div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead>
                <tr>
                  <th>Voucher No.</th><th>Plant</th><th>Requestor</th><th>Department</th>
                  <th>Release Date</th><th>Due Date</th><th>Released</th><th>Outstanding</th>
                  <th>Age</th><th>Overdue</th><th>Bucket</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.length ? detailRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.voucherNo}</td>
                    <td>{r.plantLabel}</td>
                    <td>{r.requestor}</td>
                    <td>{deptDesc(r.department) || "\u2014"}</td>
                    <td>{fmtDate(r.releaseDate)}</td>
                    <td>{fmtDate(r.dueDate)}</td>
                    <td className="pcp-num">{peso(r.amount)}</td>
                    <td className="pcp-num" style={{ fontWeight: 700, color: r.outstanding > 0 ? "var(--brand)" : "inherit" }}>{peso(r.outstanding)}</td>
                    <td className="pcp-num">{r.ageDays}d</td>
                    <td className="pcp-num" style={{ color: r.overdueDays > 0 ? "var(--brand)" : "var(--text-mut)" }}>{r.overdueDays > 0 ? r.overdueDays + "d" : "\u2014"}</td>
                    <td><span className={"pcp-badge pcp-badge-" + bucketBadge(r)}>{r.agingBucket}</span></td>
                    <td><span className={"pcp-badge pcp-badge-" + bucketBadge(r)}>{r.liqStatus}</span></td>
                  </tr>
                )) : <tr><td colSpan={12} className="pcp-empty">No transactions match the selected filters</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Report Center — a professional, print-ready reporting suite. A single report
   engine (buildReport) drives 15 report types with shared filters and a paper
   preview that mirrors the A4 print / PDF output exactly. */
