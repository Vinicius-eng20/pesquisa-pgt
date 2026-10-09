import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as db from '../lib/db.js';
import { NotAdmin } from './ManageEventsPage.jsx';

export default function AllInscriptionsPage({ user }) {
  if (user.role !== 'admin') return <NotAdmin />;

  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = () => {
    const ins = db.getInscriptions();
    const evs = db.getEvents();
    setRows(ins.map(i => ({ ...i, ev: evs.find(e => e.id === i.eventId) || null })).sort((a, b) => b.createdAt - a.createdAt));
  };
  useEffect(load, []);

  let filtered = rows;
  if (filter === 'active') filtered = filtered.filter(r => r.status !== 'cancelada');
  if (filter === 'confirmed') filtered = filtered.filter(r => r.status === 'confirmada');
  if (filter === 'pending') filtered = filtered.filter(r => r.status === 'pendente');
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(r =>
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.email && r.email.toLowerCase().includes(q)) ||
      (r.ev && r.ev.title.toLowerCase().includes(q))
    );
  }

  function setStatus(id, status) {
    db.setInscriptionStatus(id, status);
    load();
  }

  function cancel(id) {
    if (window.confirm('Cancelar esta inscrição do participante?')) {
      db.setInscriptionStatus(id, 'cancelada');
      load();
    }
  }

  return (
    <main>
      <div className="toolbar">
        <div className="page-head" style={{ margin: 0 }}>
          <h1>Todas as inscrições</h1>
          <p>Confirme presenças e acompanhe todos os participantes.</p>
        </div>
        <Link className="btn btn--ghost" to="/organizar/eventos">Gerenciar eventos</Link>
      </div>

      <div className="toolbar" style={{ marginTop: -8, marginBottom: 16 }}>
        <select className="btn btn--ghost" style={{ minWidth: 200 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Todas</option>
          <option value="active">Ativas</option>
          <option value="pending">Pendentes</option>
          <option value="confirmed">Confirmadas</option>
        </select>
        <input
          className="btn btn--ghost"
          style={{ minWidth: 240, textAlign: 'left', fontWeight: 400 }}
          placeholder="Buscar por nome, e-mail ou evento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card"><div className="empty">
          <div className="ico">🔎</div>
          <p>Nenhuma inscrição encontrada com esses filtros.</p>
        </div></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Participante</th>
                  <th>Contato</th>
                  <th>Evento</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const si = db.STATUS_INSCRICAO[r.status] || { label: r.status, cls: '' };
                  const se = r.ev ? (db.STATUS_EVENTO[r.ev.status] || { label: r.ev.status, cls: '' }) : null;
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.name}</strong>
                        {r.note && <div style={{ fontSize: 12, color: 'var(--muted)' }}>“{r.note}”</div>}
                      </td>
                      <td style={{ fontSize: 13 }}>
                        <div>{r.email}</div>
                        {r.phone && <div style={{ color: 'var(--muted)' }}>{r.phone}</div>}
                      </td>
                      <td>
                        {r.ev ? <>{r.ev.title} {se && <div><span className={'badge ' + se.cls}>{se.label}</span></div>}</> : '(removido)'}
                      </td>
                      <td><span className={'badge ' + si.cls}>{si.label}</span></td>
                      <td>
                        <div className="actions">
                          {r.status !== 'confirmada' && r.status !== 'cancelada' && (
                            <button className="btn btn--primary btn--sm" onClick={() => setStatus(r.id, 'confirmada')}>Confirmar</button>
                          )}
                          {r.status !== 'cancelada' && (
                            <button className="btn btn--danger btn--sm" onClick={() => cancel(r.id)}>Cancelar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
