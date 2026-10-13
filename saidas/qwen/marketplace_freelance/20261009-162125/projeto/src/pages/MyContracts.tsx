import React, { useEffect, useState } from "react";
import { api, type Contract, type User } from "../api";
import { formatDate } from "../utils";

export default function MyContracts({ user }: { user: User }) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { contracts } = await api.myContracts();
      setContracts(contracts);
    } catch {
      /* handled by global */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="section-head">
        <div>
          <h2>Meus contratos</h2>
          <p className="muted" style={{ margin: 0 }}>Contratos em que você participa, como contratante ou fornecedor.</p>
        </div>
      </div>

      {loading ? (
        <div className="empty"><div className="big">⏳</div>Carregando...</div>
      ) : contracts.length === 0 ? (
        <div className="empty">
          <div className="big">🤝</div>
          <h3>Você ainda não tem contratos</h3>
          <p>Contrate um serviço na aba "Explorar" para começar.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Serviço</th><th>Contratante</th><th>Fornecedor</th><th>Status</th><th>Data</th></tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 700 }}>{c.serviceTitle}</td>
                  <td>{c.clientName}{c.clientName === user.name ? " (você)" : ""}</td>
                  <td>{c.providerName}{c.providerName === user.name ? " (você)" : ""}</td>
                  <td><span className={"status " + c.status}>{c.status === "active" ? "Ativo" : "Cancelado"}</span></td>
                  <td className="muted">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
