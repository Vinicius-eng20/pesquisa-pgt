const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

// Segredo para o token JWT. Em produção, use uma variável de ambiente.
const JWT_SECRET = 'segredo-super-secreto-mude-em-producao';

const app = express();
const PORT = 3000;

// Banco de dados SQLite
const db = new sqlite3.Database('./portal.db', (err) => {
  if (err) {
    console.error('Erro ao abrir o banco de dados:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite.');
  }
});

// Criação das tabelas
db.serialize(() => {
  // Tabela de usuários
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('participante', 'organizador'))
  )`);

  // Tabela de eventos
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    date TEXT NOT NULL,
    location TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo', 'cancelado'))
  )`);

  // Tabela de inscrições
  db.run(`CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'inscrito' CHECK(status IN ('inscrito', 'presente', 'cancelado')),
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (event_id) REFERENCES events (id),
    UNIQUE(user_id, event_id)
  )`);
});

// Middlewares
app.use(express.json());
app.use(express.static('public')); // Serve os arquivos da pasta 'public'

// Middleware para verificar o token de autenticação
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer TOKEN"

  if (token == null) return res.sendStatus(401); // Não autorizado

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // Proibido
    req.user = user; // Adiciona os dados do usuário à requisição
    next();
  });
}

// Middleware para verificar se é organizador
function isOrganizer(req, res, next) {
  if (req.user.role !== 'organizador') {
    return res.status(403).send('Acesso negado. Somente organizadores.');
  }
  next();
}

// ====== ROTAS DE AUTENTICAÇÃO ======
app.post('/api/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`;
    db.run(sql, [name, email, hashedPassword, role], function(err) {
      if (err) {
        return res.status(400).json({ message: 'Este e-mail já está em uso.' });
      }
      res.status(201).json({ message: 'Usuário criado com sucesso!' });
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor.' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const sql = `SELECT * FROM users WHERE email = ?`;
  db.get(sql, [email], async (err, user) => {
    if (err || !user) {
      return res.status(400).json({ message: 'E-mail ou senha inválidos.' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'E-mail ou senha inválidos.' });
    }
    // Cria o token de acesso
    const accessToken = jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ accessToken, role: user.role, name: user.name });
  });
});

// ====== ROTAS DE EVENTOS ======
// Listar todos os eventos ativos (para participantes)
app.get('/api/events', authenticateToken, (req, res) => {
  const sql = `SELECT * FROM events WHERE status = 'ativo' ORDER BY date`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Erro ao buscar eventos.' });
    res.json(rows);
  });
});

// Listar todos os eventos (para organizador, incluindo cancelados)
app.get('/api/admin/events', authenticateToken, isOrganizer, (req, res) => {
  const sql = `SELECT * FROM events ORDER BY date DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Erro ao buscar eventos.' });
    res.json(rows);
  });
});

// Criar um novo evento (somente organizador)
app.post('/api/events', authenticateToken, isOrganizer, (req, res) => {
  const { title, description, date, location } = req.body;
  const sql = `INSERT INTO events (title, description, date, location) VALUES (?, ?, ?, ?)`;
  db.run(sql, [title, description, date, location], function(err) {
    if (err) return res.status(500).json({ message: 'Erro ao criar evento.' });
    res.status(201).json({ id: this.lastID, message: 'Evento criado com sucesso!' });
  });
});

// Atualizar um evento (somente organizador)
app.put('/api/events/:id', authenticateToken, isOrganizer, (req, res) => {
  const { title, description, date, location } = req.body;
  const sql = `UPDATE events SET title = ?, description = ?, date = ?, location = ? WHERE id = ?`;
  db.run(sql, [title, description, date, location, req.params.id], function(err) {
    if (err) return res.status(500).json({ message: 'Erro ao atualizar evento.' });
    res.json({ message: 'Evento atualizado com sucesso!' });
  });
});

// Cancelar um evento (somente organizador)
app.put('/api/events/:id/cancel', authenticateToken, isOrganizer, (req, res) => {
  const sql = `UPDATE events SET status = 'cancelado' WHERE id = ?`;
  db.run(sql, [req.params.id], function(err) {
    if (err) return res.status(500).json({ message: 'Erro ao cancelar evento.' });
    res.json({ message: 'Evento cancelado com sucesso!' });
  });
});

// ====== ROTAS DE INSCRIÇÕES ======
// Participante se inscreve em um evento
app.post('/api/registrations', authenticateToken, (req, res) => {
  const { eventId } = req.body;
  const userId = req.user.id;
  const sql = `INSERT INTO registrations (user_id, event_id) VALUES (?, ?)`;
  db.run(sql, [userId, eventId], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ message: 'Você já está inscrito neste evento.' });
      }
      return res.status(500).json({ message: 'Erro ao se inscrever.' });
    }
    res.status(201).json({ message: 'Inscrição realizada com sucesso!' });
  });
});

// Participante vê suas próprias inscrições
app.get('/api/my-registrations', authenticateToken, (req, res) => {
  const sql = `
    SELECT r.id as registration_id, r.status, e.id as event_id, e.title, e.date, e.location, e.status as event_status
    FROM registrations r
    JOIN events e ON r.event_id = e.id
    WHERE r.user_id = ? AND r.status != 'cancelado'
  `;
  db.all(sql, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Erro ao buscar inscrições.' });
    res.json(rows);
  });
});

// Participante cancela sua inscrição
app.put('/api/registrations/:id/cancel', authenticateToken, (req, res) => {
  const sql = `UPDATE registrations SET status = 'cancelado' WHERE id = ? AND user_id = ?`;
  db.run(sql, [req.params.id, req.user.id], function(err) {
    if (err) return res.status(500).json({ message: 'Erro ao cancelar inscrição.' });
    if (this.changes === 0) return res.status(404).json({ message: 'Inscrição não encontrada.' });
    res.json({ message: 'Inscrição cancelada com sucesso!' });
  });
});

// Organizador vê todas as inscrições de um evento
app.get('/api/events/:id/registrations', authenticateToken, isOrganizer, (req, res) => {
  const sql = `
    SELECT r.id, r.status, u.name, u.email
    FROM registrations r
    JOIN users u ON r.user_id = u.id
    WHERE r.event_id = ?
  `;
  db.all(sql, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Erro ao buscar inscrições.' });
    res.json(rows);
  });
});

// Organizador confirma a presença de um participante
app.put('/api/registrations/:id/confirm', authenticateToken, isOrganizer, (req, res) => {
  const sql = `UPDATE registrations SET status = 'presente' WHERE id = ?`;
  db.run(sql, [req.params.id], function(err) {
    if (err) return res.status(500).json({ message: 'Erro ao confirmar presença.' });
    if (this.changes === 0) return res.status(404).json({ message: 'Inscrição não encontrada.' });
    res.json({ message: 'Presença confirmada com sucesso!' });
  });
});

// Rota principal que serve o app
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse http://localhost:${PORT} no seu navegador.`);
});
