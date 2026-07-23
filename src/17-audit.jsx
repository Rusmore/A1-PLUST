/* ============================= AUDIT TRAIL ============================= */

const AUDIT_ACTIONS = ["Signed In", "Signed Out", "Request Created", "Edited", "Approved", "Rejected", "Released", "Liquidated", "Replenished", "Deleted", "Password Changed"];

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

