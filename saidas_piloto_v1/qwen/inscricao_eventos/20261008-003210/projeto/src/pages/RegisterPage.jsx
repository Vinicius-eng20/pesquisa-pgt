import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import * as db from '../lib/db.js';

export default function RegisterPage({ user }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [ev, setEv] = useState(() => db.getEvents().find(e => e.id === id));

  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!ev) {
    return (
      <main>
        <div className="card"><div className="empty">
          <div className="ico">❓</div>
          <p>Evento não encontrado.</p>
          <p style={{ marginTop: 12 }}><Link className="btn btn--ghost" to="/eventos">Voltar aos eventos</Link></p>
        </div></div>
      </main>
    );
  }

  if (ev.status !== 'aberto') {
    return (
      <main>
        <div className="card"><div className="empty">
          <div className="ico">🔒</div>
          <p>As inscrições para este evento estão encerradas.</p>
          <p style={{ marginTop: 12 }}><Link className="btn btn--ghost" to="/eventos">Voltar aos eventos</Link></p>
        </div></div>
      </main>
    );
  }

  const already = db.getInscriptionsForUser(user.id).some(i => i.eventId === ev.id && i.status !== 'cancelada');

  if (done) {
    return (
      <main>
        <div className="card auth-card">
          <div className="card__body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>✅</div>
            <h2 style={{ margin: '10px 0' }}>Inscrição enviada!</h2>
            <p style={{ color: 'var(--muted)', marginBottom: 20 }}>
              Você está inscrito(a) em <strong>{ev.title}</strong>. O organizador vai confirmar sua presença.
            </p>
            <Link className="btn btn--primary" to="/minhas-inscricoes" style={{ justifyContent: 'center', width: '100%' }}>Ver minhas inscrições</Link>
          </div>
        </div>
      </main>
    );
  }

  if (already) {
    return (
      <main>
        <div className="card auth-card">
          <div className="card__body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>🔁</div>
            <h2 style={{ margin: '10px 0' }}>Você já está inscrito(a)</h2>
            <p style={{ color: 'var(--muted)', marginBottom: 20 }}>Esta inscrição já está na sua lista.</p>
            <Link className="btn btn--ghost" to="/minhas-inscricoes" style={{ justifyContent: 'center', width: '100%' }}>Ver minhas inscrições</Link>
          </div>
        </div>
      </main>
    );
  }

  function submit(e) {
    e.preventDefault();
    setError('');
    const res = db.addInscription({
      eventId: ev.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      phone,
      note
    });
    if (!res.ok) { setError(res.error); return; }
    setDone(true);
  }

  return (
    <main>
      <div className="card auth-card">
        <div className="card__head">
          <div>
            <h2>Inscrever-se</h2>
            <div className="sub">{ev.title}</div>
          </div>
        </div>
        <div className="card__body">
          <div className="field">
            <label>Nome</label>
            <input value={user.name} disabled />
          </div>
          <div className="field">
            <label>E-mail</label>
            <input value={user.email} disabled />
          </div>
          <div className="field">
            <label>Telefone (opcional)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div className="field">
            <label>Observações (opcional)</label>
            <textarea rows="3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Algo que o organizador deve saber?" />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="btn btn--primary" onClick={submit} style={{ width: '100%', justifyContent: 'center' }}>Confirmar inscrição</button>
          <p style={{ marginTop: 12, textAlign: 'center' }}>
            <Link to="/eventos" style={{ color: 'var(--brand)' }}>Cancelar e voltar</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
