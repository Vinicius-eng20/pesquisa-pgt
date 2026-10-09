import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthContext } from '../App.jsx'

export default function Layout({ title, subtitle, children, actions }) {
  const { currentStudent, logout } = useAuthContext()
  const location = useLocation()
  const navigate = useNavigate()

  const nav = [
    currentStudent?.isAdmin
      ? { to: '/admin', label: 'Cursos' }
      : { to: '/aluno', label: 'Cursos Disponíveis' },
    currentStudent?.isAdmin
      ? { to: '/admin/matriculas', label: 'Matrículas' }
      : { to: '/aluno/meus-cursos', label: 'Meus Cursos' },
  ]

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <span>🎓</span>
            <span>Plataforma de Cursos</span>
          </Link>
          <div className="nav-links">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={location.pathname === item.to ? 'active' : ''}
              >
                {item.label}
              </Link>
            ))}
            {currentStudent && (
              <span className="badge-role">
                {currentStudent.isAdmin ? 'Admin' : 'Aluno'} · {currentStudent.name}
              </span>
            )}
            <button onClick={handleLogout}>Sair</button>
          </div>
        </div>
      </div>

      <div className="container">
        {actions && <div className="page-actions">{actions}</div>}
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
        {children}
      </div>
    </>
  )
}
