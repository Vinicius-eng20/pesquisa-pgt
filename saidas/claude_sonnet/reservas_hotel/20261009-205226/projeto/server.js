const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Configuração de middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'hotel-secreto-chave-segura-12345',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

// Criar pasta data se não existir
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Arquivos de dados
const usersFile = path.join(dataDir, 'users.json');
const roomsFile = path.join(dataDir, 'rooms.json');
const reservationsFile = path.join(dataDir, 'reservations.json');

// Inicializar arquivos se não existirem
function initializeFile(filePath, defaultData) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
}

// Criar usuário gerente padrão
const gerenteHash = bcrypt.hashSync('gerente123', 10);
initializeFile(usersFile, [{
  id: 1,
  nome: 'Gerente',
  email: 'gerente@hotel.com',
  senha: gerenteHash,
  tipo: 'gerente'
}]);
initializeFile(roomsFile, []);
initializeFile(reservationsFile, []);

// Funções para ler e escrever dados
function readData(filePath) {
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

function writeData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Não autorizado' });
  }
}

function requireManager(req, res, next) {
  if (req.session.userId && req.session.userType === 'gerente') {
    next();
  } else {
    res.status(403).json({ error: 'Acesso negado' });
  }
}

// Rotas de autenticação
app.post('/api/register', (req, res) => {
  const { nome, email, senha } = req.body;
  
  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }
  
  const users = readData(usersFile);
  
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Email já cadastrado' });
  }
  
  const newUser = {
    id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
    nome,
    email,
    senha: bcrypt.hashSync(senha, 10),
    tipo: 'hospede'
  };
  
  users.push(newUser);
  writeData(usersFile, users);
  
  req.session.userId = newUser.id;
  req.session.userType = newUser.tipo;
  req.session.userName = newUser.nome;
  
  res.json({ 
    success: true, 
    user: { 
      id: newUser.id, 
      nome: newUser.nome, 
      email: newUser.email, 
      tipo: newUser.tipo 
    } 
  });
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  
  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }
  
  const users = readData(usersFile);
  const user = users.find(u => u.email === email);
  
  if (!user || !bcrypt.compareSync(senha, user.senha)) {
    return res.status(401).json({ error: 'Email ou senha incorretos' });
  }
  
  req.session.userId = user.id;
  req.session.userType = user.tipo;
  req.session.userName = user.nome;
  
  res.json({ 
    success: true, 
    user: { 
      id: user.id, 
      nome: user.nome, 
      email: user.email, 
      tipo: user.tipo 
    } 
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  const users = readData(usersFile);
  const user = users.find(u => u.id === req.session.userId);
  
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }
  
  res.json({ 
    id: user.id, 
    nome: user.nome, 
    email: user.email, 
    tipo: user.tipo 
  });
});

// Rotas de quartos
app.get('/api/rooms', requireAuth, (req, res) => {
  const { dataInicio, dataFim } = req.query;
  let rooms = readData(roomsFile);
  
  if (dataInicio && dataFim) {
    const reservations = readData(reservationsFile);
    const activeReservations = reservations.filter(r => 
      r.status !== 'cancelada' && r.status !== 'recusada'
    );
    
    rooms = rooms.map(room => {
      const hasConflict = activeReservations.some(r => {
        if (r.quartoId !== room.id) return false;
        
        const rStart = new Date(r.dataInicio);
        const rEnd = new Date(r.dataFim);
        const qStart = new Date(dataInicio);
        const qEnd = new Date(dataFim);
        
        return (qStart <= rEnd && qEnd >= rStart);
      });
      
      return { ...room, disponivel: !hasConflict };
    });
  }
  
  res.json(rooms);
});

app.post('/api/rooms', requireManager, (req, res) => {
  const { numero, tipo, capacidade, precoPorNoite, descricao, comodidades } = req.body;
  
  if (!numero || !tipo || !capacidade || !precoPorNoite) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }
  
  const rooms = readData(roomsFile);
  
  if (rooms.find(r => r.numero === numero)) {
    return res.status(400).json({ error: 'Número de quarto já existe' });
  }
  
  const newRoom = {
    id: rooms.length > 0 ? Math.max(...rooms.map(r => r.id)) + 1 : 1,
    numero,
    tipo,
    capacidade: parseInt(capacidade),
    precoPorNoite: parseFloat(precoPorNoite),
    descricao: descricao || '',
    comodidades: comodidades || []
  };
  
  rooms.push(newRoom);
  writeData(roomsFile, rooms);
  
  res.json(newRoom);
});

app.put('/api/rooms/:id', requireManager, (req, res) => {
  const roomId = parseInt(req.params.id);
  const { numero, tipo, capacidade, precoPorNoite, descricao, comodidades } = req.body;
  
  const rooms = readData(roomsFile);
  const index = rooms.findIndex(r => r.id === roomId);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Quarto não encontrado' });
  }
  
  const otherRoom = rooms.find(r => r.numero === numero && r.id !== roomId);
  if (otherRoom) {
    return res.status(400).json({ error: 'Número de quarto já existe' });
  }
  
  rooms[index] = {
    ...rooms[index],
    numero,
    tipo,
    capacidade: parseInt(capacidade),
    precoPorNoite: parseFloat(precoPorNoite),
    descricao: descricao || '',
    comodidades: comodidades || []
  };
  
  writeData(roomsFile, rooms);
  res.json(rooms[index]);
});

