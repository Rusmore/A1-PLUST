function Root() {
  const cloudEnabled = !!(window.PCP_AUTH && window.PCP_AUTH.enabled);
  const localUsers = window.PCP_LOCAL_USERS || [];
  const localEnabled = !cloudEnabled && localUsers.length > 0;

  const [checking, setChecking] = useState(cloudEnabled);
  const [user, setUser] = useState(null);
  const [localSession, setLocalSession] = useState(() => {
    try { const v = localStorage.getItem(LOCAL_SESSION_KEY); return v ? JSON.parse(v) : null; }
    catch (e) { return null; }
  });

  useEffect(() => {
    if (!cloudEnabled) return;
    let active = true;
    window.PCP_AUTH.getUser().then((u) => { if (active) { setUser(u); setChecking(false); } });
    window.PCP_AUTH.onChange((session) => { if (active) { setUser(session ? session.user : null); setChecking(false); } });
    return () => { active = false; };
  }, [cloudEnabled]);

  const cloudSignOut = useCallback(() => { window.PCP_AUTH.signOut(); }, []);

  const doLocalLogin = useCallback((username, password) => {
    const s = localSignIn(username, password);
    if (!s) return { error: { message: "Invalid username or password." } };
    try { localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(s)); } catch (e) {}
    setLocalSession(s);
    return {};
  }, []);

  const localSignOut = useCallback(() => {
    try { localStorage.removeItem(LOCAL_SESSION_KEY); } catch (e) {}
    setLocalSession(null);
  }, []);

  /* ---- Cloud mode ---- */
  if (cloudEnabled) {
    if (checking) {
      return (
        <div className="pcp-root" style={{ alignItems: "center", justifyContent: "center" }}>
          <style>{CSS}</style>
          <div style={{ color: "var(--text-mut)", fontSize: 13 }}>Checking sign-in…</div>
        </div>
      );
    }
    if (!user) return <LoginScreen mode="cloud" />;
    const access = resolveUserAccess(user.email);
    return <App userEmail={user.email} userName={access.name} onSignOut={cloudSignOut} userRole={access.role} isAdmin={access.isAdmin} userPlants={access.plants} />;
  }

  /* ---- Local mode (built-in accounts) ---- */
  if (localEnabled) {
    if (!localSession) return <LoginScreen mode="local" onLocalLogin={doLocalLogin} />;
    return (
      <App
        userEmail={localSession.user}
        userName={localSession.name}
        onSignOut={localSignOut}
        userRole={localSession.role}
        isAdmin={localSession.role === "Accounting"}
        userPlants={localSession.plants}
      />
    );
  }

  /* ---- No auth configured ---- */
  return <App />;
}

/* ============================= MOUNT ============================= */

createRoot(document.getElementById("root")).render(<Root />);
