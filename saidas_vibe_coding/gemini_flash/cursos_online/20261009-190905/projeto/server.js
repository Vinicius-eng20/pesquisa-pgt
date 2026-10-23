const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta-plataforma-cursos-super-segura-2025';

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

function authenticateToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      res.clearCookie('token');
      req.user = null;
      return next();
    }
    const user = db.findUserById(decoded.id);
    if (!user) {
      res.clearCookie('token');
      req.user = null;
      return next();
    }
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    next();
  });
}

function requireLogin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Você precisa estar logado para realizar esta ação.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas o administrador tem permissão.' });
  }
  next();
}

app.use(authenticateToken);

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  const existing = db.findUserByEmail(email);
  if (existing) {
    return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const newUser = db.createUser({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: passwordHash
  });

  const token = jwt.sign({ id: newUser.id }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  });

  res.status(201).json({
    user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  const user = db.findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  const validPassword = bcrypt.compareSync(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  });

  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logout realizado com sucesso.' });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.json({ user: null });
  }
  res.json({ user: req.user });
});

app.get('/api/courses', (req, res) => {
  const courses = db.getCourses();
  const enrollments = db.getEnrollments();

  const coursesWithStatus = courses.map((course) => {
    let isEnrolled = false;
    if (req.user) {
      isEnrolled = enrollments.some(
        (e) => e.userId === req.user.id && e.courseId === course.id && e.status === 'ativa'
      );
    }
    const totalStudents = enrollments.filter(
      (e) => e.courseId === course.id && e.status === 'ativa'
    ).length;

    return {
      ...course,
      isEnrolled,
      totalStudents
    };
  });

  res.json(coursesWithStatus);
});

app.post('/api/courses', requireAdmin, (req, res) => {
  const { title, description, instructor, category, duration, content } = req.body;
  if (!title || !description || !instructor) {
    return res.status(400).json({ error: 'Título, descrição e instrutor são obrigatórios.' });
  }

  const newCourse = db.createCourse({
    title: title.trim(),
    description: description.trim(),
    instructor: instructor.trim(),
    category: (category || 'Geral').trim(),
    duration: (duration || 'Auto-instrucional').trim(),
    content: (content || 'Conteúdo das aulas disponível após matrícula.').trim()
  });

  res.status(201).json(newCourse);
});

app.put('/api/courses/:id', requireAdmin, (req, res) => {
  const courseId = req.params.id;
  const { title, description, instructor, category, duration, content } = req.body;

  const existing = db.findCourseById(courseId);
  if (!existing) {
    return res.status(404).json({ error: 'Curso não encontrado.' });
  }

  const updated = db.updateCourse(courseId, {
    title: title ? title.trim() : existing.title,
    description: description ? description.trim() : existing.description,
    instructor: instructor ? instructor.trim() : existing.instructor,
    category: category ? category.trim() : existing.category,
    duration: duration ? duration.trim() : existing.duration,
    content: content ? content.trim() : existing.content
  });

  res.json(updated);
});

app.delete('/api/courses/:id', requireAdmin, (req, res) => {
  const courseId = req.params.id;
  const existing = db.findCourseById(courseId);
  if (!existing) {
    return res.status(404).json({ error: 'Curso não encontrado.' });
  }

  db.deleteCourse(courseId);
  res.json({ message: 'Curso excluído com sucesso.' });
});

app.post('/api/enroll/:courseId', requireLogin, (req, res) => {
  const courseId = req.params.courseId;
  const course = db.findCourseById(courseId);
  if (!course) {
    return res.status(404).json({ error: 'Curso não encontrado.' });
  }

  const existing = db.findEnrollment(req.user.id, courseId);
  if (existing) {
    return res.status(400).json({ error: 'Você já está matriculado neste curso.' });
  }

  const enrollment = db.createEnrollment(req.user.id, courseId);
  res.status(201).json({ message: 'Matrícula realizada com sucesso!', enrollment });
});

app.get('/api/my-enrollments', requireLogin, (req, res) => {
  const allEnrollments = db.getEnrollments();
  const allCourses = db.getCourses();

  const userEnrollments = allEnrollments
    .filter((e) => e.userId === req.user.id && e.status === 'ativa')
    .map((enrollment) => {
      const course = allCourses.find((c) => c.id === enrollment.courseId);
      return {
        enrollmentId: enrollment.id,
        enrolledAt: enrollment.enrolledAt,
        course: course || {
          id: enrollment.courseId,
          title: 'Curso Removido',
          description: 'Este curso não está mais disponível.',
          instructor: 'N/A',
          category: 'N/A',
          duration: 'N/A',
          content: ''
        }
      };
    });

  res.json(userEnrollments);
});

app.get('/api/admin/enrollments', requireAdmin, (req, res) => {
  const enrollments = db.getEnrollments();
  const users = db.getUsers();
  const courses = db.getCourses();

  const report = enrollments.map((enr) => {
    const student = users.find((u) => u.id === enr.userId);
    const course = courses.find((c) => c.id === enr.courseId);

    return {
      id: enr.id,
      status: enr.status,
      enrolledAt: enr.enrolledAt,
      student: {
        id: student ? student.id : 'desconhecido',
        name: student ? student.name : 'Usuário Excluído',
        email: student ? student.email : 'N/A'
      },
      course: {
        id: course ? course.id : 'desconhecido',
        title: course ? course.title : 'Curso Removido'
      }
    };
  });

  res.json(report);
});

app.post('/api/admin/enrollments/:id/cancel', requireAdmin, (req, res) => {
  const enrollmentId = req.params.id;
  const updated = db.cancelEnrollment(enrollmentId);
  if (!updated) {
    return res.status(404).json({ error: 'Matrícula não encontrada.' });
  }
  res.json({ message: 'Matrícula cancelada com sucesso.', enrollment: updated });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================`);
  console.log(` Plataforma de Cursos Online iniciada com sucesso!`);
  console.log(` Acesse pelo navegador em: http://localhost:${PORT}`);
  console.log(` Conta do Administrador: admin@cursos.com | Senha: admin123`);
  console.log(` Conta de Aluno de Teste: aluno@cursos.com | Senha: aluno123`);
  console.log(`=================================================`);
});
