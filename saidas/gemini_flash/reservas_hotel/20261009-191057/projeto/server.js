const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { readData, writeData, initDb } = require('./db');

initDb();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Gerenciamento de sessões em memória mapeadas aos usuários
const sessions = new Map();

function authMiddleware(req, res, next) {
  const token = req.cookies.session_token;
  if (!token || !sessions.has(token)) {
    req.user = null;
    return next();
  }
  const session = sessions.get(token);
  const db = readData();
  const user = db.users.find((u) => u.id === session.userId);
  if (!user) {
    sessions.delete(token);
    req.user = null;
    return next();
  }
  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone
  };
  next();
}

app.use(authMiddleware);

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Você precisa estar conectado para realizar esta ação.' });
  }
  next();
}

function requireManager(req, res, next) {
  if (!req.user || req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Acesso restrito apenas ao gerente do hotel.' });
  }
  next();
}

// ---------------- AUTENTICAÇÃO ----------------

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Preencha nome, e-mail e senha.' });
  }

  const db = readData();
  const existing = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'Este e-mail já está cadastrado no sistema.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const newUser = {
    id: 'usr_' + crypto.randomUUID().slice(0, 8),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    passwordHash: bcrypt.hashSync(password, salt),
    role: 'guest',
    phone: phone ? phone.trim() : '',
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  writeData(db);

  const token = crypto.randomUUID();
  sessions.set(token, { userId: newUser.id, createdAt: Date.now() });

  res.cookie('session_token', token, {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  });

  res.status(201).json({
    message: 'Cadastro realizado com sucesso!',
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      phone: newUser.phone
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  const db = readData();
  const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  }

  const token = crypto.randomUUID();
  sessions.set(token, { userId: user.id, createdAt: Date.now() });

  res.cookie('session_token', token, {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  });

  res.json({
    message: 'Login realizado com sucesso!',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone
    }
  });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies.session_token;
  if (token) {
    sessions.delete(token);
    res.clearCookie('session_token');
  }
  res.json({ message: 'Você saiu da sua conta.' });
});

// ---------------- BUSCA E QUARTOS ----------------

function checkRoomConflict(booking, checkIn, checkOut) {
  if (booking.status === 'recusada' || booking.status === 'cancelada') {
    return false;
  }
  const bIn = new Date(booking.checkIn);
  const bOut = new Date(booking.checkOut);
  const qIn = new Date(checkIn);
  const qOut = new Date(checkOut);

  return qIn < bOut && qOut > bIn;
}

app.get('/api/rooms', (req, res) => {
  const { checkIn, checkOut, guests } = req.query;
  const db = readData();

  if (!checkIn || !checkOut) {
    return res.json(db.rooms);
  }

  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);

  if (isNaN(inDate.getTime()) || isNaN(outDate.getTime()) || inDate >= outDate) {
    return res.status(400).json({ error: 'Datas de check-in e check-out inválidas.' });
  }

  const guestsCount = guests ? parseInt(guests, 10) : 1;

  const availableRooms = db.rooms.filter((room) => {
    if (room.capacity < guestsCount) {
      return false;
    }
    const hasConflict = db.bookings.some(
      (b) => b.roomId === room.id && checkRoomConflict(b, checkIn, checkOut)
    );
    return !hasConflict;
  });

  res.json(availableRooms);
});

// ---------------- RESERVAS - HÓSPEDE ----------------

app.post('/api/bookings', requireAuth, (req, res) => {
  const { roomId, checkIn, checkOut, guestsCount } = req.body;

  if (!roomId || !checkIn || !checkOut) {
    return res.status(400).json({ error: 'Informe quarto, check-in e check-out.' });
  }

  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) {
    return res.status(400).json({ error: 'Datas inválidas.' });
  }

  if (inDate < today) {
    return res.status(400).json({ error: 'A data de check-in não pode ser no passado.' });
  }

  if (inDate >= outDate) {
    return res.status(400).json({ error: 'A data de check-out deve ser posterior ao check-in.' });
  }

  const db = readData();
  const room = db.rooms.find((r) => r.id === roomId);
  if (!room) {
    return res.status(404).json({ error: 'Quarto selecionado não existe.' });
  }

  const guestsNum = parseInt(guestsCount, 10) || 1;
  if (guestsNum > room.capacity) {
    return res.status(400).json({ error: `Este quarto acomoda no máximo ${room.capacity} pessoas.` });
  }

  const hasConflict = db.bookings.some(
    (b) => b.roomId === room.id && checkRoomConflict(b, checkIn, checkOut)
  );

  if (hasConflict) {
    return res.status(400).json({ error: 'Este quarto já está reservado no período selecionado.' });
  }

  const diffTime = Math.abs(outDate - inDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const totalPrice = diffDays * room.pricePerNight;

  const newBooking = {
    id: 'res_' + crypto.randomUUID().slice(0, 8),
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    userPhone: req.user.phone,
    roomId: room.id,
    roomName: room.name,
    roomCategory: room.category,
    checkIn,
    checkOut,
    nights: diffDays,
    guestsCount: guestsNum,
    pricePerNight: room.pricePerNight,
    totalPrice,
    status: 'pendente', // pendente, confirmada, recusada, cancelada
    createdAt: new Date().toISOString()
  };

  db.bookings.unshift(newBooking);
  writeData(db);

  res.status(201).json({
    message: 'Reserva solicitada com sucesso! Aguarde a confirmação do hotel.',
    booking: newBooking
  });
});

