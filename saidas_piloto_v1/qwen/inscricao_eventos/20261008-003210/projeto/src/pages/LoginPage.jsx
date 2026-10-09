import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as db from '../lib/db.js';

const ADMIN_EMAIL = 'organizador@evento.com';
const ADMIN_PASS = 'organizar123';

export default function LoginPage({ user, onLogin }) {
  const nav = useNavigate();
  const loc = useLocation();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (user) {
    const dest = loc.state?.from?.pathname || (user.role === 'admin' ? '/organizar/eventos' : '/eventos');
    return <RedirectTo path={dest} />;
  }

  function finish(u) {
    onLogin(u);
    const dest = loc.state?.from?.pathname || (u.role === 'admin' ? '/organizar/eventos' : '/eventos');
    nav(dest, { replace: true });
  }

  function doLogin(e) {
    e.preventDefault();
    setError('');
    const res = db.login(email.trim(), password);
    if (!res.ok) { setError(res.error); return; }
    finish(res.user);
  }

  function doRegister(e) {
    e.preventDefault();
    setError('');
    const res = db.createUser({ name: name.trim(), email: email.trim(), password, role: 'participante' });
    if (!res.ok) { setError(res.error); return; }
    finish(res.user);
  }

  return (
    <main>
      <div className="card auth-card">
        <div className="card__body">
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</h2>
          <p className="sub" style={{ marginBottom: 18 }}>
            {mode === 'login' ? 'Use sua conta para acessar o portal.' : 'Cadastre-se para ver e se inscrever nos eventos.'}
          </p>

          <div className="tabs">
            <div className={'tab ' + (mode === 'login' ? 'active' : '')} onClick={() => { setMode('login'); setError(''); }}>Entrar</div>
            <div className={'tab ' + (mode === 'register' ? 'active' : '')} onClick={() => { setMode('register'); setError(''); }}>Criar conta</div>
          </div>

          {error && <div className="form-error">{error}</div>}

          {mode === 'login' ? (
            <form onSubmit={doLogin}>
              <div className="field">
                <label>E-mail</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="field">
                <label>Senha</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <button className="btn btn--primary" type="submit" style={{ width: '100%', justifyContent: 'center' }}>Entrar</button>
            </form>
          ) : (
            <form onSubmit={doRegister}>
              <div className="field">
                <label>Nome completo</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="field">
                <label>E-mail</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="field">
                <label>Senha</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <span className="hint">Só você vai ver sua senha. Guarde-a bem.</span>
              </div>
              <button className="btn btn--primary" type="submit" style={{ width: '100%', justifyContent: 'center' }}>Criar conta</button>
            </form>
          )}
        </div>
      </div>

      <div className="card" style={{ maxWidth: 440, margin: '18px auto', borderStyle: 'dashed' }}>
        <div className="card__body" style={{ padding: '16px 22px' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>💡 Conta do organizador (para teste)</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7 }}>
            <div><strong>E-mail:</strong> {ADMIN_EMAIL}</div>
            <div><strong>Senha:</strong> {ADMIN_PASS}</div>
            <div style={{ marginTop: 8, fontSize: 13 }}>Participantes: use “Criar conta” acima.</div>
          </div>
        </div>
      </div>
    </main>
  );
}

function RedirectTo({ path }) {
  return <NavigateTo path={path} />;
}

function NavigateTo({ path }) {
  return <RedirectInner path={path} />;
}

import { Navigate } from 'react-router-dom';
function RedirectInner({ path }) {
  return <Navigate to={path} replace />;
}
