/* ============================= CASH MANAGEMENT ============================= */
/* Physical Cash Count, Cash Reconciliation and Cash Return / Unused Balance
   (Sections 24–27). All physical-cash movements are recorded here with a peso
   denomination breakdown so Finance can trace the actual bills and coins
   supporting each PCF balance. */

/* Small read-only figure used across the cash forms so calculated balances can
   never be manually edited (Section 24). */
function CashStat({ label, value, strong, tint }) {
  return (
    <div className="pcp-field">
      <label>{label}</label>
      <div className="pcp-input" style={{
        background: "var(--paper)", display: "flex", alignItems: "center",
        fontWeight: strong ? 700 : 600, color: tint || "inherit",
      }}>
        {peso(value)}
      </div>
    </div>
  );
}

function CashVarianceBanner({ variance }) {
  const ok = variance.difference === 0;
  return (
    <div style={{
      marginTop: 6, padding: "10px 12px", borderRadius: 8, fontSize: 12.5,
      background: ok ? "var(--green-bg)" : "var(--red-bg)",
      color: ok ? "var(--green)" : "var(--brand-dark)",
    }}>
      {ok ? (
        <><Check size={14} style={{ verticalAlign: "-2px" }} /> <strong>BALANCED</strong> — counted cash matches the expected balance.</>
      ) : (
        <><AlertTriangle size={14} style={{ verticalAlign: "-2px" }} /> <strong>{variance.status}</strong> — variance of {peso(Math.abs(variance.difference))}.
          {" "}This transaction will be flagged <strong>CASH VARIANCE / FOR REVIEW</strong> and needs a written explanation.</>
      )}
    </div>
  );
}

/* ---- Physical Cash Count (Section 24) ---- */
function PhysicalCashCountForm({ fund, disbursements, liquidations, replenishments, cashReturns, onSubmit, onCancel, userName }) {
  const mon = monitoringForFund(fund, disbursements, liquidations, replenishments);
  const returned = cashReturnedForBranch(fund.branchCode, cashReturns);
  const beginning = Number(fund.beginningBalance) || 0;
  /* Expected Cash = Beginning + Replenishment + Cash Returned − Cash Released − Adjustments. */
  const [adjust, setAdjust] = useState(0);
  const expected = round2(beginning + mon.replenished + returned - mon.disbursed - (Number(adjust) || 0));

  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [countedBy, setCountedBy] = useState(userName || "");
  const [verifiedBy, setVerifiedBy] = useState("");
  const [denoms, setDenoms] = useState({});
  const [explanation, setExplanation] = useState("");

  const actual = denominationTotal(denoms);
  const variance = cashVariance(expected, actual);
  const needsExplanation = variance.difference !== 0;
  const valid = countedBy.trim() && (!needsExplanation || explanation.trim());

  return (
    <div className="pcp-card" style={{ padding: 18 }}>
      <div className="pcp-section-title"><Banknote size={16} /> Physical Cash Count — {fund.label} ({fund.branchCode})</div>
      <div className="pcp-field-row">
        <div className="pcp-field">
          <label>Custodian</label>
          <input className="pcp-input" value={fund.custodian || "—"} disabled />
        </div>
        <div className="pcp-field">
          <label>Date &amp; Time</label>
          <input type="datetime-local" className="pcp-input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="pcp-field-row">
        <CashStat label="Beginning Cash Balance" value={beginning} />
        <CashStat label="Replenishments Received" value={mon.replenished} />
      </div>
      <div className="pcp-field-row">
        <CashStat label="Cash Returned" value={returned} />
        <CashStat label="Cash Released" value={mon.disbursed} tint="var(--brand-dark)" />
      </div>
      <div className="pcp-field-row">
        <div className="pcp-field">
          <label>Other Approved Adjustments (₱)</label>
          <input type="number" step="0.01" className="pcp-input" value={adjust} onChange={(e) => setAdjust(e.target.value)} placeholder="0.00" />
        </div>
        <CashStat label="Expected Cash Balance (auto)" value={expected} strong />
      </div>

      <div style={{ marginTop: 10 }}>
        <CashDenominationEditor value={denoms} onChange={setDenoms} target={expected} title="Actual Physical Cash — Denomination Breakdown" />
      </div>

      <div className="pcp-field-row" style={{ marginTop: 10 }}>
        <CashStat label="Actual Physical Cash (auto)" value={actual} strong />
        <CashStat label="Cash Over / Short (auto)" value={variance.difference} strong tint={variance.difference === 0 ? "var(--green)" : "var(--brand-dark)"} />
      </div>

      <CashVarianceBanner variance={variance} />

      {needsExplanation && (
        <div className="pcp-field" style={{ marginTop: 10 }}>
          <label>Variance Explanation <span style={{ color: "var(--brand)" }}>*</span></label>
          <textarea className="pcp-input" rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Required — explain the cash over / short before finalizing" />
        </div>
      )}

      <div className="pcp-field-row" style={{ marginTop: 10 }}>
        <div className="pcp-field">
          <label>Counted By</label>
          <input className="pcp-input" value={countedBy} onChange={(e) => setCountedBy(e.target.value)} placeholder="Full name" />
        </div>
        <div className="pcp-field">
          <label>Verified By</label>
          <input className="pcp-input" value={verifiedBy} onChange={(e) => setVerifiedBy(e.target.value)} placeholder="Full name (optional)" />
        </div>
      </div>

      <div className="pcp-modal-foot" style={{ paddingRight: 0 }}>
        <button className="pcp-btn" onClick={onCancel}>Cancel</button>
        <button
          className="pcp-btn pcp-btn-primary"
          disabled={!valid}
          title={valid ? "" : "Enter who counted the cash and explain any variance."}
          onClick={() => onSubmit({
            branchCode: fund.branchCode, custodian: fund.custodian || "", date,
            beginning, replenished: round2(mon.replenished), returned: round2(returned),
            released: round2(mon.disbursed), adjustments: round2(Number(adjust) || 0),
            expectedCash: expected, actualCash: round2(actual), variance: variance.difference,
            status: needsExplanation ? "CASH VARIANCE / FOR REVIEW" : "BALANCED",
            explanation: explanation.trim(), countedBy: countedBy.trim(), verifiedBy: verifiedBy.trim(),
            denominations: denoms,
          })}
        >
          Record Cash Count
        </button>
      </div>
    </div>
  );
}

