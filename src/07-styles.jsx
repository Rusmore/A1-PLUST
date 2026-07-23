/* ============================= STYLES ============================= */

const CSS = `
  :root {
    --ink: #12172a;
    --ink-2: #1c2440;
    --paper: #f3f4f7;
    --card: #ffffff;
    --line: #e3e5ea;
    --text: #1c2130;
    --text-mut: #6b7182;
    --brand: #c8102e;
    --brand-dark: #970c22;
    --amber: #b9790a;
    --green: #15803d;
    --green-bg: #e8f5ec;
    --red-bg: #fbe9e9;
    --amber-bg: #fdf3e0;
    --blue-bg: #eaf1fb;
    --blue: #2054a3;
  }
  * { box-sizing: border-box; }
  .pcp-root {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: var(--paper);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    font-size: 13.5px;
    line-height: 1.45;
  }
  .pcp-root * { font-variant-numeric: tabular-nums; }
  .pcp-num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }

  /* ---- Sidebar ---- */
  .pcp-sidebar {
    width: 232px;
    flex-shrink: 0;
    background: var(--ink);
    color: #cfd3e0;
    display: flex;
    flex-direction: column;
    padding: 18px 14px;
    position: sticky;
    top: 0;
    height: 100vh;
  }
  .pcp-brand-row {
    display: flex; align-items: center; gap: 10px;
    padding: 4px 6px 18px 6px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    margin-bottom: 14px;
  }
  .pcp-brand-mark {
    width: 34px; height: 34px; border-radius: 8px;
    background: linear-gradient(135deg, var(--brand), var(--brand-dark));
    display: flex; align-items: center; justify-content: center;
    color: white; flex-shrink: 0;
  }
  .pcp-brand-title { font-weight: 700; font-size: 14.5px; color: #fff; letter-spacing: 0.2px; }
  .pcp-brand-sub { font-size: 10.5px; color: #8891a8; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 1px; }

  .pcp-nav { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; flex: 1 1 auto; min-height: 0; overflow-y: auto; }
  .pcp-nav::-webkit-scrollbar { width: 6px; }
  .pcp-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 3px; }
  .pcp-nav-group-label {
    font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;
    color: #7f889f; padding: 12px 8px 4px 8px; margin-top: 2px;
  }
  .pcp-nav-group:first-child .pcp-nav-group-label { margin-top: 0; }
  .pcp-nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 11px 8px 14px; border-radius: 8px; cursor: pointer;
    color: #b7bccd; font-size: 12.5px; font-weight: 500;
    transition: background 0.12s, color 0.12s;
    border: none; background: transparent; text-align: left; width: 100%;
  }
  .pcp-nav-item:hover { background: rgba(255,255,255,0.06); color: #fff; }
  .pcp-nav-item.active { background: var(--brand); color: #fff; }
  .pcp-nav-item svg { flex-shrink: 0; }

  .pcp-sidebar-foot {
    margin-top: auto; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.08);
  }
  .pcp-logos-strip { display: flex; align-items: center; gap: 12px; padding: 10px 6px; }
  .pcp-logos-strip img { max-height: 40px; max-width: 104px; object-fit: contain; filter: brightness(0) invert(1); opacity: 0.9; }

  /* ---- Main ---- */
  .pcp-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .pcp-topbar {
    background: var(--card); border-bottom: 1px solid var(--line);
    padding: 14px 26px; display: flex; align-items: center; justify-content: space-between;
    position: sticky; top: 0; z-index: 5;
  }
  .pcp-topbar h1 { font-size: 18px; font-weight: 700; margin: 0; letter-spacing: -0.2px; }
  .pcp-topbar-sub { font-size: 12px; color: var(--text-mut); margin-top: 2px; }
  .pcp-content { padding: 22px 26px 60px 26px; }

  .pcp-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: 7px; border: 1px solid var(--line);
    background: #fff; color: var(--text); font-size: 12.5px; font-weight: 600;
    cursor: pointer; transition: all 0.12s; white-space: nowrap;
  }
  .pcp-btn:hover { border-color: #c7cad3; background: #fafafb; }
  .pcp-btn-primary { background: var(--brand); border-color: var(--brand); color: #fff; }
  .pcp-btn-primary:hover { background: var(--brand-dark); border-color: var(--brand-dark); }
  .pcp-btn-ghost { border-color: transparent; background: transparent; }
  .pcp-btn-ghost:hover { background: var(--paper); }
  .pcp-btn-sm { padding: 5px 10px; font-size: 11.5px; }
  .pcp-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .pcp-btn-danger { color: var(--brand); }

  .pcp-card {
    background: var(--card); border: 1px solid var(--line); border-radius: 12px;
  }
  .pcp-card-pad { padding: 18px 20px; }

  .pcp-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
  .pcp-kpi {
    background: var(--card); border: 1px solid var(--line); border-radius: 12px;
    padding: 15px 17px; position: relative; overflow: hidden;
  }
  .pcp-kpi-label { font-size: 11px; color: var(--text-mut); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .pcp-kpi-value { font-size: 21px; font-weight: 700; margin-top: 6px; letter-spacing: -0.3px; }
  .pcp-kpi-icon {
    position: absolute; right: 14px; top: 14px; width: 30px; height: 30px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
  }
  .pcp-kpi-foot { font-size: 11px; margin-top: 6px; color: var(--text-mut); }

  .pcp-section-title { font-size: 14px; font-weight: 700; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px; }
  .pcp-eyebrow { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; color: var(--brand); margin-bottom: 4px; }

  .pcp-grid-2 { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; }
  .pcp-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

  table.pcp-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  table.pcp-table thead th {
    text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px;
    color: var(--text-mut); font-weight: 700; padding: 9px 10px; border-bottom: 1px solid var(--line);
    background: #fafbfc; white-space: nowrap;
  }
  table.pcp-table tbody td { padding: 9px 10px; border-bottom: 1px solid #eef0f3; vertical-align: middle; }
  table.pcp-table tbody tr:hover { background: #fafbfd; }
  table.pcp-table tbody tr:last-child td { border-bottom: none; }
  .pcp-table-wrap { overflow-x: auto; }

  .pcp-badge {
    display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 99px;
    font-size: 10.5px; font-weight: 700; white-space: nowrap; letter-spacing: 0.2px;
  }
  .pcp-badge-green { background: var(--green-bg); color: var(--green); }
  .pcp-badge-amber { background: var(--amber-bg); color: var(--amber); }
  .pcp-badge-red { background: var(--red-bg); color: var(--brand); }
  .pcp-badge-blue { background: var(--blue-bg); color: var(--blue); }
  .pcp-badge-gray { background: #eef0f3; color: var(--text-mut); }

  .pcp-input, .pcp-select, textarea.pcp-input {
    width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: 7px;
    font-size: 12.5px; background: #fff; color: var(--text); font-family: inherit;
  }
  .pcp-input:focus, .pcp-select:focus, textarea.pcp-input:focus { outline: 2px solid var(--brand); outline-offset: 0; border-color: var(--brand); }
  .pcp-field { margin-bottom: 12px; }
  .pcp-field label { display: block; font-size: 11.5px; font-weight: 600; color: var(--text-mut); margin-bottom: 5px; }
  .pcp-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  .pcp-modal-backdrop {
    position: fixed; inset: 0; background: rgba(15,18,30,0.55); display: flex;
    align-items: flex-start; justify-content: center; z-index: 50; padding: 40px 20px; overflow-y: auto;
  }
  .pcp-modal {
    background: #fff; border-radius: 14px; width: 100%; max-width: 620px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  }
  .pcp-modal-head {
    padding: 18px 22px; border-bottom: 1px solid var(--line); display: flex;
    align-items: center; justify-content: space-between;
  }
  .pcp-modal-head h3 { margin: 0; font-size: 15px; font-weight: 700; }
  .pcp-modal-body { padding: 20px 22px; max-height: 65vh; overflow-y: auto; }
  .pcp-modal-foot { padding: 14px 22px; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; gap: 8px; }

  .pcp-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin-bottom: 18px; }
  .pcp-tab {
    padding: 9px 14px; font-size: 12.5px; font-weight: 600; color: var(--text-mut);
    cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; background: none; border-left:none;border-right:none;border-top:none;
  }
  .pcp-tab.active { color: var(--brand); border-bottom-color: var(--brand); }

  .pcp-empty { text-align: center; padding: 40px 20px; color: var(--text-mut); }
  .pcp-flow {
    display: flex; align-items: stretch; gap: 0; background: var(--ink);
    border-radius: 12px; overflow: hidden; margin-bottom: 18px;
  }
  .pcp-flow-step { flex: 1; padding: 16px 20px; position: relative; color: #fff; }
  .pcp-flow-step + .pcp-flow-step { border-left: 1px solid rgba(255,255,255,0.12); }
  .pcp-flow-click { cursor: pointer; transition: background 0.12s; }
  .pcp-flow-click:hover { background: rgba(255,255,255,0.08); }
  .pcp-flow-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.6px; color: #9098b3; font-weight: 700; }
  .pcp-flow-value { font-size: 19px; font-weight: 700; margin-top: 6px; }
  .pcp-flow-arrow { position: absolute; right: -11px; top: 50%; transform: translateY(-50%); z-index: 2; color: #676f8c; }

  .pcp-liq-line { display: grid; grid-template-columns: 100px 1fr 1.1fr 1fr 0.85fr 100px 32px; gap: 8px; align-items: center; margin-bottom: 8px; }
  .pcp-liq-line-head { display: grid; grid-template-columns: 100px 1fr 1.1fr 1fr 0.85fr 100px 32px; gap: 8px; font-size: 10.5px; text-transform: uppercase; color: var(--text-mut); font-weight: 700; margin-bottom: 8px; letter-spacing: 0.4px;}

  .pcp-chip-list { display: flex; flex-wrap: wrap; gap: 8px; }
  .pcp-voucher-card {
    border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; cursor: pointer;
    transition: all 0.12s; margin-bottom: 8px;
  }
  .pcp-voucher-card:hover { border-color: var(--brand); }
  .pcp-voucher-card.active { border-color: var(--brand); background: var(--red-bg); }

  ::-webkit-scrollbar { width: 9px; height: 9px; }
  ::-webkit-scrollbar-thumb { background: #d3d6de; border-radius: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }

  /* ---- Approval matrix ---- */
  .pcp-appr-chips { display: flex; gap: 4px; flex-wrap: wrap; }
  .pcp-appr-chip {
    display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 99px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.2px; white-space: nowrap;
  }
  .pcp-appr-approved { background: var(--green-bg); color: var(--green); }
  .pcp-appr-pending { background: var(--amber-bg); color: var(--amber); }
  .pcp-appr-rejected { background: var(--red-bg); color: var(--brand); }
  .pcp-appr-row {
    display: grid; grid-template-columns: 150px 1fr auto; gap: 10px; align-items: center;
    padding: 10px 0; border-bottom: 1px solid #eef0f3;
  }
  .pcp-appr-row:last-child { border-bottom: none; }
  .pcp-appr-level { font-weight: 700; font-size: 12.5px; }

  /* ---- Notifications & role ---- */
  .pcp-notif-dot {
    position: absolute; top: 1px; right: 1px; min-width: 15px; height: 15px; padding: 0 3px;
    background: var(--brand); color: #fff; border-radius: 99px; font-size: 9px; font-weight: 800;
    display: flex; align-items: center; justify-content: center; line-height: 1;
  }
  .pcp-notif-panel {
    position: absolute; right: 0; top: calc(100% + 8px); width: 340px; background: #fff;
    border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 16px 44px rgba(0,0,0,0.18);
    z-index: 60; overflow: hidden;
  }
  .pcp-notif-head { padding: 12px 16px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; }
  .pcp-notif-list { max-height: 400px; overflow-y: auto; }
  .pcp-notif-item { display: flex; gap: 10px; padding: 11px 16px; border-bottom: 1px solid #f0f1f4; cursor: pointer; }
  .pcp-notif-item:hover { background: #fafbfd; }
  .pcp-notif-item:last-child { border-bottom: none; }
  .pcp-notif-ic { width: 28px; height: 28px; border-radius: 7px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .pcp-role-select { width: auto; min-width: 150px; font-weight: 600; }
  .pcp-role-pill {
    display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 7px;
    background: var(--blue-bg); color: var(--blue); font-size: 12px; font-weight: 700; white-space: nowrap;
  }
  .pcp-role-badge {
    display: flex; align-items: center; gap: 6px; padding: 7px 10px; margin: 0 6px 10px 6px;
    background: rgba(255,255,255,0.06); border-radius: 8px; color: #cfd3e0; font-size: 11.5px; font-weight: 600;
  }
  .pcp-user-card { padding: 8px 10px; margin: 0 6px 8px 6px; background: rgba(255,255,255,0.06); border-radius: 8px; }
  .pcp-user-name { color: #fff; font-size: 12.5px; font-weight: 700; }
  .pcp-user-card .pcp-role-badge { margin: 4px 0 0 0; }
  .pcp-user-row {
    display: flex; align-items: center; gap: 6px; padding: 6px 8px 6px 10px; margin: 0 6px 10px 6px;
    background: rgba(255,255,255,0.04); border-radius: 8px;
  }
  .pcp-user-email { flex: 1; min-width: 0; color: #9098b3; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pcp-kpi-click { cursor: pointer; transition: border-color 0.12s, box-shadow 0.12s; }
  .pcp-kpi-click:hover { border-color: var(--brand); box-shadow: 0 4px 14px rgba(200,16,46,0.10); }

  /* ---- Login ---- */
  .pcp-login-wrap { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; min-height: 100vh; }
  .pcp-login-card {
    width: 100%; max-width: 380px; background: var(--card); border: 1px solid var(--line);
    border-radius: 14px; box-shadow: 0 18px 50px rgba(15,18,30,0.12); overflow: hidden;
  }
  .pcp-login-head { background: var(--ink); color: #fff; padding: 22px 24px; }
  .pcp-login-head .pcp-brand-mark { margin-bottom: 12px; }
  .pcp-login-title { font-size: 16px; font-weight: 700; }
  .pcp-login-sub { font-size: 11.5px; color: #9098b3; margin-top: 3px; }
  .pcp-login-body { padding: 22px 24px; }
  .pcp-login-err { background: var(--red-bg); color: var(--brand); font-size: 12px; padding: 9px 12px; border-radius: 8px; margin-bottom: 12px; }
  .pcp-login-ok { background: var(--green-bg); color: var(--green); font-size: 12px; padding: 9px 12px; border-radius: 8px; margin-bottom: 12px; }
  .pcp-login-foot { font-size: 11px; color: var(--text-mut); text-align: center; margin-top: 14px; }
  .pcp-link-btn { background: none; border: none; color: var(--brand); font-size: 11.5px; cursor: pointer; padding: 0; font-weight: 600; }

  /* ---- Report ---- */
  .pcp-report-head { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
  .pcp-report-head img { max-height: 46px; max-width: 130px; object-fit: contain; }
  .pcp-report-title { font-size: 17px; font-weight: 800; letter-spacing: -0.2px; }
  .pcp-report-sub { font-size: 11.5px; color: var(--text-mut); }
  table.pcp-table tfoot td { padding: 9px 10px; border-top: 2px solid var(--line); font-weight: 800; background: #fafbfc; }

  @media (max-width: 980px) {
    .pcp-kpi-grid { grid-template-columns: repeat(2, 1fr); }
    .pcp-grid-2, .pcp-grid-3 { grid-template-columns: 1fr; }
    .pcp-sidebar { width: 74px; }
    .pcp-brand-title, .pcp-brand-sub, .pcp-nav-item span, .pcp-logos-strip { display: none; }
  }

  /* ---- Report Center (on-screen professional preview) ---- */
  .pcp-rc-toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; }
  .pcp-rc-filters { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .pcp-rc-field label { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-mut); margin-bottom: 4px; }
  .pcp-doc-scroll { overflow: auto; background: #eceef2; border: 1px solid var(--line); border-radius: 12px; padding: 22px; }
  .pcp-doc {
    background: #fff; margin: 0 auto; box-shadow: 0 6px 24px rgba(15,18,30,0.14);
    padding: 26px 30px; position: relative; font-family: Calibri, Arial, Helvetica, sans-serif; color: #1a1a1a;
  }
  .pcp-doc.portrait { max-width: 794px; }
  .pcp-doc.landscape { max-width: 1123px; }
  .pcp-doc-wm { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; overflow: hidden; }
  .pcp-doc-wm span { font-size: 120px; font-weight: 800; color: rgba(200,16,46,0.07); transform: rotate(-30deg); white-space: nowrap; }
  .pcp-doc-head { display: flex; align-items: center; gap: 14px; padding-bottom: 8px; border-bottom: 2.5px solid #111; position: relative; z-index: 1; }
  .pcp-doc-head img { height: 52px; max-width: 150px; object-fit: contain; }
  .pcp-doc-head-c { flex: 1; text-align: center; }
  .pcp-doc-company { font-size: 16px; font-weight: 800; letter-spacing: 0.3px; }
  .pcp-doc-portal { font-size: 11px; font-weight: 700; color: var(--brand); letter-spacing: 1px; }
  .pcp-doc-title { font-size: 13px; font-weight: 800; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .pcp-doc-ref { min-width: 130px; text-align: right; font-size: 8px; color: #555; line-height: 1.5; }
  .pcp-doc-ref b { color: #111; font-size: 9px; }
  .pcp-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 22px; padding: 9px 2px 4px; font-size: 10px; position: relative; z-index: 1; }
  .pcp-doc-meta b { display: inline-block; min-width: 96px; color: #333; }
  .pcp-doc-count { text-align: right; font-size: 10px; font-weight: 700; color: #1f2d3d; padding-bottom: 8px; }
  table.pcp-doc-table { width: 100%; border-collapse: collapse; position: relative; z-index: 1; }
  table.pcp-doc-table thead th { background: #1f2d3d; color: #fff; font-size: 9.5px; font-weight: 700; padding: 6px 7px; border: 1px solid #1f2d3d; }
  table.pcp-doc-table tbody td { padding: 5px 7px; border: 1px solid #d5d9e0; font-size: 9.5px; vertical-align: top; word-break: break-word; }
  table.pcp-doc-table tbody tr:nth-child(even) td { background: #f4f6f9; }
  .pcp-doc-table .a-right { text-align: right; } .pcp-doc-table .a-center { text-align: center; } .pcp-doc-table .a-left { text-align: left; }
  table.pcp-doc-table tr.grp td { background: #e8edf3; font-weight: 800; font-size: 10px; }
  table.pcp-doc-table tr.sub td { background: #eef1f5; font-weight: 800; }
  table.pcp-doc-table tr.tot td { background: #1f2d3d; color: #fff; font-weight: 800; font-size: 10.5px; border-color: #1f2d3d; }
  table.pcp-doc-table tr.nf td { text-align: center; font-style: italic; color: #666; letter-spacing: 2px; }
  .pcp-doc-foot { border-top: 1.5px solid #111; margin-top: 6px; padding-top: 5px; font-size: 8.5px; color: #444; display: flex; justify-content: space-between; position: relative; z-index: 1; }
  .pcp-doc-sign { display: flex; justify-content: space-between; gap: 24px; margin-top: 34px; position: relative; z-index: 1; }
  .pcp-doc-sign .box { flex: 1; text-align: center; font-size: 9.5px; }
  .pcp-doc-sign .who { color: #333; margin-bottom: 30px; }
  .pcp-doc-sign .line { border-top: 1px solid #111; padding-top: 3px; font-weight: 700; }
  .pcp-doc-sign .role { font-size: 8.5px; color: #555; }

  @media (max-width: 980px) { .pcp-rc-filters { grid-template-columns: repeat(2, 1fr); } }

  /* ---- Clickable charts + drill-down ---- */
  .pcp-chart-click { cursor: pointer; }
  .pcp-chart-hint { font-size: 10.5px; color: var(--text-mut); margin-top: 8px; display: flex; align-items: center; gap: 5px; }
  .pcp-chart-hint svg { opacity: 0.7; }

  .pcp-drill-backdrop {
    position: fixed; inset: 0; background: rgba(15,18,30,0.5); z-index: 60;
    display: flex; justify-content: flex-end; animation: pcpDrillFade 0.18s ease;
  }
  .pcp-drill {
    width: min(1120px, 97vw); height: 100vh; background: var(--paper); overflow-y: auto;
    box-shadow: -14px 0 46px rgba(0,0,0,0.28); display: flex; flex-direction: column;
    animation: pcpDrillIn 0.24s cubic-bezier(.2,.7,.3,1);
  }
  .pcp-drill.closing { animation: pcpDrillOut 0.2s ease forwards; }
  .pcp-drill-backdrop.closing { animation: pcpDrillFadeOut 0.2s ease forwards; }
  @keyframes pcpDrillFade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes pcpDrillFadeOut { from { opacity: 1; } to { opacity: 0; } }
  @keyframes pcpDrillIn { from { transform: translateX(46px); opacity: 0.3; } to { transform: none; opacity: 1; } }
  @keyframes pcpDrillOut { from { transform: none; opacity: 1; } to { transform: translateX(46px); opacity: 0; } }

  .pcp-drill-head { position: sticky; top: 0; z-index: 3; background: #fff; border-bottom: 1px solid var(--line); padding: 14px 20px; }
  .pcp-breadcrumb { font-size: 11.5px; color: var(--text-mut); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .pcp-breadcrumb .crumb { display: inline-flex; align-items: center; gap: 6px; }
  .pcp-breadcrumb .crumb.link { color: var(--brand); cursor: pointer; font-weight: 600; }
  .pcp-breadcrumb b { color: var(--text); }
  .pcp-drill-title { font-size: 16.5px; font-weight: 700; margin-top: 5px; display: flex; align-items: center; gap: 9px; }
  .pcp-drill-title .pill { font-size: 11px; font-weight: 700; color: #fff; background: var(--brand); border-radius: 99px; padding: 2px 10px; }
  .pcp-drill-body { padding: 16px 20px 48px; }

  .pcp-drill-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
  .pcp-drill-search { position: relative; flex: 1; min-width: 220px; }
  .pcp-drill-search svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-mut); }
  .pcp-drill-search input { width: 100%; padding: 8px 10px 8px 32px; border: 1px solid var(--line); border-radius: 7px; font-size: 12.5px; }
  .pcp-drill-filters { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 12px; }
  .pcp-drill-filters .pcp-rc-field label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; color: var(--text-mut); margin-bottom: 3px; }
  @media (max-width: 980px) { .pcp-drill-filters { grid-template-columns: repeat(2, 1fr); } }

  .pcp-sortable { cursor: pointer; user-select: none; white-space: nowrap; }
  .pcp-sortable:hover { color: var(--brand); }
  .pcp-sort-ind { font-size: 9px; opacity: 0.7; margin-left: 3px; }

  .pcp-detail-card { background: #fff; border: 1px solid var(--line); border-left: 3px solid var(--brand); border-radius: 8px; padding: 14px 16px; margin: 2px 0 6px; }
  .pcp-detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 20px; font-size: 12px; }
  .pcp-detail-grid .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--text-mut); font-weight: 700; }
  @media (max-width: 760px) { .pcp-detail-grid { grid-template-columns: 1fr 1fr; } }
  .pcp-receipts { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
  .pcp-receipt { display: inline-flex; flex-direction: column; align-items: center; gap: 4px; width: 92px; text-decoration: none; color: var(--text); }
  .pcp-receipt img { width: 92px; height: 66px; object-fit: cover; border-radius: 6px; border: 1px solid var(--line); }
  .pcp-receipt .fileicon { width: 92px; height: 66px; border-radius: 6px; border: 1px solid var(--line); background: #f4f6f9; display: flex; align-items: center; justify-content: center; }
  .pcp-receipt span { font-size: 10px; color: var(--text-mut); max-width: 92px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pcp-receipt-link { color: var(--brand); font-weight: 600; cursor: pointer; }

  .pcp-pager { display: flex; align-items: center; gap: 10px; justify-content: flex-end; margin-top: 14px; font-size: 12px; color: var(--text-mut); }
  .pcp-drill-count { font-size: 12px; color: var(--text-mut); }

  /* ---- Print (management report) ---- */
  @media print {
    .pcp-sidebar, .pcp-topbar, .pcp-tabs, .pcp-no-print { display: none !important; }
    .pcp-root { display: block; }
    .pcp-content { padding: 0 !important; }
    .pcp-card { border: 1px solid #ccc; break-inside: avoid; }
    body, .pcp-root { background: #fff !important; }
    table.pcp-table thead th { background: #f0f0f0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "requests", label: "Petty Cash Requests", icon: ClipboardList },
  { key: "disbursements", label: "Release Ledger", icon: Receipt },
  { key: "liquidation", label: "Liquidation", icon: FileSpreadsheet },
  { key: "replenishment", label: "Replenishment", icon: RefreshCw },
  { key: "history", label: "Transaction History", icon: History },
  { key: "report", label: "Reports", icon: FileText },
  { key: "aging", label: "Liquidation Aging", icon: Clock },
  { key: "audit", label: "Audit Trail", icon: ShieldCheck },
  { key: "masterdata", label: "Funds & Master Data", icon: Database },
  { key: "users", label: "User Management", icon: UserCog },
  { key: "settings", label: "System Settings", icon: Settings },
];

/* Modules that get their OWN separate tab per plant (Manila / Warner / Disney /
   RG and Co.). Each plant + module pair is a distinct nav tab so a custodian
   only ever sees the tabs for the plant(s) they are allowed to access. */
const PLANT_MODULES = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "requests", label: "Petty Cash Requests", icon: ClipboardList },
  { key: "disbursements", label: "Release Ledger", icon: Receipt },
  { key: "liquidation", label: "Liquidation", icon: FileSpreadsheet },
  { key: "replenishment", label: "Replenishment", icon: RefreshCw },
  { key: "history", label: "Transaction History", icon: History },
  { key: "report", label: "Reports", icon: FileText },
];
const PLANT_MODULE_KEYS = PLANT_MODULES.map((m) => m.key);

/* System-wide modules that stay as a single shared tab (not per plant). */
const GLOBAL_MODULES = [
  { key: "audit", label: "Audit Trail", icon: ShieldCheck },
  { key: "masterdata", label: "Funds & Master Data", icon: Database },
  { key: "users", label: "User Management", icon: UserCog },
  { key: "settings", label: "System Settings", icon: Settings },
];

/* Consolidated monitoring modules that span every plant in one shared view.
   The Liquidation Aging report lives here so it always covers ALL plants. */
const MONITORING_MODULES = [
  { key: "aging", label: "Liquidation Aging", icon: Clock },
];

/* Encode / decode a plant-scoped tab key, e.g. "A1+::requests". */
const TAB_SEP = "::";
const plantTabKey = (plantCode, moduleKey) => plantCode + TAB_SEP + moduleKey;
const parseTab = (tab) => {
  const i = (tab || "").indexOf(TAB_SEP);
  if (i === -1) return { plant: null, module: tab };
  return { plant: tab.slice(0, i), module: tab.slice(i + TAB_SEP.length) };
};

function Sidebar({ tab, setTab, role, navGroups, userEmail, userName, onSignOut, onChangePassword }) {
  const groups = navGroups || [];
  return (
    <aside className="pcp-sidebar">
      <div className="pcp-brand-row">
        <div className="pcp-brand-mark"><Wallet size={18} /></div>
        <div>
          <div className="pcp-brand-title">Petty Cash System</div>
          <div className="pcp-brand-sub">Imprest Fund System</div>
        </div>
      </div>
      <nav className="pcp-nav">
        {groups.map((group) => (
          <div className="pcp-nav-group" key={group.key}>
            {group.label && <div className="pcp-nav-group-label">{group.label}</div>}
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.tabKey}
                  className={"pcp-nav-item" + (tab === item.tabKey ? " active" : "")}
                  onClick={() => setTab(item.tabKey)}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="pcp-sidebar-foot">
        {(userName || role) && (
          <div className="pcp-user-card" title="Signed-in user">
            {userName && <div className="pcp-user-name">{userName}</div>}
            {role && <div className="pcp-role-badge" style={{ marginTop: 4 }}><UserCog size={13} /> <span>{ROLES[role] ? ROLES[role].label : role}</span></div>}
          </div>
        )}
        {userEmail && (
          <div className="pcp-user-row">
            <span className="pcp-user-email" title={userEmail}>{userEmail}</span>
            <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" style={{ color: "#cfd3e0" }} onClick={onSignOut} title="Sign out">
              <LogOut size={13} />
            </button>
          </div>
        )}
        {onChangePassword && (
          <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" style={{ color: "#cfd3e0", width: "100%", justifyContent: "flex-start", marginTop: 2 }} onClick={onChangePassword} title="Change your password">
            <KeyRound size={13} /> Change Password
          </button>
        )}
        <div className="pcp-logos-strip">
          <img src={LOGO_A1} alt="A1+ Paper and Plastic Inc." />
          <img src={LOGO_SPI} alt="Starkson Paper and Plastic Corporation" />
        </div>
        <div style={{ fontSize: 10.5, color: "#6b7290", padding: "2px 6px" }}>
          A1+ Paper &amp; Plastic Inc. · Starkson Paper &amp; Plastic Corp.
        </div>
      </div>
    </aside>
  );
}

/* Shared UI context so every tab's TopBar can render the global notification
   bell and role switcher without threading props through each component. */
const AppUI = React.createContext(null);

const NOTIF_ICON = { clip: ClipboardList, check: Check, x: X, alert: AlertTriangle, sheet: FileSpreadsheet, refresh: RefreshCw };

function NotificationBell() {
  const ui = useContext(AppUI);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  if (!ui) return null;
  const notes = ui.notifications || [];
  const count = notes.length;
  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button className="pcp-btn pcp-btn-ghost" style={{ position: "relative", padding: "8px 10px" }} onClick={() => setOpen((o) => !o)} title="Notifications">
        <Bell size={16} />
        {count > 0 && <span className="pcp-notif-dot">{count > 9 ? "9+" : count}</span>}
      </button>
      {open && (
        <div className="pcp-notif-panel">
          <div className="pcp-notif-head">
            <strong>Notifications</strong>
            <span style={{ fontSize: 11, color: "var(--text-mut)" }}>{count} active</span>
          </div>
          <div className="pcp-notif-list">
            {notes.length ? notes.map((n) => {
              const Icon = NOTIF_ICON[n.icon] || Bell;
              const tint = n.type === "overdue" || n.type === "rejected" ? "var(--brand)"
                : n.type === "approved" || n.type === "replenished" ? "var(--green)"
                : n.type === "approval" ? "var(--amber)" : "var(--blue)";
              return (
                <div key={n.id} className="pcp-notif-item" onClick={() => { if (ui.onNotifClick) ui.onNotifClick(n); setOpen(false); }}>
                  <div className="pcp-notif-ic" style={{ background: tint + "18", color: tint }}><Icon size={14} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-mut)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.text}</div>
                    <div style={{ fontSize: 10, color: "#9098b3" }}>{fmtDate(n.date)}</div>
                  </div>
                </div>
              );
            }) : <div className="pcp-empty" style={{ padding: 24 }}>You're all caught up</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function RoleSelector() {
  const ui = useContext(AppUI);
  if (!ui) return null;
  if (!ui.canSwitchRole) {
    return (
      <span className="pcp-role-pill" title="Your access level (set by your administrator)">
        <ShieldCheck size={13} /> {ui.role}
      </span>
    );
  }
  return (
    <select className="pcp-select pcp-role-select" value={ui.role} onChange={(e) => ui.setRole(e.target.value)} title="Super admin — view the system as any role">
      {ROLE_NAMES.map((r) => <option key={r} value={r}>{r === "Administrator" ? "Administrator (super)" : "View as: " + r}</option>)}
    </select>
  );
}

function TopBar({ title, sub, right }) {
  return (
    <div className="pcp-topbar">
      <div>
        <h1>{title}</h1>
        {sub && <div className="pcp-topbar-sub">{sub}</div>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {right}
        <NotificationBell />
      </div>
    </div>
  );
}

function Badge({ status }) {
  const map = {
    Pending: "amber", Approved: "blue", Rejected: "red", Disbursed: "green",
    Open: "blue", Closed: "gray",
    "Not Liquidated": "amber", "Partially Liquidated": "blue",
    "Fully Liquidated": "green", "Over-Liquidated": "red",
    Draft: "gray", Submitted: "amber", Verified: "blue", Completed: "green", Released: "green",
  };
  const cls = map[status] || "gray";
  return <span className={`pcp-badge pcp-badge-${cls}`}>{status}</span>;
}
