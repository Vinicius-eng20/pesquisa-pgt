import React, { useEffect, useState } from "react";
import { api, type Service, type Contract } from "../api";
import { emojiFor, formatPrice, formatDate } from "../utils";

type Tab = "services" | "contracts" | "users";

export default function AdminPanel({ showToast }: { showToast: (m: string, k?: "ok" | "error") => void }) {
  const [tab, setTab] = useState<Tab>("services");
  const [services, setServices] = useState<Service[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, c, u] = await Promise.all([api.adminServices(), api.adminContracts(), api.adminUsers()]);
      setServices(s.services);
      setContracts(c.contracts);
      setUsers(u.users);
    } catch (e: any) {
      showToast(e?.message || "Erro ao carregar dados do admin.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (id: number, status: string, label: string) => {
    try {
      await api.setServiceStatus(id, status);
      showToast(label + ".");
      load();
    } catch (e: any) {
      showToast(e?.message || "Erro.", "error");
    }
  };

  const toggleSuspend = async (u: any) => {
    const next = !u.suspended;
    const verb = next ? "Suspender" : "Reativar";
    if (!window.confirm(`${verb} a conta de ${u.name}?`)) return;
    try {
      await api.setSuspended(u.id, next);
      showToast("Conta " + (next ? "suspensa." : "reativada."));
      load();
    } catch (e: any) {
      showToast(e?.message || "Erro.", "error");
    }
  };

  const counts = {
    pending: services.filter((s) => s.status === "pending").length,
    active: contracts.filter((c) => c.status === "active").length,
    suspended: users.filter((u) => u.suspended).length,
  };

  return (
    <div>
      <div className="section-head">
        <div>
          <h2>Painel do Administrador</h2>
          <p className="muted" style={{ margin: 0 }}>Aprove ou remova serviços, suspenda contas e acompanhe todos os dados.</p>
        </div>
      </div>

      <div className="grid cols-3" style={{ marginBottom: 20 }}>
        <div className="card muted"><div className="muted" style={{ fontSize: 12 }}>Aguardando aprovação</div><div style={{ fontSize: 26, fontWeight: 800 }}>{counts.pending}</div></div>
        <div className="card muted"><div className="muted" style={{ fontSize: 12 }}>Contratos ativos</div><div style={{ fontSize: 26, fontWeight: 800 }}>{counts.active}</div></div>
        <div className="card muted"><div className="muted" style={{ fontSize: 12 }}>Contas suspensas</div><div style={{ fontSize: 26, fontWeight: 800 }}>{counts.suspended}</div></div>
      </div>

      <div className="tabs" style={{ marginBottom: 18 }}>
        {([["services", "Serviços"], ["contracts", "Contratos"], ["users", "Usuários"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div className="empty"><div className="big">⏳</div>Carregando...</div>
      ) : tab === "services" ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Serviço</th><th>Fornecedor</th><th>Preço</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span className="svc-emoji" style={{ width: 36, height: 36, fontSize: 18 }}>{emojiFor(s.category)}</span>
                      <div><div style={{ fontWeight: 700 }}>{s.title}</div><div className="muted" style={{ fontSize: 12 }}>{s.category}</div></div>
                    </div>
                  </td>
                  <td>{s.ownerName}</td>
                  <td>{formatPrice(s.price)}</td>
                  <td><span className={"status " + s.status}>{s.status}</span></td>
                  <td>
                    <div className="actions">
                      {s.status !== "approved" && <button className="btn success small" onClick={() => setStatus(s.id, "approved", "Serviço aprovado")}>Aprovar</button>}
                      {s.status === "pending" && <button className="btn ghost small" onClick={() => setStatus(s.id, "removed", "Serviço removido")}>Remover</button>}
                      {s.status === "approved" && <button className="btn danger small" onClick={() => setStatus(s.id, "removed", "Serviço removido")}>Remover</button>}
                      {s.status === "removed" && <button className="btn small" onClick={() => setStatus(s.id, "approved", "Serviço reativado")}>Reativar</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {services.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 24 }}>Nenhum serviço publicado.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : tab === "contracts" ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Serviço</th><th>Contratante</th><th>Fornecedor</th><th>Status</th><th>Data</th></tr></thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 700 }}>{c.serviceTitle}</td>
                  <td>{c.clientName}</td>
                  <td>{c.providerName}</td>
                  <td><span className={"status " + c.status}>{c.status === "active" ? "Ativo" : "Cancelado"}</span></td>
                  <td className="muted">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
              {contracts.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 24 }}>Nenhum contrato ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Tipo</th><th>Serviços</th><th>Contratos</th><th>Suspensa</th><th>Ações</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>{u.name}</td>
                  <td className="muted">{u.email}</td>
                  <td><span className={"role-badge " + u.role}>{u.role === "admin" ? "Admin" : "Usuário"}</span></td>
                  <td>{u.serviceCount}</td>
                  <td>{u.contractCount}</td>
                  <td>{u.suspended ? <span className="status removed">Sim</span> : <span className="muted">Não</span>}</td>
                  <td>
                    <div className="actions">
                      {u.role !== "admin" && (
                        u.suspended
                          ? <button className="btn success small" onClick={() => toggleSuspend(u)}>Reativar</button>
                          : <button className="btn danger small" onClick={() => toggleSuspend(u)}>Suspender</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
