import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as db from '../lib/db.js';

export default function ManageEventsPage({ user }) {
  if (user.role !== 'admin') return <NotAdmin />;

  const [events, setEvents] = useState(db.getEvents());

  const load = () => setEvents(db.getEvents());
  useEffect(load, []);

  const insc = db.getInscriptions();
  const countBy = (id) => insc.filter(i => i.eventId === id && i.status !== 'cancelada').length;

  function toggleStatus(ev) {
    const next = ev.status === 'aberto' ? 'fechado' : 'aberto';
    db.setEventStatus(ev.id, next);
    load();
  }

  function cancelEvent(ev) {
    if (window.confirm(`Cancelar o evento "${ev.title}"? Os inscritos verão o evento como cancelado.`)) {
      db.setEventStatus(ev.id, 'cancelado');
      load();
    }
  }

  return (
    <main>
      <div className="toolbar">
        <div className="page-head" style={{ margin: 0 }}>
          <h1>Gerenciar eventos</h1>
          <p>Crie, edite e controle as inscrições dos seus eventos.</p>
        </div>
        <Link className="btn btn--primary" to="/organizar/eventos/novo">+ Novo evento</Link>
      </div>

      {events.length === 0 ? (
        <div className="card"><div className="empty">
          <div className="ico">📋</div>
          <p>Você ainda não criou nenhum evento.</p>
          <p style={{ marginTop: 12 }}><Link className="btn btn--primary" to="/organizar/eventos/novo">Criar o primeiro evento</Link></p>
        </div></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Data</th>
                  <th>Local</th>
                  <th>Inscritos</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {events.map(ev => {
                  const st = db.STATUS_EVENTO[ev.status] || { label: ev.status, cls: '' };
                  return (
                    <tr key={ev.id}>
                      <td><strong>{ev.title}</strong></td>
                      <td>{db.formatDate(ev.date)}{ev.time ? ' ' + db.formatTime(ev.time) : ''}</td>
                      <td>{ev.location || '—'}</td>
                      <td><span className="badge">{countBy(ev.id)}{ev.capacity ? ` / ${ev.capacity}` : ''}</span></td>
                      <td><span className={'badge ' + st.cls}>{st.label}</span></td>
                      <td>
                        <div className="actions">
                          <Link className="btn btn--ghost btn--sm" to={'/organizar/eventos/' + ev.id}>Editar</Link>
                          {ev.status !== 'cancelado' && (
                            <button className="btn btn--ghost btn--sm" onClick={() => toggleStatus(ev)}>
                              {ev.status === 'aberto' ? 'Encerrar' : 'Abrir'}
                            </button>
                          )}
                          {ev.status !== 'cancelado' && (
                            <button className="btn btn--danger btn--sm" onClick={() => cancelEvent(ev)}>Cancelar</button>
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

export function NotAdmin() {
  return (
    <main>
      <div className="card"><div className="empty">
        <div className="ico">🔐</div>
        <p>Você não tem permissão para acessar esta área.</p>
        <p style={{ marginTop: 12 }}><Link className="btn btn--primary" to="/eventos">Ir para eventos</Link></p>
      </div></div>
    </main>
  );
}
