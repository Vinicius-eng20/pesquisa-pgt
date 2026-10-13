const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Banco de dados persistente em arquivo
const db = new sqlite3.Database(path.join(__dirname, 'dados.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha TEXT NOT NULL,
    papel TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tarefas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descricao TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    membro_id INTEGER,
    criado_por INTEGER,
    criado_em TEXT NOT NULL,
    FOREIGN KEY (membro_id) REFERENCES usuarios(id),
    FOREIGN KEY (criado_por) REFERENCES usuarios(id)
  )`);

  // Cria gerente padrão se não existir
  db.get(`SELECT COUNT(*) as n FROM usuarios WHERE papel = 'gerente'`, (err, row) => {
    if (row && row.n === 0) {
      const hash = bcrypt.hashSync('admin123', 10);
      db.run(`INSERT INTO usuarios (nome, email, senha, papel) VALUES (?, ?, ?, ?)`,
        ['Gerente', 'gerente@equipe.com', hash, 'gerente']);
      console.log('Gerente padrão criado: gerente@equipe.com / admin123');
    }
  });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: 'segredo-super-secreto-tarefas-equipe-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 } // 30 dias
}));

app.use(express.static(path.join(__dirname, 'public')));

function precisaLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ erro: 'Não autenticado' });
  next();
}

function apenasGerente(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ erro: 'Não autenticado' });
  if (req.session.papel !== 'gerente') return res.status(403).json({ erro: 'Apenas gerente' });
  next();
}

// ===== AUTENTICAÇÃO =====
app.post('/api/registrar', (req, res) => {
  const { nome, email, senha, papel } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Preencha todos os campos' });
  const papelFinal = papel === 'gerente' ? 'gerente' : 'membro';
  
  // Só permite criar gerente se não existir nenhum
  if (papelFinal === 'gerente') {
    db.get(`SELECT COUNT(*) as n FROM usuarios WHERE papel = 'gerente'`, (err, row) => {
      if (row && row.n > 0) return res.status(403).json({ erro: 'Já existe um gerente' });
      continuar();
    });
  } else continuar();

  function continuar() {
    const hash = bcrypt.hashSync(senha, 10);
    db.run(`INSERT INTO usuarios (nome, email, senha, papel) VALUES (?, ?, ?, ?)`,
      [nome, email.toLowerCase(), hash, papelFinal],
      function(err) {
        if (err) return res.status(400).json({ erro: 'Email já cadastrado' });
        req.session.userId = this.lastID;
        req.session.nome = nome;
        req.session.papel = papelFinal;
        res.json({ ok: true, papel: papelFinal });
      });
  }
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  db.get(`SELECT * FROM usuarios WHERE email = ?`, [email.toLowerCase()], (err, user) => {
    if (!user) return res.status(400).json({ erro: 'Email ou senha inválidos' });
    if (!bcrypt.compareSync(senha, user.senha)) return res.status(400).json({ erro: 'Email ou senha inválidos' });
    req.session.userId = user.id;
    req.session.nome = user.nome;
    req.session.papel = user.papel;
    res.json({ ok: true, papel: user.papel });
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/eu', (req, res) => {
  if (!req.session.userId) return res.json({ logado: false });
  res.json({ logado: true, id: req.session.userId, nome: req.session.nome, papel: req.session.papel });
});

// ===== USUÁRIOS =====
app.get('/api/usuarios', precisaLogin, (req, res) => {
  db.all(`SELECT id, nome, email, papel FROM usuarios WHERE papel = 'membro'`, (err, rows) => {
    res.json(rows || []);
  });
});

// ===== TAREFAS =====
app.get('/api/tarefas', precisaLogin, (req, res) => {
  const sql = `SELECT t.*, u.nome as membro_nome, c.nome as criador_nome 
    FROM tarefas t 
    LEFT JOIN usuarios u ON t.membro_id = u.id 
    LEFT JOIN usuarios c ON t.criado_por = c.id`;
  
  if (req.session.papel === 'gerente') {
    db.all(sql + ' ORDER BY t.criado_em DESC', (err, rows) => res.json(rows || []));
  } else {
    db.all(sql + ' WHERE t.membro_id = ? ORDER BY t.criado_em DESC', [req.session.userId], (err, rows) => res.json(rows || []));
  }
});

app.post('/api/tarefas', precisaLogin, (req, res) => {
  const { titulo, descricao, membro_id } = req.body;
  if (!titulo) return res.status(400).json({ erro: 'Título obrigatório' });

  let destino;
  if (req.session.papel === 'gerente') {
    destino = membro_id || null;
  } else {
    // Membro só pode criar para si mesmo
    destino = req.session.userId;
  }

  const agora = new Date().toISOString();
  db.run(`INSERT INTO tarefas (titulo, descricao, status, membro_id, criado_por, criado_em) 
    VALUES (?, ?, 'pendente', ?, ?, ?)`,
    [titulo, descricao || '', destino, req.session.userId, agora],
    function(err) {
      if (err) return res.status(500).json({ erro: 'Erro ao criar' });
      res.json({ ok: true, id: this.lastID });
    });
});

app.put('/api/tarefas/:id', precisaLogin, (req, res) => {
  const id = req.params.id;
  const { titulo, descricao, status, membro_id } = req.body;

  db.get(`SELECT * FROM tarefas WHERE id = ?`, [id], (err, tarefa) => {
    if (!tarefa) return res.status(404).json({ erro: 'Tarefa não encontrada' });

    if (req.session.papel === 'membro') {
      // Membro só pode mudar status da própria tarefa
      if (tarefa.membro_id !== req.session.userId) return res.status(403).json({ erro: 'Sem permissão' });
      if (status && ['pendente', 'em_andamento', 'concluida'].includes(status)) {
        db.run(`UPDATE tarefas SET status = ? WHERE id = ?`, [status, id], () => res.json({ ok: true }));
      } else {
        res.status(400).json({ erro: 'Status inválido' });
      }
    } else {
      // Gerente pode editar tudo
      db.run(`UPDATE tarefas SET titulo = ?, descricao = ?, status = ?, membro_id = ? WHERE id = ?`,
        [titulo, descricao, status, membro_id, id],
        () => res.json({ ok: true }));
    }
  });
});

app.delete('/api/tarefas/:id', apenasGerente, (req, res) => {
  db.run(`DELETE FROM tarefas WHERE id = ?`, [req.params.id], () => res.json({ ok: true }));
});

app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
