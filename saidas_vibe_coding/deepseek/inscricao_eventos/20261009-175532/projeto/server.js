const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Banco de dados ----------
const db = new sqlite3.Database(path.join(__dirname, 'portal.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('participante','organizador'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descricao TEXT,
    local TEXT,
    data TEXT,
    vagas INTEGER DEFAULT 0,
    organizador_id INTEGER NOT NULL,
    cancelado INTEGER DEFAULT 0,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inscricoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pendente',
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(evento_id, usuario_id)
  )`);
});

// ---------- Middlewares ----------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: 'portal-eventos-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 }
}));

app.use(express.static(path.join(__dirname, 'public')));

// ---------- Helpers ----------
function requireAuth(req, res, next) {
  if (!req.session.usuario) return res.status(401).json({ erro: 'Não autenticado' });
  next();
}
function requireOrganizador(req, res, next) {
  if (!req.session.usuario) return res.status(401).json({ erro: 'Não autenticado' });
  if (req.session.usuario.tipo !== 'organizador') return res.status(403).json({ erro: 'Apenas organizador' });
  next();
}

// ---------- Autenticação ----------
app.post('/api/registrar', async (req, res) => {
  const { nome, email, senha, tipo } = req.body;
  if (!nome || !email || !senha || !tipo) return res.status(400).json({ erro: 'Preencha todos os campos' });
  if (!['participante', 'organizador'].includes(tipo)) return res.status(400).json({ erro: 'Tipo inválido' });

  const hash = await bcrypt.hash(senha, 10);
  db.run(
    `INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)`,
    [nome, email.toLowerCase(), hash, tipo],
    function (err) {
      if (err) {
        if (String(err.message).includes('UNIQUE')) return res.status(400).json({ erro: 'Este e-mail já está cadastrado' });
        return res.status(500).json({ erro: 'Erro ao cadastrar' });
      }
      req.session.usuario = { id: this.lastID, nome, email: email.toLowerCase(), tipo };
      res.json({ ok: true, usuario: req.session.usuario });
    }
  );
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Preencha todos os campos' });

  db.get(`SELECT * FROM usuarios WHERE email = ?`, [email.toLowerCase()], async (err, user) => {
    if (err || !user) return res.status(400).json({ erro: 'E-mail ou senha inválidos' });
    const ok = await bcrypt.compare(senha, user.senha);
    if (!ok) return res.status(400).json({ erro: 'E-mail ou senha inválidos' });
    req.session.usuario = { id: user.id, nome: user.nome, email: user.email, tipo: user.tipo };
    res.json({ ok: true, usuario: req.session.usuario });
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/eu', (req, res) => {
  if (!req.session.usuario) return res.json({ usuario: null });
  res.json({ usuario: req.session.usuario });
});

// ---------- Eventos ----------
app.get('/api/eventos', (req, res) => {
  const u = req.session.usuario;
  const sql = `
    SELECT e.*, u.nome AS organizador_nome,
      (SELECT COUNT(*) FROM inscricoes i WHERE i.evento_id = e.id AND i.status != 'cancelada') AS total_inscritos
    FROM eventos e
    JOIN usuarios u ON u.id = e.organizador_id
    WHERE e.cancelado = 0
    ORDER BY e.data ASC, e.id DESC
  `;
  db.all(sql, [], (err, eventos) => {
    if (err) return res.status(500).json({ erro: 'Erro ao buscar eventos' });
    if (!u) return res.json({ eventos: eventos.map(e => ({ ...e, minha_inscricao: null })) });
    db.all(`SELECT evento_id, status FROM inscricoes WHERE usuario_id = ?`, [u.id], (err2, insc) => {
      const map = {};
      (insc || []).forEach(i => { map[i.evento_id] = i.status; });
      res.json({ eventos: eventos.map(e => ({ ...e, minha_inscricao: map[e.id] || null })) });
    });
  });
});

app.post('/api/eventos', requireOrganizador, (req, res) => {
  const { titulo, descricao, local, data, vagas } = req.body;
  if (!titulo) return res.status(400).json({ erro: 'Título é obrigatório' });
  db.run(
    `INSERT INTO eventos (titulo, descricao, local, data, vagas, organizador_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [titulo, descricao || '', local || '', data || '', Number(vagas) || 0, req.session.usuario.id],
    function (err) {
      if (err) return res.status(500).json({ erro: 'Erro ao criar evento' });
      res.json({ ok: true, id: this.lastID });
    }
  );
});

app.put('/api/eventos/:id', requireOrganizador, (req, res) => {
  const id = Number(req.params.id);
  const { titulo, descricao, local, data, vagas } = req.body;
  db.get(`SELECT * FROM eventos WHERE id = ? AND organizador_id = ?`, [id, req.session.usuario.id], (err, ev) => {
    if (err || !ev) return res.status(404).json({ erro: 'Evento não encontrado' });
    db.run(
      `UPDATE eventos SET titulo = ?, descricao = ?, local = ?, data = ?, vagas = ? WHERE id = ?`,
      [titulo || ev.titulo, descricao ?? ev.descricao, local ?? ev.local, data ?? ev.data, Number(vagas) || 0, id],
      (err2) => {
        if (err2) return res.status(500).json({ erro: 'Erro ao atualizar' });
        res.json({ ok: true });
      }
    );
  });
});

