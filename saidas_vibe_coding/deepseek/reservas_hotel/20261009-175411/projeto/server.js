const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const db = new Database(path.join(__dirname, 'hotel.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quartos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE NOT NULL,
  tipo TEXT NOT NULL,
  capacidade INTEGER NOT NULL,
  preco REAL NOT NULL,
  descricao TEXT,
  ativo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS reservas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  quarto_id INTEGER NOT NULL,
  data_entrada TEXT NOT NULL,
  data_saida TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  criado_em TEXT NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (quarto_id) REFERENCES quartos(id)
);
`);

const gerente = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get('gerente');
if (!gerente) {
  db.prepare('INSERT INTO usuarios (usuario, senha, nome, tipo) VALUES (?, ?, ?, ?)')
    .run('gerente', bcrypt.hashSync('gerente123', 10), 'Gerente do Hotel', 'gerente');
}
const hospede = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get('hospede');
if (!hospede) {
  db.prepare('INSERT INTO usuarios (usuario, senha, nome, tipo) VALUES (?, ?, ?, ?)')
    .run('hospede', bcrypt.hashSync('hospede123', 10), 'Hóspede Exemplo', 'hospede');
}
const totalQuartos = db.prepare('SELECT COUNT(*) as c FROM quartos').get().c;
if (totalQuartos === 0) {
  const ins = db.prepare('INSERT INTO quartos (numero, tipo, capacidade, preco, descricao) VALUES (?, ?, ?, ?, ?)');
  ins.run('101', 'Solteiro', 1, 150, 'Quarto simples com cama de solteiro.');
  ins.run('102', 'Casal', 2, 220, 'Quarto com cama de casal e varanda.');
  ins.run('103', 'Casal', 2, 240, 'Quarto com cama de casal e vista para o jardim.');
  ins.run('201', 'Família', 4, 380, 'Quarto amplo com duas camas de casal.');
  ins.run('202', 'Suíte', 2, 450, 'Suíte com banheira e sala de estar.');
}

app.use(express.json());
app.use(session({
  secret: 'chave-secreta-hotel-2024-muito-segura',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 }
}));

function autenticado(req, res, next) {
  if (!req.session.usuario) return res.status(401).json({ erro: 'Não autenticado' });
  next();
}
function apenasGerente(req, res, next) {
  if (!req.session.usuario || req.session.usuario.tipo !== 'gerente')
    return res.status(403).json({ erro: 'Acesso restrito ao gerente' });
  next();
}

app.post('/api/registrar', (req, res) => {
  const { usuario, senha, nome } = req.body;
  if (!usuario || !senha || !nome)
    return res.status(400).json({ erro: 'Preencha todos os campos' });
  if (usuario.length < 3 || senha.length < 6)
    return res.status(400).json({ erro: 'Usuário com pelo menos 3 e senha com pelo menos 6 caracteres' });
  const existe = db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get(usuario);
  if (existe) return res.status(400).json({ erro: 'Usuário já existe' });
  const hash = bcrypt.hashSync(senha, 10);
  const info = db.prepare('INSERT INTO usuarios (usuario, senha, nome, tipo) VALUES (?, ?, ?, ?)')
    .run(usuario, hash, nome, 'hospede');
  req.session.usuario = { id: info.lastInsertRowid, usuario, nome, tipo: 'hospede' };
  res.json({ ok: true, usuario: req.session.usuario });
});

app.post('/api/login', (req, res) => {
  const { usuario, senha } = req.body;
  if (!usuario || !senha) return res.status(400).json({ erro: 'Preencha todos os campos' });
  const u = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get(usuario);
  if (!u || !bcrypt.compareSync(senha, u.senha))
    return res.status(400).json({ erro: 'Usuário ou senha inválidos' });
  req.session.usuario = { id: u.id, usuario: u.usuario, nome: u.nome, tipo: u.tipo };
  res.json({ ok: true, usuario: req.session.usuario });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/sessao', (req, res) => {
  res.json({ usuario: req.session.usuario || null });
});

app.get('/api/quartos', (req, res) => {
  const quartos = db.prepare('SELECT * FROM quartos ORDER BY numero').all();
  res.json(quartos);
});

app.get('/api/quartos/disponiveis', (req, res) => {
  const { entrada, saida } = req.query;
  if (!entrada || !saida) return res.status(400).json({ erro: 'Informe as datas' });
  if (entrada >= saida) return res.status(400).json({ erro: 'Data de saída deve ser depois da entrada' });
  const quartos = db.prepare(`
    SELECT * FROM quartos
    WHERE ativo = 1
    AND id NOT IN (
      SELECT quarto_id FROM reservas
      WHERE status IN ('pendente', 'confirmada')
      AND NOT (data_saida <= ? OR data_entrada >= ?)
    )
    ORDER BY numero
  `).all(entrada, saida);
  res.json(quartos);
});

app.post('/api/quartos', autenticado, apenasGerente, (req, res) => {
  const { numero, tipo, capacidade, preco, descricao } = req.body;
  if (!numero || !tipo || !capacidade || !preco)
    return res.status(400).json({ erro: 'Preencha os campos obrigatórios' });
  try {
    const info = db.prepare('INSERT INTO quartos (numero, tipo, capacidade, preco, descricao) VALUES (?, ?, ?, ?, ?)')
      .run(numero, tipo, capacidade, preco, descricao || '');
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ erro: 'Número de quarto já existe' });
  }
});

app.put('/api/quartos/:id', autenticado, apenasGerente, (req, res) => {
  const { numero, tipo, capacidade, preco, descricao, ativo } = req.body;
  try {
    db.prepare('UPDATE quartos SET numero=?, tipo=?, capacidade=?, preco=?, descricao=?, ativo=? WHERE id=?')
      .run(numero, tipo, capacidade, preco, descricao || '', ativo ? 1 : 0, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: 'Erro ao salvar quarto' });
  }
});

app.delete('/api/quartos/:id', autenticado, apenasGerente, (req, res) => {
  const reservas = db.prepare("SELECT COUNT(*) as c FROM reservas WHERE quarto_id = ? AND status IN ('pendente','confirmada')").get(req.params.id).c;
  if (reservas > 0) return res.status(400).json({ erro: 'Há reservas ativas para este quarto. Desative-o em vez de remover.' });
  db.prepare('DELETE FROM quartos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/reservas/minhas', autenticado, (req, res) => {
  const reservas = db.prepare(`
    SELECT r.*, q.numero as quarto_numero, q.tipo as quarto_tipo, q.preco as quarto_preco
    FROM reservas r JOIN quartos q ON q.id = r.quarto_id
    WHERE r.usuario_id = ? ORDER BY r.criado_em DESC
  `).all(req.session.usuario.id);
  res.json(reservas);
});

app.get('/api/reservas', autenticado, apenasGerente, (req, res) => {
  const reservas = db.prepare(`
    SELECT r.*, q.numero as quarto_numero, q.tipo as quarto_tipo, q.preco as quarto_preco,
           u.nome as hospede_nome, u.usuario as hospede_usuario
    FROM reservas r
    JOIN quartos q ON q.id = r.quarto_id
    JOIN usuarios u ON u.id = r.usuario_id
    ORDER BY r.criado_em DESC
  `).all();
  res.json(reservas);
});

app.post('/api/reservas', autenticado, (req, res) => {
  const { quarto_id, data_entrada, data_saida } = req.body;
  if (!quarto_id || !data_entrada || !data_saida)
    return res.status(400).json({ erro: 'Preencha todos os campos' });
  if (data_entrada >= data_saida)
    return res.status(400).json({ erro: 'Data de saída deve ser depois da entrada' });
  const conflito = db.prepare(`
    SELECT COUNT(*) as c FROM reservas
    WHERE quarto_id = ? AND status IN ('pendente','confirmada')
    AND NOT (data_saida <= ? OR data_entrada >= ?)
  `).get(quarto_id, data_entrada, data_saida).c;
  if (conflito > 0) return res.status(400).json({ erro: 'Quarto indisponível nesse período' });
  const info = db.prepare('INSERT INTO reservas (usuario_id, quarto_id, data_entrada, data_saida, status, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.session.usuario.id, quarto_id, data_entrada, data_saida, 'pendente', new Date().toISOString());
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.post('/api/reservas/:id/status', autenticado, apenasGerente, (req, res) => {
  const { status } = req.body;
  if (!['confirmada', 'recusada', 'cancelada', 'pendente'].includes(status))
    return res.status(400).json({ erro: 'Status inválido' });
  db.prepare('UPDATE reservas SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

app.post('/api/reservas/:id/cancelar', autenticado, (req, res) => {
  const r = db.prepare('SELECT * FROM reservas WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ erro: 'Reserva não encontrada' });
  if (r.usuario_id !== req.session.usuario.id && req.session.usuario.tipo !== 'gerente')
    return res.status(403).json({ erro: 'Sem permissão' });
  db.prepare("UPDATE reservas SET status = 'cancelada' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
