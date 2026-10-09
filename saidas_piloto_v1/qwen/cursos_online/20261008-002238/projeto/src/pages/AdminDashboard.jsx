import React, { useState } from 'react'
import { db } from '../storage.js'
import Layout from '../components/Layout.jsx'
import CourseForm from '../components/CourseForm.jsx'

export default function AdminDashboard() {
  const [courses, setCourses] = useState(db.getCourses())
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')

  const refresh = () => setCourses([...db.getCourses()])

  const openNew = () => {
    setEditing(null)
    setShowForm(true)
  }
  const openEdit = (course) => {
    setEditing(course)
    setShowForm(true)
  }
  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
    refresh()
  }
  const save = (data) => {
    if (editing) {
      db.updateCourse(editing.id, data)
      setMessage('Curso atualizado!')
    } else {
      db.addCourse(data)
      setMessage('Curso cadastrado!')
    }
    closeForm()
    setTimeout(() => setMessage(''), 2500)
  }
  const remove = (course) => {
    if (
      window.confirm(
        `Remover o curso "${course.title}"? As matrículas deste curso também serão removidas.`
      )
    ) {
      db.removeCourse(course.id)
      refresh()
      setMessage('Curso removido.')
      setTimeout(() => setMessage(''), 2500)
    }
  }

  return (
    <Layout
      title="Gestão de Cursos"
      subtitle="Cadastre, edite e remova os cursos da plataforma."
      actions={
        !showForm && (
          <button className="btn btn-primary btn-sm" onClick={openNew}>
            + Cadastrar Curso
          </button>
        )
      }
    >
      {message && <div className="alert alert-success">{message}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>{editing ? 'Editar Curso' : 'Cadastrar Novo Curso'}</h2>
          <CourseForm
            initial={editing || null}
            onSave={save}
            onCancel={closeForm}
          />
        </div>
      )}

      {courses.length === 0 && !showForm ? (
        <div className="empty">Nenhum curso cadastrado ainda. Clique em “Cadastrar Curso”.</div>
      ) : (
        courses.map((course) => {
          const count = db.getEnrollments().filter((e) => e.courseId === course.id).length
          return (
            <div className="course-item" key={course.id}>
              <div className="course-title">{course.title}</div>
              {course.description && <p className="course-desc">{course.description}</p>}
              <div className="meta">
                {course.category && <span className="tag">{course.category}</span>}
                {course.duration && <span className="tag">{course.duration}</span>}
                <span className="tag">{count} aluno(s) matriculado(s)</span>
              </div>
              <div className="course-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(course)}>
                  Editar
                </button>
                <button className="btn btn-danger-soft btn-sm" onClick={() => remove(course)}>
                  Remover
                </button>
              </div>
            </div>
          )
        })
      )}
    </Layout>
  )
}
