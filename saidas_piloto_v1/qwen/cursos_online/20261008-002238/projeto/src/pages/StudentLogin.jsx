import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../storage.js'
import { useAuthContext } from '../App.jsx'

export default function StudentLogin() {
  const { login } = useAuthContext()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [loginField, setLoginField] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handle = (e) => {
    e.preventDefault()
    setError('')

    if (mode === 'register') {
      if (!name.trim() || !loginField.trim() || !password.trim()) {
        setError('Preencha nome, usuário e senha.')
        return
      }
      if (password.length < 4) {
        setError('A senha precisa ter pelo menos 4 caracteres.')
        return
      }
      if (db.findStudentByLogin(loginField)) {
        setError('Este usuário já existe. Faça login.')
        return
      }
      const student = db.addStudent({
        name: name.trim(),
        login: loginField.trim(),
        password,
      })
      login(student)
      navigate('/aluno')
    } else {
      const student = db.findStudentByLogin(loginField)
      if (!student || student.password !== password) {
        setError('Usuário ou senha incorretos.')
        return
      }
      if (student.isAdmin) {
        setError('Este é um usuário de administrador. Entre pela área do administrador.')
        return
      }
      login(student)
      navigate('/aluno')
    }
  }

  const switchMode = (m) => {
    setMode(m)
    setError('')
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span>👨‍🎓</span>
            <span>Área do Aluno</span>
          </div>
        </div>
      </div>
      <div className="container" style={{ maxWidth: 460 }}>
        <div className="card">
          <h2>{mode === 'login' ? 'Entrar' : 'Criar conta de aluno'}</h2>
          <p className="subtitle">
            {mode === 'login'
              ? 'Faça login para acessar seus cursos.'
              : 'Primeira vez? Crie sua conta de aluno.'}
          </p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handle}>
            {mode === 'register' && (
              <div className="field">
                <label>Seu nome</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Maria Silva"
                />
              </div>
            )}
            <div className="field">
              <label>Usuário</label>
              <input
                value={loginField}
                onChange={(e) => setLoginField(e.target.value)}
                placeholder="Ex.: maria"
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
              {mode === 'login' ? 'Entrar' : 'Criar conta e entrar'}
            </button>
          </form>

          <p style={{ marginTop: 16, textAlign: 'center', fontSize: 14 }}>
            {mode === 'login' ? (
              <>
                Ainda não tem conta?{' '}
                <a href="#registrar" onClick={(e) => (e.preventDefault(), switchMode('register'))}>
                  Criar conta
                </a>
              </>
            ) : (
              <>
                Já tem conta?{' '}
                <a href="#login" onClick={(e) => (e.preventDefault(), switchMode('login'))}>
                  Fazer login
                </a>
              </>
            )}
          </p>
        </div>
      </div>
    </>
  )
}
