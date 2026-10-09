import React from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { db } from './storage.js'
import Home from './pages/Home.jsx'
import StudentLogin from './pages/StudentLogin.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import StudentDashboard from './pages/StudentDashboard.jsx'
import EnrolledCourses from './pages/EnrolledCourses.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import EnrollmentsAdmin from './pages/EnrollmentsAdmin.jsx'
import Layout from './components/Layout.jsx'

function useAuth() {
  const [session, setSession] = React.useState(db.getSession())
  const login = (student) => {
    const s = { studentId: student.id, isAdmin: student.isAdmin }
    db.setSession(s)
    setSession(s)
  }
  const logout = () => {
    db.clearSession()
    setSession(null)
  }
  const currentStudent = session ? db.getStudents().find((s) => s.id === session.studentId) : null
  return { session, login, logout, currentStudent }
}

const AuthContext = React.createContext(null)

export function AuthProvider({ children }) {
  const auth = useAuth()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  return React.useContext(AuthContext)
}

function RequireAuth({ children, role }) {
  const { session, currentStudent } = useAuthContext()
  const navigate = useNavigate()
  const location = useLocation()

  if (!session || !currentStudent) {
    return <Navigate to="/" replace />
  }
  if (role && role !== 'any' && currentStudent.isAdmin !== (role === 'admin')) {
    return <Navigate to={currentStudent.isAdmin ? '/admin' : '/aluno'} replace />
  }
  return children
}

function AppRoutes() {
  const { session, currentStudent } = useAuthContext()
  const defaultPath = session
    ? currentStudent?.isAdmin
      ? '/admin'
      : '/aluno'
    : '/'

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/entrar/aluno" element={<StudentLogin />} />
      <Route path="/entrar/admin" element={<AdminLogin />} />

      <Route
        path="/aluno"
        element={
          <RequireAuth role="student">
            <StudentDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/aluno/meus-cursos"
        element={
          <RequireAuth role="student">
            <EnrolledCourses />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth role="admin">
            <AdminDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/matriculas"
        element={
          <RequireAuth role="admin">
            <EnrollmentsAdmin />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to={defaultPath} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