app.delete('/api/rooms/:id', requireManager, (req, res) => {
  const roomId = parseInt(req.params.id);
  
  const rooms = readData(roomsFile);
  const reservations = readData(reservationsFile);
  
  const hasActiveReservations = reservations.some(r => 
    r.quartoId === roomId && (r.status === 'pendente' || r.status === 'confirmada')
  );
  
  if (hasActiveReservations) {
    return res.status(400).json({ error: 'Não é possível remover quarto com reservas ativas' });
  }
  
  const filteredRooms = rooms.filter(r => r.id !== roomId);
  writeData(roomsFile, filteredRooms);
  
  res.json({ success: true });
});

// Rotas de reservas
app.get('/api/reservations', requireAuth, (req, res) => {
  let reservations = readData(reservationsFile);
  const rooms = readData(roomsFile);
  const users = readData(usersFile);
  
  if (req.session.userType !== 'gerente') {
    reservations = reservations.filter(r => r.hospedeId === req.session.userId);
  }
  
  reservations = reservations.map(r => {
    const room = rooms.find(room => room.id === r.quartoId);
    const user = users.find(u => u.id === r.hospedeId);
    return {
      ...r,
      quarto: room,
      hospede: user ? { id: user.id, nome: user.nome, email: user.email } : null
    };
  });
  
  res.json(reservations);
});

app.post('/api/reservations', requireAuth, (req, res) => {
  const { quartoId, dataInicio, dataFim } = req.body;
  
  if (!quartoId || !dataInicio || !dataFim) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }
  
  const start = new Date(dataInicio);
  const end = new Date(dataFim);
  
  if (start >= end) {
    return res.status(400).json({ error: 'Data de fim deve ser posterior à data de início' });
  }
  
  if (start < new Date().setHours(0, 0, 0, 0)) {
    return res.status(400).json({ error: 'Não é possível reservar datas passadas' });
  }
  
  const rooms = readData(roomsFile);
  const room = rooms.find(r => r.id === quartoId);
  
  if (!room) {
    return res.status(404).json({ error: 'Quarto não encontrado' });
  }
  
  const reservations = readData(reservationsFile);
  
  const hasConflict = reservations.some(r => {
    if (r.quartoId !== quartoId) return false;
    if (r.status === 'cancelada' || r.status === 'recusada') return false;
    
    const rStart = new Date(r.dataInicio);
    const rEnd = new Date(r.dataFim);
    
    return (start <= rEnd && end >= rStart);
  });
  
  if (hasConflict) {
    return res.status(400).json({ error: 'Quarto não disponível para estas datas' });
  }
  
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  const valorTotal = days * room.precoPorNoite;
  
  const newReservation = {
    id: reservations.length > 0 ? Math.max(...reservations.map(r => r.id)) + 1 : 1,
    hospedeId: req.session.userId,
    quartoId,
    dataInicio,
    dataFim,
    valorTotal,
    status: 'pendente',
    dataCriacao: new Date().toISOString()
  };
  
  reservations.push(newReservation);
  writeData(reservationsFile, reservations);
  
  res.json(newReservation);
});

app.put('/api/reservations/:id/status', requireAuth, (req, res) => {
  const reservationId = parseInt(req.params.id);
  const { status } = req.body;
  
  const validStatuses = ['pendente', 'confirmada', 'recusada', 'cancelada'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }
  
  const reservations = readData(reservationsFile);
  const index = reservations.findIndex(r => r.id === reservationId);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Reserva não encontrada' });
  }
  
  const reservation = reservations[index];
  
  // Hóspede só pode cancelar suas próprias reservas
  if (req.session.userType !== 'gerente') {
    if (reservation.hospedeId !== req.session.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    if (status !== 'cancelada') {
      return res.status(403).json({ error: 'Você só pode cancelar reservas' });
    }
  }
  
  reservations[index].status = status;
  writeData(reservationsFile, reservations);
  
  res.json(reservations[index]);
});

app.delete('/api/reservations/:id', requireAuth, (req, res) => {
  const reservationId = parseInt(req.params.id);
  
  const reservations = readData(reservationsFile);
  const reservation = reservations.find(r => r.id === reservationId);
  
  if (!reservation) {
    return res.status(404).json({ error: 'Reserva não encontrada' });
  }
  
  if (req.session.userType !== 'gerente' && reservation.hospedeId !== req.session.userId) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  const filteredReservations = reservations.filter(r => r.id !== reservationId);
  writeData(reservationsFile, filteredReservations);
  
  res.json({ success: true });
});

// Servir páginas HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/cadastro', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cadastro.html'));
});

app.get('/hospede', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'hospede.html'));
});

app.get('/gerente', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'gerente.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`\nConta de gerente padrão:`);
  console.log(`Email: gerente@hotel.com`);
  console.log(`Senha: gerente123`);
});
