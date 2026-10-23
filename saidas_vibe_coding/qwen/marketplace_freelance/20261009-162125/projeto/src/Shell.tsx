import React, { useState } from "react";
import type { User } from "./api";
import Dashboard from "./pages/Dashboard";
import MyServices from "./pages/MyServices";
import MyContracts from "./pages/MyContracts";
import AdminPanel from "./pages/AdminPanel";
import Profile from "./pages/Profile";

export default function Shell({
  user,
  onUserChange,
  onLogout,
  showToast,
}: {
  user: User;
  onUserChange: (u: User) => void;
  onLogout: () => void;
  showToast: (msg: string, kind?: "ok" | "error") => void;
}) {
  const [route, setRoute] = useState("home");

  const nav = [
    { key: "home", label: "Explorar" },
    { key: "services", label: "Meus serviços" },
    { key: "contracts", label: "Meus contratos" },
    ...(user.role === "admin" ? [{ key: "admin", label: "Painel do Admin" }] : []),
    { key: "profile", label: "Perfil" },
  ];

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <a className="brand" onClick={() => setRoute("home")} style={{ cursor: "pointer" }}>
            <span className="logo">◆</span> FreelanceMarket
          </a>
          <nav className="nav">
            {nav.map((n) => (
              <a key={n.key} className={route === n.key ? "active" : ""} onClick={() => setRoute(n.key)}>
                {n.label}
              </a>
            ))}
          </nav>
          <div className="spacer" />
          <div className="userchip">
            <span className={"role-badge " + user.role}>{user.role === "admin" ? "Admin" : "Usuário"}</span>
            <span className="avatar" title={user.name}>{initials}</span>
            <button className="btn ghost small" onClick={onLogout}>Sair</button>
          </div>
        </div>
      </header>

      <main className="container page">
        {route === "home" && <Dashboard user={user} onHire={(id) => window.alert("Contrato criado! Veja em 'Meus contratos'.")} showToast={showToast} />}
        {route === "services" && <MyServices user={user} showToast={showToast} />}
        {route === "contracts" && <MyContracts user={user} />}
        {route === "admin" && user.role === "admin" && <AdminPanel showToast={showToast} />}
        {route === "profile" && <Profile user={user} onUserChange={onUserChange} showToast={showToast} />}
      </main>

      <footer className="footer container">FreelanceMarket — tudo salvo no servidor, acessível de qualquer aparelho.</footer>
    </div>
  );
}
