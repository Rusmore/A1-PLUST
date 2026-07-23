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

function DisbursementsTab({ disbursements, liquidations, requests, onUpdateRemarks, onToggleBilled, onEditDisbursement, plantOptions, plantTitle }) {
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
        title={(plantTitle ? plantTitle + " \u00b7 " : "") + "Release Ledger"}
        sub="Full transaction history of all petty cash releases (vouchers)"
        right={
          <>
            <button className="pcp-btn" onClick={() => window.print()}><Printer size={14} /> Print</button>
            <button className="pcp-btn pcp-btn-primary" onClick={exportLedger}><Download size={14} /> Export to Excel</button>
          </>
        }
      />
      <div className="pcp-content">
        <PlantScopeTabs plants={plantOptions} value={branchFilter === "All" ? "ALL" : branchFilter} onChange={(v) => setBranchFilter(v === "ALL" ? "All" : v)} />
        <div className="pcp-card">
          <div style={{ padding: "14px 18px", display: "flex", gap: 10, alignItems: "center", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 280 }}>
              <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#9098b3" }} />
              <input className="pcp-input" style={{ paddingLeft: 28 }} placeholder="Search voucher or employee" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="pcp-select" style={{ width: 160 }} value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
              <option>All</option>
              {(plantOptions || BRANCHES.map((b) => ({ code: b.code, label: b.code }))).map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
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
