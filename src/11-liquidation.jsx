/* ============================= LIQUIDATION ============================= */

function emptyLine() {
  return { id: uid("ln"), date: todayISO(), expense: "", category: EXPENSE_CATEGORIES[0], department: SUBACCOUNTS[1].code, amount: "", taxCategory: "" };
}

function LiquidationWorksheet({ disbursement, liquidation, onSave, onExport }) {
  const [lines, setLines] = useState(liquidation ? liquidation.lines.map((l) => ({ ...l })) : [emptyLine()]);
  const [attachments, setAttachments] = useState(liquidation && liquidation.attachments ? liquidation.attachments : []);
  const [saved, setSaved] = useState(true);
  const [uploadNote, setUploadNote] = useState("");

  useEffect(() => {
    setLines(liquidation ? liquidation.lines.map((l) => ({ ...l })) : [emptyLine()]);
    setAttachments(liquidation && liquidation.attachments ? liquidation.attachments : []);
    setSaved(true);
    setUploadNote("");
  }, [disbursement.id]);

  const updateLine = (id, patch) => {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setSaved(false);
  };
  const addLine = () => { setLines((ls) => [...ls, emptyLine()]); setSaved(false); };
  const removeLine = (id) => { setLines((ls) => ls.filter((l) => l.id !== id)); setSaved(false); };

  /* Supporting documents (official receipts, sales invoices, etc.) are read as
     data URLs and stored with the liquidation. Capped per-file to keep the
     shared record from growing too large. */
  const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB per file
  const onPickFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploadNote("");
    files.forEach((file) => {
      if (file.size > MAX_FILE_BYTES) {
        setUploadNote(`"${file.name}" is larger than 2 MB and was skipped. Please compress it first.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments((as) => [...as, {
          id: uid("att"), name: file.name, type: file.type || "file",
          size: file.size, data: reader.result, uploadedAt: todayISO(),
        }]);
        setSaved(false);
      };
      reader.readAsDataURL(file);
    });
  };
  const removeAttachment = (id) => { setAttachments((as) => as.filter((a) => a.id !== id)); setSaved(false); };

  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const remaining = disbursement.amount - total;
  const validLines = lines.filter((l) => l.expense.trim() && Number(l.amount) > 0);

  const handleSave = () => {
    onSave(disbursement.id, validLines.map((l) => ({ ...l, amount: Number(l.amount) })), attachments);
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

      {/* Supporting documents */}
      <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="pcp-section-title" style={{ margin: 0 }}>
            <Receipt size={15} color="#c8102e" /> Supporting Documents
            <span style={{ fontSize: 11.5, color: "var(--text-mut)", fontWeight: 500, marginLeft: 6 }}>
              ({attachments.length}) — official receipts, sales invoices, etc.
            </span>
          </div>
          <label className="pcp-btn pcp-btn-sm" style={{ cursor: "pointer", margin: 0 }}>
            <Download size={12} style={{ transform: "rotate(180deg)" }} /> Upload
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              style={{ display: "none" }}
              onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }}
            />
          </label>
        </div>

        {uploadNote && (
          <div style={{ background: "var(--amber-bg)", color: "var(--amber)", fontSize: 11.5, padding: "8px 11px", borderRadius: 8, marginBottom: 10 }}>
            {uploadNote}
          </div>
        )}

        {attachments.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {attachments.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 11px" }}>
                <FileText size={15} color="#2054a3" style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-mut)" }}>
                    {(a.size / 1024).toFixed(0)} KB · uploaded {fmtDate(a.uploadedAt)}
                  </div>
                </div>
                <a className="pcp-btn pcp-btn-sm" href={a.data} target="_blank" rel="noopener noreferrer" title="View / download">View</a>
                <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" onClick={() => removeAttachment(a.id)} title="Remove"><Trash2 size={13} color="var(--brand)" /></button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "var(--text-mut)", padding: "10px 0" }}>
            No documents attached yet. Click <strong>Upload</strong> to attach scanned receipts or invoices (images or PDF, up to 2 MB each).
          </div>
        )}
      </div>

      {remaining < 0 && (
        <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center", background: "var(--red-bg)", padding: "10px 12px", borderRadius: 8, fontSize: 12, color: "var(--brand-dark)" }}>
          <AlertTriangle size={15} /> Liquidated amount exceeds the cash advance. The custodian owes the employee {peso(Math.abs(remaining))}.
        </div>
      )}
    </div>
  );
}

function LiquidationTab({ disbursements, liquidations, onSaveLiquidation, onExport, onExportAll, plantOptions, plantTitle }) {
  const [selectedId, setSelectedId] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [plant, setPlant] = useState("ALL");

  const scoped = plant === "ALL" ? disbursements : disbursements.filter((d) => d.branchCode === plant);
  const enriched = scoped.map((d) => ({ ...d, liqStatus: liqStatusFor(d, liquidations) }));
  const list = showAll ? enriched : enriched.filter((d) => d.liqStatus !== "Fully Liquidated");
  const selected = enriched.find((d) => d.id === selectedId) || list[0] || null;
  const exportableCount = disbursements.filter((d) => {
    const liq = liquidationFor(d.id, liquidations);
    return liq && liq.lines && liq.lines.length;
  }).length;

  return (
    <div>
      <TopBar
        title={(plantTitle ? plantTitle + " \u00b7 " : "") + "Liquidation"}
        sub="Break down each cash advance into itemized receipts and reconcile the balance"
        right={
          <button className="pcp-btn pcp-btn-primary" onClick={onExportAll} disabled={!exportableCount}>
            <Download size={14} /> Export All to Acumatica
          </button>
        }
      />
      <div className="pcp-content">
        <PlantScopeTabs plants={plantOptions} value={plant} onChange={(v) => { setPlant(v); setSelectedId(null); }} />
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
