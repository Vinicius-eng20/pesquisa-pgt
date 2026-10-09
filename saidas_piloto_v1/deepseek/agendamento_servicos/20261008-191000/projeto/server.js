const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'agendamento-secret-key-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

// ---------- Persistencia ----------
let db = {
  users: [],
  services: [],
  slots: [],
  appointments: []
};

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      db.users = db.users || [];
      db.services = db.services || [];
      db.slots = db.slots || [];
      db.appointments = db.appointments || [];
    } catch (e) {
      console.error('Erro ao ler data.json, iniciando vazio.');
    }
  }
  // Cria admin padrao se nao existir
  if (!db.users.find(u => u.role === 'admin')) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.users.push({
      id: Date.now().toString(),
      name: 'Administrador',
      email: 'admin@admin.com',
      password: hash,
      role: 'admin'
    });
    saveData();
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

loadData();

// ---------- Helpers ----------
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Nao autenticado' });
  next();
}
function requireAdmin(req, res, next) {
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  next();
}

// ---------- Autenticacao ----------
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Preencha todos os campos' });
  if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'Email ja cadastrado' });
  }
  const user = {
    id: Date.now().toString(),
    name,
    email,
    password: bcrypt.hashSync(password, 10),
    role: 'client'
  };
  db.users.push(user);
  saveData();
  req.session.userId = user.id;
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
  if (!user || !bcrypt.compareSync(password || '', user.password)) {
    return res.status(400).json({ error: 'Email ou senha invalidos' });
  }
  req.session.userId = user.id;
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json(null);
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.json(null);
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

// ---------- Servicos ----------
app.get('/api/services', (req, res) => {
  res.json(db.services);
});

app.post('/api/services', requireAuth, requireAdmin, (req, res) => {
  const { name, description, duration, price } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatorio' });
  const service = {
    id: Date.now().toString(),
    name,
    description: description || '',
    duration: duration || '30 min',
    price: price || ''
  };
  db.services.push(service);
  saveData();
  res.json(service);
});

app.put('/api/services/:id', requireAuth, requireAdmin, (req, res) => {
  const service = db.services.find(s => s.id === req.params.id);
  if (!service) return res.status(404).json({ error: 'Servico nao encontrado' });
  service.name = req.body.name || service.name;
  service.description = req.body.description !== undefined ? req.body.description : service.description;
  service.duration = req.body.duration !== undefined ? req.body.duration : service.duration;
  service.price = req.body.price !== undefined ? req.body.price : service.price;
  saveData();
  res.json(service);
});

app.delete('/api/services/:id', requireAuth, requireAdmin, (req, res) => {
  db.services = db.services.filter(s => s.id !== req.params.id);
  saveData();
  res.json({ ok: true });
});

// ---------- Horarios (slots) ----------
app.get('/api/slots', (req, res) => {
  res.json(db.slots);
});

app.post('/api/slots', requireAuth, requireAdmin, (req, res) => {
  const { date, time } = req.body;
  if (!date || !time) return res.status(400).json({ error: 'Data e hora obrigatorios' });
  if (db.slots.find(s => s.date === date && s.time === time)) {
    return res.status(400).json({ error: 'Ja existe este horario' });
  }
  const slot = { id: Date.now().toString(), date, time };
  db.slots.push(slot);
  saveData();
  res.json(slot);
});

app.delete('/api/slots/:id', requireAuth, requireAdmin, (req, res) => {
  db.slots = db.slots.filter(s => s.id !== req.params.id);
  db.appointments = db.appointments.filter(a => a.slotId !== req.params.id);
  saveData();
  res.json({ ok: true });
});

// ---------- Agendamentos ----------
app.get('/api/appointments', requireAuth, (req, res) => {
  const user = db.users.find(u => u.id === req.session.userId);
  let list;
  if (user.role === 'admin') {
    list = db.appointments;
  } else {
    list = db.appointments.filter(a => a.userId === user.id);
  }
  // Enriquecer com nomes de servicos, horarios e usuarios
  const enriched = list.map(a => {
    const s = db.services.find(x => x.id === a.serviceId) || {};
    const sl = db.slots.find(x => x.id === a.slotId) || {};
    const u = db.users.find(x => x.id === a.userId) || {};
    return {
      ...a,
      serviceName: s.name || 'Servico removido',
      servicePrice: s.price || '',
      date: sl.date || '',
      time: sl.time || '',
      clientName: u.name || '',
      clientEmail: u.email || ''
    };
  });
  enriched.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  res.json(enriched);
});

app.post('/api/appointments', requireAuth, (req, res) => {
  const { serviceId, slotId } = req.body;
  const user = db.users.find(u => u.id === req.session.userId);
  if (!db.services.find(s => s.id === serviceId)) return res.status(400).json({ error: 'Servico invalido' });
  const slot = db.slots.find(s => s.id === slotId);
  if (!slot) return res.status(400).json({ error: 'Horario invalido' });
  if (db.appointments.find(a => a.slotId === slotId && a.status !== 'recusado' && a.status !== 'cancelado')) {
    return res.status(400).json({ error: 'Horario ja ocupado' });
  }
  const appt = {
    id: Date.now().toString(),
    userId: user.id,
    serviceId,
    slotId,
    status: 'pendente',
    createdAt: new Date().toISOString()
  };
  db.appointments.push(appt);
  saveData();
  res.json(appt);
});

app.put('/api/appointments/:id', requireAuth, (req, res) => {
  const appt = db.appointments.find(a => a.id === req.params.id);
  if (!appt) return res.status(404).json({ error: 'Agendamento nao encontrado' });
  const user = db.users.find(u => u.id === req.session.userId);
  const { status } = req.body;

  // Cliente so pode cancelar o proprio
  if (user.role !== 'admin') {
    if (appt.userId !== user.id) return res.status(403).json({ error: 'Acesso negado' });
    if (status !== 'cancelado') return res.status(403).json({ error: 'Cliente so pode cancelar' });
  } else {
    if (!['confirmado', 'recusado', 'pendente'].includes(status)) {
      return res.status(400).json({ error: 'Status invalido' });
    }
  }
  appt.status = status;
  saveData();
  res.json(appt);
});

app.delete('/api/appointments/:id', requireAuth, (req, res) => {
  const appt = db.appointments.find(a => a.id === req.params.id);
  if (!appt) return res.status(404).json({ error: 'Nao encontrado' });
  const user = db.users.find(u => u.id === req.session.userId);
  if (user.role !== 'admin' && appt.userId !== user.id) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  db.appointments = db.appointments.filter(a => a.id !== req.params.id);
  saveData();
  res.json({ ok: true });
});

// ---------- Horarios livres (para cliente) ----------
app.get('/api/free-slots', requireAuth, (req, res) => {
  const busySlotIds = db.appointments
    .filter(a => a.status !== 'recusado' && a.status !== 'cancelado')
    .map(a => a.slotId);
  const free = db.slots.filter(s => !busySlotIds.includes(s.id));
  free.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  res.json(free);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

---
