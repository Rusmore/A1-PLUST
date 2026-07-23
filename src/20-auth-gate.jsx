/* ============================= AUTH GATE ============================= */

const LOCAL_SESSION_KEY = "pcp-local-session";

/* Validate a username/password against the built-in accounts defined in
   index.html (window.PCP_LOCAL_USERS). Used only when no Supabase database
   is configured, so there is a working login/logout out of the box. */
function localSignIn(username, password) {
  const users = window.PCP_LOCAL_USERS || [];
  const u = users.find((x) =>
    String(x.user).trim().toLowerCase() === String(username).trim().toLowerCase() &&
    String(x.password) === String(password)
  );
  if (!u) return null;
  return { user: u.user, role: (u.role && ROLES[u.role]) ? u.role : "Custodian", name: u.name || u.user, plants: u.plants || "ALL" };
}

/* Sign-in screen. mode="cloud" uses Supabase email/password; mode="local"
   uses the built-in accounts (username/password). */
function LoginScreen({ mode, onLocalLogin }) {
  const cloud = mode === "cloud";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setNotice(""); setBusy(true);
    try {
      if (cloud) {
        const res = await window.PCP_AUTH.signIn(identifier.trim(), password);
        if (res && res.error) setError(res.error.message || "Sign-in failed.");
        /* On success, onAuthStateChange in <Root/> swaps in the app. */
      } else {
        const res = onLocalLogin(identifier, password);
        if (res && res.error) setError(res.error.message);
      }
    } catch (err) {
      setError(cloud ? "Could not reach the server. Check your connection." : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setError(""); setNotice("");
    if (!identifier.trim()) { setError("Enter your email first, then click Forgot password."); return; }
    try {
      const res = await window.PCP_AUTH.resetPassword(identifier.trim());
      if (res && res.error) setError(res.error.message);
      else setNotice("If that email has an account, a reset link is on its way.");
    } catch (err) {
      setError("Could not send the reset email.");
    }
  };

  return (
    <div className="pcp-root">
      <style>{CSS}</style>
      <div className="pcp-login-wrap">
        <div className="pcp-login-card">
          <div className="pcp-login-head">
            <div className="pcp-brand-mark"><Wallet size={18} /></div>
            <div className="pcp-login-title">Petty Cash Management System</div>
            <div className="pcp-login-sub">Sign in to continue</div>
          </div>
          <form className="pcp-login-body" onSubmit={submit}>
            {error && <div className="pcp-login-err">{error}</div>}
            {notice && <div className="pcp-login-ok">{notice}</div>}
            <div className="pcp-field">
              <label>{cloud ? "Email" : "Username"}</label>
              <input
                type={cloud ? "email" : "text"}
                className="pcp-input"
                autoComplete="username"
                placeholder={cloud ? "you@company.com" : "e.g. a1plus"}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
            <div className="pcp-field">
              <label>Password</label>
              <input type="password" className="pcp-input" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="pcp-btn pcp-btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 4 }} disabled={busy}>
              {busy ? "Signing in…" : "Sign In"}
            </button>
            {cloud && (
              <div className="pcp-login-foot">
                <button type="button" className="pcp-link-btn" onClick={forgot}>Forgot password?</button>
              </div>
            )}
            <div className="pcp-login-foot" style={{ marginTop: 8 }}>
              Access is provided by your administrator.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* Root chooses the auth mode:
   - "cloud": a Supabase database is configured → email login (shared, secure).
   - "local": no database, but built-in accounts exist → username login.
   - "off":  neither → app opens directly as admin (offline/demo). */
