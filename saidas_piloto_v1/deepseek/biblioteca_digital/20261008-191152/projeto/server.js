const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database(path.join(__dirname, 'biblioteca.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha TEXT NOT NULL,
    papel TEXT NOT NULL CHECK(papel IN ('leitor','bibliotecario'))
  );

  CREATE TABLE IF NOT EXISTS itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    autor TEXT NOT NULL,
    categoria TEXT NOT NULL,
    ano INTEGER,
    disponivel INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS emprestimos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    data_emprestimo TEXT NOT NULL,
    data_prevista TEXT NOT NULL,
    data_devolucao TEXT,
    FOREIGN KEY(item_id) REFERENCES itens(id),
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
  );
`);

// Cria bibliotecário padrão se não existir
const adminExiste = db.prepare("SELECT id FROM usuarios WHERE papel='bibliotecario'").get();
if (!adminExiste) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare("INSERT INTO usuarios (nome,email,senha,papel) VALUES (?,?,?,?)")
    .run('Bibliotecário', 'admin@biblioteca.com', hash, 'bibliotecario');
  console.log('Bibliotecário padrão criado: admin@biblioteca.com / admin123');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'biblioteca-secret-key-mude-se-quiser',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use(express.static(path.join(__dirname, 'public')));

function exigirLogin(req, res, next) {
  if (!req.session.usuario) return res.status(401).json({ erro: 'Faça login primeiro.' });
  next();
}

function exigirBibliotecario(req, res, next) {
  if (!req.session.usuario || req.session.usuario.papel !== 'bibliotecario')
    return res.status(403).json({ erro: 'Apenas o bibliotecário pode fazer isso.' });
  next();
}

// ===== AUTENTICAÇÃO =====
app.post('/api/cadastro', (req, res) => {
  const { nome, email, senha, papel } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Preencha todos os campos.' });
  const p = papel === 'bibliotecario' ? 'bibliotecario' : 'leitor';
  try {
    const hash = bcrypt.hashSync(senha, 10);
    const info = db.prepare("INSERT INTO usuarios (nome,email,senha,papel) VALUES (?,?,?,?)")
      .run(nome, email.toLowerCase(), hash, p);
    req.session.usuario = { id: info.lastInsertRowid, nome, email: email.toLowerCase(), papel: p };
    res.json({ ok: true, usuario: req.session.usuario });
  } catch (e) {
    res.status(400).json({ erro: 'Este email já está cadastrado.' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  const u = db.prepare("SELECT * FROM usuarios WHERE email=?").get((email || '').toLowerCase());
  if (!u || !bcrypt.compareSync(senha || '', u.senha))
    return res.status(401).json({ erro: 'Email ou senha incorretos.' });
  req.session.usuario = { id: u.id, nome: u.nome, email: u.email, papel: u.papel };
  res.json({ ok: true, usuario: req.session.usuario });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/eu', (req, res) => {
  res.json({ usuario: req.session.usuario || null });
});

// ===== ITENS DO ACERVO =====
app.get('/api/itens', exigirLogin, (req, res) => {
  const { busca } = req.query;
  let itens;
  if (busca) {
    const b = `%${busca}%`;
    itens = db.prepare("SELECT * FROM itens WHERE titulo LIKE ? OR autor LIKE ? OR categoria LIKE ? ORDER BY titulo")
      .all(b, b, b);
  } else {
    itens = db.prepare("SELECT * FROM itens ORDER BY titulo").all();
  }
  res.json(itens);
});

app.post('/api/itens', exigirBibliotecario, (req, res) => {
  const { titulo, autor, categoria, ano } = req.body;
  if (!titulo || !autor || !categoria) return res.status(400).json({ erro: 'Preencha título, autor e categoria.' });
  const info = db.prepare("INSERT INTO itens (titulo,autor,categoria,ano,disponivel) VALUES (?,?,?,?,1)")
    .run(titulo, autor, categoria, ano || null);
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.put('/api/itens/:id', exigirBibliotecario, (req, res) => {
  const { titulo, autor, categoria, ano } = req.body;
  const item = db.prepare("SELECT * FROM itens WHERE id=?").get(req.params.id);
  if (!item) return res.status(404).json({ erro: 'Item não encontrado.' });
  db.prepare("UPDATE itens SET titulo=?, autor=?, categoria=?, ano=? WHERE id=?")
    .run(titulo, autor, categoria, ano || null, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/itens/:id', exigirBibliotecario, (req, res) => {
  const ativo = db.prepare("SELECT id FROM emprestimos WHERE item_id=? AND data_devolucao IS NULL").get(req.params.id);
  if (ativo) return res.status(400).json({ erro: 'Item está emprestado no momento.' });
  db.prepare("DELETE FROM itens WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// ===== EMPRÉSTIMOS =====
function temAtraso(usuarioId) {
  const hoje = new Date().toISOString().slice(0, 10);
  const atrasado = db.prepare(
    "SELECT id FROM emprestimos WHERE usuario_id=? AND data_devolucao IS NULL AND data_prevista < ?"
  ).get(usuarioId, hoje);
  return !!atrasado;
}

app.post('/api/emprestimos', exigirLogin, (req, res) => {
  const { item_id } = req.body;
  const item = db.prepare("SELECT * FROM itens WHERE id=?").get(item_id);
  if (!item) return res.status(404).json({ erro: 'Item não encontrado.' });
  if (!item.disponivel) return res.status(400).json({ erro: 'Item indisponível.' });

  if (temAtraso(req.session.usuario.id))
    return res.status(403).json({ erro: 'Você tem empréstimos em atraso. Devolva-os antes de pegar novos.' });

  const hoje = new Date();
  const prevista = new Date();
  prevista.setDate(hoje.getDate() + 14);

  db.prepare("INSERT INTO emprestimos (item_id,usuario_id,data_emprestimo,data_prevista) VALUES (?,?,?,?)")
    .run(item_id, req.session.usuario.id, hoje.toISOString().slice(0, 10), prevista.toISOString().slice(0, 10));
  db.prepare("UPDATE itens SET disponivel=0 WHERE id=?").run(item_id);
  res.json({ ok: true });
});

app.post('/api/emprestimos/:id/devolver', exigirLogin, (req, res) => {
  const emp = db.prepare("SELECT * FROM emprestimos WHERE id=?").get(req.params.id);
  if (!emp) return res.status(404).json({ erro: 'Empréstimo não encontrado.' });
  if (emp.usuario_id !== req.session.usuario.id && req.session.usuario.papel !== 'bibliotecario')
    return res.status(403).json({ erro: 'Sem permissão.' });
  if (emp.data_devolucao) return res.status(400).json({ erro: 'Já devolvido.' });
  db.prepare("UPDATE emprestimos SET data_devolucao=? WHERE id=?")
    .run(new Date().toISOString().slice(0, 10), req.params.id);
  db.prepare("UPDATE itens SET disponivel=1 WHERE id=?").run(emp.item_id);
  res.json({ ok: true });
});

app.get('/api/meus-emprestimos', exigirLogin, (req, res) => {
  const rows = db.prepare(`
    SELECT e.*, i.titulo, i.autor FROM emprestimos e
    JOIN itens i ON i.id = e.item_id
    WHERE e.usuario_id=? ORDER BY e.data_emprestimo DESC
  `).all(req.session.usuario.id);
  res.json(rows);
});

app.get('/api/emprestimos', exigirBibliotecario, (req, res) => {
  const rows = db.prepare(`
    SELECT e.*, i.titulo, i.autor, u.nome AS leitor, u.email AS leitor_email
    FROM emprestimos e
    JOIN itens i ON i.id = e.item_id
    JOIN usuarios u ON u.id = e.usuario_id
    ORDER BY e.data_emprestimo DESC
  `).all();
  res.json(rows);
});

app.get('/api/usuarios', exigirBibliotecario, (req, res) => {
  const rows = db.prepare("SELECT id,nome,email,papel FROM usuarios ORDER BY nome").all();
  const hoje = new Date().toISOString().slice(0, 10);
  const result = rows.map(u => {
    const atrasados = db.prepare(
      "SELECT COUNT(*) c FROM emprestimos WHERE usuario_id=? AND data_devolucao IS NULL AND data_prevista < ?"
    ).get(u.id, hoje).c;
    const ativos = db.prepare(
      "SELECT COUNT(*) c FROM emprestimos WHERE usuario_id=? AND data_devolucao IS NULL"
    ).get(u.id).c;
    return { ...u, atrasados, ativos };
  });
  res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
