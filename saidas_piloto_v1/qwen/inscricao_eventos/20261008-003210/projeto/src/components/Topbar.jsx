import React from 'react';
import { NavLink, Link } from 'react-router-dom';

export default function Topbar({ user, onLogout }) {
  const isAdmin = user && user.role === 'admin';

  return (
    <header className="topbar">
      <div className="container topbar__inner">
        <Link to="/" className="brand">
          <span className="brand__dot">📅</span>
          <span>Portal de Inscrições</span>
        </Link>

        <nav className="nav">
          {user ? (
            <>
              <NavLink to="/eventos" className={({ isActive }) => isActive ? 'active' : ''}>Eventos</NavLink>
              <NavLink to="/minhas-inscricoes" className={({ isActive }) => isActive ? 'active' : ''}>Minhas inscrições</NavLink>
              {isAdmin && (
                <>
                  <NavLink to="/organizar/eventos" className={({ isActive }) => isActive ? 'active' : ''}>Gerenciar eventos</NavLink>
                  <NavLink to="/organizar/inscricoes" className={({ isActive }) => isActive ? 'active' : ''}>Todas as inscrições</NavLink>
                </>
              )}
            </>
          ) : (
            <NavLink to="/entrar" className={({ isActive }) => isActive ? 'active' : ''}>Entrar</NavLink>
          )}
        </nav>

        {user && (
          <div className="userbox">
            <span>
              Olá, <strong>{user.name.split(' ')[0]}</strong>
            </span>
            <button className="btn btn--ghost btn--sm" onClick={onLogout}>Sair</button>
          </div>
        )}
      </div>
    </header>
  );
}
