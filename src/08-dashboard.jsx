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

/* Per-plant tab bar shown at the top of each module so users with more than one
   plant (Accounting, Finance, Pura Barloso) can view a single plant at a time —
   effectively a separate module per plant. Hidden when only one plant applies. */
function PlantScopeTabs({ plants, value, onChange }) {
  if (!plants || plants.length <= 1) return null;
  return (
    <div className="pcp-tabs" style={{ marginBottom: 14 }}>
      <button className={"pcp-tab" + (value === "ALL" ? " active" : "")} onClick={() => onChange("ALL")}>All Plants</button>
      {plants.map((p) => (
        <button key={p.code} className={"pcp-tab" + (value === p.code ? " active" : "")} onClick={() => onChange(p.code)}>{p.label}</button>
      ))}
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

function MiniBarChart({ data, height = 220, layout = "vertical", onSelect }) {
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
        <Bar dataKey="value" fill="#c8102e" radius={[4, 4, 4, 4]} maxBarSize={22}
          cursor={onSelect ? "pointer" : undefined}
          onClick={onSelect ? (d) => onSelect(pickName(d)) : undefined} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const DASHBOARD_BRANCHES = [
  { key: "MNL", label: "Manila", branchCode: "A1+" },
  { key: "WARNER", label: "Warner", branchCode: "WARNER" },
  { key: "DISNEY", label: "Disney", branchCode: "D1" },
  { key: "RG", label: "RG and Co.", branchCode: "RG" },
];

/* ---- Drill-down support -------------------------------------------------
   Every dashboard chart is clickable. Clicking a bar / slice / legend / point
   opens a slide-in panel listing the underlying transactions with search,
   filters, sorting, pagination, receipt viewing and Excel/CSV/PDF/Print export
   (the export reuses the professional report engine). Records are enriched
   once from the live data and paginated, so thousands of rows stay responsive. */

/* Extract the clicked category name from the various Recharts click payloads
   (bar datum, pie sector, or legend entry). */
function pickName(d) {
  if (!d) return null;
  if (d.name != null) return d.name;
  if (typeof d.value === "string") return d.value;
  if (d.payload) {
    if (d.payload.name != null) return d.payload.name;
    if (d.payload.payload && d.payload.payload.name != null) return d.payload.payload.name;
  }
  return null;
}

/* Flatten a disbursement (+ its request and liquidation) into one row that the
   drill-down table, detail card and exporter can all read from. */
function enrichDisbursement(d, requests, liquidations) {
  const req = requests.find((r) => r.id === d.requestId);
  const liq = liquidationFor(d.id, liquidations);
  const amtLiq = liquidatedTotal(liq);
  const amount = Number(d.amount) || 0;
  return {
    id: d.id, _date: d.date, date: fmtDate(d.date),
    dateRequested: req ? fmtDate(req.date) : "—",
    liqDate: liq ? fmtDate(liq.createdDate) : "—",
    requestNo: req ? req.requestNo : "—", voucherNo: d.voucherNo,
    company: companyOfBranch(d.branchCode), branch: d.branchCode,
    department: deptDesc(d.department), requestor: d.employee, payee: d.employee,
    purpose: req ? req.purpose : "—", expenseCategory: d.expenseCategory || "—",
    amountRequested: req ? (Number(req.amount) || 0) : amount,
    amount, amountLiquidated: amtLiq, remaining: amount - amtLiq,
    status: liqStatusFor(d, liquidations), liqRef: liq ? liq.id : "—",
    _receipts: (liq && liq.attachments) ? liq.attachments : [],
    _req: req, _liq: liq,
  };
}

/* Flatten a single liquidation line (for the "liquidated expense" drill-downs). */
function enrichLine(line, d, liq, req) {
  const desc = (line.expense && line.expense.trim()) ? line.expense.trim() : line.category;
  return {
    id: line.id, _date: line.date, date: fmtDate(line.date),
    branch: d.branchCode, company: companyOfBranch(d.branchCode),
    department: deptDesc(line.department || d.department), description: desc,
    amount: Number(line.amount) || 0, liqRef: liq ? liq.id : "—",
    requestor: d.employee, payee: d.employee, voucherNo: d.voucherNo,
    requestNo: req ? req.requestNo : "—", purpose: req ? req.purpose : "—",
    expenseCategory: line.category, status: "Liquidated",
    _receipts: (liq && liq.attachments) ? liq.attachments : [],
    _req: req, _liq: liq,
  };
}

const DRILL_COLS_DISB = [
  { key: "date", label: "Date", sortable: true },
  { key: "requestNo", label: "Request No.", sortable: true },
  { key: "voucherNo", label: "Voucher No.", sortable: true },
  { key: "company", label: "Company", sortable: true },
  { key: "branch", label: "Branch", sortable: true },
  { key: "department", label: "Department", sortable: true },
  { key: "expenseCategory", label: "Expense Category", sortable: true },
  { key: "payee", label: "Payee", sortable: true },
  { key: "amount", label: "Amount", money: true, align: "right", sortable: true },
  { key: "status", label: "Liquidation Status", badge: true, align: "center", sortable: true },
];

const DRILL_COLS_LIQSTATUS = [
  { key: "requestNo", label: "Request No.", sortable: true },
  { key: "dateRequested", label: "Date Requested", sortable: true },
  { key: "liqDate", label: "Liquidation Date", sortable: true },
  { key: "company", label: "Company", sortable: true },
  { key: "branch", label: "Branch", sortable: true },
  { key: "department", label: "Department", sortable: true },
  { key: "requestor", label: "Requestor", sortable: true },
  { key: "payee", label: "Payee", sortable: true },
  { key: "amountRequested", label: "Amt Requested", money: true, align: "right", sortable: true },
  { key: "amountLiquidated", label: "Amt Liquidated", money: true, align: "right", sortable: true },
  { key: "remaining", label: "Remaining", money: true, align: "right", sortable: true },
  { key: "status", label: "Status", badge: true, align: "center", sortable: true },
];

const DRILL_COLS_EXPLIQ = [
  { key: "date", label: "Date", sortable: true },
  { key: "branch", label: "Branch", sortable: true },
  { key: "company", label: "Company", sortable: true },
  { key: "department", label: "Department", sortable: true },
  { key: "description", label: "Description" },
  { key: "amount", label: "Amount", money: true, align: "right", sortable: true },
  { key: "liqRef", label: "Liquidation Ref" },
  { key: "receipt", label: "Receipt", align: "center" },
  { key: "requestor", label: "Requestor", sortable: true },
];

const DRILL_PAGE_SIZES = [10, 25, 50, 100];

function drillSortValue(row, key) {
  if (key === "date") return row._date || "";
  if (key === "dateRequested") return (row._req && row._req.date) || "";
  if (key === "liqDate") return (row._liq && row._liq.createdDate) || "";
  const v = row[key];
  return v == null ? "" : v;
}

function DrillReceipts({ items }) {
  if (!items || !items.length) return <span style={{ color: "var(--text-mut)", fontSize: 12 }}>No receipts attached.</span>;
  return (
    <div className="pcp-receipts">
      {items.map((a) => {
        const isImg = (a.type || "").startsWith("image/") && a.data;
        return (
          <a key={a.id} className="pcp-receipt" href={a.data || "#"} target="_blank" rel="noopener noreferrer" title={a.name}>
            {isImg ? <img src={a.data} alt={a.name} /> : <div className="fileicon"><Receipt size={22} color="#9098b3" /></div>}
            <span>{a.name}</span>
          </a>
        );
      })}
    </div>
  );
}

function DrillDownModal({ chartName, label, columns, records, canEdit, onEditRecord, onClose }) {
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fBranch, setFBranch] = useState("ALL");
  const [fCompany, setFCompany] = useState("ALL");
  const [fDept, setFDept] = useState("ALL");
  const [fStatus, setFStatus] = useState("ALL");
  const [sortKey, setSortKey] = useState(columns[0].key);
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [expanded, setExpanded] = useState(null);
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => { setClosing(true); setTimeout(onClose, 190); }, [onClose]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const opts = useMemo(() => {
    const uniq = (fn) => Array.from(new Set(records.map(fn).filter(Boolean))).sort();
    return { branches: uniq((r) => r.branch), companies: uniq((r) => r.company), departments: uniq((r) => r.department), statuses: uniq((r) => r.status) };
  }, [records]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return records.filter((r) => {
      if (from && (r._date || "") < from) return false;
      if (to && (r._date || "") > to) return false;
      if (fBranch !== "ALL" && r.branch !== fBranch) return false;
      if (fCompany !== "ALL" && r.company !== fCompany) return false;
      if (fDept !== "ALL" && r.department !== fDept) return false;
      if (fStatus !== "ALL" && r.status !== fStatus) return false;
      if (needle) {
        const hay = [r.requestNo, r.voucherNo, r.requestor, r.payee, r.purpose, r.description, r.expenseCategory, r.branch, r.company, r.department]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [records, q, from, to, fBranch, fCompany, fDept, fStatus]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey) || {};
    return [...filtered].sort((a, b) => {
      let va = drillSortValue(a, sortKey), vb = drillSortValue(b, sortKey);
      if (col.money) { va = Number(va) || 0; vb = Number(vb) || 0; return sortDir === "asc" ? va - vb : vb - va; }
      va = String(va); vb = String(vb);
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [filtered, sortKey, sortDir, columns]);

  useEffect(() => { setPage(0); }, [q, from, to, fBranch, fCompany, fDept, fStatus, sortKey, sortDir, pageSize]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = page * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);
  const sumAmount = useMemo(() => filtered.reduce((s, r) => s + (Number(r.amount) || 0), 0), [filtered]);

  const setSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const buildDoc = () => {
    const docCols = columns.filter((c) => c.key !== "receipt").map((c) => ({ key: c.key, label: c.label, align: c.align || (c.money ? "right" : "left"), money: !!c.money }));
    let hasMoney = false;
    const totalsRow = { _total: true };
    docCols.forEach((col) => { if (col.money) { hasMoney = true; totalsRow[col.key] = sorted.reduce((s, r) => s + (Number(r[col.key]) || 0), 0); } });
    totalsRow[docCols[0].key] = "GRAND TOTAL";
    return {
      title: chartName + " — " + label, orientation: docCols.length > 7 ? "landscape" : "portrait",
      columns: docCols, rows: sorted, totalsRow: hasMoney ? totalsRow : null, count: total,
      meta: { "Report": chartName, "Data Point": label, "Records": String(total), "Generated By": "Dashboard Drill-Down", "Date Generated": nowStamp() },
      reference: makeReportRef("DRILL"), watermark: false,
    };
  };

  const align = (a) => ({ textAlign: a === "right" ? "right" : a === "center" ? "center" : "left" });
  const cellContent = (r, col) => {
    if (col.key === "receipt") {
      const n = (r._receipts || []).length;
      return n
        ? <span className="pcp-receipt-link" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>{n} file{n > 1 ? "s" : ""}</span>
        : <span style={{ color: "#9098b3" }}>—</span>;
    }
    if (col.badge) return <Badge status={r[col.key]} />;
    if (col.money) return <span className="pcp-num">{money(r[col.key])}</span>;
    const v = r[col.key];
    return (v == null || v === "") ? "—" : v;
  };

  return (
    <div className={"pcp-drill-backdrop" + (closing ? " closing" : "")} onClick={close}>
      <div className={"pcp-drill" + (closing ? " closing" : "")} onClick={(e) => e.stopPropagation()}>
        <div className="pcp-drill-head">
          <div className="pcp-breadcrumb">
            <span className="crumb link" onClick={close}><LayoutDashboard size={12} /> Dashboard</span>
            <ChevronRight size={12} />
            <span className="crumb"><b>{chartName}</b></span>
            <ChevronRight size={12} />
            <span className="crumb">{label} · Transactions</span>
          </div>
          <div className="pcp-drill-title">
            {chartName} <span className="pill">{label}</span>
            <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" style={{ marginLeft: "auto" }} onClick={close}><X size={16} /></button>
          </div>
        </div>
        <div className="pcp-drill-body">
          <div className="pcp-drill-toolbar">
            <div className="pcp-drill-search">
              <Search size={14} />
              <input placeholder="Search transactions…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className="pcp-btn pcp-btn-sm" onClick={() => exportReportExcel(buildDoc())}><FileSpreadsheet size={13} /> Excel</button>
            <button className="pcp-btn pcp-btn-sm" onClick={() => exportReportCsv(buildDoc())}><Download size={13} /> CSV</button>
            <button className="pcp-btn pcp-btn-sm" onClick={() => printReportDocument(buildDoc())}><FileText size={13} /> PDF</button>
            <button className="pcp-btn pcp-btn-sm" onClick={() => printReportDocument(buildDoc())}><Printer size={13} /> Print</button>
          </div>
          <div className="pcp-drill-filters">
            <div className="pcp-rc-field"><label>From</label><input type="date" className="pcp-input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="pcp-rc-field"><label>To</label><input type="date" className="pcp-input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div className="pcp-rc-field"><label>Company</label><select className="pcp-select" value={fCompany} onChange={(e) => setFCompany(e.target.value)}><option value="ALL">All</option>{opts.companies.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div className="pcp-rc-field"><label>Branch</label><select className="pcp-select" value={fBranch} onChange={(e) => setFBranch(e.target.value)}><option value="ALL">All</option>{opts.branches.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div className="pcp-rc-field"><label>Department</label><select className="pcp-select" value={fDept} onChange={(e) => setFDept(e.target.value)}><option value="ALL">All</option>{opts.departments.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div className="pcp-rc-field"><label>Status</label><select className="pcp-select" value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="ALL">All</option>{opts.statuses.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div className="pcp-drill-count" style={{ marginBottom: 8 }}>{total} transaction{total !== 1 ? "s" : ""} · Total {money(sumAmount)}</div>
          <div className="pcp-card">
            <div className="pcp-table-wrap">
              <table className="pcp-table">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key} className={col.sortable ? "pcp-sortable" : ""} style={align(col.align)} onClick={col.sortable ? () => setSort(col.key) : undefined}>
                        {col.label}{col.sortable && sortKey === col.key ? <span className="pcp-sort-ind">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span> : null}
                      </th>
                    ))}
                    <th style={{ textAlign: "right" }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length ? pageRows.map((r) => (
                    <React.Fragment key={r.id}>
                      <tr>
                        {columns.map((col) => <td key={col.key} style={align(col.align)}>{cellContent(r, col)}</td>)}
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>{expanded === r.id ? "Hide" : "View"}</button>
                        </td>
                      </tr>
                      {expanded === r.id && (
                        <tr>
                          <td colSpan={columns.length + 1} style={{ background: "#fafbfd" }}>
                            <div className="pcp-detail-card">
                              <div className="pcp-detail-grid">
                                <div><div className="lbl">Request No.</div>{r.requestNo || "—"}</div>
                                <div><div className="lbl">Voucher No.</div>{r.voucherNo || "—"}</div>
                                <div><div className="lbl">Status</div><Badge status={r.status} /></div>
                                <div><div className="lbl">Date Requested</div>{r.dateRequested || r.date}</div>
                                <div><div className="lbl">Liquidation Date</div>{r.liqDate || "—"}</div>
                                <div><div className="lbl">Company</div>{r.company}</div>
                                <div><div className="lbl">Branch</div>{r.branch}</div>
                                <div><div className="lbl">Department</div>{r.department}</div>
                                <div><div className="lbl">Expense Category</div>{r.expenseCategory || "—"}</div>
                                <div><div className="lbl">Requestor</div>{r.requestor || "—"}</div>
                                <div><div className="lbl">Payee</div>{r.payee || "—"}</div>
                                <div><div className="lbl">Purpose / Description</div>{r.purpose || r.description || "—"}</div>
                                <div><div className="lbl">Amount Requested</div>{money(r.amountRequested != null ? r.amountRequested : r.amount)}</div>
                                <div><div className="lbl">Amount Liquidated</div>{money(r.amountLiquidated || 0)}</div>
                                <div><div className="lbl">Remaining Balance</div>{money(r.remaining != null ? r.remaining : 0)}</div>
                              </div>
                              <div style={{ marginTop: 12, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px", color: "var(--text-mut)" }}>Attached Receipts / Documents</div>
                              <DrillReceipts items={r._receipts} />
                              {canEdit && onEditRecord && (
                                <div style={{ marginTop: 12 }}>
                                  <button className="pcp-btn pcp-btn-sm" onClick={() => onEditRecord(r)}><Edit3 size={13} /> Edit in Release Ledger</button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )) : <tr><td colSpan={columns.length + 1} className="pcp-empty">No matching transactions.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="pcp-pager">
            <span>Rows:</span>
            <select className="pcp-select" style={{ width: 72 }} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              {DRILL_PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>{total ? start + 1 : 0}–{Math.min(start + pageSize, total)} of {total}</span>
            <button className="pcp-btn pcp-btn-sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</button>
            <span>Page {page + 1} / {pageCount}</span>
            <button className="pcp-btn pcp-btn-sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>Next</button>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="pcp-btn" onClick={close}><ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Dashboard</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ funds, requests, disbursements, liquidations, replenishments, onNavigate, canEdit }) {
  const [drill, setDrill] = useState(null);
  const openDrill = (chartName, label) => { if (label == null || label === "") return; setDrill({ chartName, label: String(label) }); };
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

  /* Records behind the currently opened chart data point — computed lazily
     (only when a drill is open) so the dashboard itself never re-renders the
     full transaction list. */
  const drillData = useMemo(() => {
    if (!drill) return null;
    const { chartName, label } = drill;
    const enrich = (d) => enrichDisbursement(d, requests, liquidations);
    if (chartName === "Liquidation Status")
      return { columns: DRILL_COLS_LIQSTATUS, records: disbursements.filter((d) => liqStatusFor(d, liquidations) === label).map(enrich) };
    if (chartName === "Disbursements by Branch")
      return { columns: DRILL_COLS_DISB, records: disbursements.filter((d) => d.branchCode === label).map(enrich) };
    if (chartName === "Disbursements by Company")
      return { columns: DRILL_COLS_DISB, records: disbursements.filter((d) => companyOfBranch(d.branchCode) === label).map(enrich) };
    if (chartName === "Disbursements by Department")
      return { columns: DRILL_COLS_DISB, records: disbursements.filter((d) => deptDesc(d.department) === label).map(enrich) };
    if (chartName === "Disbursements by Expense Category")
      return { columns: DRILL_COLS_DISB, records: disbursements.filter((d) => (d.expenseCategory || "Unassigned") === label).map(enrich) };
    if (chartName === "Top Expense Categories (Liquidated)" || chartName === "Monthly Expense Trend") {
      const recs = [];
      disbursements.forEach((d) => {
        const liq = liquidationFor(d.id, liquidations);
        if (!liq || !liq.lines) return;
        const req = requests.find((r) => r.id === d.requestId);
        liq.lines.forEach((line) => {
          if (chartName === "Top Expense Categories (Liquidated)" && line.category !== label) return;
          if (chartName === "Monthly Expense Trend" && (line.date || "").slice(0, 7) !== label) return;
          recs.push(enrichLine(line, d, liq, req));
        });
      });
      return { columns: DRILL_COLS_EXPLIQ, records: recs };
    }
    return null;
  }, [drill, disbursements, requests, liquidations]);

  return (
    <div>
      <div className="pcp-flow">
        <div className="pcp-flow-step pcp-flow-click" onClick={() => onNavigate && onNavigate("masterdata")}>
          <div className="pcp-flow-label">Total Fund (Beginning Balance)</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalFund)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step pcp-flow-click" onClick={() => onNavigate && onNavigate("disbursements")}>
          <div className="pcp-flow-label">Total Disbursed</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalDisbursed)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step pcp-flow-click" onClick={() => onNavigate && onNavigate("liquidation")}>
          <div className="pcp-flow-label">Total Liquidated</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalLiquidated)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step pcp-flow-click" onClick={() => onNavigate && onNavigate("masterdata")}>
          <div className="pcp-flow-label">Available Balance</div>
          <div className="pcp-flow-value pcp-num" style={{ color: m.availableBalance < 0 ? "#ff8080" : "#8fffb0" }}>
            {peso(m.availableBalance)}
          </div>
        </div>
      </div>

      <div className="pcp-kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <KpiCard label="Current Petty Cash Balance" value={peso(m.availableBalance)} icon={CircleDollarSign}
          tint={m.availableBalance < 0 ? "#c8102e" : "#15803d"}
          foot={m.availableBalance < 0 ? "Over committed — replenish soon" : "Cash on hand across custodians"}
          onClick={onNavigate ? () => onNavigate("masterdata") : undefined} />
        <KpiCard label="Pending Requests" value={m.pendingRequests} icon={ClipboardList} tint="#b9790a" foot="Awaiting approval" onClick={onNavigate ? () => onNavigate("requests") : undefined} />
        <KpiCard label="Approved Requests" value={m.approvedRequests} icon={Check} tint="#2054a3" foot="Ready for release" onClick={onNavigate ? () => onNavigate("requests") : undefined} />
        <KpiCard label="Pending Liquidations" value={m.pendingLiquidationCount} icon={FileSpreadsheet} tint="#2054a3" foot="Vouchers not fully liquidated" onClick={onNavigate ? () => onNavigate("liquidation") : undefined} />
        <KpiCard label="Pending Replenishments" value={m.pendingReplenishments} icon={RefreshCw} tint="#b9790a" foot="Awaiting completion" onClick={onNavigate ? () => onNavigate("replenishment") : undefined} />
        <KpiCard label="Monthly Expenses" value={peso(m.monthlyExpenses)} icon={TrendingUp} tint="#c8102e" foot="Liquidated this month" onClick={onNavigate ? () => onNavigate("history") : undefined} />
        <KpiCard label="Active Petty Cash Funds" value={funds.length + " Funds"} icon={PiggyBank} tint="#7c3aed" foot="Across all plants" onClick={onNavigate ? () => onNavigate("masterdata") : undefined} />
        <KpiCard label="Total Disbursed" value={peso(m.totalDisbursed)} icon={ArrowUpRight} tint="#b9790a" foot="Released to date" onClick={onNavigate ? () => onNavigate("disbursements") : undefined} />
        <KpiCard label="Employees w/ Active Advances" value={m.activeEmployeeCount} icon={Users} tint="#15803d" onClick={onNavigate ? () => onNavigate("history") : undefined} />
      </div>

      <div className="pcp-grid-2" style={{ marginBottom: 16 }}>
        <div className="pcp-card pcp-card-pad pcp-chart-click" title="Click to view detailed transactions.">
          <div className="pcp-section-title"><TrendingUp size={15} color="#c8102e" /> Monthly Expense Trend</div>
          {monthlyTrend.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyTrend} margin={{ left: 8, right: 18, top: 4, bottom: 4 }} style={{ cursor: "pointer" }}
                onClick={(e) => e && e.activeLabel && openDrill("Monthly Expense Trend", e.activeLabel)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                <XAxis dataKey="month" fontSize={10.5} stroke="#9098b3" />
                <YAxis tickFormatter={shortPeso} fontSize={10.5} stroke="#9098b3" />
                <Tooltip formatter={(v) => peso(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e3e5ea" }} />
                <Line type="monotone" dataKey="value" stroke="#c8102e" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="pcp-empty">No liquidated expenses recorded yet</div>}
          <div className="pcp-chart-hint">Click a month to view its transactions.</div>
        </div>
        <div className="pcp-card pcp-card-pad pcp-chart-click" title="Click to view detailed transactions.">
          <div className="pcp-section-title"><FileSpreadsheet size={15} color="#c8102e" /> Liquidation Status</div>
          {liqStatusCounts.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={liqStatusCounts} dataKey="value" nameKey="name" innerRadius={45} outerRadius={78} paddingAngle={2}
                  cursor="pointer" onClick={(s) => openDrill("Liquidation Status", pickName(s))}>
                  {liqStatusCounts.map((entry, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} cursor="pointer" />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11, cursor: "pointer" }} onClick={(e) => openDrill("Liquidation Status", e && e.value)} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e3e5ea" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="pcp-empty">No vouchers yet</div>}
          <div className="pcp-chart-hint">Click a slice or legend to view transactions.</div>
        </div>
      </div>

      <div className="pcp-grid-3" style={{ marginBottom: 16 }}>
        <div className="pcp-card pcp-card-pad pcp-chart-click" title="Click to view detailed transactions.">
          <div className="pcp-section-title">Disbursements by Branch</div>
          <MiniBarChart data={byBranch} onSelect={(name) => openDrill("Disbursements by Branch", name)} />
          <div className="pcp-chart-hint">Click a bar to view its transactions.</div>
        </div>
        <div className="pcp-card pcp-card-pad pcp-chart-click" title="Click to view detailed transactions.">
          <div className="pcp-section-title">Disbursements by Company</div>
          <MiniBarChart data={byCompany} onSelect={(name) => openDrill("Disbursements by Company", name)} />
          <div className="pcp-chart-hint">Click a bar to view its transactions.</div>
        </div>
        <div className="pcp-card pcp-card-pad pcp-chart-click" title="Click to view detailed transactions.">
          <div className="pcp-section-title">Disbursements by Department</div>
          <MiniBarChart data={byDept} onSelect={(name) => openDrill("Disbursements by Department", name)} />
          <div className="pcp-chart-hint">Click a bar to view its transactions.</div>
        </div>
      </div>

      <div className="pcp-grid-2" style={{ marginBottom: 16 }}>
        <div className="pcp-card pcp-card-pad pcp-chart-click" title="Click to view detailed transactions.">
          <div className="pcp-section-title">Top Expense Categories (Liquidated)</div>
          <MiniBarChart data={topCategories} onSelect={(name) => openDrill("Top Expense Categories (Liquidated)", name)} />
          <div className="pcp-chart-hint">Click a bar to view liquidated receipts.</div>
        </div>
        <div className="pcp-card pcp-card-pad pcp-chart-click" title="Click to view detailed transactions.">
          <div className="pcp-section-title">Disbursements by Expense Category</div>
          <MiniBarChart data={byCategory} onSelect={(name) => openDrill("Disbursements by Expense Category", name)} />
          <div className="pcp-chart-hint">Click a bar to view its transactions.</div>
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
      {drill && drillData && (
        <DrillDownModal
          chartName={drill.chartName} label={drill.label}
          columns={drillData.columns} records={drillData.records}
          canEdit={canEdit}
          onEditRecord={() => { setDrill(null); onNavigate && onNavigate("disbursements"); }}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}

/* Single-branch dashboard (Manila / Warner / Disney) — same KPI set as the
   consolidated view, scoped to one branch's funds, requests, disbursements
   and liquidations. */
function BranchDashboard({ label, branchCode, funds, requests, disbursements, liquidations, replenishments, onNavigate }) {
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
        <div className="pcp-flow-step pcp-flow-click" onClick={() => onNavigate && onNavigate("masterdata")}>
          <div className="pcp-flow-label">Beginning Balance</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalFund)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step pcp-flow-click" onClick={() => onNavigate && onNavigate("disbursements")}>
          <div className="pcp-flow-label">Total Disbursed</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalDisbursed)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step pcp-flow-click" onClick={() => onNavigate && onNavigate("liquidation")}>
          <div className="pcp-flow-label">Total Liquidated</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalLiquidated)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step pcp-flow-click" onClick={() => onNavigate && onNavigate("masterdata")}>
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
        <KpiCard label="Beginning Balance" value={peso(m.totalFund)} icon={Banknote} tint="#2054a3" onClick={onNavigate ? () => onNavigate("masterdata") : undefined} />
        <KpiCard label="Total Disbursed" value={peso(m.totalDisbursed)} icon={ArrowUpRight} tint="#b9790a" onClick={onNavigate ? () => onNavigate("disbursements") : undefined} />
        <KpiCard label="Total Liquidated" value={peso(m.totalLiquidated)} icon={ArrowDownRight} tint="#15803d" onClick={onNavigate ? () => onNavigate("liquidation") : undefined} />
        <KpiCard label="Available Balance" value={peso(m.availableBalance)} icon={CircleDollarSign}
          tint={m.availableBalance < 0 ? "#c8102e" : "#15803d"}
          foot={m.availableBalance < 0 ? "Over committed — replenish soon" : "Cash on hand"}
          onClick={onNavigate ? () => onNavigate("masterdata") : undefined} />
        <KpiCard label="Completed & Billed" value={m.completedBilled} icon={Check} tint="#15803d" foot="Exported to Acumatica" onClick={onNavigate ? () => onNavigate("disbursements") : undefined} />
        <KpiCard label="Pending Requests" value={m.pendingRequests} icon={ClipboardList} tint="#b9790a" foot="Awaiting approval" onClick={onNavigate ? () => onNavigate("requests") : undefined} />
        <KpiCard label="Pending Liquidation" value={m.pendingLiquidationCount} icon={FileSpreadsheet} tint="#2054a3" foot="Vouchers not fully liquidated" onClick={onNavigate ? () => onNavigate("liquidation") : undefined} />
        <KpiCard label="Employees w/ Active Advances" value={m.activeEmployeeCount} icon={Users} tint="#7c3aed" onClick={onNavigate ? () => onNavigate("history") : undefined} />
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
