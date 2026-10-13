import React, { useEffect, useState } from "react";
import { api, type Service, type User } from "../api";
import { emojiFor, formatPrice, formatDate } from "../utils";
import PublishForm from "../PublishForm";

const STATUS_LABEL: Record<string, string> = {
  approved: "Aprovado",
  pending: "Aguardando",
  removed: "Removido",
};

export default function MyServices({ user, showToast }: { user: User; showToast: (m: string, k?: "ok" | "error") => void }) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { services } = await api.myServices();
      setServices(services);
    } catch (e: any) {
      showToast(e?.message || "Erro ao carregar.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const remove = async (s: Service) => {
    if (!window.confirm(`Remover o serviço "${s.title}"? Os contratos dele também serão removidos.`)) return;
    try {
      await api.deleteService(s.id);
      showToast("Serviço removido.");
      load();
    } catch (e: any) {
      showToast(e?.message || "Não foi possível remover.", "error");
    }
  };

  return (
    <div>
      <div className="section-head">
        <div>
          <h2>Meus serviços</h2>
          <p className="muted" style={{ margin: 0 }}>Os serviços que você publicou e o status de cada um.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 12 }}>Publicar novo serviço</h3>
        <PublishForm onSuccess={() => { showToast("Serviço publicado!"); load(); }} showToast={showToast} />
      </div>

      {loading ? (
        <div className="empty"><div className="big">⏳</div>Carregando...</div>
      ) : services.length === 0 ? (
        <div className="empty">
          <div className="big">📭</div>
          <h3>Você ainda não publicou nenhum serviço</h3>
          <p>Use o formulário acima para oferecer um serviço.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Serviço</th><th>Categoria</th><th>Preço</th><th>Status</th><th>Criado em</th><th></th></tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span className="svc-emoji" style={{ width: 36, height: 36, fontSize: 18 }}>{emojiFor(s.category)}</span>
                      <div>
                        <div style={{ fontWeight: 700 }}>{s.title}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{s.description.length > 60 ? s.description.slice(0, 60) + "…" : s.description}</div>
                      </div>
                    </div>
                  </td>
                  <td>{s.category}</td>
                  <td>{formatPrice(s.price)}</td>
                  <td><span className={"status " + s.status}>{STATUS_LABEL[s.status] || s.status}</span></td>
                  <td className="muted">{formatDate(s.createdAt)}</td>
                  <td><div className="actions"><button className="btn danger small" onClick={() => remove(s)}>Remover</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
