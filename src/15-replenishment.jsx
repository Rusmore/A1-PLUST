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

function ReplenishmentFormModal({ onClose, onSave, nextNo, funds, disbursements, liquidations, replenishments, replenishment, plantOptions }) {
  const isEdit = !!replenishment;
  const defaultBranch = (plantOptions && plantOptions[0]) ? plantOptions[0].code
    : (funds[0] ? funds[0].branchCode : BRANCHES[0].code);
  const [form, setForm] = useState(
    replenishment
      ? { ...replenishment, amount: replenishment.amount }
      : {
          date: todayISO(), branchCode: defaultBranch,
          amount: "", preparedBy: "", status: "", remarks: "",
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
              <label>Fund / Plant</label>
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
              <label>Status <span style={{ color: "var(--text-mut)", fontWeight: 400 }}>(optional)</span></label>
              <select className="pcp-select" value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="">—</option>
                {REPLENISH_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="pcp-field">
            <label>Remarks</label>
            <input className="pcp-input" placeholder="Optional notes" value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
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

function ReplenishmentTab({ replenishments, funds, disbursements, liquidations, onCreate, onEdit, onComplete, onDelete, plantOptions, canEdit, plantTitle }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [plant, setPlant] = useState("ALL");

  const nextNo = "PCRP-2026-" + String(replenishments.length + 1).padStart(4, "0");
  const totalCompleted = replenishments.filter((r) => r.status === "Completed").reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalPending = replenishments.filter((r) => r.status !== "Completed").reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const filtered = replenishments.filter((r) => {
    if (plant !== "ALL" && r.branchCode !== plant) return false;
    if (statusFilter !== "All" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(r.replenishmentNo.toLowerCase().includes(q) || (r.preparedBy || "").toLowerCase().includes(q))) return false;
    }
    return true;
  }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const formPlantOptions = (plantOptions && plantOptions.length)
    ? (plant !== "ALL" ? plantOptions.filter((p) => p.code === plant) : plantOptions)
    : null;

  return (
    <div>
      <TopBar
        title={(plantTitle ? plantTitle + " \u00b7 " : "") + "Replenishment"}
        sub="Reimburse funds for liquidated expenses to restore the imprest balance"
        right={<button className="pcp-btn pcp-btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> New Replenishment</button>}
      />
      <div className="pcp-content">
        <PlantScopeTabs plants={plantOptions} value={plant} onChange={setPlant} />
        <div className="pcp-kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <KpiCard label="Total Replenished" value={peso(totalCompleted)} icon={RefreshCw} tint="#15803d" foot="Completed reimbursements" />
          <KpiCard label="Pending Replenishments" value={replenishments.filter((r) => r.status !== "Completed").length} icon={Clock} tint="#b9790a" foot={peso(totalPending) + " in progress"} />
          <KpiCard label="Replenishment Records" value={replenishments.length} icon={Landmark} tint="#2054a3" />
        </div>
        <div className="pcp-card">
          <div style={{ padding: "14px 18px", display: "flex", gap: 10, alignItems: "center", borderBottom: "1px solid var(--line)" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
              <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#9098b3" }} />
              <input className="pcp-input" style={{ paddingLeft: 28 }} placeholder="Search no. or preparer" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                  <th>Replenishment No.</th><th>Date</th><th>Fund / Plant</th><th>Amount</th>
                  <th>Prepared By</th><th>Status</th><th>Remarks</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.replenishmentNo}</td>
                    <td>{fmtDate(r.date)}</td>
                    <td>{plantLabel(r.branchCode)}</td>
                    <td className="pcp-num">{peso(r.amount)}</td>
                    <td>{r.preparedBy || "—"}</td>
                    <td>{r.status ? <Badge status={r.status} /> : <span style={{ color: "var(--text-mut)" }}>—</span>}</td>
                    <td style={{ maxWidth: 200, whiteSpace: "normal" }}>{r.remarks || "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {canEdit && r.status !== "Completed" && (
                          <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={() => onComplete(r.id)} title="Mark completed"><Check size={12} /></button>
                        )}
                        <button className="pcp-btn pcp-btn-sm" onClick={() => setEditing(r)} title="Edit"><Edit3 size={12} /></button>
                        {canEdit && (
                          <button className="pcp-btn pcp-btn-sm pcp-btn-danger" onClick={() => onDelete(r.id)} title="Delete"><Trash2 size={12} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={8} className="pcp-empty">No replenishment records match your filters</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {showForm && (
        <ReplenishmentFormModal
          nextNo={nextNo} funds={funds} disbursements={disbursements} liquidations={liquidations} replenishments={replenishments} plantOptions={formPlantOptions}
          onClose={() => setShowForm(false)}
          onSave={(form) => { onCreate({ ...form, replenishmentNo: nextNo }); setShowForm(false); }}
        />
      )}
      {editing && (
        <ReplenishmentFormModal
          replenishment={editing} funds={funds} disbursements={disbursements} liquidations={liquidations} replenishments={replenishments} plantOptions={formPlantOptions}
          onClose={() => setEditing(null)}
          onSave={(form) => { onEdit(editing.id, form); setEditing(null); }}
        />
      )}
    </div>
  );
}

