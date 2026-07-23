/* ============================= REQUESTS ============================= */

function RequestFormModal({ onClose, onSave, nextRequestNo, request, plantOptions }) {
  const isEdit = !!request;
  const defaultBranch = (plantOptions && plantOptions[0]) ? plantOptions[0].code : BRANCHES[0].code;
  const [form, setForm] = useState(
    request
      ? {
          date: request.date, employee: request.employee, department: request.department,
          branchCode: request.branchCode, purpose: request.purpose,
          amount: request.amount, approver: request.approver || "",
        }
      : {
          date: todayISO(), employee: "", department: SUBACCOUNTS[1].code,
          branchCode: defaultBranch, purpose: "", amount: "", approver: "",
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
              <label>Plant / Branch</label>
              <select className="pcp-select" value={form.branchCode} onChange={(e) => set("branchCode", e.target.value)}>
                {plantOptions ? (
                  plantOptions.map((p) => <option key={p.code} value={p.code}>{p.label} ({p.code})</option>)
                ) : (
                  COMPANIES.map((c) => (
                    <optgroup label={c} key={c}>
                      {branchesForCompany(c).map((b) => <option key={b.code} value={b.code}>{b.name} ({b.code})</option>)}
                    </optgroup>
                  ))
                )}
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

function RequestsTab({ requests, funds, onCreate, onEdit, onApprove, onReject, onDisburse, plantOptions, canApprove, canRelease, plantTitle }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [plant, setPlant] = useState("ALL");

  const nextRequestNo = "PCR-2026-" + String(requests.length + 1).padStart(4, "0");

  const filtered = requests.filter((r) => {
    if (plant !== "ALL" && r.branchCode !== plant) return false;
    if (statusFilter !== "All" && r.status !== statusFilter) return false;
    if (search && !(r.employee.toLowerCase().includes(search.toLowerCase()) || r.requestNo.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const formPlantOptions = (plantOptions && plantOptions.length)
    ? (plant !== "ALL" ? plantOptions.filter((p) => p.code === plant) : plantOptions)
    : null;

  return (
    <div>
      <TopBar
        title={(plantTitle ? plantTitle + " \u00b7 " : "") + "Petty Cash Requests"}
        sub="Submit and approve cash advance requests before release"
        right={<button className="pcp-btn pcp-btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> New Request</button>}
      />
      <div className="pcp-content">
        <PlantScopeTabs plants={plantOptions} value={plant} onChange={setPlant} />
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
                  <th>Request No.</th><th>Date</th><th>Employee</th><th>Department</th><th>Plant</th>
                  <th>Purpose</th><th>Amount</th><th>Approver</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.requestNo}</td>
                    <td>{fmtDate(r.date)}</td>
                    <td>{r.employee}</td>
                    <td title={subaccountLabel(r.department)}>{subaccountLabel(r.department)}</td>
                    <td>{plantLabel(r.branchCode)}</td>
                    <td style={{ maxWidth: 220, whiteSpace: "normal" }}>{r.purpose}</td>
                    <td className="pcp-num">{peso(r.amount)}</td>
                    <td>{r.approver || "—"}</td>
                    <td><Badge status={r.status} /></td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {canApprove && r.status === "Pending" && (
                          <>
                            <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={() => onApprove(r.id)} title="Approve request"><Check size={12} /> Approve</button>
                            <button className="pcp-btn pcp-btn-sm pcp-btn-danger" onClick={() => onReject(r.id)} title="Reject request"><X size={12} /></button>
                          </>
                        )}
                        {r.status !== "Disbursed" && (
                          <button className="pcp-btn pcp-btn-sm" onClick={() => setEditing(r)} title="Edit request"><Edit3 size={12} /></button>
                        )}
                        {canRelease && r.status === "Approved" && (
                          <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={() => onDisburse(r)}>Release</button>
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
          plantOptions={formPlantOptions}
          onClose={() => setShowForm(false)}
          onSave={(form) => { onCreate({ ...form, requestNo: nextRequestNo }); setShowForm(false); }}
        />
      )}
      {editing && (
        <RequestFormModal
          request={editing}
          plantOptions={formPlantOptions}
          onClose={() => setEditing(null)}
          onSave={(form) => { onEdit(editing.id, form); setEditing(null); }}
        />
      )}
    </div>
  );
}
