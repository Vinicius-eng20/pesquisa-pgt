import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as db from '../lib/db.js';

export default function ListEventsPage({ user }) {
  const [events, setEvents] = useState([]);
  const [myIns, setMyIns] = useState([]);

  const load = () => {
    setEvents(db.getEvents());
    setMyIns(db.getInscriptionsForUser(user.id));
  };

  useEffect(load, [user.id]);

  const myEventIds = new Set(myIns.filter(i => i.status !== 'cancelada').map(i => i.eventId));

  const open = events.filter(e => e.status === 'aberto');
  const others = events.filter(e => e.status !== 'aberto');

  return (
    <main>
      <div className="page-head">
        <h1>Eventos</h1>
        <p>Escolha um evento para se inscrever.</p>
      </div>

      {events.length === 0 && (
        <div className="card"><div className="empty">
          <div className="ico">📭</div>
          Ainda não há eventos disponíveis. Volte em breve.
        </div></div>
      )}

      {open.length > 0 && (
        <>
          <h3 style={{ margin: '8px 0 14px' }}>Inscrições abertas</h3>
          <div className="grid">
            {open.map(ev => <EventCard key={ev.id} ev={ev} already={myEventIds.has(ev.id)} onRefresh={load} />)}
          </div>
          {others.length > 0 && <h3 style={{ margin: '26px 0 14px' }}>Outros eventos</h3>}
        </>
      )}

      {others.length > 0 && (
        <div className="grid">
          {others.map(ev => <EventCard key={ev.id} ev={ev} already={myEventIds.has(ev.id)} onRefresh={load} />)}
        </div>
      )}
    </main>
  );
}

function EventCard({ ev, already, onRefresh }) {
  const st = db.STATUS_EVENTO[ev.status] || { label: ev.status, cls: '' };
  const spots = ev.capacity ? `${ev.enrolled}/${ev.capacity} vagas` : `${ev.enrolled} inscritos`;

  return (
    <div className="event-card">
      <div className="event-card__band" style={{ background: ev.color || 'var(--brand)' }} />
      <div className="event-card__body">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span className={'badge ' + st.cls}>{st.label}</span>
        </div>
        <div className="event-card__title">{ev.title}</div>
        <div className="event-card__meta">
          <span>📅 {db.formatDate(ev.date)}</span>
          {ev.time && <span>🕒 {db.formatTime(ev.time)}</span>}
          {ev.location && <span>📍 {ev.location}</span>}
        </div>
        {ev.description && <div className="event-card__desc">{ev.description}</div>}
        <div className="event-card__foot">
          <span className="badge">{spots}</span>
          {ev.status === 'aberto' ? (
            already ? (
              <Link className="btn btn--ghost btn--sm" to="/minhas-inscricoes">Já inscrito</Link>
            ) : (
              <Link className="btn btn--primary btn--sm" to={'/inscrever/' + ev.id}>Inscrever</Link>
            )
          ) : (
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>Indisponível</span>
          )}
        </div>
      </div>
    </div>
  );
}
