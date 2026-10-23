const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    store: new SQLiteStore({
      db: 'sessions.sqlite',
      dir: '.'
    }),
    secret: process.env.SESSION_SECRET || 'troque-esta-chave-em-producao',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

app.use(async (req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.error = req.session.error || null;
  res.locals.success = req.session.success || null;
  delete req.session.error;
  delete req.session.success;
  next();
});

function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.session.error = 'Entre na sua conta para continuar.';
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    req.session.error = 'Acesso restrito ao administrador.';
    return res.redirect('/');
  }
  next();
}

async function refreshUser(req) {
  if (!req.session.user) return null;
  const user = await db.get('SELECT id, name, email, role, suspended FROM users WHERE id = ?', [req.session.user.id]);
  if (!user || user.suspended) {
    req.session.destroy(() => {});
    return null;
  }
  req.session.user = user;
  return user;
}

app.get('/', async (req, res) => {
  await refreshUser(req);
  const services = await db.all(`
    SELECT services.*, users.name AS owner_name
    FROM services
    JOIN users ON users.id = services.user_id
    WHERE services.status = 'approved'
      AND users.suspended = 0
    ORDER BY services.created_at DESC
  `);
  res.render('index', { services });
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    req.session.error = 'Preencha todos os campos.';
    return res.redirect('/register');
  }

  const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    req.session.error = 'Este e-mail já está cadastrado.';
    return res.redirect('/register');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.run(
    'INSERT INTO users (name, email, password_hash, role, suspended, created_at) VALUES (?, ?, ?, ?, 0, datetime("now"))',
    [name, email, passwordHash, 'user']
  );

  req.session.success = 'Conta criada com sucesso. Agora entre.';
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await db.get('SELECT id, name, email, password_hash, role, suspended FROM users WHERE email = ?', [email]);
  if (!user) {
    req.session.error = 'E-mail ou senha inválidos.';
    return res.redirect('/login');
  }

  if (user.suspended) {
    req.session.error = 'Sua conta está suspensa.';
    return res.redirect('/login');
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    req.session.error = 'E-mail ou senha inválidos.';
    return res.redirect('/login');
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    suspended: user.suspended
  };

  res.redirect('/');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.get('/dashboard', requireAuth, async (req, res) => {
  const user = await refreshUser(req);
  if (!user) return res.redirect('/login');

  const myServices = await db.all(`
    SELECT *
    FROM services
    WHERE user_id = ?
    ORDER BY created_at DESC
  `, [user.id]);

  const myContracts = await db.all(`
    SELECT contracts.*,
           services.title AS service_title,
           services.price AS service_price,
           provider.name AS provider_name,
           client.name AS client_name
    FROM contracts
    JOIN services ON services.id = contracts.service_id
    JOIN users provider ON provider.id = contracts.provider_id
    JOIN users client ON client.id = contracts.client_id
    WHERE contracts.provider_id = ? OR contracts.client_id = ?
    ORDER BY contracts.created_at DESC
  `, [user.id, user.id]);

  res.render('dashboard', { myServices, myContracts });
});

app.get('/services/new', requireAuth, async (req, res) => {
  const user = await refreshUser(req);
  if (!user) return res.redirect('/login');
  res.render('new-service');
});

app.post('/services/new', requireAuth, async (req, res) => {
  const user = await refreshUser(req);
  if (!user) return res.redirect('/login');

  const { title, description, price } = req.body;

  if (!title || !description || !price) {
    req.session.error = 'Preencha todos os campos.';
    return res.redirect('/services/new');
  }

  await db.run(`
    INSERT INTO services (user_id, title, description, price, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', datetime("now"))
  `, [user.id, title, description, Number(price)]);

  req.session.success = 'Serviço publicado e enviado para aprovação.';
  res.redirect('/dashboard');
});

app.get('/services/:id', async (req, res) => {
  await refreshUser(req);

  const service = await db.get(`
    SELECT services.*, users.name AS owner_name, users.suspended AS owner_suspended
    FROM services
    JOIN users ON users.id = services.user_id
    WHERE services.id = ?
  `, [req.params.id]);

  if (!service || service.status !== 'approved' || service.owner_suspended) {
    req.session.error = 'Serviço não encontrado.';
    return res.redirect('/');
  }

  res.render('service', { service });
});

app.post('/services/:id/hire', requireAuth, async (req, res) => {
  const user = await refreshUser(req);
  if (!user) return res.redirect('/login');

  const service = await db.get(`
    SELECT services.*, users.suspended AS owner_suspended
    FROM services
    JOIN users ON users.id = services.user_id
    WHERE services.id = ?
  `, [req.params.id]);

  if (!service || service.status !== 'approved' || service.owner_suspended) {
    req.session.error = 'Serviço não encontrado.';
    return res.redirect('/');
  }

  if (service.user_id === user.id) {
    req.session.error = 'Você não pode contratar seu próprio serviço.';
    return res.redirect('/services/' + service.id);
  }

  await db.run(`
    INSERT INTO contracts (service_id, provider_id, client_id, status, created_at)
    VALUES (?, ?, ?, 'active', datetime("now"))
  `, [service.id, service.user_id, user.id]);

  req.session.success = 'Serviço contratado com sucesso.';
  res.redirect('/dashboard');
});

app.post('/contracts/:id/status', requireAuth, async (req, res) => {
  const user = await refreshUser(req);
  if (!user) return res.redirect('/login');

  const { status } = req.body;
  if (!['active', 'completed', 'cancelled'].includes(status)) {
    req.session.error = 'Status inválido.';
    return res.redirect('/dashboard');
  }

  const contract = await db.get('SELECT * FROM contracts WHERE id = ?', [req.params.id]);
  if (!contract || (contract.provider_id !== user.id && contract.client_id !== user.id)) {
    req.session.error = 'Contrato não encontrado.';
    return res.redirect('/dashboard');
  }

  await db.run('UPDATE contracts SET status = ? WHERE id = ?', [status, contract.id]);
  req.session.success = 'Contrato atualizado.';
  res.redirect('/dashboard');
});

app.get('/admin', requireAdmin, async (req, res) => {
  const users = await db.all('SELECT id, name, email, role, suspended, created_at FROM users ORDER BY created_at DESC');

  const services = await db.all(`
    SELECT services.*, users.name AS owner_name, users.email AS owner_email
    FROM services
    JOIN users ON users.id = services.user_id
    ORDER BY services.created_at DESC
  `);

  const contracts = await db.all(`
    SELECT contracts.*,
           services.title AS service_title,
           provider.name AS provider_name,
           client.name AS client_name
    FROM contracts
    JOIN services ON services.id = contracts.service_id
    JOIN users provider ON provider.id = contracts.provider_id
    JOIN users client ON client.id = contracts.client_id
    ORDER BY contracts.created_at DESC
  `);

  res.render('admin', { users, services, contracts });
});

app.post('/admin/services/:id/approve', requireAdmin, async (req, res) => {
  await db.run('UPDATE services SET status = "approved" WHERE id = ?', [req.params.id]);
  req.session.success = 'Serviço aprovado.';
  res.redirect('/admin');
});

app.post('/admin/services/:id/remove', requireAdmin, async (req, res) => {
  await db.run('UPDATE services SET status = "removed" WHERE id = ?', [req.params.id]);
  req.session.success = 'Serviço removido.';
  res.redirect('/admin');
});

app.post('/admin/users/:id/suspend', requireAdmin, async (req, res) => {
  const target = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (target && target.role !== 'admin') {
    await db.run('UPDATE users SET suspended = 1 WHERE id = ?', [req.params.id]);
    req.session.success = 'Usuário suspenso.';
  } else {
    req.session.error = 'Não é possível suspender administrador.';
  }
  res.redirect('/admin');
});

app.post('/admin/users/:id/activate', requireAdmin, async (req, res) => {
  await db.run('UPDATE users SET suspended = 0 WHERE id = ?', [req.params.id]);
  req.session.success = 'Usuário reativado.';
  res.redirect('/admin');
});

db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
});
