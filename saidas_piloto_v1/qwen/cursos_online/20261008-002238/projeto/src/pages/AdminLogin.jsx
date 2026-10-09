import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../storage.js'
import { useAuthContext } from '../App.jsx'

export default function AdminLogin() {
  const { login } = useAuthContext()
  const navigate = useNavigate()
  const [loginField, setLoginField] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handle = (e) => {
    e.preventDefault()
    setError('')
    const student = db.findStudentByLogin(loginField)
    if (!student || student.password !== password) {
      setError('Usuário ou senha incorretos.')
      return
    }
    if (!student.isAdmin) {
      setError('Este não é um usuário de administrador.')
      return
    }
    login(student)
    navigate('/admin')
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span>🛠️</span>
            <span>Área do Administrador</span>
          </div>
        </div>
      </div>
      <div className="container" style={{ maxWidth: 460 }}>
        <div className="card">
          <h2>Login do Administrador</h2>
          <p className="subtitle">Acesse para gerenciar cursos e matrículas.</p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handle}>
            <div className="field">
              <label>Usuário</label>
              <input
                value={loginField}
                onChange={(e) => setLoginField(e.target.value)}
                placeholder="Ex.: admin"
              />
            </div>
            <div className="field">
              <label>Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block">
              Entrar
            </button>
          </form>

          <div className="alert alert-info" style={{ marginTop: 16 }}>
            Conta inicial: usuário <strong>admin</strong> / senha <strong>admin123</strong>
          </div>
        </div>
      </div>
    </>
  )
}