function PhysicalCashCountSection({ funds, disbursements, liquidations, replenishments, cashCounts, cashReturns, onAddCashCount, plantOptions, userName, canDelete, onDeleteCashCount }) {
  const [creating, setCreating] = useState(false);
  const firstBranch = (plantOptions && plantOptions[0]) ? plantOptions[0].code : (funds[0] ? funds[0].branchCode : "");
  const [branch, setBranch] = useState(firstBranch);
  const fund = funds.find((f) => f.branchCode === branch) || funds[0];
  const rows = cashCounts.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  return (
    <div>
      {!creating && (
        <div className="pcp-card" style={{ padding: 16, marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="pcp-field" style={{ maxWidth: 260 }}>
            <label>PCF / Plant / Branch</label>
            <select className="pcp-select" value={branch} onChange={(e) => setBranch(e.target.value)}>
              {(plantOptions || []).map((p) => <option key={p.code} value={p.code}>{p.label} ({p.code})</option>)}
            </select>
          </div>
          <button className="pcp-btn pcp-btn-primary" disabled={!fund} onClick={() => setCreating(true)}><Plus size={14} /> New Physical Cash Count</button>
        </div>
      )}

      {creating && fund && (
        <div style={{ marginBottom: 14 }}>
          <PhysicalCashCountForm
            fund={fund} disbursements={disbursements} liquidations={liquidations}
            replenishments={replenishments} cashReturns={cashReturns} userName={userName}
            onCancel={() => setCreating(false)}
            onSubmit={(payload) => { onAddCashCount(payload); setCreating(false); }}
          />
        </div>
      )}

      <div className="pcp-card">
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12.5, fontWeight: 600 }}>
          Recorded Cash Counts <span style={{ color: "var(--text-mut)", fontWeight: 400 }}>({rows.length})</span>
        </div>
        <div className="pcp-table-wrap">
          <table className="pcp-table">
            <thead>
              <tr>
                <th>PCF Ref</th><th>Plant</th><th>Date</th><th>Expected</th><th>Actual</th>
                <th>Over / Short</th><th>Status</th><th>Counted By</th><th>Verified By</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((c) => (
                <tr key={c.id}>
                  <td>{c.pcfNo || "—"}</td>
                  <td>{plantLabel(c.branchCode)}</td>
                  <td>{String(c.date || "").replace("T", " ")}</td>
                  <td className="pcp-num">{peso(c.expectedCash)}</td>
                  <td className="pcp-num">{peso(c.actualCash)}</td>
                  <td className="pcp-num" style={{ color: c.variance === 0 ? "var(--green)" : "var(--brand)" }}>{peso(c.variance)}</td>
                  <td><Badge status={c.variance === 0 ? "BALANCED" : "FOR REVIEW"} /></td>
                  <td>{c.countedBy || "—"}</td>
                  <td>{c.verifiedBy || "—"}</td>
                  <td>
                    {canDelete && onDeleteCashCount && (
                      <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" onClick={() => onDeleteCashCount(c.id)} title="Delete cash count"><Trash2 size={13} color="var(--brand)" /></button>
                    )}
                  </td>
                </tr>
              )) : <tr><td colSpan={10} className="pcp-empty">No cash counts recorded yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---- Cash Reconciliation (Section 25) ---- */
function CashReconciliationSection({ funds, disbursements, liquidations, replenishments, cashCounts, cashReturns }) {
  const rows = funds.map((f) => ({ fund: f, r: reconcileFund(f, disbursements, liquidations, replenishments, cashCounts, cashReturns) }));

  const exportRecon = () => {
    const data = rows.map(({ fund, r }) => ({
      "Plant": fund.label, "Branch": fund.branchCode, "Custodian": fund.custodian || "",
      "Approved PCF Fund": r.approvedFund, "Physical Cash": r.physicalCash,
      "Released but Unliquidated": r.unliquidated, "Liquidated": r.liquidated,
      "Replenished": r.replenished, "Cash Returned": r.returned,
      "Expected Fund": r.expectedFund, "Actual Fund": r.approvedFund,
      "Variance": r.variance, "Status": r.status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cash Reconciliation");
    downloadWorkbook(wb, `Cash_Reconciliation_${todayISO()}.xlsx`);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="pcp-btn pcp-btn-primary" onClick={exportRecon}><Download size={14} /> Export to Excel</button>
      </div>
      <div className="pcp-kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 14 }}>
        <KpiCard label="Approved PCF Fund" value={peso(rows.reduce((s, x) => s + x.r.approvedFund, 0))} icon={PiggyBank} tint="#2054a3" />
        <KpiCard label="Physical Cash on Hand" value={peso(rows.reduce((s, x) => s + x.r.physicalCash, 0))} icon={Banknote} tint="#15803d" />
        <KpiCard label="Released but Unliquidated" value={peso(rows.reduce((s, x) => s + x.r.unliquidated, 0))} icon={CircleDollarSign} tint="#b9790a" />
        <KpiCard label="Funds For Review" value={rows.filter((x) => x.r.status !== "BALANCED").length} icon={AlertTriangle} tint="#c8102e" />
      </div>
      <div className="pcp-card">
        <div className="pcp-table-wrap">
          <table className="pcp-table">
            <thead>
              <tr>
                <th>Plant</th><th>Approved Fund</th><th>Physical Cash</th><th>Unliquidated</th>
                <th>Liquidated</th><th>Replenished</th><th>Returned</th>
                <th>Expected Fund</th><th>Actual Fund</th><th>Variance</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map(({ fund, r }) => (
                <tr key={fund.id || fund.branchCode}>
                  <td><strong>{fund.label}</strong><div style={{ fontSize: 11, color: "var(--text-mut)" }}>{fund.branchCode}{r.hasCount ? "" : " · computed"}</div></td>
                  <td className="pcp-num">{peso(r.approvedFund)}</td>
                  <td className="pcp-num">{peso(r.physicalCash)}</td>
                  <td className="pcp-num">{peso(r.unliquidated)}</td>
                  <td className="pcp-num">{peso(r.liquidated)}</td>
                  <td className="pcp-num">{peso(r.replenished)}</td>
                  <td className="pcp-num">{peso(r.returned)}</td>
                  <td className="pcp-num">{peso(r.expectedFund)}</td>
                  <td className="pcp-num">{peso(r.approvedFund)}</td>
                  <td className="pcp-num" style={{ color: r.variance === 0 ? "var(--green)" : "var(--brand)" }}>{peso(r.variance)}</td>
                  <td><Badge status={r.status} /></td>
                </tr>
              )) : <tr><td colSpan={11} className="pcp-empty">No funds in scope</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--text-mut)" }}>
        Imprest rule: <strong>PCF Fund = Physical Cash on Hand + Released-but-Unliquidated + Liquidated-but-Unreplenished</strong>.
        Physical cash uses the latest recorded count when available, otherwise the computed cash movement.
      </div>
    </div>
  );
}

/* ---- Cash Return / Unused Balance (Section 27) ---- */
function CashReturnForm({ disbursements, liquidations, onSubmit, onCancel, userName }) {
  const openDisb = disbursements.filter((d) => liqStatusFor(d, liquidations) !== "Fully Liquidated");
  const [disbId, setDisbId] = useState(openDisb[0] ? openDisb[0].id : "");
  const disb = disbursements.find((d) => d.id === disbId) || null;
  const released = disb ? Number(disb.amount) || 0 : 0;

  const [expenses, setExpenses] = useState("");
  const [receiptTotal, setReceiptTotal] = useState("");
  const [date, setDate] = useState(todayISO());
  const [returnedBy, setReturnedBy] = useState("");
  const [receivedBy, setReceivedBy] = useState(userName || "");
  const [denoms, setDenoms] = useState({});

  /* Cash Returned = Cash Released − Actual Allowable Expenses. */
  const expenseNum = Number(expenses) || 0;
  const cashReturned = round2(Math.max(0, released - expenseNum));
  const difference = round2((Number(receiptTotal) || 0) - expenseNum);
  const denomTotal = denominationTotal(denoms);
  const denomOk = round2(denomTotal) === cashReturned;
  const valid = disb && returnedBy.trim() && receivedBy.trim() && expenseNum <= released && denomOk && cashReturned > 0;

  return (
    <div className="pcp-card" style={{ padding: 18 }}>
      <div className="pcp-section-title"><ArrowDownRight size={16} /> Cash Return / Unused Balance</div>
      <div className="pcp-field">
        <label>Original Cash Release (voucher)</label>
        <select className="pcp-select" value={disbId} onChange={(e) => setDisbId(e.target.value)}>
          <option value="">— select a released voucher —</option>
          {openDisb.map((d) => <option key={d.id} value={d.id}>{d.voucherNo} · {d.employee} · {peso(d.amount)}</option>)}
        </select>
      </div>
      <div className="pcp-field-row">
        <CashStat label="Original Cash Released" value={released} />
        <div className="pcp-field">
          <label>Actual Allowable Expenses (₱)</label>
          <input type="number" step="0.01" className="pcp-input" value={expenses} onChange={(e) => setExpenses(e.target.value)} placeholder="0.00" />
        </div>
      </div>
      <div className="pcp-field-row">
        <div className="pcp-field">
          <label>Receipt Total (₱)</label>
          <input type="number" step="0.01" className="pcp-input" value={receiptTotal} onChange={(e) => setReceiptTotal(e.target.value)} placeholder="0.00" />
        </div>
        <CashStat label="Difference (receipts − expenses)" value={difference} tint={difference === 0 ? "inherit" : "var(--brand-dark)"} />
      </div>
      <div className="pcp-field-row">
        <CashStat label="Cash Returned (auto)" value={cashReturned} strong tint="var(--green)" />
        <div className="pcp-field">
          <label>Return Date</label>
          <input type="date" className="pcp-input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {expenseNum > released && (
        <div style={{ padding: "8px 11px", borderRadius: 8, fontSize: 12, background: "var(--red-bg)", color: "var(--brand-dark)", marginBottom: 8 }}>
          <AlertTriangle size={13} style={{ verticalAlign: "-2px" }} /> Actual expenses cannot exceed the amount originally released ({peso(released)}).
        </div>
      )}

      <CashDenominationEditor value={denoms} onChange={setDenoms} target={cashReturned} title="Returned Cash — Denomination Breakdown" />

      <div className="pcp-field-row" style={{ marginTop: 10 }}>
        <div className="pcp-field">
          <label>Returned By</label>
          <input className="pcp-input" value={returnedBy} onChange={(e) => setReturnedBy(e.target.value)} placeholder="Employee returning the cash" />
        </div>
        <div className="pcp-field">
          <label>Received By</label>
          <input className="pcp-input" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Custodian receiving the cash" />
        </div>
      </div>

      <div className="pcp-modal-foot" style={{ paddingRight: 0 }}>
        <button className="pcp-btn" onClick={onCancel}>Cancel</button>
        <button
          className="pcp-btn pcp-btn-primary"
          disabled={!valid}
          title={valid ? "" : "Complete all fields and match the denomination total to the cash returned."}
          onClick={() => onSubmit({
            disbursementId: disb.id, voucherNo: disb.voucherNo, branchCode: disb.branchCode,
            employee: disb.employee, released, expenses: round2(expenseNum),
            receiptTotal: round2(Number(receiptTotal) || 0), difference, amount: cashReturned,
            date, returnedBy: returnedBy.trim(), receivedBy: receivedBy.trim(), denominations: denoms,
          })}
        >
          Record Cash Return
        </button>
      </div>
    </div>
  );
}

function CashReturnSection({ disbursements, liquidations, cashReturns, onReturnCash, userName, canDelete, onDeleteCashReturn }) {
  const [creating, setCreating] = useState(false);
  const rows = cashReturns.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <div>
      {!creating && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, color: "var(--text-mut)" }}>Total unused cash returned: <strong>{peso(total)}</strong></div>
          <button className="pcp-btn pcp-btn-primary" onClick={() => setCreating(true)}><Plus size={14} /> Record Cash Return</button>
        </div>
      )}
      {creating && (
        <div style={{ marginBottom: 14 }}>
          <CashReturnForm
            disbursements={disbursements} liquidations={liquidations} userName={userName}
            onCancel={() => setCreating(false)}
            onSubmit={(payload) => { onReturnCash(payload); setCreating(false); }}
          />
        </div>
      )}
      <div className="pcp-card">
        <div className="pcp-table-wrap">
          <table className="pcp-table">
            <thead>
              <tr>
                <th>PCF Ref</th><th>Date</th><th>Voucher</th><th>Employee</th><th>Released</th>
                <th>Expenses</th><th>Cash Returned</th><th>Returned By</th><th>Received By</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.pcfNo || "—"}</td>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.voucherNo}</td>
                  <td>{r.employee}</td>
                  <td className="pcp-num">{peso(r.released)}</td>
                  <td className="pcp-num">{peso(r.expenses)}</td>
                  <td className="pcp-num" style={{ color: "var(--green)" }}>{peso(r.amount)}</td>
                  <td>{r.returnedBy || "—"}</td>
                  <td>{r.receivedBy || "—"}</td>
                  <td>
                    {canDelete && onDeleteCashReturn && (
                      <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" onClick={() => onDeleteCashReturn(r.id)} title="Delete cash return"><Trash2 size={13} color="var(--brand)" /></button>
                    )}
                  </td>
                </tr>
              )) : <tr><td colSpan={10} className="pcp-empty">No cash returns recorded yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---- Container with segmented sub-navigation ---- */