app.get('/api/my-bookings', requireAuth, (req, res) => {
  const db = readData();
  const myBookings = db.bookings.filter((b) => b.userId === req.user.id);
  res.json(myBookings);
});

app.post('/api/bookings/:id/cancel', requireAuth, (req, res) => {
  const { id } = req.params;
  const db = readData();
  const booking = db.bookings.find((b) => b.id === id);

  if (!booking) {
    return res.status(404).json({ error: 'Reserva não encontrada.' });
  }

  if (booking.userId !== req.user.id && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Você não tem permissão para cancelar esta reserva.' });
  }

  if (booking.status === 'cancelada') {
    return res.status(400).json({ error: 'Esta reserva já foi cancelada.' });
  }

  if (booking.status === 'recusada') {
    return res.status(400).json({ error: 'Esta reserva já foi recusada pelo hotel.' });
  }

  booking.status = 'cancelada';
  booking.cancelledAt = new Date().toISOString();
  writeData(db);

  res.json({ message: 'Reserva cancelada com sucesso.', booking });
});

// ---------------- GERÊNCIA: QUARTOS ----------------

app.post('/api/admin/rooms', requireManager, (req, res) => {
  const { name, category, description, pricePerNight, capacity, imageUrl, amenities } = req.body;

  if (!name || !pricePerNight || !capacity) {
    return res.status(400).json({ error: 'Nome, preço por noite e capacidade são obrigatórios.' });
  }

  const db = readData();
  const newRoom = {
    id: 'room_' + crypto.randomUUID().slice(0, 8),
    name: name.trim(),
    category: category ? category.trim() : 'Standard',
    description: description ? description.trim() : '',
    pricePerNight: Number(pricePerNight),
    capacity: Number(capacity),
    imageUrl: imageUrl && imageUrl.trim() ? imageUrl.trim() : 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
    amenities: Array.isArray(amenities)
      ? amenities
      : (amenities || '').split(',').map((a) => a.trim()).filter(Boolean)
  };

  db.rooms.push(newRoom);
  writeData(db);

  res.status(201).json({ message: 'Quarto cadastrado com sucesso!', room: newRoom });
});

app.put('/api/admin/rooms/:id', requireManager, (req, res) => {
  const { id } = req.params;
  const { name, category, description, pricePerNight, capacity, imageUrl, amenities } = req.body;

  const db = readData();
  const room = db.rooms.find((r) => r.id === id);

  if (!room) {
    return res.status(404).json({ error: 'Quarto não encontrado.' });
  }

  if (name) room.name = name.trim();
  if (category) room.category = category.trim();
  if (description !== undefined) room.description = description.trim();
  if (pricePerNight) room.pricePerNight = Number(pricePerNight);
  if (capacity) room.capacity = Number(capacity);
  if (imageUrl) room.imageUrl = imageUrl.trim();
  if (amenities !== undefined) {
    room.amenities = Array.isArray(amenities)
      ? amenities
      : amenities.split(',').map((a) => a.trim()).filter(Boolean);
  }

  writeData(db);
  res.json({ message: 'Quarto atualizado com sucesso!', room });
});

app.delete('/api/admin/rooms/:id', requireManager, (req, res) => {
  const { id } = req.params;
  const db = readData();
  const roomIndex = db.rooms.findIndex((r) => r.id === id);

  if (roomIndex === -1) {
    return res.status(404).json({ error: 'Quarto não encontrado.' });
  }

  // Verifica se há reservas ativas para o quarto
  const hasActiveBookings = db.bookings.some(
    (b) => b.roomId === id && (b.status === 'pendente' || b.status === 'confirmada')
  );

  if (hasActiveBookings) {
    return res.status(400).json({
      error: 'Não é possível excluir este quarto pois ele possui reservas pendentes ou confirmadas.'
    });
  }

  db.rooms.splice(roomIndex, 1);
  writeData(db);

  res.json({ message: 'Quarto removido com sucesso!' });
});

// ---------------- GERÊNCIA: RESERVAS ----------------

app.get('/api/admin/bookings', requireManager, (req, res) => {
  const db = readData();
  res.json(db.bookings);
});

app.post('/api/admin/bookings/:id/status', requireManager, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['confirmada', 'recusada'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido. Use "confirmada" ou "recusada".' });
  }

  const db = readData();
  const booking = db.bookings.find((b) => b.id === id);

  if (!booking) {
    return res.status(404).json({ error: 'Reserva não encontrada.' });
  }

  booking.status = status;
  booking.updatedAt = new Date().toISOString();
  writeData(db);

  res.json({ message: `Reserva ${status} com sucesso!`, booking });
});

// Rota coringa para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(` Hotel Bellagio - Sistema de Reservas Online`);
  console.log(` Servidor rodando com sucesso na porta: ${PORT}`);
  console.log(` Acesse pelo computador: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
