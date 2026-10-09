import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as db from '../lib/db.js';

export default function MyInscriptionsPage({ user }) {
  const [rows, setRows] = useState([]);

  const load = () => {
    const ins = db.getInscriptionsForUser(user.id);
    const evs = db.getEvents();
    setRows(ins.map(i => ({ ...i, ev: evs.find(e => e.id === i.eventId) || null })).sort((a, b) => b.createdAt - a.createdAt));
  };

  useEffect(load, [user.id]);

  function cancel(id) {
    if (window.confirm('Cancelar esta inscrição?')) {
      db.cancelInscription(id);
      load();
    }
  }

  return (
    <main>
      <div className="toolbar">
        <div className="page-head" style={{ margin: 0 }}>
          <h1>Minhas inscrições</h1>
          <p>Aqui você acompanha e gerencia suas inscrições.</p>
        </div>
        <Link className="btn btn--primary" to="/eventos">Ver eventos</Link>
      </div>

      {rows.length === 0 ? (
        <div className="card"><div className="empty">
          <div className="ico">🎟️</div>
          <p>Você ainda não está inscrito(a) em nenhum evento.</p>
          <p style={{ marginTop: 12 }}><Link className="btn btn--primary" to="/eventos">Ver eventos disponíveis</Link></p>
        </div></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Data</th>
                  <th>Status da inscrição</th>
                  <th>Status do evento</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const si = db.STATUS_INSCRICAO[r.status] || { label: r.status, cls: '' };
                  const se = r.ev ? (db.STATUS_EVENTO[r.ev.status] || { label: r.ev.status, cls: '' }) : null;
                  const canCancel = r.status !== 'cancelada' && r.ev && r.ev.status !== 'cancelado';
                  return (
                    <tr key={r.id}>
                      <td><strong>{r.ev ? r.ev.title : '(evento removido)'}</strong></td>
                      <td>{r.ev ? db.formatDate(r.ev.date) + (r.ev.time ? ' ' + db.formatTime(r.ev.time) : '') : '—'}</td>
                      <td><span className={'badge ' + si.cls}>{si.label}</span></td>
                      <td>{se ? <span className={'badge ' + se.cls}>{se.label}</span> : '—'}</td>
                      <td>
                        {canCancel && <button className="btn btn--danger btn--sm" onClick={() => cancel(r.id)}>Cancelar</button>}
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
