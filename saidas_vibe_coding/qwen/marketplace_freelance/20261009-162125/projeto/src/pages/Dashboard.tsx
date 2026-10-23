import React, { useEffect, useState } from "react";
import { api, type Service, type User } from "../api";
import { emojiFor, formatPrice, formatDate } from "../utils";
import PublishForm from "../PublishForm";

export default function Dashboard({
  user,
  onHire,
  showToast,
}: {
  user: User;
  onHire: (id: number) => void;
  showToast: (m: string, k?: "ok" | "error") => void;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { services } = await api.listServices();
      setServices(services);
    } catch (e: any) {
      showToast(e?.message || "Erro ao carregar serviços.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const cats = Array.from(new Set(services.map((s) => s.category))).sort();
  const filtered = services.filter((s) => {
    const q = query.toLowerCase();
    const okQ = !q || s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || (s.ownerName || "").toLowerCase().includes(q);
    const okC = !cat || s.category === cat;
    return okQ && okC;
  });

  const hire = async (id: number) => {
    try {
      await api.createContract(id);
      onHire(id);
      showToast("Contrato criado com sucesso!");
    } catch (e: any) {
      showToast(e?.message || "Não foi possível contratar.", "error");
    }
  };

  return (
    <div>
      <div className="section-head">
        <div>
          <h2>Explorar serviços</h2>
          <p className="muted" style={{ margin: 0 }}>Aqui ficam os serviços que já foram aprovados. Encontre o que você precisa e contrate.</p>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Publicar um serviço que você oferece</h3>
          <PublishForm onSuccess={(s) => { showToast("Serviço publicado e enviado para aprovação!"); load(); }} showToast={showToast} />
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Filtros</h3>
          <div className="field">
            <label>Buscar</label>
            <input className="input" placeholder="Título, descrição ou fornecedor..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="field">
            <label>Categoria</label>
            <select className="select" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Todas</option>
              {cats.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>{filtered.length} serviço(s) encontrado(s).</p>
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        {loading ? (
          <div className="empty"><div className="big">⏳</div>Carregando serviços...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="big">🔍</div>
            <h3>Nenhum serviço por aqui</h3>
            <p>Nenhum serviço aprovado ainda. Seja o primeiro a publicar!</p>
          </div>
        ) : (
          <div className="grid cols-2">
            {filtered.map((s) => {
              const mine = s.ownerName && user.name === s.ownerName && s.id;
              return (
                <div key={s.id} className="card svc">
                  <div className="svc-top">
                    <div className="svc-emoji">{emojiFor(s.category)}</div>
                    <div>
                      <div className="svc-title">{s.title}</div>
                      <div className="svc-owner">por {s.ownerName}</div>
                    </div>
                  </div>
                  <div className="svc-desc">{s.description}</div>
                  <div className="pill-row">
                    <span className="tag">{s.category}</span>
                    <span className="muted" style={{ fontSize: 12 }}>{formatDate(s.createdAt)}</span>
                  </div>
                  <div className="svc-foot">
                    <div className="price">{formatPrice(s.price)} <small>/ projeto</small></div>
                    <button className="btn primary small" onClick={() => hire(s.id)}>Contratar</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
