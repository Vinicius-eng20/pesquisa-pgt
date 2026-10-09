const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// -------------------- Configuração --------------------
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SESSION_SECRET = process.env.SESSION_SECRET || 'biblioteca-secreta-' + Math.random().toString(36).slice(2);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const LOAN_DAYS = 14; // prazo de empréstimo em dias

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'biblioteca.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// -------------------- Banco de dados --------------------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('reader','librarian')),
  blocked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'Livro',
  year TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  item_id INTEGER NOT NULL REFERENCES items(id),
  loan_date TEXT NOT NULL DEFAULT (datetime('now')),
  due_date TEXT NOT NULL,
  return_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','returned'))
);
`);

// Cria o bibliotecário admin na primeira execução
const adminExists = db.prepare("SELECT id FROM users WHERE role='librarian' LIMIT 1").get();
if (!adminExists) {
  db.prepare("INSERT INTO users (username, password_hash, name, role) VALUES (?,?,?, 'librarian')")
    .run('admin', bcrypt.hashSync(ADMIN_PASSWORD, 10), 'Bibliotecário');
  console.log('✔ Conta do bibliotecário criada: usuário "admin"');
}

// -------------------- App --------------------
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 dias
}));
app.use(express.static(path.join(__dirname, 'public')));

// -------------------- Helpers --------------------
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Você precisa estar logado.' });
  next();
}
function requireLibrarian(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Você precisa estar logado.' });
  if (req.session.role !== 'librarian') return res.status(403).json({ error: 'Apenas o bibliotecário pode fazer isso.' });
  next();
}
function availableCount(itemId) {
  const row = db.prepare(`
    SELECT i.quantity - COALESCE(SUM(CASE WHEN l.status='active' THEN 1 ELSE 0 END),0) AS available
    FROM items i LEFT JOIN loans l ON l.item_id = i.id
    WHERE i.id = ? GROUP BY i.id
  `).get(itemId);
  return row ? row.available : 0;
}
function isOverdue(loan) {
  return loan.status === 'active' && new Date(loan.due_date + 'Z') < new Date();
}
// Leitor está impedido de pegar itens? (bloqueado manualmente OU tem atraso)
function readerIsRestricted(userId) {
  const user = db.prepare('SELECT blocked FROM users WHERE id=?').get(userId);
  if (!user) return { restricted: true, reason: 'Usuário não encontrado.' };
  if (user.blocked) return { restricted: true, reason: 'Sua conta está bloqueada pelo bibliotecário. Procure a biblioteca.' };
  const overdue = db.prepare(`
    SELECT COUNT(*) AS c FROM loans
    WHERE user_id=? AND status='active' AND datetime(due_date) < datetime('now')
  `).get(userId).c;
  if (overdue > 0) return { restricted: true, reason: 'Você tem itens em atraso. Devolva-os para poder pegar novos itens.' };
  return { restricted: false };
}

// -------------------- Autenticação --------------------
app.post('/api/register', (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password || !name) return res.status(400).json({ error: 'Preencha nome, usuário e senha.' });
  if (username.length < 3) return res.status(400).json({ error: 'O usuário precisa ter pelo menos 3 caracteres.' });
  if (password.length < 4) return res.status(400).json({ error: 'A senha precisa ter pelo menos 4 caracteres.' });
  const exists = db.prepare('SELECT id FROM users WHERE username=?').get(username.trim().toLowerCase());
  if (exists) return res.status(400).json({ error: 'Esse nome de usuário já está em uso.' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare("INSERT INTO users (username, password_hash, name, role) VALUES (?,?,?, 'reader')")
    .run(username.trim().toLowerCase(), hash, name.trim());
  req.session.userId = info.lastInsertRowid;
  req.session.role = 'reader';
  req.session.name = name.trim();
  res.json({ ok: true, role: 'reader', name: name.trim() });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Informe usuário e senha.' });
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }
  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.name = user.name;
  res.json({ ok: true, role: user.role, name: user.name });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ logged: false });
  const user = db.prepare('SELECT id, username, name, role, blocked FROM users WHERE id=?').get(req.session.userId);
  if (!user) return res.json({ logged: false });
  const restriction = readerIsRestricted(user.id);
  res.json({ logged: true, id: user.id, username: user.username, name: user.name, role: user.role, blocked: user.blocked, restricted: restriction.restricted, restrictionReason: restriction.reason });
});

app.post('/api/change-password', requireAuth, (req, res) => {
  const { current, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.session.userId);
  if (!bcrypt.compareSync(current || '', user.password_hash)) return res.status(400).json({ error: 'Senha atual incorreta.' });
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 4 caracteres.' });
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(newPassword, 10), user.id);
  res.json({ ok: true });
});

// -------------------- Acervo (público para logados) --------------------
app.get('/api/items', requireAuth, (req, res) => {
  const q = (req.query.q || '').trim();
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db.prepare(`
      SELECT i.*,
        i.quantity - COALESCE((SELECT COUNT(*) FROM loans l WHERE l.item_id=i.id AND l.status='active'),0) AS available
      FROM items i
      WHERE i.title LIKE ? OR i.author LIKE ? OR i.type LIKE ? OR i.description LIKE ?
      ORDER BY i.title COLLATE NOCASE
    `).all(like, like, like, like);
  } else {
    rows = db.prepare(`
      SELECT i.*,
        i.quantity - COALESCE((SELECT COUNT(*) FROM loans l WHERE l.item_id=i.id AND l.status='active'),0) AS available
      FROM items i ORDER BY i.title COLLATE NOCASE
    `).all();
  }
  res.json(rows);
});

// -------------------- Empréstimos do leitor --------------------
app.post('/api/loans', requireAuth, (req, res) => {
  const { itemId } = req.body;
  const item = db.prepare('SELECT * FROM items WHERE id=?').get(itemId);
  if (!item) return res.status(404).json({ error: 'Item não encontrado.' });

  const restriction = readerIsRestricted(req.session.userId);
  if (restriction.restricted) return res.status(403).json({ error: restriction.reason });

  if (availableCount(itemId) <= 0) return res.status(400).json({ error: 'Não há exemplares disponíveis deste item no momento.' });

  const already = db.prepare("SELECT id FROM loans WHERE user_id=? AND item_id=? AND status='active'").get(req.session.userId, itemId);
  if (already) return res.status(400).json({ error: 'Você já está com um exemplar deste item.' });

  const due = new Date();
  due.setDate(due.getDate() + LOAN_DAYS);
  const dueStr = due.toISOString().slice(0, 19).replace('T', ' ');
  db.prepare("INSERT INTO loans (user_id, item_id, due_date) VALUES (?,?,?)").run(req.session.userId, itemId, dueStr);
  res.json({ ok: true, message: `Empréstimo realizado! Devolução até ${due.toLocaleDateString('pt-BR')}.` });
});

app.get('/api/my-loans', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT l.*, i.title, i.author, i.type
    FROM loans l JOIN items i ON i.id = l.item_id
    WHERE l.user_id = ?
    ORDER BY l.status='active' DESC, l.loan_date DESC
  `).all(req.session.userId);
  res.json(rows.map(l => ({ ...l, overdue: isOverdue(l) })));
});

