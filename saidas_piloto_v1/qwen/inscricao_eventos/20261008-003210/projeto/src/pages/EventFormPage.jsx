import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import * as db from '../lib/db.js';
import { NotAdmin } from './ManageEventsPage.jsx';

const COLORS = ['#4f46e5', '#7c3aed', '#0ea5e9', '#16a34a', '#d97706', '#dc2626', '#db2777'];

export default function EventFormPage({ user, mode }) {
  if (user.role !== 'admin') return <NotAdmin />;

  const { id } = useParams();
  const nav = useNavigate();
  const editing = mode === 'editar';
  const existing = editing ? db.getEvents().find(e => e.id === id) : null;

  if (editing && !existing) {
    return (
      <main>
        <div className="card"><div className="empty">
          <div className="ico">❓</div>
          <p>Evento não encontrado.</p>
          <p style={{ marginTop: 12 }}><Link className="btn btn--ghost" to="/organizar/eventos">Voltar</Link></p>
        </div></div>
      </main>
    );
  }

  const [title, setTitle] = useState(existing?.title || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [date, setDate] = useState(existing?.date || '');
  const [time, setTime] = useState(existing?.time || '');
  const [location, setLocation] = useState(existing?.location || '');
  const [capacity, setCapacity] = useState(existing?.capacity ? String(existing.capacity) : '');
  const [color, setColor] = useState(existing?.color || COLORS[0]);
  const [error, setError] = useState('');

  function save(e) {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('Informe o nome do evento.'); return; }

    const data = {
      title: title.trim(),
      description: description.trim(),
      date, time,
      location: location.trim(),
      capacity: capacity ? parseInt(capacity, 10) : null,
      color
    };

    if (editing) {
      db.updateEvent(existing.id, data);
      nav('/organizar/eventos');
    } else {
      db.createEvent(data);
      nav('/organizar/eventos');
    }
  }

  return (
    <main>
      <div className="card auth-card" style={{ maxWidth: 620, margin: '20px auto' }}>
        <div className="card__head">
          <h2>{editing ? 'Editar evento' : 'Novo evento'}</h2>
        </div>
        <div className="card__body">
          <form onSubmit={save}>
            <div className="field">
              <label>Nome do evento *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ex.: Oficina de Programação" />
            </div>
            <div className="field">
              <label>Descrição</label>
              <textarea rows="3" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Conte o que será o evento..." />
            </div>
            <div className="form-row">
              <div className="field">
                <label>Data</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="field">
                <label>Hora</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Local</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Auditório Central" />
              </div>
              <div className="field">
                <label>Vagas máximas (opcional)</label>
                <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Sem limite" />
              </div>
            </div>
            <div className="field">
              <label>Cor de destaque</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {COLORS.map(c => (
                  <button type="button" key={c} onClick={() => setColor(c)}
                    style={{ width: 34, height: 34, borderRadius: 8, background: c, cursor: 'pointer', border: color === c ? '3px solid #1f2430' : '3px solid transparent' }}
                    aria-label={c} />
                ))}
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn--primary" style={{ flex: 1, justifyContent: 'center' }}>
                {editing ? 'Salvar alterações' : 'Criar evento'}
              </button>
              <Link className="btn btn--ghost" to="/organizar/eventos">Cancelar</Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
