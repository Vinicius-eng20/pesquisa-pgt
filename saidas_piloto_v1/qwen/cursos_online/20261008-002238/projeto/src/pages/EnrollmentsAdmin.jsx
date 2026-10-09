import React, { useState } from 'react'
import { db } from '../storage.js'
import Layout from '../components/Layout.jsx'

export default function EnrollmentsAdmin() {
  const [tick, setTick] = useState(0)
  const [message, setMessage] = useState('')

  const enrollments = db.getEnrollments()
  const courses = db.getCourses()
  const students = db.getStudents()

  const rows = enrollments.map((e) => {
    const course = courses.find((c) => c.id === e.courseId)
    const student = students.find((s) => s.id === e.studentId)
    return { e, course, student }
  })

  const cancel = (e) => {
    const course = courses.find((c) => c.id === e.courseId)
    const student = students.find((s) => s.id === e.studentId)
    if (
      window.confirm(
        `Cancelar a matrícula de ${student?.name || 'aluno'} no curso "${course?.title || ''}"?`
      )
    ) {
      db.removeEnrollment(e.id)
      setTick(tick + 1)
      setMessage('Matrícula cancelada.')
      setTimeout(() => setMessage(''), 2500)
    }
  }

  return (
    <Layout
      title="Todas as Matrículas"
      subtitle="Acompanhe e cancele as matrículas de todos os alunos."
    >
      {message && <div className="alert alert-success">{message}</div>}

      {rows.length === 0 ? (
        <div className="empty">Nenhuma matrícula cadastrada até o momento.</div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Curso</th>
                  <th>Data</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ e, course, student }) => (
                  <tr key={e.id}>
                    <td>{student?.name || '—'}</td>
                    <td>{course?.title || '—'}</td>
                    <td>{new Date(e.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td>
                      <button
                        className="btn btn-danger-soft btn-sm"
                        onClick={() => cancel(e)}
                      >
                        Cancelar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  )
}
