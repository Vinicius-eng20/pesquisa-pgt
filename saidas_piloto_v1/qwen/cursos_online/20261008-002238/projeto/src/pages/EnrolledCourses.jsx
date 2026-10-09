import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../storage.js'
import { useAuthContext } from '../App.jsx'
import Layout from '../components/Layout.jsx'
import CourseCard from '../components/CourseCard.jsx'

export default function EnrolledCourses() {
  const { currentStudent } = useAuthContext()
  const navigate = useNavigate()
  const [tick, setTick] = useState(0)
  const [message, setMessage] = useState('')

  const enrollments = db.enrollmentsForStudent(currentStudent.id)
  const courses = db
    .getCourses()
    .filter((c) => enrollments.some((e) => e.courseId === c.id))

  const cancel = (enrollment) => {
    const course = db.getCourses().find((c) => c.id === enrollment.courseId)
    if (window.confirm(`Cancelar sua matrícula no curso "${course?.title}"?`)) {
      db.removeEnrollment(enrollment.id)
      setTick(tick + 1)
      setMessage('Matrícula cancelada.')
      setTimeout(() => setMessage(''), 2500)
    }
  }

  return (
    <Layout
      title="Meus Cursos"
      subtitle="Cursos em que você está matriculado."
      actions={
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/aluno')}>
          ← Ver cursos disponíveis
        </button>
      }
    >
      {message && <div className="alert alert-success">{message}</div>}

      {courses.length === 0 ? (
        <div className="empty">
          Você ainda não está matriculado em nenhum curso.
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/aluno')}>
              Ver cursos disponíveis
            </button>
          </div>
        </div>
      ) : (
        courses.map((course) => {
          const enrollment = enrollments.find((e) => e.courseId === course.id)
          const date = new Date(enrollment.createdAt).toLocaleDateString('pt-BR')
          return (
            <CourseCard
              key={course.id}
              course={course}
              footer={
                <div className="course-actions">
                  <span className="tag">Matriculado em {date}</span>
                  <button
                    className="btn btn-danger-soft btn-sm"
                    onClick={() => cancel(enrollment)}
                  >
                    Cancelar matrícula
                  </button>
                </div>
              }
            />
          )
        })
      )}
    </Layout>
  )
}
