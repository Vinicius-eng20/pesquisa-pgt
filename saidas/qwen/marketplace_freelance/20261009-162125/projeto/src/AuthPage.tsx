import React, { useState } from "react";
import { api, setToken, type User } from "./api";

export default function AuthPage({ onAuthed }: { onAuthed: (u: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      let res;
      if (mode === "login") res = await api.login(email, password);
      else res = await api.register(name, email, password);
      setToken(res.token);
      onAuthed(res.user);
    } catch (err: any) {
      setError(err?.message || "Algo deu errado. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="auth-head">
          <div className="logo">◆</div>
          <h1>FreelanceMarket</h1>
          <p className="muted">Ofereça, contrate e gerencie serviços freelance.</p>
        </div>

        <div className="tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Entrar</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Criar conta</button>
        </div>

        <form onSubmit={submit}>
          {mode === "register" && (
            <div className="field">
              <label>Seu nome</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria Silva" required />
            </div>
          )}
          <div className="field">
            <label>E-mail</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" required />
          </div>
          <div className="field">
            <label>Senha</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" ? "Mínimo de 6 caracteres" : "Sua senha"} required />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div style={{ marginTop: 16 }}>
            <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={busy} type="submit">
              {busy ? <span className="spin" /> : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </div>
        </form>

        <div className="divider" />
        <p className="muted" style={{ fontSize: 13, textAlign: "center", margin: 0 }}>
          Novos serviços passam pela aprovação do administrador antes de ficarem visíveis para todos.
        </p>
      </div>
    </div>
  );
}
