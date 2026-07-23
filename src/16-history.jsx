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
    category: r.remarks || "Replenishment", amount: Number(r.amount) || 0, status: r.status || "—",
  }));
  return rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function TransactionHistoryTab({ requests, disbursements, liquidations, replenishments, initialFilter, plantOptions }) {
  const [type, setType] = useState("All");
  const [company, setCompany] = useState("All");
  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minAmt, setMinAmt] = useState("");
  const [maxAmt, setMaxAmt] = useState("");
  const [plant, setPlant] = useState("ALL");

  useEffect(() => { if (initialFilter && initialFilter.type) setType(initialFilter.type); }, [initialFilter]);

  const feed = useMemo(() => buildTransactionFeed(requests, disbursements, liquidations, replenishments), [requests, disbursements, liquidations, replenishments]);

  const filtered = useMemo(() => feed.filter((t) => {
    if (plant !== "ALL" && t.branchCode !== plant) return false;
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
  }), [feed, type, company, status, from, to, minAmt, maxAmt, search, plant]);

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
        title={(plantTitle ? plantTitle + " \u00b7 " : "") + "Transaction History"}
        sub="Every request, release, liquidation and replenishment in one filterable ledger"
        right={<button className="pcp-btn pcp-btn-primary" onClick={exportExcel}><FileSpreadsheet size={14} /> Export to Excel</button>}
      />
      <div className="pcp-content">
        <PlantScopeTabs plants={plantOptions} value={plant} onChange={setPlant} />
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

