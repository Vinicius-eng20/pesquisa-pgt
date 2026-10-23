import React, { useState } from "react";
import { api, type User } from "../api";

export default function Profile({
  user,
  onUserChange,
  showToast,
}: {
  user: User;
  onUserChange: (u: User) => void;
  showToast: (m: string, k?: "ok" | "error") => void;
}) {
  const [name, setName] = useState(user.name);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password && password.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setBusy(true);
    try {
      const { user: updated } = await api.updateMe(name, password);
      onUserChange(updated);
      setPassword("");
      showToast("Perfil atualizado com sucesso.");
    } catch (err: any) {
      setError(err?.message || "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="section-head">
        <div>
          <h2>Meu perfil</h2>
          <p className="muted" style={{ margin: 0 }}>Atualize seus dados e sua senha.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <form onSubmit={submit}>
          <div className="field">
            <label>Nome</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>E-mail (não pode ser alterado)</label>
            <input className="input" value={user.email} disabled />
          </div>
          <div className="field">
            <label>Nova senha (deixe em branco para não mudar)</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? <span className="spin" /> : "Salvar alterações"}</button>
        </form>
      </div>
    </div>
  );
}
