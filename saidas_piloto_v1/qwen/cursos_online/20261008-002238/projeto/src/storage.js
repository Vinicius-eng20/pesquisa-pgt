// Camadas de armazenamento usando o localStorage do navegador.
// Tudo fica salvo no próprio navegador e continua disponível
// mesmo depois de fechar e reabrir o site.

const KEYS = {
  courses: 'plataforma_cursos',
  students: 'plataforma_alunos',
  enrollments: 'plataforma_matriculas',
  session: 'plataforma_sessao',
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// Garante que o administrador padrão exista na primeira vez.
function ensureAdmin() {
  const students = read(KEYS.students, [])
  if (!students.some((s) => s.login === 'admin')) {
    students.push({
      id: 'admin',
      name: 'Administrador',
      login: 'admin',
      password: 'admin123',
      isAdmin: true,
    })
    write(KEYS.students, students)
  }
}

export const db = {
  // Cursos
  getCourses() {
    return read(KEYS.courses, [])
  },
  saveCourses(courses) {
    write(KEYS.courses, courses)
  },
  addCourse(course) {
    const courses = this.getCourses()
    course.id = uid()
    course.createdAt = new Date().toISOString()
    courses.push(course)
    this.saveCourses(courses)
    return course
  },
  updateCourse(id, changes) {
    const courses = this.getCourses().map((c) =>
      c.id === id ? { ...c, ...changes } : c
    )
    this.saveCourses(courses)
    return courses.find((c) => c.id === id)
  },
  removeCourse(id) {
    this.saveCourses(this.getCourses().filter((c) => c.id !== id))
    // Remove também as matrículas do curso
    this.saveEnrollments(this.getEnrollments().filter((e) => e.courseId !== id))
  },

  // Alunos (e admin)
  getStudents() {
    ensureAdmin()
    return read(KEYS.students, [])
  },
  saveStudents(students) {
    write(KEYS.students, students)
  },
  findStudentByLogin(login) {
    return this.getStudents().find((s) => s.login.toLowerCase() === login.toLowerCase())
  },
  addStudent(data) {
    const students = this.getStudents()
    const student = {
      id: uid(),
      name: data.name,
      login: data.login,
      password: data.password,
      isAdmin: false,
    }
    students.push(student)
    this.saveStudents(students)
    return student
  },

  // Matrículas
  getEnrollments() {
    return read(KEYS.enrollments, [])
  },
  saveEnrollments(enrollments) {
    write(KEYS.enrollments, enrollments)
  },
  addEnrollment(courseId, studentId) {
    const enrollments = this.getEnrollments()
    if (enrollments.some((e) => e.courseId === courseId && e.studentId === studentId)) {
      return null // já matriculado
    }
    const enrollment = {
      id: uid(),
      courseId,
      studentId,
      createdAt: new Date().toISOString(),
    }
    enrollments.push(enrollment)
    this.saveEnrollments(enrollments)
    return enrollment
  },
  removeEnrollment(id) {
    this.saveEnrollments(this.getEnrollments().filter((e) => e.id !== id))
  },
  hasEnrollment(courseId, studentId) {
    return this.getEnrollments().some(
      (e) => e.courseId === courseId && e.studentId === studentId
    )
  },
  enrollmentsForStudent(studentId) {
    return this.getEnrollments().filter((e) => e.studentId === studentId)
  },

  // Sessão (quem está logado)
  getSession() {
    return read(KEYS.session, null)
  },
  setSession(session) {
    write(KEYS.session, session)
  },
  clearSession() {
    localStorage.removeItem(KEYS.session)
  },
}
