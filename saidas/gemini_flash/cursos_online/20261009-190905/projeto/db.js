const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getInitialData() {
  const salt = bcrypt.genSaltSync(10);
  const adminPasswordHash = bcrypt.hashSync('admin123', salt);
  const alunoPasswordHash = bcrypt.hashSync('aluno123', salt);

  return {
    users: [
      {
        id: 'user-admin',
        name: 'Administrador da Plataforma',
        email: 'admin@cursos.com',
        password: adminPasswordHash,
        role: 'admin',
        createdAt: new Date().toISOString()
      },
      {
        id: 'user-aluno-demo',
        name: 'Aluno Exemplo',
        email: 'aluno@cursos.com',
        password: alunoPasswordHash,
        role: 'student',
        createdAt: new Date().toISOString()
      }
    ],
    courses: [
      {
        id: 'curso-1',
        title: 'Introdução ao Desenvolvimento Web',
        description: 'Aprenda os fundamentos de criação de sites modernos com HTML, CSS e JavaScript do zero absoluto.',
        instructor: 'Prof. Carlos Silva',
        category: 'Programação',
        duration: '40 horas',
        content: 'Neste curso você vai criar seus primeiros projetos de sites reais, entender como funcionam páginas para computadores e celulares e publicar seu site na web.',
        createdAt: new Date().toISOString()
      },
      {
        id: 'curso-2',
        title: 'Design de Interfaces e Experiência do Usuário (UI/UX)',
        description: 'Domine princípios visuais, tipografia, paletas de cores e crie telas incríveis e fáceis de usar.',
        instructor: 'Profª. Mariana Souza',
        category: 'Design',
        duration: '32 horas',
        content: 'Você aprenderá prototipagem, testes com usuários reais e como transformar ideias em interfaces bonitas e funcionais.',
        createdAt: new Date().toISOString()
      },
      {
        id: 'curso-3',
        title: 'Gestão Financeira e Empreendedorismo',
        description: 'Estratégias práticas para planejar orçamentos, precificar serviços e alavancar novos negócios.',
        instructor: 'Prof. Roberto Mendes',
        category: 'Negócios',
        duration: '25 horas',
        content: 'Controle fluxo de caixa, entenda impostos de forma descomplicada e planeje o crescimento sustentável da sua empresa.',
        createdAt: new Date().toISOString()
      }
    ],
    enrollments: [
      {
        id: 'matr-1',
        userId: 'user-aluno-demo',
        courseId: 'curso-1',
        status: 'ativa',
        enrolledAt: new Date().toISOString()
      }
    ]
  };
}

function readData() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = getInitialData();
    writeData(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    const initial = getInitialData();
    writeData(initial);
    return initial;
  }
}

function writeData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = {
  getUsers: () => readData().users,
  findUserByEmail: (email) => {
    const users = readData().users;
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },
  findUserById: (id) => {
    const users = readData().users;
    return users.find((u) => u.id === id);
  },
  createUser: (userData) => {
    const data = readData();
    const newUser = {
      id: 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      createdAt: new Date().toISOString(),
      role: 'student',
      ...userData
    };
    data.users.push(newUser);
    writeData(data);
    return newUser;
  },

  getCourses: () => readData().courses,
  findCourseById: (id) => {
    const courses = readData().courses;
    return courses.find((c) => c.id === id);
  },
  createCourse: (courseData) => {
    const data = readData();
    const newCourse = {
      id: 'curso-' + Date.now(),
      createdAt: new Date().toISOString(),
      ...courseData
    };
    data.courses.unshift(newCourse);
    writeData(data);
    return newCourse;
  },
  updateCourse: (id, updatedFields) => {
    const data = readData();
    const index = data.courses.findIndex((c) => c.id === id);
    if (index === -1) return null;
    data.courses[index] = { ...data.courses[index], ...updatedFields };
    writeData(data);
    return data.courses[index];
  },
  deleteCourse: (id) => {
    const data = readData();
    data.courses = data.courses.filter((c) => c.id !== id);
    data.enrollments = data.enrollments.filter((e) => e.courseId !== id);
    writeData(data);
    return true;
  },

  getEnrollments: () => readData().enrollments,
  findEnrollment: (userId, courseId) => {
    const enrollments = readData().enrollments;
    return enrollments.find(
      (e) => e.userId === userId && e.courseId === courseId && e.status === 'ativa'
    );
  },
  createEnrollment: (userId, courseId) => {
    const data = readData();
    const existing = data.enrollments.find(
      (e) => e.userId === userId && e.courseId === courseId && e.status === 'ativa'
    );
    if (existing) return existing;

    const newEnrollment = {
      id: 'matr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      userId,
      courseId,
      status: 'ativa',
      enrolledAt: new Date().toISOString()
    };
    data.enrollments.unshift(newEnrollment);
    writeData(data);
    return newEnrollment;
  },
  cancelEnrollment: (enrollmentId) => {
    const data = readData();
    const enrollment = data.enrollments.find((e) => e.id === enrollmentId);
    if (!enrollment) return null;
    enrollment.status = 'cancelada';
    writeData(data);
    return enrollment;
  }
};
