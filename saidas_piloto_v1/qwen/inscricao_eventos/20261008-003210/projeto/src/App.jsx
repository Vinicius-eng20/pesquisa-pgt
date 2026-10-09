import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import * as db from './lib/db.js';
import Topbar from './components/Topbar.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ListEventsPage from './pages/ListEventsPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import MyInscriptionsPage from './pages/MyInscriptionsPage.jsx';
import ManageEventsPage from './pages/ManageEventsPage.jsx';
import EventFormPage from './pages/EventFormPage.jsx';
import AllInscriptionsPage from './pages/AllInscriptionsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

function useSession() {
  const [user, setUser] = useState(() => {
    const id = db.getSession();
    return id ? db.getUserById(id) : null;
  });

  const login = (u) => setUser(u);
  const logout = () => {
    db.setSession(null);
    setUser(null);
  };
  return { user, login, logout };
}

function RequireAuth({ user, children }) {
  const loc = useLocation();
  if (!user) return <Navigate to="/entrar" state={{ from: loc }} replace />;
  return children;
}

export default function App() {
  const { user, login, logout } = useSession();

  return (
    <div>
      <Topbar user={user} onLogout={logout} />
      <div className="container">
        <Routes>
          <Route path="/" element={user ? <Navigate to="/eventos" replace /> : <Navigate to="/entrar" replace />} />
          <Route path="/entrar" element={<LoginPage user={user} onLogin={login} />} />

          <Route path="/eventos" element={
            <RequireAuth user={user}>
              <ListEventsPage user={user} />
            </RequireAuth>
          } />

          <Route path="/inscrever/:id" element={
            <RequireAuth user={user}>
              <RegisterPage user={user} />
            </RequireAuth>
          } />

          <Route path="/minhas-inscricoes" element={
            <RequireAuth user={user}>
              <MyInscriptionsPage user={user} />
            </RequireAuth>
          } />

          <Route path="/organizar/eventos" element={
            <RequireAuth user={user}>
              <ManageEventsPage user={user} />
            </RequireAuth>
          } />

          <Route path="/organizar/eventos/novo" element={
            <RequireAuth user={user}>
              <EventFormPage user={user} mode="novo" />
            </RequireAuth>
          } />

          <Route path="/organizar/eventos/:id" element={
            <RequireAuth user={user}>
              <EventFormPage user={user} mode="editar" />
            </RequireAuth>
          } />

          <Route path="/organizar/inscricoes" element={
            <RequireAuth user={user}>
              <AllInscriptionsPage user={user} />
            </RequireAuth>
          } />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </div>
  );
}