app.post('/api/loans/:id/return', requireAuth, (req, res) => {
  const loan = db.prepare("SELECT * FROM loans WHERE id=? AND user_id=? AND status='active'").get(req.params.id, req.session.userId);
  if (!loan) return res.status(404).json({ error: 'Empréstimo não encontrado ou já devolvido.' });
  db.prepare("UPDATE loans SET status='returned', return_date=datetime('now') WHERE id=?").run(loan.id);
  res.json({ ok: true, message: 'Item devolvido. Obrigado!' });
});

// -------------------- Bibliotecário: acervo --------------------
app.post('/api/items', requireLibrarian, (req, res) => {
  const { title, author, type, year, description, quantity } = req.body;
  if (!title) return res.status(400).json({ error: 'O título é obrigatório.' });
  const qty = Math.max(1, parseInt(quantity) || 1);
  const info = db.prepare('INSERT INTO items (title, author, type, year, description, quantity) VALUES (?,?,?,?,?,?)')
    .run(title.trim(), (author || '').trim(), (type || 'Livro').trim(), (year || '').trim(), (description || '').trim(), qty);
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.put('/api/items/:id', requireLibrarian, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id=?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item não encontrado.' });
  const { title, author, type, year, description, quantity } = req.body;
  const active = db.prepare("SELECT COUNT(*) AS c FROM loans WHERE item_id=? AND status='active'").get(item.id).c;
  const qty = Math.max(active, parseInt(quantity) || 1);
  db.prepare('UPDATE items SET title=?, author=?, type=?, year=?, description=?, quantity=? WHERE id=?')
    .run((title || item.title).trim(), (author ?? item.author).trim(), (type ?? item.type).trim(), (year ?? item.year).trim(), (description ?? item.description).trim(), qty, item.id);
  res.json({ ok: true });
});

app.delete('/api/items/:id', requireLibrarian, (req, res) => {
  const active = db.prepare("SELECT COUNT(*) AS c FROM loans WHERE item_id=? AND status='active'").get(req.params.id).c;
  if (active > 0) return res.status(400).json({ error: 'Não é possível remover: há exemplares emprestados deste item.' });
  db.prepare('DELETE FROM loans WHERE item_id=?').run(req.params.id);
  db.prepare('DELETE FROM items WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// -------------------- Bibliotecário: leitores e histórico --------------------
app.get('/api/readers', requireLibrarian, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.name, u.blocked, u.created_at,
      (SELECT COUNT(*) FROM loans l WHERE l.user_id=u.id AND l.status='active') AS active_loans,
      (SELECT COUNT(*) FROM loans l WHERE l.user_id=u.id AND l.status='active' AND datetime(l.due_date) < datetime('now')) AS overdue_loans
    FROM users u WHERE u.role='reader' ORDER BY u.name COLLATE NOCASE
  `).all();
  res.json(rows);
});

app.post('/api/readers/:id/block', requireLibrarian, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id=? AND role='reader'").get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Leitor não encontrado.' });
  const newVal = user.blocked ? 0 : 1;
  db.prepare('UPDATE users SET blocked=? WHERE id=?').run(newVal, user.id);
  res.json({ ok: true, blocked: !!newVal });
});

app.get('/api/loans', requireLibrarian, (req, res) => {
  const filter = req.query.filter || 'all';
  let where = '';
  if (filter === 'active') where = "WHERE l.status='active'";
  if (filter === 'overdue') where = "WHERE l.status='active' AND datetime(l.due_date) < datetime('now')";
  if (filter === 'returned') where = "WHERE l.status='returned'";
  const rows = db.prepare(`
    SELECT l.*, u.name AS reader_name, u.username AS reader_username, i.title AS item_title, i.type AS item_type
    FROM loans l
    JOIN users u ON u.id = l.user_id
    JOIN items i ON i.id = l.item_id
    ${where}
    ORDER BY l.loan_date DESC
  `).all();
  res.json(rows.map(l => ({ ...l, overdue: isOverdue(l) })));
});

// Bibliotecário pode cadastrar outro bibliotecário
app.post('/api/librarians', requireLibrarian, (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password || !name) return res.status(400).json({ error: 'Preencha nome, usuário e senha.' });
  const exists = db.prepare('SELECT id FROM users WHERE username=?').get(username.trim().toLowerCase());
  if (exists) return res.status(400).json({ error: 'Esse nome de usuário já está em uso.' });
  db.prepare("INSERT INTO users (username, password_hash, name, role) VALUES (?,?,?, 'librarian')")
    .run(username.trim().toLowerCase(), bcrypt.hashSync(password, 10), name.trim());
  res.json({ ok: true });
});

// -------------------- Iniciar --------------------
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n📚 Biblioteca Digital rodando em: http://localhost:${PORT}\n`);
});
