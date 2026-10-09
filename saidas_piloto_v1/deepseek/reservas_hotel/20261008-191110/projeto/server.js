const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');

// ---------- BANCO DE DADOS (arquivo JSON) ----------
function carregarDB() {
  if (!fs.existsSync(DB_FILE)) {
    const inicial = {
      usuarios: [],
      quartos: [],
      reservas: []
    };
    // Cria a conta do gerente
    inicial.usuarios.push({
      id: 1,
      nome: 'Gerente do Hotel',
      email: 'gerente@hotel.com',
      senha: bcrypt.hashSync('admin123', 10),
      tipo: 'gerente'
    });
    // Cria alguns quartos de exemplo
    const exemplos = [
      { numero: '101', tipo: 'Solteiro', capacidade: 1, preco: 150, descricao: 'Quarto simples e confortável, ideal para viajantes sozinhos.' },
      { numero: '102', tipo: 'Casal', capacidade: 2, preco: 250, descricao: 'Quarto com cama de casal, ar-condicionado e TV.' },
      { numero: '201', tipo: 'Casal Superior', capacidade: 2, preco: 350, descricao: 'Quarto amplo com varanda e vista para o jardim.' },
      { numero: '202', tipo: 'Família', capacidade: 4, preco: 450, descricao: 'Quarto grande com duas camas de casal e frigobar.' },
      { numero: '301', tipo: 'Suíte', capacidade: 2, preco: 600, descricao: 'Suíte com banheira, varanda e serviço de quarto.' }
    ];
    let idQ = 1;
    for (const e of exemplos) {
      inicial.quartos.push({ id: idQ++, ...e });
    }
    salvarDB(inicial);
    return inicial;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (err) {
    console.error('Erro ao ler o banco:', err);
    return { usuarios: [], quartos: [], reservas: [] };
  }
}

function salvarDB(db) {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let db = carregarDB();

// ---------- CONFIGURAÇÃO ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: 'hotel-secret-key-2024-muito-segura',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 dias
}));

// Arquivos estáticos (o front-end dentro de /public)
app.use(express.static(path.join(__dirname, 'public')));

// ---------- HELPERS ----------
function usuarioLogado(req) {
  if (!req.session.userId) return null;
  return db.usuarios.find(u => u.id === req.session.userId) || null;
}

function proximoId(array) {
  return array.length ? Math.max(...array.map(i => i.id)) + 1 : 1;
}

function datasSobrepostas(inicioA, fimA, inicioB, fimB) {
  // Retorna true se os períodos se sobrepõem
  return !(fimA <= inicioB || inicioA >= fimB);
}

function quartoDisponivel(quartoId, dataInicio, dataFim, ignorarReservaId = null) {
  // Considera reservas confirmadas ou pendentes (não canceladas/recusadas)
  return !db.reservas.some(r => {
    if (r.quartoId !== quartoId) return false;
    if (r.status === 'cancelada' || r.status === 'recusada') return false;
    if (ignorarReservaId && r.id === ignorarReservaId) return false;
    return datasSobrepostas(r.dataInicio, r.dataFim, dataInicio, dataFim);
  });
}

// ---------- ROTAS DE AUTENTICAÇÃO ----------
app.post('/api/registrar', async (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  }
  if (db.usuarios.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ erro: 'Este email já está cadastrado.' });
  }
  const usuario = {
    id: proximoId(db.usuarios),
    nome,
    email,
    senha: await bcrypt.hash(senha, 10),
    tipo: 'hospede'
  };
  db.usuarios.push(usuario);
  salvarDB(db);
  req.session.userId = usuario.id;
  res.json({ ok: true, usuario: { id: usuario.id, nome, email, tipo: 'hospede' } });
});

app.post('/api/login', async (req, res) => {
  const { email, senha } = req.body;
  const usuario = db.usuarios.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
  if (!usuario) return res.status(400).json({ erro: 'Email ou senha inválidos.' });
  const senhaOk = await bcrypt.compare(senha || '', usuario.senha);
  if (!senhaOk) return res.status(400).json({ erro: 'Email ou senha inválidos.' });
  req.session.userId = usuario.id;
  res.json({ ok: true, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, tipo: usuario.tipo } });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/eu', (req, res) => {
  const u = usuarioLogado(req);
  if (!u) return res.status(401).json({ erro: 'Não autenticado.' });
  res.json({ id: u.id, nome: u.nome, email: u.email, tipo: u.tipo });
});

// ---------- ROTAS PÚBLICAS ----------
app.get('/api/quartos', (req, res) => {
  res.json(db.quartos);
});

app.get('/api/disponiveis', (req, res) => {
  const { dataInicio, dataFim } = req.query;
  if (!dataInicio || !dataFim) {
    return res.json(db.quartos);
  }
  if (dataFim <= dataInicio) {
    return res.status(400).json({ erro: 'A data de saída deve ser depois da data de entrada.' });
  }
  const disponiveis = db.quartos.filter(q => quartoDisponivel(q.id, dataInicio, dataFim));
  res.json(disponiveis);
});

