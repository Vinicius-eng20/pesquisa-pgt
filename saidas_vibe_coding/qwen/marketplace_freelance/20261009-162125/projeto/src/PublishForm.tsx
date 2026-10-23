import React, { useState } from "react";
import { api } from "../api";
import { CATEGORIES } from "../utils";

export default function PublishForm({
  onSuccess,
  showToast,
}: {
  onSuccess: (s: any) => void;
  showToast: (m: string, k?: "ok" | "error") => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const p = Number(price);
    if (!Number.isFinite(p) || p < 0) {
      setError("Informe um preço válido (maior ou igual a zero).");
      return;
    }
    setBusy(true);
    try {
      const { service } = await api.publishService({ title, description, category, price: p });
      setTitle(""); setDescription(""); setPrice("");
      showToast("Serviço publicado! Aguardando aprovação do administrador.");
      onSuccess(service);
    } catch (err: any) {
      setError(err?.message || "Não foi possível publicar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label>Título do serviço</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Design de logo" required />
      </div>
      <div className="field">
        <label>Descrição</label>
        <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="O que você entrega, prazos, formas de pagamento..." required />
      </div>
      <div className="grid cols-2">
        <div className="field">
          <label>Categoria</label>
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </div>
        <div className="field">
          <label>Preço (R$)</label>
          <input className="input" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" required />
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="form-hint">Após publicar, o serviço fica com status "Aguardando" até o administrador aprovar.</div>
      <div style={{ marginTop: 14 }}>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? <span className="spin" /> : "Publicar serviço"}</button>
      </div>
    </form>
  );
}
