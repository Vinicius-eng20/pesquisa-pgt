const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'marketplace-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Inicializar banco de dados
function initDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      users: [
        {
          id: 1,
          name: 'Administrador',
          email: 'admin@marketplace.com',
          password: bcrypt.hashSync('Admin123!', 10),
          role: 'admin',
          suspended: false,
          createdAt: new Date().toISOString()
        }
      ],
      services: [],
      contracts: [],
      nextUserId: 2,
      nextServiceId: 1,
      nextContractId: 1
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
  }
}

function readDB() {
  const data = fs.readFileSync(DB_FILE, 'utf8');
  return JSON.parse(data);
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

initDatabase();

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId || req.session.userRole !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  next();
}

// Rotas de autenticação
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
  }

  const db = readDB();
  
  if (db.users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Email já cadastrado' });
  }

  const newUser = {
    id: db.nextUserId++,
    name,
    email,
    password: bcrypt.hashSync(password, 10),
    role: 'user',
    suspended: false,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  writeDB(db);

  req.session.userId = newUser.id;
  req.session.userName = newUser.name;
  req.session.userRole = newUser.role;

  res.json({ 
    success: true, 
    user: { 
      id: newUser.id, 
      name: newUser.name, 
      email: newUser.email, 
      role: newUser.role 
    } 
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  const db = readDB();
  const user = db.users.find(u => u.email === email);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Email ou senha incorretos' });
  }

  if (user.suspended) {
    return res.status(403).json({ error: 'Conta suspensa. Entre em contato com o administrador.' });
  }

  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.userRole = user.role;

  res.json({ 
    success: true, 
    user: { 
      id: user.id, 
      name: user.name, 
      email: user.email, 
      role: user.role 
    } 
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  res.json({ 
    id: user.id, 
    name: user.name, 
    email: user.email, 
    role: user.role,
    suspended: user.suspended
  });
});

// Rotas de serviços
app.post('/api/services', requireAuth, (req, res) => {
  const { title, description, price, category } = req.body;

  if (!title || !description || !price || !category) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);

  if (user.suspended) {
    return res.status(403).json({ error: 'Conta suspensa' });
  }

  const newService = {
    id: db.nextServiceId++,
    userId: req.session.userId,
    userName: req.session.userName,
    title,
    description,
    price: parseFloat(price),
    category,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  db.services.push(newService);
  writeDB(db);

  res.json({ success: true, service: newService });
});

app.get('/api/services', requireAuth, (req, res) => {
  const db = readDB();
  let services = db.services;

  if (req.session.userRole !== 'admin') {
    services = services.filter(s => s.status === 'approved');
  }

  res.json(services);
});

app.get('/api/services/my', requireAuth, (req, res) => {
  const db = readDB();
  const myServices = db.services.filter(s => s.userId === req.session.userId);
  res.json(myServices);
});

app.delete('/api/services/:id', requireAuth, (req, res) => {
  const serviceId = parseInt(req.params.id);
  const db = readDB();
  
  const serviceIndex = db.services.findIndex(s => s.id === serviceId);
  
  if (serviceIndex === -1) {
    return res.status(404).json({ error: 'Serviço não encontrado' });
  }

  const service = db.services[serviceIndex];

  if (service.userId !== req.session.userId && req.session.userRole !== 'admin') {
    return res.status(403).json({ error: 'Sem permissão' });
  }

  db.services.splice(serviceIndex, 1);
  writeDB(db);

  res.json({ success: true });
});

app.patch('/api/services/:id/approve', requireAdmin, (req, res) => {
  const serviceId = parseInt(req.params.id);
  const db = readDB();
  
  const service = db.services.find(s => s.id === serviceId);
  
  if (!service) {
    return res.status(404).json({ error: 'Serviço não encontrado' });
  }

  service.status = 'approved';
  writeDB(db);

  res.json({ success: true, service });
});

app.delete('/api/admin/services/:id', requireAdmin, (req, res) => {
  const serviceId = parseInt(req.params.id);
  const db = readDB();
  
  const serviceIndex = db.services.findIndex(s => s.id === serviceId);
  
  if (serviceIndex === -1) {
    return res.status(404).json({ error: 'Serviço não encontrado' });
  }

  db.services.splice(serviceIndex, 1);
  writeDB(db);

  res.json({ success: true });
});

// Rotas de contratos
app.post('/api/contracts', requireAuth, (req, res) => {
  const { serviceId } = req.body;

  if (!serviceId) {
    return res.status(400).json({ error: 'ID do serviço é obrigatório' });
  }

  const db = readDB();
  const service = db.services.find(s => s.id === parseInt(serviceId));

  if (!service) {
    return res.status(404).json({ error: 'Serviço não encontrado' });
  }

  if (service.status !== 'approved') {
    return res.status(400).json({ error: 'Serviço não está aprovado' });
  }

  if (service.userId === req.session.userId) {
    return res.status(400).json({ error: 'Você não pode contratar seu próprio serviço' });
  }

  const user = db.users.find(u => u.id === req.session.userId);
  if (user.suspended) {
    return res.status(403).json({ error: 'Conta suspensa' });
  }

  const newContract = {
    id: db.nextContractId++,
    serviceId: service.id,
    serviceTitle: service.title,
    providerId: service.userId,
    providerName: service.userName,
    clientId: req.session.userId,
    clientName: req.session.userName,
    price: service.price,
    status: 'active',
    createdAt: new Date().toISOString()
  };

  db.contracts.push(newContract);
  writeDB(db);

  res.json({ success: true, contract: newContract });
});

app.get('/api/contracts', requireAuth, (req, res) => {
  const db = readDB();
  let contracts = db.contracts;

  if (req.session.userRole !== 'admin') {
    contracts = contracts.filter(c => 
      c.clientId === req.session.userId || c.providerId === req.session.userId
    );
  }

  res.json(contracts);
});

// Rotas de administração
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const db = readDB();
  const users = db.users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    suspended: u.suspended,
    createdAt: u.createdAt
  }));
  res.json(users);
});

app.patch('/api/admin/users/:id/suspend', requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  const db = readDB();
  
  const user = db.users.find(u => u.id === userId);
  
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  if (user.role === 'admin') {
    return res.status(400).json({ error: 'Não é possível suspender um administrador' });
  }

  user.suspended = !user.suspended;
  writeDB(db);

  res.json({ success: true, user: { id: user.id, suspended: user.suspended } });
});

// Rotas de páginas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`\n📝 Conta admin:`);
  console.log(`   Email: admin@marketplace.com`);
  console.log(`   Senha: Admin123!\n`);
});