// ---------- ROTAS DE RESERVA (hóspede) ----------
app.post('/api/reservas', (req, res) => {
  const u = usuarioLogado(req);
  if (!u || u.tipo !== 'hospede') return res.status(401).json({ erro: 'Faça login como hóspede.' });

  const { quartoId, dataInicio, dataFim } = req.body;
  if (!quartoId || !dataInicio || !dataFim) {
    return res.status(400).json({ erro: 'Preencha todos os campos da reserva.' });
  }
  if (dataFim <= dataInicio) {
    return res.status(400).json({ erro: 'A data de saída deve ser depois da data de entrada.' });
  }
  const quarto = db.quartos.find(q => q.id === quartoId);
  if (!quarto) return res.status(404).json({ erro: 'Quarto não encontrado.' });

  if (!quartoDisponivel(quartoId, dataInicio, dataFim)) {
    return res.status(400).json({ erro: 'Este quarto não está disponível nestas datas.' });
  }

  const reserva = {
    id: proximoId(db.reservas),
    usuarioId: u.id,
    usuarioNome: u.nome,
    usuarioEmail: u.email,
    quartoId: quarto.id,
    quartoNumero: quarto.numero,
    quartoTipo: quarto.tipo,
    dataInicio,
    dataFim,
    status: 'pendente',
    criadaEm: new Date().toISOString()
  };
  db.reservas.push(reserva);
  salvarDB(db);
  res.json({ ok: true, reserva });
});

app.get('/api/minhas-reservas', (req, res) => {
  const u = usuarioLogado(req);
  if (!u) return res.status(401).json({ erro: 'Faça login.' });
  const reservas = db.reservas
    .filter(r => r.usuarioId === u.id)
    .sort((a, b) => b.id - a.id);
  res.json(reservas);
});

app.post('/api/reservas/:id/cancelar', (req, res) => {
  const u = usuarioLogado(req);
  if (!u) return res.status(401).json({ erro: 'Faça login.' });
  const reserva = db.reservas.find(r => r.id === Number(req.params.id));
  if (!reserva) return res.status(404).json({ erro: 'Reserva não encontrada.' });
  if (reserva.usuarioId !== u.id && u.tipo !== 'gerente') {
    return res.status(403).json({ erro: 'Você não pode cancelar esta reserva.' });
  }
  if (reserva.status === 'cancelada') {
    return res.status(400).json({ erro: 'Esta reserva já foi cancelada.' });
  }
  reserva.status = 'cancelada';
  salvarDB(db);
  res.json({ ok: true, reserva });
});

// ---------- ROTAS DO GERENTE ----------
function exigirGerente(req, res, next) {
  const u = usuarioLogado(req);
  if (!u || u.tipo !== 'gerente') return res.status(403).json({ erro: 'Acesso restrito ao gerente.' });
  req.usuario = u;
  next();
}

app.get('/api/gerente/reservas', exigirGerente, (req, res) => {
  const reservas = [...db.reservas].sort((a, b) => b.id - a.id);
  res.json(reservas);
});

app.post('/api/gerente/reservas/:id/confirmar', exigirGerente, (req, res) => {
  const reserva = db.reservas.find(r => r.id === Number(req.params.id));
  if (!reserva) return res.status(404).json({ erro: 'Reserva não encontrada.' });
  // Verificar se ainda está disponível (caso outra tenha sido confirmada antes)
  if (!quartoDisponivel(reserva.quartoId, reserva.dataInicio, reserva.dataFim, reserva.id)) {
    return res.status(400).json({ erro: 'Já existe outra reserva confirmada nestas datas.' });
  }
  reserva.status = 'confirmada';
  salvarDB(db);
  res.json({ ok: true, reserva });
});

app.post('/api/gerente/reservas/:id/recusar', exigirGerente, (req, res) => {
  const reserva = db.reservas.find(r => r.id === Number(req.params.id));
  if (!reserva) return res.status(404).json({ erro: 'Reserva não encontrada.' });
  reserva.status = 'recusada';
  salvarDB(db);
  res.json({ ok: true, reserva });
});

// CRUD de quartos
app.post('/api/gerente/quartos', exigirGerente, (req, res) => {
  const { numero, tipo, capacidade, preco, descricao } = req.body;
  if (!numero || !tipo || !capacidade || !preco) {
    return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
  }
  if (db.quartos.find(q => q.numero === String(numero))) {
    return res.status(400).json({ erro: 'Já existe um quarto com este número.' });
  }
  const quarto = {
    id: proximoId(db.quartos),
    numero: String(numero),
    tipo,
    capacidade: Number(capacidade),
    preco: Number(preco),
    descricao: descricao || ''
  };
  db.quartos.push(quarto);
  salvarDB(db);
  res.json({ ok: true, quarto });
});

app.put('/api/gerente/quartos/:id', exigirGerente, (req, res) => {
  const quarto = db.quartos.find(q => q.id === Number(req.params.id));
  if (!quarto) return res.status(404).json({ erro: 'Quarto não encontrado.' });
  const { numero, tipo, capacidade, preco, descricao } = req.body;
  if (numero && db.quartos.find(q => q.numero === String(numero) && q.id !== quarto.id)) {
    return res.status(400).json({ erro: 'Já existe outro quarto com este número.' });
  }
  if (numero) quarto.numero = String(numero);
  if (tipo) quarto.tipo = tipo;
  if (capacidade) quarto.capacidade = Number(capacidade);
  if (preco) quarto.preco = Number(preco);
  if (descricao !== undefined) quarto.descricao = descricao;
  salvarDB(db);
  res.json({ ok: true, quarto });
});

app.delete('/api/gerente/quartos/:id', exigirGerente, (req, res) => {
  const id = Number(req.params.id);
  const quarto = db.quartos.find(q => q.id === id);
  if (!quarto) return res.status(404).json({ erro: 'Quarto não encontrado.' });
  const temReservaAtiva = db.reservas.some(r =>
    r.quartoId === id && r.status !== 'cancelada' && r.status !== 'recusada'
  );
  if (temReservaAtiva) {
    return res.status(400).json({ erro: 'Não é possível remover: há reservas ativas neste quarto.' });
  }
  db.quartos = db.quartos.filter(q => q.id !== id);
  salvarDB(db);
  res.json({ ok: true });
});

// ---------- INICIAR ----------
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
