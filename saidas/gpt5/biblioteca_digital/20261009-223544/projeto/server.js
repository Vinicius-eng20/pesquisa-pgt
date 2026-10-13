const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const methodOverride = require('method-override');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'biblioteca.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('reader', 'librarian')),
  blocked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT,
  type TEXT NOT NULL DEFAULT 'Livro',
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  borrowed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_at TEXT NOT NULL,
  returned_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(item_id) REFERENCES items(id)
);
`);

const adminEmail = 'bibliotecario@biblioteca.local';
const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
    'Bibliotecário',
    adminEmail,
    hash,
    'librarian'
  );
}

const countItems = db.prepare('SELECT COUNT(*) AS total FROM items').get().total;
if (countItems === 0) {
  const insert = db.prepare('INSERT INTO items (title, author, type, description, quantity) VALUES (?, ?, ?, ?, ?)');
  insert.run('Dom Casmurro', 'Machado de Assis', 'Livro', 'Clássico da literatura brasileira.', 3);
  insert.run('O Pequeno Príncipe', 'Antoine de Saint-Exupéry', 'Livro', 'Uma história poética para todas as idades.', 2);
  insert.run('Introdução à Programação', 'Equipe Biblioteca', 'E-book', 'Material introdutório para aprender lógica e programação.', 4);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: dataDir }),
  secret: process.env.SESSION_SECRET || 'troque-este-segredo-em-producao',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 14
  }
}));

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

function flash(req, type, message) {
  req.session.flash = { type, message };
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    flash(req, 'error', 'Entre com sua conta para continuar.');
    return res.redirect('/login');
  }
  next();
}

function requireLibrarian(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'librarian') {
    flash(req, 'error', 'Acesso permitido apenas ao bibliotecário.');
    return res.redirect('/');
  }
  next();
}

function isOverdue(loan) {
  return !loan.returned_at && new Date(loan.due_at) < new Date();
}

function updateReaderBlocks() {
  db.prepare(`
    UPDATE users
    SET blocked = 1
    WHERE role = 'reader'
      AND id IN (
        SELECT DISTINCT user_id FROM loans
        WHERE returned_at IS NULL AND datetime(due_at) < datetime('now')
      )
  `).run();

  db.prepare(`
    UPDATE users
    SET blocked = 0
    WHERE role = 'reader'
      AND id NOT IN (
        SELECT DISTINCT user_id FROM loans
        WHERE returned_at IS NULL AND datetime(due_at) < datetime('now')
      )
  `).run();
}

function getAvailableQuantity(itemId) {
  const item = db.prepare('SELECT quantity FROM items WHERE id = ?').get(itemId);
  if (!item) return 0;
  const active = db.prepare('SELECT COUNT(*) AS total FROM loans WHERE item_id = ? AND returned_at IS NULL').get(itemId).total;
  return item.quantity - active;
}

app.get('/', (req, res) => {
  res.redirect('/catalog');
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    flash(req, 'error', 'Preencha todos os campos.');
    return res.redirect('/register');
  }
  if (password.length < 6) {
    flash(req, 'error', 'A senha precisa ter pelo menos 6 caracteres.');
    return res.redirect('/register');
  }

  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
      name.trim(),
      email.trim().toLowerCase(),
      hash,
      'reader'
    );
    req.session.user = { id: result.lastInsertRowid, name: name.trim(), email: email.trim().toLowerCase(), role: 'reader' };
    flash(req, 'success', 'Conta criada com sucesso.');
    res.redirect('/catalog');
  } catch (err) {
    flash(req, 'error', 'Já existe uma conta com esse e-mail.');
    res.redirect('/register');
  }
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    flash(req, 'error', 'E-mail ou senha inválidos.');
    return res.redirect('/login');
  }

  req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  flash(req, 'success', 'Entrada realizada com sucesso.');
  if (user.role === 'librarian') return res.redirect('/admin');
  res.redirect('/catalog');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/catalog', (req, res) => {
  const q = (req.query.q || '').trim();
  let items;
  if (q) {
    items = db.prepare(`
      SELECT i.*,
        i.quantity - (
          SELECT COUNT(*) FROM loans l WHERE l.item_id = i.id AND l.returned_at IS NULL
        ) AS available
      FROM items i
      WHERE i.title LIKE ? OR i.author LIKE ? OR i.type LIKE ? OR i.description LIKE ?
      ORDER BY i.title
    `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  } else {
    items = db.prepare(`
      SELECT i.*,
        i.quantity - (
          SELECT COUNT(*) FROM loans l WHERE l.item_id = i.id AND l.returned_at IS NULL
        ) AS available
      FROM items i
      ORDER BY i.title
    `).all();
  }

  res.render('catalog', { items, q });
});

app.get('/items/:id', (req, res) => {
  const item = db.prepare(`
    SELECT i.*,
      i.quantity - (
        SELECT COUNT(*) FROM loans l WHERE l.item_id = i.id AND l.returned_at IS NULL
      ) AS available
    FROM items i
    WHERE i.id = ?
  `).get(req.params.id);

  if (!item) {
    flash(req, 'error', 'Item não encontrado.');
    return res.redirect('/catalog');
  }

  res.render('item', { item });
});

app.post('/items/:id/borrow', requireLogin, (req, res) => {
  if (req.session.user.role !== 'reader') {
    flash(req, 'error', 'Apenas leitores podem pegar itens emprestados.');
    return res.redirect(`/items/${req.params.id}`);
  }

  updateReaderBlocks();

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
  if (user.blocked) {
    flash(req, 'error', 'Você possui empréstimo em atraso. Devolva o item atrasado para pegar novos empréstimos.');
    return res.redirect('/my-loans');
  }

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) {
    flash(req, 'error', 'Item não encontrado.');
    return res.redirect('/catalog');
  }

  const available = getAvailableQuantity(item.id);
  if (available <= 0) {
    flash(req, 'error', 'Não há exemplares disponíveis agora.');
    return res.redirect(`/items/${item.id}`);
  }

  const alreadyBorrowed = db.prepare(`
    SELECT id FROM loans
    WHERE user_id = ? AND item_id = ? AND returned_at IS NULL
  `).get(req.session.user.id, item.id);

  if (alreadyBorrowed) {
    flash(req, 'error', 'Você já está com esse item emprestado.');
    return res.redirect('/my-loans');
  }

  db.prepare(`
    INSERT INTO loans (user_id, item_id, due_at)
    VALUES (?, ?, datetime('now', '+14 days'))
  `).run(req.session.user.id, item.id);

  flash(req, 'success', 'Empréstimo realizado. Devolva em até 14 dias.');
  res.redirect('/my-loans');
});

app.get('/my-loans', requireLogin, (req, res) => {
  if (req.session.user.role !== 'reader') return res.redirect('/admin');

  updateReaderBlocks();

  const loans = db.prepare(`
    SELECT l.*, i.title, i.author, i.type
    FROM loans l
    JOIN items i ON i.id = l.item_id
    WHERE l.user_id = ?
    ORDER BY l.borrowed_at DESC
  `).all(req.session.user.id).map(l => ({ ...l, overdue: isOverdue(l) }));

  res.render('my-loans', { loans });
});

app.post('/loans/:id/return', requireLogin, (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!loan) {
    flash(req, 'error', 'Empréstimo não encontrado.');
    return res.redirect('/my-loans');
  }

  const isOwner = req.session.user.role === 'reader' && loan.user_id === req.session.user.id;
  const isLibrarian = req.session.user.role === 'librarian';

  if (!isOwner && !isLibrarian) {
    flash(req, 'error', 'Você não pode devolver este empréstimo.');
    return res.redirect('/');
  }

  if (loan.returned_at) {
    flash(req, 'error', 'Este item já foi devolvido.');
    return res.redirect(isLibrarian ? '/admin/loans' : '/my-loans');
  }

  db.prepare("UPDATE loans SET returned_at = CURRENT_TIMESTAMP WHERE id = ?").run(loan.id);
  updateReaderBlocks();

  flash(req, 'success', 'Item devolvido com sucesso.');
  res.redirect(isLibrarian ? '/admin/loans' : '/my-loans');
});

app.get('/admin', requireLibrarian, (req, res) => {
  updateReaderBlocks();

  const stats = {
    items: db.prepare('SELECT COUNT(*) AS total FROM items').get().total,
    users: db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'reader'").get().total,
    activeLoans: db.prepare('SELECT COUNT(*) AS total FROM loans WHERE returned_at IS NULL').get().total,
    overdueLoans: db.prepare("SELECT COUNT(*) AS total FROM loans WHERE returned_at IS NULL AND datetime(due_at) < datetime('now')").get().total
  };

  const items = db.prepare(`
    SELECT i.*,
      i.quantity - (
        SELECT COUNT(*) FROM loans l WHERE l.item_id = i.id AND l.returned_at IS NULL
      ) AS available
    FROM items i
    ORDER BY i.title
  `).all();

  res.render('admin/index', { stats, items });
});

app.get('/admin/items/new', requireLibrarian, (req, res) => {
  res.render('admin/item-form', { item: null });
});

app.post('/admin/items', requireLibrarian, (req, res) => {
  const { title, author, type, description, quantity } = req.body;
  const qty = Math.max(1, parseInt(quantity || '1', 10));

  if (!title) {
    flash(req, 'error', 'O título é obrigatório.');
    return res.redirect('/admin/items/new');
  }

  db.prepare(`
    INSERT INTO items (title, author, type, description, quantity)
    VALUES (?, ?, ?, ?, ?)
  `).run(title.trim(), (author || '').trim(), (type || 'Livro').trim(), (description || '').trim(), qty);

  flash(req, 'success', 'Item cadastrado.');
  res.redirect('/admin');
});

app.get('/admin/items/:id/edit', requireLibrarian, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) {
    flash(req, 'error', 'Item não encontrado.');
    return res.redirect('/admin');
  }

  res.render('admin/item-form', { item });
});

app.put('/admin/items/:id', requireLibrarian, (req, res) => {
  const { title, author, type, description, quantity } = req.body;
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) {
    flash(req, 'error', 'Item não encontrado.');
    return res.redirect('/admin');
  }

  const activeLoans = db.prepare('SELECT COUNT(*) AS total FROM loans WHERE item_id = ? AND returned_at IS NULL').get(item.id).total;
  const qty = Math.max(activeLoans, parseInt(quantity || '1', 10));

  if (!title) {
    flash(req, 'error', 'O título é obrigatório.');
    return res.redirect(`/admin/items/${item.id}/edit`);
  }

  db.prepare(`
    UPDATE items
    SET title = ?, author = ?, type = ?, description = ?, quantity = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title.trim(), (author || '').trim(), (type || 'Livro').trim(), (description || '').trim(), qty, item.id);

  flash(req, 'success', 'Item atualizado.');
  res.redirect('/admin');
});