app.delete('/api/eventos/:id', requireOrganizador, (req, res) => {
  const id = Number(req.params.id);
  db.get(`SELECT * FROM eventos WHERE id = ? AND organizador_id = ?`, [id, req.session.usuario.id], (err, ev) => {
    if (err || !ev) return res.status(404).json({ erro: 'Evento não encontrado' });
    db.run(`UPDATE eventos SET cancelado = 1 WHERE id = ?`, [id], (err2) => {
      if (err2) return res.status(500).json({ erro: 'Erro ao cancelar' });
      res.json({ ok: true });
    });
  });
});

app.get('/api/eventos/:id/inscricoes', requireOrganizador, (req, res) => {
  const id = Number(req.params.id);
  db.get(`SELECT * FROM eventos WHERE id = ? AND organizador_id = ?`, [id, req.session.usuario.id], (err, ev) => {
    if (err || !ev) return res.status(404).json({ erro: 'Evento não encontrado' });
    db.all(
      `SELECT i.id, i.status, i.criado_em, u.nome, u.email
       FROM inscricoes i JOIN usuarios u ON u.id = i.usuario_id
       WHERE i.evento_id = ? ORDER BY u.nome`,
      [id],
      (err2, rows) => {
        if (err2) return res.status(500).json({ erro: 'Erro ao buscar inscrições' });
        res.json({ inscricoes: rows });
      }
    );
  });
});

app.post('/api/inscricoes/:id/confirmar', requireOrganizador, (req, res) => {
  const id = Number(req.params.id);
  db.get(
    `SELECT i.id, e.organizador_id FROM inscricoes i JOIN eventos e ON e.id = i.evento_id WHERE i.id = ?`,
    [id],
    (err, row) => {
      if (err || !row || row.organizador_id !== req.session.usuario.id) return res.status(404).json({ erro: 'Inscrição não encontrada' });
      db.run(`UPDATE inscricoes SET status = 'confirmada' WHERE id = ?`, [id], (e2) => {
        if (e2) return res.status(500).json({ erro: 'Erro ao confirmar' });
        res.json({ ok: true });
      });
    }
  );
});

// ---------- Inscrições do participante ----------
app.get('/api/minhas-inscricoes', requireAuth, (req, res) => {
  db.all(
    `SELECT i.id, i.status, i.criado_em, e.id AS evento_id, e.titulo, e.descricao, e.local, e.data, e.cancelado, u.nome AS organizador_nome
     FROM inscricoes i
     JOIN eventos e ON e.id = i.evento_id
     JOIN usuarios u ON u.id = e.organizador_id
     WHERE i.usuario_id = ?
     ORDER BY e.data ASC, i.criado_em DESC`,
    [req.session.usuario.id],
    (err, rows) => {
      if (err) return res.status(500).json({ erro: 'Erro ao buscar inscrições' });
      res.json({ inscricoes: rows });
    }
  );
});

app.post('/api/inscricoes', requireAuth, (req, res) => {
  const { evento_id } = req.body;
  if (!evento_id) return res.status(400).json({ erro: 'Evento inválido' });
  if (req.session.usuario.tipo !== 'participante') return res.status(403).json({ erro: 'Apenas participantes se inscrevem' });

  db.get(`SELECT * FROM eventos WHERE id = ? AND cancelado = 0`, [evento_id], (err, ev) => {
    if (err || !ev) return res.status(404).json({ erro: 'Evento não encontrado' });

    db.get(
      `SELECT COUNT(*) AS total FROM inscricoes WHERE evento_id = ? AND status != 'cancelada'`,
      [evento_id],
      (e1, row) => {
        if (e1) return res.status(500).json({ erro: 'Erro ao verificar vagas' });
        if (ev.vagas > 0 && row.total >= ev.vagas) return res.status(400).json({ erro: 'Não há vagas disponíveis' });

        db.run(
          `INSERT INTO inscricoes (evento_id, usuario_id, status) VALUES (?, ?, 'pendente')`,
          [evento_id, req.session.usuario.id],
          function (e2) {
            if (e2) {
              if (String(e2.message).includes('UNIQUE')) return res.status(400).json({ erro: 'Você já está inscrito neste evento' });
              return res.status(500).json({ erro: 'Erro ao se inscrever' });
            }
            res.json({ ok: true, id: this.lastID });
          }
        );
      }
    );
  });
});

app.delete('/api/inscricoes/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  db.get(`SELECT * FROM inscricoes WHERE id = ? AND usuario_id = ?`, [id, req.session.usuario.id], (err, ins) => {
    if (err || !ins) return res.status(404).json({ erro: 'Inscrição não encontrada' });
    db.run(`UPDATE inscricoes SET status = 'cancelada' WHERE id = ?`, [id], (e2) => {
      if (e2) return res.status(500).json({ erro: 'Erro ao cancelar' });
      res.json({ ok: true });
    });
  });
});

// ---------- SPA ----------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
