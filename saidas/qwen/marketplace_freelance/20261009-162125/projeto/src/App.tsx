import React, { useCallback, useEffect, useState } from "react";
import { api, getToken, setToken, type User } from "./api";
import AuthPage from "./AuthPage";
import Shell from "./Shell";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "error" } | null>(null);

  const showToast = useCallback((msg: string, kind: "ok" | "error" = "ok") => {
    setToast({ msg, kind });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const loadMe = useCallback(async () => {
    if (!getToken()) {
      setChecking(false);
      return null;
    }
    try {
      const { user } = await api.me();
      setUser(user);
      return user;
    } catch {
      setToken(null);
      setUser(null);
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const handleAuthed = (u: User) => setUser(u);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    setToken(null);
    setUser(null);
  };

  if (checking) {
    return (
      <div className="auth-wrap">
        <div className="inline-spin" style={{ width: 26, height: 26 }} />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthPage onAuthed={handleAuthed} />
        {toast && <div className={"toast " + (toast.kind === "error" ? "error" : "")}>{toast.msg}</div>}
      </>
    );
  }

  return (
    <Shell user={user} onUserChange={setUser} onLogout={handleLogout} showToast={showToast} />
  );
}
