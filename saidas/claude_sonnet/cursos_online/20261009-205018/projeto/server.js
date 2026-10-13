import express from 'express';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const db = new Database('plataforma.db');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// Criar tabelas
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('aluno', 'admin')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cursos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    instrutor TEXT NOT NULL,
    duracao TEXT NOT NULL,
    nivel TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS matriculas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    curso_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (curso_id) REFERENCES cursos(id),
    UNIQUE(usuario_id, curso_id)
  );
`);

// Criar usuário admin padrão se não existir
const adminExiste = db.prepare('SELECT * FROM usuarios WHERE email = ?').get('admin@plataforma.com');
if (!adminExiste) {
  const senhaHash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)').run(
    'Administrador',
    'admin@plataforma.com',
    senhaHash,
    'admin'
  );
}

// Sessões em memória
const sessoes = new Map();

// Middleware de autenticação
function verificarAuth(req, res, next) {
  const token = req.cookies.sessao;
  if (!token || !sessoes.has(token)) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }
  req.usuario = sessoes.get(token);
  next();
}

function verificarAdmin(req, res, next) {
  if (req.usuario.tipo !== 'admin') {
    return res.status(403).json({ erro: 'Acesso negado' });
  }
  next();
}

// Rotas de autenticação
app.post('/api/registrar', (req, res) => {
  const { nome, email, senha } = req.body;
  
  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
  }

  try {
    const senhaHash = bcrypt.hashSync(senha, 10);
    const resultado = db.prepare('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)').run(
      nome,
      email,
      senhaHash,
      'aluno'
    );

    res.json({ mensagem: 'Usuário registrado com sucesso', id: resultado.lastInsertRowid });
  } catch (erro) {
    if (erro.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ erro: 'Email já cadastrado' });
    }
    res.status(500).json({ erro: 'Erro ao registrar usuário' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;

  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  
  if (!usuario || !bcrypt.compareSync(senha, usuario.senha)) {
    return res.status(401).json({ erro: 'Email ou senha inválidos' });
  }

  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  sessoes.set(token, {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    tipo: usuario.tipo
  });

  res.cookie('sessao', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
  res.json({
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipo: usuario.tipo
    }
  });
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies.sessao;
  if (token) {
    sessoes.delete(token);
  }
  res.clearCookie('sessao');
  res.json({ mensagem: 'Logout realizado' });
});

app.get('/api/usuario-atual', verificarAuth, (req, res) => {
  res.json({ usuario: req.usuario });
});

// Rotas de cursos
app.get('/api/cursos', verificarAuth, (req, res) => {
  const cursos = db.prepare('SELECT * FROM cursos ORDER BY created_at DESC').all();
  
  if (req.usuario.tipo === 'aluno') {
    const matriculas = db.prepare('SELECT curso_id FROM matriculas WHERE usuario_id = ?').all(req.usuario.id);
    const cursosMatriculadosIds = matriculas.map(m => m.curso_id);
    
    const cursosComStatus = cursos.map(curso => ({
      ...curso,
      matriculado: cursosMatriculadosIds.includes(curso.id)
    }));
    
    return res.json(cursosComStatus);
  }
  
  res.json(cursos);
});

app.post('/api/cursos', verificarAuth, verificarAdmin, (req, res) => {
  const { titulo, descricao, instrutor, duracao, nivel } = req.body;
  
  if (!titulo || !descricao || !instrutor || !duracao || !nivel) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
  }

  try {
    const resultado = db.prepare('INSERT INTO cursos (titulo, descricao, instrutor, duracao, nivel) VALUES (?, ?, ?, ?, ?)').run(
      titulo,
      descricao,
      instrutor,
      duracao,
      nivel
    );

    res.json({ mensagem: 'Curso criado com sucesso', id: resultado.lastInsertRowid });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao criar curso' });
  }
});

app.put('/api/cursos/:id', verificarAuth, verificarAdmin, (req, res) => {
  const { id } = req.params;
  const { titulo, descricao, instrutor, duracao, nivel } = req.body;

  if (!titulo || !descricao || !instrutor || !duracao || !nivel) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
  }

  try {
    db.prepare('UPDATE cursos SET titulo = ?, descricao = ?, instrutor = ?, duracao = ?, nivel = ? WHERE id = ?').run(
      titulo,
      descricao,
      instrutor,
      duracao,
      nivel,
      id
    );

    res.json({ mensagem: 'Curso atualizado com sucesso' });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao atualizar curso' });
  }
});

app.delete('/api/cursos/:id', verificarAuth, verificarAdmin, (req, res) => {
  const { id } = req.params;

  try {
    db.prepare('DELETE FROM matriculas WHERE curso_id = ?').run(id);
    db.prepare('DELETE FROM cursos WHERE id = ?').run(id);
    res.json({ mensagem: 'Curso removido com sucesso' });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao remover curso' });
  }
});

// Rotas de matrículas
app.get('/api/minhas-matriculas', verificarAuth, (req, res) => {
  const matriculas = db.prepare(`
    SELECT m.id as matricula_id, m.created_at as data_matricula, c.*
    FROM matriculas m
    JOIN cursos c ON m.curso_id = c.id
    WHERE m.usuario_id = ?
    ORDER BY m.created_at DESC
  `).all(req.usuario.id);

  res.json(matriculas);
});

app.post('/api/matriculas', verificarAuth, (req, res) => {
  const { curso_id } = req.body;

  if (!curso_id) {
    return res.status(400).json({ erro: 'ID do curso é obrigatório' });
  }

  const curso = db.prepare('SELECT * FROM cursos WHERE id = ?').get(curso_id);
  if (!curso) {
    return res.status(404).json({ erro: 'Curso não encontrado' });
  }

  try {
    db.prepare('INSERT INTO matriculas (usuario_id, curso_id) VALUES (?, ?)').run(
      req.usuario.id,
      curso_id
    );

    res.json({ mensagem: 'Matrícula realizada com sucesso' });
  } catch (erro) {
    if (erro.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ erro: 'Você já está matriculado neste curso' });
    }
    res.status(500).json({ erro: 'Erro ao realizar matrícula' });
  }
});

app.delete('/api/matriculas/:id', verificarAuth, (req, res) => {
  const { id } = req.params;

  if (req.usuario.tipo === 'admin') {
    db.prepare('DELETE FROM matriculas WHERE id = ?').run(id);
  } else {
    db.prepare('DELETE FROM matriculas WHERE id = ? AND usuario_id = ?').run(id, req.usuario.id);
  }

  res.json({ mensagem: 'Matrícula cancelada com sucesso' });
});

// Rotas administrativas
app.get('/api/admin/matriculas', verificarAuth, verificarAdmin, (req, res) => {
  const matriculas = db.prepare(`
    SELECT 
      m.id as matricula_id,
      m.created_at as data_matricula,
      u.id as usuario_id,
      u.nome as usuario_nome,
      u.email as usuario_email,
      c.id as curso_id,
      c.titulo as curso_titulo
    FROM matriculas m
    JOIN usuarios u ON m.usuario_id = u.id
    JOIN cursos c ON m.curso_id = c.id
    ORDER BY m.created_at DESC
  `).all();

  res.json(matriculas);
});

// Servir páginas HTML
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'login.html'));
});

app.get('/registrar', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'registrar.html'));
});

app.get('/aluno', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'aluno.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'admin.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
  console.log(`\nCredenciais do administrador:`);
  console.log(`Email: admin@plataforma.com`);
  console.log(`Senha: admin123`);
});
