const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Diretório de dados persistente
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new sqlite3.Database(path.join(DATA_DIR, 'app.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT UNIQUE NOT NULL,
    ativa INTEGER NOT NULL DEFAULT 1
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS despesas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    categoria_id INTEGER NOT NULL,
    descricao TEXT,
    valor REAL NOT NULL,
    data TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY(categoria_id) REFERENCES categorias(id)
  )`);
  // Admin padrão
  db.get(`SELECT id FROM usuarios WHERE is_admin = 1 LIMIT 1`, (err, row) => {
    if (!row) {
      const hash = bcrypt.hashSync('admin123', 10);
      db.run(`INSERT INTO usuarios (nome, email, senha, is_admin, ativo) VALUES (?, ?, ?, 1, 1)`,
        ['Administrador', 'admin@admin.com', hash]);
      console.log('Usuário admin padrão criado: admin@admin.com / admin123');
    }
  });
  // Categorias padrão
  db.get(`SELECT id FROM categorias LIMIT 1`, (err, row) => {
    if (!row) {
      const cats = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Outros'];
      cats.forEach(c => db.run(`INSERT INTO categorias (nome) VALUES (?)`, [c]));
    }
  });
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: DATA_DIR }),
  secret: process.env.SESSION_SECRET || 'segredo-controle-despesas-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  db.get(`SELECT * FROM usuarios WHERE id = ?`, [req.session.userId], (err, user) => {
    if (err || !user || !user.ativo) {
      req.session.destroy(() => res.redirect('/login'));
      return;
    }
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) return res.status(403).send('Acesso negado');
  next();
}

// --- Rotas de autenticação ---

app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('login', { erro: null });
});

app.post('/login', (req, res) => {
  const { email, senha } = req.body;
  db.get(`SELECT * FROM usuarios WHERE email = ?`, [email], (err, user) => {
    if (err || !user) return res.render('login', { erro: 'Email ou senha inválidos' });
    if (!user.ativo) return res.render('login', { erro: 'Conta desativada. Contate o administrador.' });
    if (!bcrypt.compareSync(senha, user.senha)) return res.render('login', { erro: 'Email ou senha inválidos' });
    req.session.userId = user.id;
    res.redirect('/dashboard');
  });
});

app.get('/cadastro', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('cadastro', { erro: null });
});

app.post('/cadastro', (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) return res.render('cadastro', { erro: 'Preencha todos os campos' });
  if (senha.length < 4) return res.render('cadastro', { erro: 'Senha muito curta' });
  const hash = bcrypt.hashSync(senha, 10);
  db.run(`INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)`, [nome, email, hash], function(err) {
    if (err) return res.render('cadastro', { erro: 'Email já cadastrado' });
    req.session.userId = this.lastID;
    res.redirect('/dashboard');
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// --- Rotas do usuário ---

app.get('/dashboard', requireLogin, (req, res) => {
  const hoje = new Date();
  const mes = req.query.mes || `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const inicio = mes + '-01';
  const [ano, m] = mes.split('-').map(Number);
  const fim = new Date(ano, m, 0).toISOString().slice(0, 10);

  db.all(`
    SELECT d.id, d.descricao, d.valor, d.data, c.nome AS categoria, c.id AS categoria_id
    FROM despesas d JOIN categorias c ON c.id = d.categoria_id
    WHERE d.usuario_id = ? AND d.data >= ? AND d.data <= ?
    ORDER BY d.data DESC, d.id DESC
  `, [req.user.id, inicio, fim], (err, despesas) => {
    if (err) despesas = [];
    const total = despesas.reduce((s, d) => s + d.valor, 0);

    const porCategoria = {};
    despesas.forEach(d => {
      porCategoria[d.categoria] = (porCategoria[d.categoria] || 0) + d.valor;
    });

    db.all(`SELECT * FROM categorias WHERE ativa = 1 ORDER BY nome`, (err, categorias) => {
      if (err) categorias = [];
      res.render('dashboard', {
        user: req.user,
        despesas,
        categorias: categorias || [],
        total,
        porCategoria,
        mes
      });
    });
  });
});

app.post('/despesas', requireLogin, (req, res) => {
  const { descricao, valor, data, categoria_id } = req.body;
  const v = parseFloat(String(valor).replace(',', '.'));
  if (!v || v <= 0 || !data || !categoria_id) return res.redirect('/dashboard');
  db.run(`INSERT INTO despesas (usuario_id, categoria_id, descricao, valor, data) VALUES (?, ?, ?, ?, ?)`,
    [req.user.id, categoria_id, descricao || '', v, data],
    () => {
      const mes = data.slice(0, 7);
      res.redirect('/dashboard?mes=' + mes);
    });
});

app.post('/despesas/:id/excluir', requireLogin, (req, res) => {
  db.run(`DELETE FROM despesas WHERE id = ? AND usuario_id = ?`, [req.params.id, req.user.id],
    () => res.redirect('back'));
});

// --- Rotas do administrador ---

app.get('/admin', requireLogin, requireAdmin, (req, res) => {
  db.all(`
    SELECT u.id, u.nome, u.email, u.ativo, u.criado_em,
      COALESCE((SELECT SUM(valor) FROM despesas WHERE usuario_id = u.id), 0) AS total_gasto
    FROM usuarios u ORDER BY u.id
  `, (err, usuarios) => {
    if (err) usuarios = [];
    db.all(`SELECT c.*, (SELECT COUNT(*) FROM despesas WHERE categoria_id = c.id) AS qtd FROM categorias c ORDER BY c.nome`,
      (err, categorias) => {
        if (err) categorias = [];
        const totalGeral = (usuarios || []).reduce((s, u) => s + (u.total_gasto || 0), 0);
        res.render('admin', {
          user: req.user,
          usuarios: usuarios || [],
          categorias: categorias || [],
          totalGeral
        });
      });
  });
});

app.post('/admin/categorias', requireLogin, requireAdmin, (req, res) => {
  const { nome } = req.body;
  if (!nome || !nome.trim()) return res.redirect('/admin');
  db.run(`INSERT INTO categorias (nome) VALUES (?)`, [nome.trim()], (err) => {
    res.redirect('/admin');
  });
});

app.post('/admin/categorias/:id/toggle', requireLogin, requireAdmin, (req, res) => {
  db.get(`SELECT ativa FROM categorias WHERE id = ?`, [req.params.id], (err, row) => {
    if (!row) return res.redirect('/admin');
    db.run(`UPDATE categorias SET ativa = ? WHERE id = ?`, [row.ativa ? 0 : 1, req.params.id],
      () => res.redirect('/admin'));
  });
});

app.post('/admin/usuarios/:id/toggle', requireLogin, requireAdmin, (req, res) => {
  db.get(`SELECT is_admin, ativo FROM usuarios WHERE id = ?`, [req.params.id], (err, row) => {
    if (!row || row.is_admin) return res.redirect('/admin');
    db.run(`UPDATE usuarios SET ativo = ? WHERE id = ?`, [row.ativo ? 0 : 1, req.params.id],
      () => res.redirect('/admin'));
  });
});

app.listen(PORT, () => {
  console.log('Servidor rodando na porta ' + PORT);
  console.log('Admin padrão: admin@admin.com / admin123');
});
