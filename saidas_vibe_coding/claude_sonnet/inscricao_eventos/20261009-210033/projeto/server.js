const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
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
  secret: 'evento-secreto-2024-portal-inscricoes',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

// Funções de banco de dados
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Erro ao carregar banco de dados:', error);
  }
  
  // Banco de dados inicial
  return {
    users: [],
    events: [],
    registrations: []
  };
}

function saveDatabase(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar banco de dados:', error);
    return false;
  }
}

// Inicializar banco com usuários padrão
function initializeDatabase() {
  let db = loadDatabase();
  
  if (db.users.length === 0) {
    const organizadorHash = bcrypt.hashSync('organizador123', 10);
    const participanteHash = bcrypt.hashSync('participante123', 10);
    
    db.users.push({
      id: 1,
      name: 'Organizador Sistema',
      email: 'organizador@eventos.com',
      password: organizadorHash,
      role: 'organizador',
      createdAt: new Date().toISOString()
    });
    
    db.users.push({
      id: 2,
      name: 'Participante Teste',
      email: 'participante@eventos.com',
      password: participanteHash,
      role: 'participante',
      createdAt: new Date().toISOString()
    });
    
    saveDatabase(db);
  }
  
  return db;
}

// Middleware de autenticação
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Não autorizado' });
  }
}

function isOrganizador(req, res, next) {
  if (req.session.userId && req.session.role === 'organizador') {
    next();
  } else {
    res.status(403).json({ error: 'Acesso negado. Apenas organizadores.' });
  }
}

// Rotas de autenticação
app.post('/api/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }
  
  if (role !== 'participante' && role !== 'organizador') {
    return res.status(400).json({ error: 'Tipo de usuário inválido' });
  }
  
  const db = loadDatabase();
  
  // Verificar se email já existe
  if (db.users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Email já cadastrado' });
  }
  
  // Criar novo usuário
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1,
    name,
    email,
    password: hashedPassword,
    role,
    createdAt: new Date().toISOString()
  };
  
  db.users.push(newUser);
  saveDatabase(db);
  
  res.json({ message: 'Usuário criado com sucesso', userId: newUser.id });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }
  
  const db = loadDatabase();
  const user = db.users.find(u => u.email === email);
  
  if (!user) {
    return res.status(401).json({ error: 'Email ou senha incorretos' });
  }
  
  const validPassword = await bcrypt.compare(password, user.password);
  
  if (!validPassword) {
    return res.status(401).json({ error: 'Email ou senha incorretos' });
  }
  
  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.name = user.name;
  
  res.json({
    message: 'Login realizado com sucesso',
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
  res.json({ message: 'Logout realizado com sucesso' });
});

app.get('/api/me', isAuthenticated, (req, res) => {
  const db = loadDatabase();
  const user = db.users.find(u => u.id === req.session.userId);
  
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }
  
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  });
});

// Rotas de eventos
app.get('/api/events', isAuthenticated, (req, res) => {
  const db = loadDatabase();
  const events = db.events.filter(e => e.status === 'ativo');
  
  res.json(events);
});

app.get('/api/events/:id', isAuthenticated, (req, res) => {
  const db = loadDatabase();
  const event = db.events.find(e => e.id === parseInt(req.params.id));
  
  if (!event) {
    return res.status(404).json({ error: 'Evento não encontrado' });
  }
  
  res.json(event);
});

app.post('/api/events', isOrganizador, (req, res) => {
  const { title, description, date, location, maxParticipants } = req.body;
  
  if (!title || !description || !date || !location || !maxParticipants) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }
  
  const db = loadDatabase();
  
  const newEvent = {
    id: db.events.length > 0 ? Math.max(...db.events.map(e => e.id)) + 1 : 1,
    title,
    description,
    date,
    location,
    maxParticipants: parseInt(maxParticipants),
    organizerId: req.session.userId,
    status: 'ativo',
    createdAt: new Date().toISOString()
  };
  
  db.events.push(newEvent);
  saveDatabase(db);
  
  res.json({ message: 'Evento criado com sucesso', event: newEvent });
});

app.put('/api/events/:id', isOrganizador, (req, res) => {
  const { title, description, date, location, maxParticipants } = req.body;
  const db = loadDatabase();
  
  const eventIndex = db.events.findIndex(e => e.id === parseInt(req.params.id));
  
  if (eventIndex === -1) {
    return res.status(404).json({ error: 'Evento não encontrado' });
  }
  
  const event = db.events[eventIndex];
  
  if (event.organizerId !== req.session.userId) {
    return res.status(403).json({ error: 'Você não pode editar este evento' });
  }
  
  db.events[eventIndex] = {
    ...event,
    title: title || event.title,
    description: description || event.description,
    date: date || event.date,
    location: location || event.location,
    maxParticipants: maxParticipants ? parseInt(maxParticipants) : event.maxParticipants,
    updatedAt: new Date().toISOString()
  };
  
  saveDatabase(db);
  
  res.json({ message: 'Evento atualizado com sucesso', event: db.events[eventIndex] });
});

