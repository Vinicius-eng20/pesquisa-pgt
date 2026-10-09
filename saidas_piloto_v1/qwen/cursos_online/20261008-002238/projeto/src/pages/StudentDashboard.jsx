import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../storage.js'
import { useAuthContext } from '../App.jsx'
import Layout from '../components/Layout.jsx'
import CourseCard from '../components/CourseCard.jsx'

export default function StudentDashboard() {
  const { currentStudent } = useAuthContext()
  const navigate = useNavigate()
  const [courses, setCourses] = useState(db.getCourses())
  const [message, setMessage] = useState('')

  const enroll = (course) => {
    const result = db.addEnrollment(course.id, currentStudent.id)
    if (result) {
      setMessage('Você se matriculou com sucesso!')
    } else {
      setMessage('Você já está matriculado neste curso.')
    }
    setCourses([...db.getCourses()])
    setTimeout(() => setMessage(''), 2500)
  }

  return (
    <Layout
      title="Cursos Disponíveis"
      subtitle="Escolha um curso e clique em Matricular-se."
    >
      {message && <div className="alert alert-success">{message}</div>}

      {courses.length === 0 ? (
        <div className="empty">
          Ainda não há cursos cadastrados. O administrador precisa cadastrar cursos.
        </div>
      ) : (
        courses.map((course) => {
          const enrolled = db.hasEnrollment(course.id, currentStudent.id)
          return (
            <CourseCard
              key={course.id}
              course={course}
              footer={
                enrolled ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate('/aluno/meus-cursos')}
                  >
                    ✓ Você está matriculado
                  </button>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={() => enroll(course)}>
                    Matricular-se
                  </button>
                )
              }
            />
          )
        })
      )}
    </Layout>
  )
}
