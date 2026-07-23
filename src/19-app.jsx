/* ============================= APP ============================= */

export default function App({ userEmail, userName, onSignOut, userRole, isAdmin, userPlants }) {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [funds, setFunds] = useState([]);
  const [requests, setRequests] = useState([]);
  const [disbursements, setDisbursements] = useState([]);
  const [liquidations, setLiquidations] = useState([]);
  const [replenishments, setReplenishments] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [role, setRole] = useState(userRole || "Accounting");
  /* Non-admins are locked to their assigned role; admins may view-as any role. */
  useEffect(() => { setRole(userRole || "Accounting"); }, [userRole]);
  const guardedSetRole = useCallback((r) => { if (isAdmin) setRole(r); }, [isAdmin]);
  const [historyFilter, setHistoryFilter] = useState(null);
  const [disburseTarget, setDisburseTarget] = useState(null);
  const [showEditBalances, setShowEditBalances] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [saveTick, setSaveTick] = useState(0);

  /* Plant-level access scope for this user (list of allowed branch codes).
     For management (userPlants === "ALL") the scope is derived LIVE from the
     funds master data, so any plant newly created in Funds & Master Data is
     automatically included across the dashboard, aging report, notifications
     and management reports — with no code change. */
  const allowedPlants = useMemo(() => {
    if (userPlants === "ALL" || !userPlants) {
      const codes = new Set(PLANT_CODES);
      funds.forEach((f) => { if (f.branchCode) codes.add(f.branchCode); });
      return Array.from(codes);
    }
    /* Explicitly granted plants (custodians) — trusted as configured, including
       any new plant codes assigned to them. */
    return Array.from(new Set(userPlants));
  }, [userPlants, funds]);
  /* Plant selector options in canonical order, then any additional master-data
     plants appended so new plants surface automatically. */
  const plantOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    PLANTS.forEach((p) => { if (allowedPlants.includes(p.code) && !seen.has(p.code)) { seen.add(p.code); out.push({ code: p.code, label: p.label }); } });
    funds.forEach((f) => { if (allowedPlants.includes(f.branchCode) && !seen.has(f.branchCode)) { seen.add(f.branchCode); out.push({ code: f.branchCode, label: f.label || plantLabel(f.branchCode) || f.branchCode }); } });
    return out;
  }, [allowedPlants, funds]);
  const inScope = useCallback((code) => allowedPlants.includes(code), [allowedPlants]);
  /* Whoever is signed in has full edit/approve/release rights within their scope. */
  const canEdit = true, canApprove = true, canRelease = true;

  /* Append an entry to the immutable audit trail, tagged with the signed-in user. */
  const logAudit = useCallback((action, entity, remarks) => {
    setAuditLog((log) => [...log, {
      id: uid("aud"), ts: new Date().toISOString().slice(0, 19), user: userName || role, action, entity, remarks: remarks || "",
    }]);
  }, [role, userName]);

  /* Record sign-in once per session, and sign-out via a wrapped handler. */
  const loginLoggedRef = useRef(false);
  useEffect(() => {
    if (!loaded || loginLoggedRef.current) return;
    loginLoggedRef.current = true;
    setAuditLog((log) => [...log, {
      id: uid("aud"), ts: new Date().toISOString().slice(0, 19),
      user: userName || (userEmail || "User"), action: "Signed In",
      entity: userEmail || "—", remarks: `Role: ${ROLES[role] ? ROLES[role].label : role}`,
    }]);
  }, [loaded]); // eslint-disable-line

  const handleSignOut = useCallback(() => {
    setAuditLog((log) => {
      const next = [...log, {
        id: uid("aud"), ts: new Date().toISOString().slice(0, 19),
        user: userName || (userEmail || "User"), action: "Signed Out",
        entity: userEmail || "—", remarks: "",
      }];
      try { saveState({ dataVersion: DATA_VERSION, funds, requests, disbursements, liquidations, replenishments, auditLog: next }); } catch (e) {}
      return next;
    });
    if (onSignOut) onSignOut();
  }, [onSignOut, userName, userEmail, funds, requests, disbursements, liquidations, replenishments]);

  useEffect(() => {
    (async () => {
      const saved = await loadState();
      /* Always keep the four master plant funds available, adding any missing. */
      const ensureFunds = (fs) => {
        const list = (fs && fs.length) ? fs.map((f) => ({ ...f })) : seedFunds();
        seedFunds().forEach((sf) => { if (!list.some((f) => f.branchCode === sf.branchCode)) list.push(sf); });
        return list;
      };
      if (saved && saved.dataVersion === DATA_VERSION) {
        setFunds(ensureFunds(saved.funds));
        setRequests(saved.requests || []);
        setDisbursements(saved.disbursements || []);
        setLiquidations(saved.liquidations || []);
        setReplenishments(saved.replenishments || []);
        setAuditLog(saved.auditLog || []);
      } else {
        /* First load after this upgrade — keep master funds but clear ALL
           existing transactions so the system starts with a clean database. */
        setFunds(ensureFunds(saved && saved.funds));
        setRequests([]);
        setDisbursements([]);
        setLiquidations([]);
        setReplenishments([]);
        setAuditLog([]);
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveState({ dataVersion: DATA_VERSION, funds, requests, disbursements, liquidations, replenishments, auditLog });
  }, [funds, requests, disbursements, liquidations, replenishments, auditLog, loaded]);

  /* ---- Requests ---- */
  const addRequest = useCallback((form) => {
    setRequests((rs) => [...rs, {
      id: uid("req"), requestNo: form.requestNo, date: form.date, employee: form.employee,
      department: form.department, branchCode: form.branchCode, purpose: form.purpose,
      amount: Number(form.amount), approver: form.approver, status: "Pending",
    }]);
    logAudit("Request Created", form.requestNo, `${form.employee} · ${peso(Number(form.amount))} · ${form.purpose}`);
  }, [logAudit]);

  const editRequest = useCallback((id, form) => {
    setRequests((rs) => rs.map((r) => (r.id === id ? {
      ...r, date: form.date, employee: form.employee, department: form.department,
      branchCode: form.branchCode, purpose: form.purpose, amount: Number(form.amount),
      approver: form.approver,
    } : r)));
    const r = requests.find((x) => x.id === id);
    logAudit("Edited", r ? r.requestNo : id, `Request updated · ${form.employee} · ${peso(Number(form.amount))}`);
  }, [logAudit, requests]);

  /* Simple single-step approve / reject (the multi-level approval matrix was removed). */
  const approveRequest = useCallback((id) => {
    setRequests((rs) => rs.map((r) => (r.id === id && r.status === "Pending" ? { ...r, status: "Approved" } : r)));
    const r = requests.find((x) => x.id === id);
    logAudit("Approved", r ? r.requestNo : id, "Request approved");
  }, [logAudit, requests]);

  const rejectRequest = useCallback((id) => {
    setRequests((rs) => rs.map((r) => (r.id === id && r.status === "Pending" ? { ...r, status: "Rejected" } : r)));
    const r = requests.find((x) => x.id === id);
    logAudit("Rejected", r ? r.requestNo : id, "Request rejected");
  }, [logAudit, requests]);

  /* ---- Disbursements ---- */
  const nextVoucherNo = "PCV-2026-" + String(disbursements.length + 1).padStart(4, "0");

  const confirmDisburse = useCallback((extra) => {
    const req = disburseTarget;
    if (!req) return;
    setDisbursements((ds) => [...ds, {
      id: uid("dv"), voucherNo: nextVoucherNo, date: extra.date, requestId: req.id,
      employee: req.employee, branchCode: req.branchCode, department: req.department,
      expenseCategory: extra.expenseCategory, amount: extra.amount, status: "Open",
      remarks: extra.remarks, billed: false,
    }]);
    setRequests((rs) => rs.map((r) => (r.id === req.id ? { ...r, status: "Disbursed" } : r)));
    logAudit("Released", nextVoucherNo, `Cash released to ${req.employee} · ${peso(extra.amount)}`);
    setDisburseTarget(null);
  }, [disburseTarget, nextVoucherNo, logAudit]);

  const updateRemarks = useCallback((id, remarks) => {
    setDisbursements((ds) => ds.map((d) => (d.id === id ? { ...d, remarks } : d)));
  }, []);

  const editDisbursement = useCallback((id, patch) => {
    setDisbursements((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  const toggleBilled = useCallback((id) => {
    setDisbursements((ds) => ds.map((d) => (d.id === id ? { ...d, billed: !d.billed } : d)));
  }, []);

  /* ---- Liquidation ---- */
  const saveLiquidation = useCallback((disbursementId, lines, attachments) => {
    const atts = attachments || [];
    setLiquidations((ls) => {
      const exists = ls.find((l) => l.disbursementId === disbursementId);
      if (exists) return ls.map((l) => (l.disbursementId === disbursementId ? { ...l, lines, attachments: atts } : l));
      return [...ls, { id: uid("liq"), disbursementId, createdDate: todayISO(), lines, attachments: atts }];
    });
    setDisbursements((ds) => ds.map((d) => (d.id === disbursementId ? { ...d, status: "Closed" } : d)));
    const d = disbursements.find((x) => x.id === disbursementId);
    const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    logAudit("Liquidated", d ? d.voucherNo : disbursementId, `${lines.length} receipt line(s) · ${peso(total)}${atts.length ? ` · ${atts.length} document(s)` : ""}`);
  }, [logAudit, disbursements]);

  /* ---- Replenishment ---- */
  const addReplenishment = useCallback((form) => {
    setReplenishments((rs) => [...rs, { id: uid("rep"), ...form }]);
    logAudit("Replenished", form.replenishmentNo, `${peso(Number(form.amount))} · ${form.method}${form.checkNo ? ` · ${form.checkNo}` : ""} · ${form.status}`);
  }, [logAudit]);

  const editReplenishment = useCallback((id, form) => {
    setReplenishments((rs) => rs.map((r) => (r.id === id ? { ...r, ...form } : r)));
    logAudit("Edited", form.replenishmentNo || id, `Replenishment updated · ${peso(Number(form.amount))} · ${form.status}`);
  }, [logAudit]);

  const completeReplenishment = useCallback((id) => {
    setReplenishments((rs) => rs.map((r) => (r.id === id ? { ...r, status: "Completed" } : r)));
    const r = replenishments.find((x) => x.id === id);
    logAudit("Replenished", r ? r.replenishmentNo : id, `Marked completed${r ? ` · ${peso(Number(r.amount))}` : ""}`);
  }, [logAudit, replenishments]);

  const deleteReplenishment = useCallback((id) => {
    const r = replenishments.find((x) => x.id === id);
    setReplenishments((rs) => rs.filter((x) => x.id !== id));
    logAudit("Deleted", r ? r.replenishmentNo : id, "Replenishment record removed");
  }, [logAudit, replenishments]);

  const exportLiquidation = useCallback((disbursement, liq) => {
    const rows = buildLiquidationExportRows(disbursement, liq);
    const meta = [
      ["Petty Cash Liquidation — Acumatica Import Sheet"],
      ["Voucher No.", disbursement.voucherNo],
      ["Employee", disbursement.employee],
      ["Branch", disbursement.branchCode],
      ["Company", companyOfBranch(disbursement.branchCode)],
      ["Requested Amount", disbursement.amount],
      ["Total Liquidated", rows.reduce((s, r) => s + r.Amount, 0)],
      [],
    ];
    const ws = XLSX.utils.aoa_to_sheet(meta);
    XLSX.utils.sheet_add_json(ws, rows, { origin: -1, header: ACUMATICA_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Liquidation");
    downloadWorkbook(wb, `Liquidation_${disbursement.voucherNo}.xlsx`);
  }, []);

  const exportAllToAcumatica = useCallback(() => {
    const rows = buildAllAcumaticaExportRows(disbursements, liquidations);
    const ws = XLSX.utils.json_to_sheet(rows, { header: ACUMATICA_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, ACUMATICA_PO_SHEET_NAME);
    downloadWorkbook(wb, `Acumatica_PO_Export_All_${todayISO()}.xlsx`);
  }, [disbursements, liquidations]);

  /* ---- Funds ---- */
  const addFund = useCallback((f) => {
    setFunds((fs) => [...fs, { id: uid("fund"), ...f }]);
  }, []);
  const editFund = useCallback((id, f) => {
    setFunds((fs) => fs.map((x) => (x.id === id ? { ...x, ...f } : x)));
  }, []);
  const deleteFund = useCallback((id) => {
    setFunds((fs) => fs.filter((x) => x.id !== id));
  }, []);
  /* Bulk beginning-balance update from the Dashboard "Edit Balances" modal. */
  const saveBalances = useCallback((updates) => {
    const map = new Map(updates.map((u) => [u.id, u.beginningBalance]));
    setFunds((fs) => fs.map((x) => (map.has(x.id) ? { ...x, beginningBalance: map.get(x.id) } : x)));
  }, []);

  /* ---- Plant-scoped views ---- */
  /* Every module only receives data for plants the user is allowed to see, so a
     custodian can never view or edit another plant's records. */
  const visibleFunds = useMemo(() => funds.filter((f) => inScope(f.branchCode)), [funds, inScope]);
  const visibleRequests = useMemo(() => requests.filter((r) => inScope(r.branchCode)), [requests, inScope]);
  const visibleDisbursements = useMemo(() => disbursements.filter((d) => inScope(d.branchCode)), [disbursements, inScope]);
  const visibleReplenishments = useMemo(() => replenishments.filter((r) => inScope(r.branchCode)), [replenishments, inScope]);
  const visibleLiquidations = useMemo(() => {
    const ids = new Set(visibleDisbursements.map((d) => d.id));
    return liquidations.filter((l) => ids.has(l.disbursementId));
  }, [liquidations, visibleDisbursements]);
  /* Dashboard plant tabs limited to the user's plants. */

  /* ---- Separate tab per plant ---- */
  /* The active tab is either a global module key ("audit") or a plant-scoped
     key ("A1+::requests"). Parse it so each module renders only its own plant. */
  const { plant: activePlant, module: activeModule } = parseTab(tab);
  const scopeCodes = useMemo(
    () => (activePlant && allowedPlants.includes(activePlant)) ? [activePlant] : allowedPlants,
    [activePlant, allowedPlants]
  );
  const scopedFunds = useMemo(() => visibleFunds.filter((f) => scopeCodes.includes(f.branchCode)), [visibleFunds, scopeCodes]);
  const scopedRequests = useMemo(() => visibleRequests.filter((r) => scopeCodes.includes(r.branchCode)), [visibleRequests, scopeCodes]);
  const scopedDisbursements = useMemo(() => visibleDisbursements.filter((d) => scopeCodes.includes(d.branchCode)), [visibleDisbursements, scopeCodes]);
  const scopedReplenishments = useMemo(() => visibleReplenishments.filter((r) => scopeCodes.includes(r.branchCode)), [visibleReplenishments, scopeCodes]);
  const scopedLiquidations = useMemo(() => {
    const ids = new Set(scopedDisbursements.map((d) => d.id));
    return visibleLiquidations.filter((l) => ids.has(l.disbursementId));
  }, [visibleLiquidations, scopedDisbursements]);
  /* Plant selector options limited to the active tab's plant so module forms
     default to the correct plant and the redundant in-page selector hides. */
  const scopedPlantOptions = useMemo(
    () => plantOptions.filter((p) => scopeCodes.includes(p.code)),
    [plantOptions, scopeCodes]
  );
  const activePlantLabel = activePlant ? plantLabel(activePlant) : "";
  /* Resolve the per-plant dashboard header from the canonical list, falling back
     to the funds master data so newly created plants get a working dashboard. */
  const activeBranch = useMemo(() => {
    if (!activePlant) return null;
    const db = DASHBOARD_BRANCHES.find((b) => b.branchCode === activePlant);
    if (db) return db;
    const f = funds.find((x) => x.branchCode === activePlant);
    return f ? { key: activePlant, label: f.label || plantLabel(activePlant) || activePlant, branchCode: activePlant } : null;
  }, [activePlant, funds]);

  /* ---- Roles, navigation & notifications ---- */
  const roleModuleKeys = (ROLES[role] || ROLES["Accounting"]).tabs;
  /* User's plants in canonical order, then any additional master-data plants so
     newly created plants automatically get their own sidebar group + dashboard. */
  const orderedPlants = useMemo(() => plantOptions, [plantOptions]);

  /* Build the grouped sidebar: an optional consolidated overview, one group per
     plant with that plant's modules, then the shared administration tabs. */
  const navGroups = useMemo(() => {
    const groups = [];
    const plantMods = PLANT_MODULES.filter((m) => roleModuleKeys.includes(m.key));
    if (orderedPlants.length > 1 && roleModuleKeys.includes("dashboard")) {
      groups.push({ key: "overview", label: "Overview", items: [
        { tabKey: "dashboard", label: "Consolidated Dashboard", icon: LayoutDashboard },
      ] });
    }
    orderedPlants.forEach((p) => {
      groups.push({
        key: "plant-" + p.code,
        label: p.label,
        items: plantMods.map((m) => ({ tabKey: plantTabKey(p.code, m.key), label: m.label, icon: m.icon })),
      });
    });
    const monMods = MONITORING_MODULES.filter((m) => roleModuleKeys.includes(m.key));
    if (monMods.length) {
      groups.push({ key: "monitoring", label: "Monitoring", items: monMods.map((m) => ({ tabKey: m.key, label: m.label, icon: m.icon })) });
    }
    const globalMods = GLOBAL_MODULES.filter((m) => roleModuleKeys.includes(m.key));
    if (globalMods.length) {
      groups.push({ key: "admin", label: "Administration", items: globalMods.map((m) => ({ tabKey: m.key, label: m.label, icon: m.icon })) });
    }
    return groups;
  }, [roleModuleKeys, orderedPlants]);

  /* Flat set of every valid tab key for this user — used to block navigation to
     unauthorized pages, including manual URL/state tampering. */
  const allowedTabs = useMemo(() => {
    const set = new Set();
    navGroups.forEach((g) => g.items.forEach((it) => set.add(it.tabKey)));
    return set;
  }, [navGroups]);
  const firstTab = (navGroups[0] && navGroups[0].items[0]) ? navGroups[0].items[0].tabKey : "dashboard";

  /* Keep the active tab valid whenever role/plants change. */
  useEffect(() => {
    if (loaded && !allowedTabs.has(tab)) setTab(firstTab);
  }, [role, loaded, allowedTabs]); // eslint-disable-line

  const navigate = useCallback((key, opts) => {
    /* Accept a bare module key from dashboard drill-downs and scope it to the
       plant currently in context (or the first allowed plant). */
    let target = key;
    if (!String(key).includes(TAB_SEP) && PLANT_MODULE_KEYS.includes(key)) {
      const cur = parseTab(tab).plant || (orderedPlants[0] && orderedPlants[0].code);
      if (cur) target = plantTabKey(cur, key);
    }
    if (!allowedTabs.has(target)) return;
    if (parseTab(target).module === "history") setHistoryFilter(opts && opts.type ? { type: opts.type } : null);
    setTab(target);
  }, [allowedTabs, tab, orderedPlants]);

  const notifications = useMemo(
    () => buildNotifications(visibleRequests, visibleDisbursements, visibleLiquidations, visibleReplenishments),
    [visibleRequests, visibleDisbursements, visibleLiquidations, visibleReplenishments]
  );

  const onNotifClick = useCallback((n) => {
    if (n.type === "approval" || n.type === "approved" || n.type === "rejected") navigate("requests");
    else if (n.type === "liquidation" || n.type === "overdue") navigate("liquidation");
    else if (n.type === "replenished" || n.type === "replenish-pending") navigate("replenishment");
  }, [navigate]);

  const uiValue = useMemo(() => ({ notifications, role, setRole: guardedSetRole, canSwitchRole: !!isAdmin, onNotifClick }), [notifications, role, guardedSetRole, isAdmin, onNotifClick]);

  if (!loaded) {
    return (
      <div className="pcp-root" style={{ alignItems: "center", justifyContent: "center" }}>
        <style>{CSS}</style>
        <div style={{ color: "var(--text-mut)", fontSize: 13 }}>Loading petty cash portal…</div>
      </div>
    );
  }

  return (
    <AppUI.Provider value={uiValue}>
    <div className="pcp-root">
      <style>{CSS}</style>
      <Sidebar tab={tab} setTab={setTab} role={role} navGroups={navGroups} userEmail={userEmail} userName={userName} onSignOut={handleSignOut} onChangePassword={() => setShowChangePw(true)} />
      <div className="pcp-main">
        {activeModule === "dashboard" && (
          activePlant && activeBranch ? (
            <>
              <TopBar
                title={activeBranch.label + " Dashboard"}
                sub={"Real-time summary of petty cash activity for " + activeBranch.label}
                right={<button className="pcp-btn" onClick={() => setShowEditBalances(true)}><Edit3 size={14} /> Edit Beginning Balances</button>}
              />
              <div className="pcp-content">
                <BranchDashboard
                  label={activeBranch.label}
                  branchCode={activeBranch.branchCode}
                  funds={scopedFunds} requests={scopedRequests} disbursements={scopedDisbursements} liquidations={scopedLiquidations} replenishments={scopedReplenishments}
                  onNavigate={navigate}
                />
              </div>
            </>
          ) : (
            <>
              <TopBar
                title="Consolidated Dashboard"
                sub="Real-time summary of petty cash activity across your assigned plants"
                right={<button className="pcp-btn" onClick={() => setShowEditBalances(true)}><Edit3 size={14} /> Edit Beginning Balances</button>}
              />
              <div className="pcp-content">
                <Dashboard funds={scopedFunds} requests={scopedRequests} disbursements={scopedDisbursements} liquidations={scopedLiquidations} replenishments={scopedReplenishments} onNavigate={navigate} canEdit={canEdit} />
              </div>
            </>
          )
        )}
        {activeModule === "requests" && (
          <RequestsTab
            key={tab}
            requests={scopedRequests} funds={scopedFunds}
            onCreate={addRequest} onEdit={editRequest}
            onApprove={approveRequest} onReject={rejectRequest}
            onDisburse={(req) => setDisburseTarget(req)}
            plantOptions={scopedPlantOptions} canApprove={canApprove} canRelease={canRelease}
            plantTitle={activePlantLabel}
          />
        )}
        {activeModule === "disbursements" && (
          <DisbursementsTab
            key={tab}
            disbursements={scopedDisbursements} liquidations={scopedLiquidations} requests={scopedRequests}
            onUpdateRemarks={updateRemarks} onToggleBilled={toggleBilled} onEditDisbursement={editDisbursement}
            plantOptions={scopedPlantOptions}
            plantTitle={activePlantLabel}
          />
        )}
        {activeModule === "liquidation" && (
          <LiquidationTab
            key={tab}
            disbursements={scopedDisbursements} liquidations={scopedLiquidations}
            onSaveLiquidation={saveLiquidation} onExport={exportLiquidation}
            onExportAll={exportAllToAcumatica}
            plantOptions={scopedPlantOptions}
            plantTitle={activePlantLabel}
          />
        )}
        {activeModule === "replenishment" && (
          <ReplenishmentTab
            key={tab}
            replenishments={scopedReplenishments} funds={scopedFunds}
            disbursements={scopedDisbursements} liquidations={scopedLiquidations}
            onCreate={addReplenishment} onEdit={editReplenishment}
            onComplete={completeReplenishment} onDelete={deleteReplenishment}
            plantOptions={scopedPlantOptions} canEdit={canEdit}
            plantTitle={activePlantLabel}
          />
        )}
        {activeModule === "history" && (
          <TransactionHistoryTab
            key={tab}
            requests={scopedRequests} disbursements={scopedDisbursements}
            liquidations={scopedLiquidations} replenishments={scopedReplenishments}
            initialFilter={historyFilter} plantOptions={scopedPlantOptions}
            plantTitle={activePlantLabel}
          />
        )}
        {activeModule === "report" && (
          <ManagementReportTab
            key={tab}
            funds={scopedFunds} requests={scopedRequests} disbursements={scopedDisbursements} liquidations={scopedLiquidations} replenishments={scopedReplenishments}
            auditLog={auditLog} generatedBy={userName || userEmail}
            plantTitle={activePlantLabel}
          />
        )}
        {activeModule === "aging" && (
          <LiquidationAgingTab
            funds={visibleFunds} requests={visibleRequests} disbursements={visibleDisbursements}
            liquidations={visibleLiquidations} replenishments={visibleReplenishments}
          />
        )}
        {activeModule === "audit" && (
          <AuditTrailTab auditLog={auditLog} />
        )}
        {activeModule === "masterdata" && (
          <MasterDataTab
            funds={funds} disbursements={disbursements} liquidations={liquidations} replenishments={replenishments}
            onAddFund={addFund} onEditFund={editFund} onDeleteFund={deleteFund}
          />
        )}
        {activeModule === "users" && (
          <UserManagementTab currentEmail={userEmail} onChangePassword={() => setShowChangePw(true)} />
        )}
        {activeModule === "settings" && (
          <SystemSettingsTab userName={userName} userEmail={userEmail} role={role} plants={allowedPlants} />
        )}
      </div>

      {disburseTarget && (
        <DisburseModal
          request={disburseTarget}
          nextVoucherNo={nextVoucherNo}
          onClose={() => setDisburseTarget(null)}
          onConfirm={confirmDisburse}
        />
      )}
      {showEditBalances && (
        <EditBalancesModal
          funds={visibleFunds}
          onClose={() => setShowEditBalances(false)}
          onSave={(updates) => { saveBalances(updates); setShowEditBalances(false); }}
        />
      )}
      {showChangePw && (
        <ChangePasswordModal onClose={() => setShowChangePw(false)} onDone={(msg) => logAudit("Password Changed", userEmail || "—", msg || "Password updated")} />
      )}
    </div>
    </AppUI.Provider>
  );
}