app.delete('/api/events/:id', isOrganizador, (req, res) => {
  const db = loadDatabase();
  const eventIndex = db.events.findIndex(e => e.id === parseInt(req.params.id));
  
  if (eventIndex === -1) {
    return res.status(404).json({ error: 'Evento não encontrado' });
  }
  
  const event = db.events[eventIndex];
  
  if (event.organizerId !== req.session.userId) {
    return res.status(403).json({ error: 'Você não pode cancelar este evento' });
  }
  
  db.events[eventIndex].status = 'cancelado';
  saveDatabase(db);
  
  res.json({ message: 'Evento cancelado com sucesso' });
});

// Rotas de inscrições
app.post('/api/registrations', isAuthenticated, (req, res) => {
  const { eventId } = req.body;
  
  if (!eventId) {
    return res.status(400).json({ error: 'ID do evento é obrigatório' });
  }
  
  const db = loadDatabase();
  const event = db.events.find(e => e.id === parseInt(eventId));
  
  if (!event) {
    return res.status(404).json({ error: 'Evento não encontrado' });
  }
  
  if (event.status !== 'ativo') {
    return res.status(400).json({ error: 'Este evento não está mais disponível' });
  }
  
  // Verificar se já está inscrito
  const existingRegistration = db.registrations.find(
    r => r.eventId === parseInt(eventId) && r.userId === req.session.userId && r.status !== 'cancelado'
  );
  
  if (existingRegistration) {
    return res.status(400).json({ error: 'Você já está inscrito neste evento' });
  }
  
  // Verificar vagas disponíveis
  const activeRegistrations = db.registrations.filter(
    r => r.eventId === parseInt(eventId) && r.status !== 'cancelado'
  );
  
  if (activeRegistrations.length >= event.maxParticipants) {
    return res.status(400).json({ error: 'Evento lotado' });
  }
  
  const newRegistration = {
    id: db.registrations.length > 0 ? Math.max(...db.registrations.map(r => r.id)) + 1 : 1,
    eventId: parseInt(eventId),
    userId: req.session.userId,
    status: 'inscrito',
    presence: false,
    createdAt: new Date().toISOString()
  };
  
  db.registrations.push(newRegistration);
  saveDatabase(db);
  
  res.json({ message: 'Inscrição realizada com sucesso', registration: newRegistration });
});

app.get('/api/registrations/my', isAuthenticated, (req, res) => {
  const db = loadDatabase();
  
  const userRegistrations = db.registrations
    .filter(r => r.userId === req.session.userId && r.status !== 'cancelado')
    .map(r => {
      const event = db.events.find(e => e.id === r.eventId);
      return {
        ...r,
        event
      };
    });
  
  res.json(userRegistrations);
});

app.get('/api/registrations/all', isOrganizador, (req, res) => {
  const db = loadDatabase();
  
  const allRegistrations = db.registrations
    .filter(r => r.status !== 'cancelado')
    .map(r => {
      const event = db.events.find(e => e.id === r.eventId);
      const user = db.users.find(u => u.id === r.userId);
      return {
        ...r,
        event,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      };
    });
  
  res.json(allRegistrations);
});

app.delete('/api/registrations/:id', isAuthenticated, (req, res) => {
  const db = loadDatabase();
  const registrationIndex = db.registrations.findIndex(r => r.id === parseInt(req.params.id));
  
  if (registrationIndex === -1) {
    return res.status(404).json({ error: 'Inscrição não encontrada' });
  }
  
  const registration = db.registrations[registrationIndex];
  
  if (registration.userId !== req.session.userId) {
    return res.status(403).json({ error: 'Você não pode cancelar esta inscrição' });
  }
  
  db.registrations[registrationIndex].status = 'cancelado';
  saveDatabase(db);
  
  res.json({ message: 'Inscrição cancelada com sucesso' });
});

app.put('/api/registrations/:id/presence', isOrganizador, (req, res) => {
  const { presence } = req.body;
  const db = loadDatabase();
  
  const registrationIndex = db.registrations.findIndex(r => r.id === parseInt(req.params.id));
  
  if (registrationIndex === -1) {
    return res.status(404).json({ error: 'Inscrição não encontrada' });
  }
  
  const registration = db.registrations[registrationIndex];
  const event = db.events.find(e => e.id === registration.eventId);
  
  if (!event || event.organizerId !== req.session.userId) {
    return res.status(403).json({ error: 'Você não pode confirmar presença neste evento' });
  }
  
  db.registrations[registrationIndex].presence = presence === true;
  saveDatabase(db);
  
  res.json({ message: 'Presença atualizada com sucesso', registration: db.registrations[registrationIndex] });
});

// Rota para servir o HTML
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicializar e iniciar servidor
initializeDatabase();

app.listen(PORT, () => {
  console.log(`\n===========================================`);
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`===========================================\n`);
  console.log(`Contas de teste:`);
  console.log(`\nOrganizador:`);
  console.log(`  Email: organizador@eventos.com`);
  console.log(`  Senha: organizador123`);
  console.log(`\nParticipante:`);
  console.log(`  Email: participante@eventos.com`);
  console.log(`  Senha: participante123`);
  console.log(`\n===========================================\n`);
});
