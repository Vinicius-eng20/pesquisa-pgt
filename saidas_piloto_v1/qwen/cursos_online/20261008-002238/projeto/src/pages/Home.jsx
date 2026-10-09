import React from 'react'
import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span>🎓</span>
            <span>Plataforma de Cursos</span>
          </div>
        </div>
      </div>
      <div className="container">
        <div className="hero">
          <h1>Bem-vindo à Plataforma de Cursos</h1>
          <p>
            Escolha como você quer entrar. Os alunos se matriculam nos cursos e o
            administrador gerencia os cursos e as matrículas.
          </p>
          <div className="choice-cards">
            <div className="choice-card">
              <div className="icon">👨‍🎓</div>
              <h3>Entrar como Aluno</h3>
              <p>
                Veja os cursos disponíveis, matricule-se e acompanhe seus cursos
                matriculados.
              </p>
              <Link to="/entrar/aluno" className="btn btn-primary btn-block">
                Entrar como Aluno
              </Link>
            </div>
            <div className="choice-card">
              <div className="icon">🛠️</div>
              <h3>Entrar como Administrador</h3>
              <p>
                Cadastre, edite e remova cursos, veja e cancele matrículas de todos
                os alunos.
              </p>
              <Link to="/entrar/admin" className="btn btn-secondary btn-block">
                Entrar como Administrador
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