app.delete('/admin/items/:id', requireLibrarian, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) {
    flash(req, 'error', 'Item não encontrado.');
    return res.redirect('/admin');
  }

  const activeLoans = db.prepare('SELECT COUNT(*) AS total FROM loans WHERE item_id = ? AND returned_at IS NULL').get(item.id).total;
  if (activeLoans > 0) {
    flash(req, 'error', 'Não é possível remover item com empréstimos ativos.');
    return res.redirect('/admin');
  }

  db.prepare('DELETE FROM loans WHERE item_id = ?').run(item.id);
  db.prepare('DELETE FROM items WHERE id = ?').run(item.id);

  flash(req, 'success', 'Item removido.');
  res.redirect('/admin');
});

app.get('/admin/loans', requireLibrarian, (req, res) => {
  updateReaderBlocks();

  const loans = db.prepare(`
    SELECT l.*, u.name AS user_name, u.email AS user_email, u.blocked,
           i.title AS item_title, i.author AS item_author
    FROM loans l
    JOIN users u ON u.id = l.user_id
    JOIN items i ON i.id = l.item_id
    ORDER BY l.borrowed_at DESC
  `).all().map(l => ({ ...l, overdue: isOverdue(l) }));

  res.render('admin/loans', { loans });
});

app.get('/admin/readers', requireLibrarian, (req, res) => {
  updateReaderBlocks();

  const readers = db.prepare(`
    SELECT u.*,
      (SELECT COUNT(*) FROM loans l WHERE l.user_id = u.id) AS total_loans,
      (SELECT COUNT(*) FROM loans l WHERE l.user_id = u.id AND l.returned_at IS NULL) AS active_loans,
      (SELECT COUNT(*) FROM loans l WHERE l.user_id = u.id AND l.returned_at IS NULL AND datetime(l.due_at) < datetime('now')) AS overdue_loans
    FROM users u
    WHERE u.role = 'reader'
    ORDER BY u.name
  `).all();

  res.render('admin/readers', { readers });
});

app.listen(PORT, () => {
  console.log(`Biblioteca Digital rodando em http://localhost:${PORT}`);
});
