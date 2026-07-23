/* ============================= ACCOUNT & ADMIN ============================= */

/* Change the signed-in user's own password. Uses the Supabase auth client
   (window.PCP_AUTH.updatePassword) so the new password is hashed server-side. */
function ChangePasswordModal({ onClose, onDone }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setOk("");
    if (pw.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (pw !== pw2) { setError("The two passwords do not match."); return; }
    setBusy(true);
    try {
      const auth = window.PCP_AUTH;
      if (!auth || !auth.updatePassword) { setError("Password changes are handled by your administrator in this deployment."); setBusy(false); return; }
      const res = await auth.updatePassword(pw);
      if (res && res.error) { setError(res.error.message || "Could not update password."); }
      else { setOk("Password updated successfully."); if (onDone) onDone("Password updated"); setTimeout(onClose, 1200); }
    } catch (err) {
      setError("Could not update password. Check your connection.");
    } finally { setBusy(false); }
  };

  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3>Change Password</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <form className="pcp-modal-body" onSubmit={submit}>
          {error && <div className="pcp-login-err">{error}</div>}
          {ok && <div className="pcp-login-ok">{ok}</div>}
          <div className="pcp-field">
            <label>New Password</label>
            <input type="password" className="pcp-input" autoComplete="new-password" placeholder="At least 8 characters" value={pw} onChange={(e) => setPw(e.target.value)} required />
          </div>
          <div className="pcp-field">
            <label>Confirm New Password</label>
            <input type="password" className="pcp-input" autoComplete="new-password" placeholder="Re-type new password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
          </div>
          <div className="pcp-modal-foot" style={{ padding: "8px 0 0" }}>
            <button type="button" className="pcp-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="pcp-btn pcp-btn-primary" disabled={busy}>{busy ? "Saving…" : "Update Password"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* Read-only roster of the configured users and their access — Accounting only.
   Accounts themselves are created/reset in the Supabase dashboard, so this view
   documents who has access to what. */
function UserManagementTab({ currentEmail, onChangePassword }) {
  const users = window.PCP_USERS || {};
  const rows = Object.keys(users).map((email) => ({ email, ...users[email] }));
  const plantsLabel = (p) => (p === "ALL" || !p) ? "All plants" : resolvePlants(p).map(plantLabel).join(", ");
  return (
    <div>
      <TopBar
        title="User Management"
        sub="Authorized users, their roles and plant access (Role-Based Access Control)"
        right={<button className="pcp-btn" onClick={onChangePassword}><KeyRound size={14} /> Change My Password</button>}
      />
      <div className="pcp-content">
        <div className="pcp-card">
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead><tr><th>Name</th><th>Login (email)</th><th>Role</th><th>Plant Access</th><th>Admin</th></tr></thead>
              <tbody>
                {rows.length ? rows.map((u) => (
                  <tr key={u.email}>
                    <td style={{ fontWeight: 600 }}>{u.name}{String(u.email).toLowerCase() === String(currentEmail || "").toLowerCase() ? " (you)" : ""}</td>
                    <td>{u.email}</td>
                    <td>{ROLES[u.role] ? ROLES[u.role].label : (u.role || "Custodian")}</td>
                    <td>{plantsLabel(u.plants)}</td>
                    <td>{(u.role === "Accounting") ? <Badge status="Approved" /> : <span style={{ color: "var(--text-mut)" }}>—</span>}</td>
                  </tr>
                )) : <tr><td colSpan={5} className="pcp-empty">No users configured. Add them in index.html (window.PCP_USERS) and in your Supabase project.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="pcp-card pcp-card-pad" style={{ marginTop: 16, fontSize: 12.5, color: "var(--text-mut)", lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Managing accounts</div>
          Passwords are hashed and stored securely by the authentication provider (Supabase). To add, remove or reset a user's
          password, use the Supabase dashboard (Authentication → Users). Each user can also change their own password from the
          sidebar. Role and plant access for each account are configured in <code>index.html</code> under <code>window.PCP_USERS</code>.
        </div>
      </div>
    </div>
  );
}

function SystemSettingsTab({ userName, userEmail, role, plants }) {
  const cloud = !!(window.PCP_AUTH && window.PCP_AUTH.enabled);
  const plantsLabel = (plants && plants.length) ? plants.map(plantLabel).join(", ") : "All plants";
  return (
    <div>
      <TopBar title="System Settings" sub="Environment, data storage and access configuration" />
      <div className="pcp-content">
        <div className="pcp-grid-2">
          <div className="pcp-card pcp-card-pad">
            <div className="pcp-section-title"><Settings size={15} color="#c8102e" /> Your Account</div>
            <table className="pcp-table"><tbody>
              <tr><td style={{ fontWeight: 600 }}>Name</td><td>{userName || "—"}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Login</td><td>{userEmail || "Local mode"}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Role</td><td>{ROLES[role] ? ROLES[role].label : role}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Plant Access</td><td>{plantsLabel}</td></tr>
            </tbody></table>
          </div>
          <div className="pcp-card pcp-card-pad">
            <div className="pcp-section-title"><ShieldCheck size={15} color="#c8102e" /> Security & Storage</div>
            <table className="pcp-table"><tbody>
              <tr><td style={{ fontWeight: 600 }}>Authentication</td><td>{cloud ? "Supabase (secure, hashed passwords)" : "Local mode"}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Access control</td><td>Role-Based Access Control (RBAC) with plant scoping</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Shared database</td><td>{cloud ? "Enabled" : "Local browser only"}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Data version</td><td>{DATA_VERSION}</td></tr>
            </tbody></table>
          </div>
        </div>
      </div>
    </div>
  );
}