const CASH_SUBTABS = [
  { key: "count", label: "Physical Cash Count" },
  { key: "recon", label: "Cash Reconciliation" },
  { key: "return", label: "Cash Return" },
];

function CashManagementTab({
  funds, disbursements, liquidations, replenishments, cashCounts, cashReturns,
  onAddCashCount, onReturnCash, onDeleteCashCount, onDeleteCashReturn,
  plantOptions, plantTitle, userName, canDelete,
}) {
  const [sub, setSub] = useState("count");
  return (
    <div>
      <TopBar
        title={(plantTitle ? plantTitle + " \u00b7 " : "") + "Cash Management"}
        sub="Physical cash counting, imprest reconciliation and unused-balance returns"
      />
      <div className="pcp-content">
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {CASH_SUBTABS.map((t) => (
            <button
              key={t.key}
              className={"pcp-btn" + (sub === t.key ? " pcp-btn-primary" : "")}
              onClick={() => setSub(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {sub === "count" && (
          <PhysicalCashCountSection
            funds={funds} disbursements={disbursements} liquidations={liquidations}
            replenishments={replenishments} cashCounts={cashCounts} cashReturns={cashReturns}
            onAddCashCount={onAddCashCount} plantOptions={plantOptions} userName={userName}
            canDelete={canDelete} onDeleteCashCount={onDeleteCashCount}
          />
        )}
        {sub === "recon" && (
          <CashReconciliationSection
            funds={funds} disbursements={disbursements} liquidations={liquidations}
            replenishments={replenishments} cashCounts={cashCounts} cashReturns={cashReturns}
          />
        )}
        {sub === "return" && (
          <CashReturnSection
            disbursements={disbursements} liquidations={liquidations} cashReturns={cashReturns}
            onReturnCash={onReturnCash} userName={userName}
            canDelete={canDelete} onDeleteCashReturn={onDeleteCashReturn}
          />
        )}
      </div>
    </div>
  );
}
