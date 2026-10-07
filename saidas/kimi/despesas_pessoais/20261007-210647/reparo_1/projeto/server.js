const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const db = new Database('despesas.db');
const SECRET = 'chave-secreta-controle-despesas-2024';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== CRIAR TABELAS =====
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo TEXT DEFAULT 'usuario',
    ativo INTEGER DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT UNIQUE NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS despesas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    categoria_id INTEGER NOT NULL,
    descricao TEXT NOT NULL,
    valor REAL NOT NULL,
    data TEXT NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
  )
`);

// ===== CRIAR ADMIN PADRÃO =====
const adminExists = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('admin@admin.com');
if (!adminExists) {
  const senhaHash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)').run('Administrador', 'admin@admin.com', senhaHash, 'admin');
}

// ===== CATEGORIAS PADRÃO =====
const categoriasPadrao = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação', 'Lazer', 'Outros'];
const insertCat = db.prepare('INSERT OR IGNORE INTO categorias (nome) VALUES (?)');
categoriasPadrao.forEach(c => insertCat.run(c));

// ===== MIDDLEWARE DE AUTENTICAÇÃO =====
function autenticar(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Não autorizado' });

  try {
    const decoded = jwt.verify(token, SECRET);
    const usuario = db.prepare('SELECT id, nome, email, tipo, ativo FROM usuarios WHERE id = ?').get(decoded.id);
    if (!usuario || !usuario.ativo) return res.status(401).json({ erro: 'Conta desativada ou não encontrada' });
    req.usuario = usuario;
    next();
  } catch (e) {
    return res.status(401).json({ erro: 'Token inválido' });
  }
}

function apenasAdmin(req, res, next) {
  if (req.usuario.tipo !== 'admin') return res.status(403).json({ erro: 'Acesso negado' });
  next();
}

// ===== ROTAS DE AUTENTICAÇÃO =====
app.post('/api/cadastro', (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Preencha todos os campos' });
  if (senha.length < 4) return res.status(400).json({ erro: 'Senha deve ter no mínimo 4 caracteres' });

  const existe = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  if (existe) return res.status(400).json({ erro: 'Email já cadastrado' });

  const senhaHash = bcrypt.hashSync(senha, 10);
  const result = db.prepare('INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)').run(nome, email, senhaHash);
  const token = jwt.sign({ id: result.lastInsertRowid }, SECRET);
  res.json({ token, usuario: { id: result.lastInsertRowid, nome, email, tipo: 'usuario' } });
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Preencha todos os campos' });

  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  if (!usuario) return res.status(400).json({ erro: 'Email não encontrado' });
  if (!usuario.ativo) return res.status(400).json({ erro: 'Conta desativada. Fale com o administrador.' });
  if (!bcrypt.compareSync(senha, usuario.senha)) return res.status(400).json({ erro: 'Senha incorreta' });

  const token = jwt.sign({ id: usuario.id }, SECRET);
  res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, tipo: usuario.tipo } });
});

// ===== ROTAS DE CATEGORIAS =====
app.get('/api/categorias', autenticar, (req, res) => {
  const categorias = db.prepare('SELECT * FROM categorias ORDER BY nome').all();
  res.json(categorias);
});

app.post('/api/categorias', autenticar, apenasAdmin, (req, res) => {
  const { nome } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Informe o nome da categoria' });

  const existe = db.prepare('SELECT id FROM categorias WHERE nome = ?').get(nome);
  if (existe) return res.status(400).json({ erro: 'Categoria já existe' });

  const result = db.prepare('INSERT INTO categorias (nome) VALUES (?)').run(nome);
  res.json({ id: result.lastInsertRowid, nome });
});

app.delete('/api/categorias/:id', autenticar, apenasAdmin, (req, res) => {
  const despesas = db.prepare('SELECT COUNT(*) as total FROM despesas WHERE categoria_id = ?').get(req.params.id);
  if (despesas.total > 0) return res.status(400).json({ erro: 'Categoria possui despesas vinculadas e não pode ser excluída' });

  db.prepare('DELETE FROM categorias WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ===== ROTAS DE DESPESAS =====
app.get('/api/despesas', autenticar, (req, res) => {
  const { mes, ano } = req.query;
  let query = `
    SELECT d.*, c.nome as categoria_nome
    FROM despesas d
    JOIN categorias c ON d.categoria_id = c.id
    WHERE d.usuario_id = ?
  `;
  const params = [req.usuario.id];

  if (mes && ano) {
    query += ` AND strftime('%m', d.data) = ? AND strftime('%Y', d.data) = ?`;
    params.push(mes.padStart(2, '0'), ano);
  }

  query += ' ORDER BY d.data DESC';
  const despesas = db.prepare(query).all(...params);
  res.json(despesas);
});

app.post('/api/despesas', autenticar, (req, res) => {
  const { descricao, valor, categoria_id, data } = req.body;
  if (!descricao || !valor || !categoria_id || !data) return res.status(400).json({ erro: 'Preencha todos os campos' });
  if (valor <= 0) return res.status(400).json({ erro: 'Valor deve ser maior que zero' });

  const result = db.prepare('INSERT INTO despesas (usuario_id, categoria_id, descricao, valor, data) VALUES (?, ?, ?, ?, ?)').run(req.usuario.id, categoria_id, descricao, valor, data);
  res.json({ id: result.lastInsertRowid });
});

app.delete('/api/despesas/:id', autenticar, (req, res) => {
  const despesa = db.prepare('SELECT * FROM despesas WHERE id = ? AND usuario_id = ?').get(req.params.id, req.usuario.id);
  if (!despesa) return res.status(404).json({ erro: 'Despesa não encontrada' });

  db.prepare('DELETE FROM despesas WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ===== RESUMO MENSAL =====
app.get('/api/resumo', autenticar, (req, res) => {
  const { mes, ano } = req.query;
  const m = mes || new Date().getMonth() + 1;
  const a = ano || new Date().getFullYear();

  const total = db.prepare(`
    SELECT COALESCE(SUM(valor), 0) as total
    FROM despesas
    WHERE usuario_id = ? AND strftime('%m', data) = ? AND strftime('%Y', data) = ?
  `).get(req.usuario.id, String(m).padStart(2, '0'), String(a));

  const porCategoria = db.prepare(`
    SELECT c.nome, COALESCE(SUM(d.valor), 0) as total
    FROM despesas d
    JOIN categorias c ON d.categoria_id = c.id
    WHERE d.usuario_id = ? AND strftime('%m', d.data) = ? AND strftime('%Y', d.data) = ?
    GROUP BY c.nome
    ORDER BY total DESC
  `).all(req.usuario.id, String(m).padStart(2, '0'), String(a));

  res.json({ total: total.total, porCategoria });
});

// ===== ROTAS DE ADMINISTRAÇÃO =====
app.get('/api/admin/usuarios', autenticar, apenasAdmin, (req, res) => {
  const usuarios = db.prepare(`
    SELECT u.id, u.nome, u.email, u.tipo, u.ativo, u.criado_em,
      COALESCE(SUM(d.valor), 0) as total_gasto
    FROM usuarios u
    LEFT JOIN despesas d ON d.usuario_id = u.id
    GROUP BY u.id
    ORDER BY u.nome
  `).all();
  res.json(usuarios);
});

app.put('/api/admin/usuarios/:id/toggle', autenticar, apenasAdmin, (req, res) => {
  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
  if (usuario.tipo === 'admin') return res.status(400).json({ erro: 'Não é possível desativar um administrador' });

  const novoStatus = usuario.ativo ? 0 : 1;
  db.prepare('UPDATE usuarios SET ativo = ? WHERE id = ?').run(novoStatus, req.params.id);
  res.json({ ativo: novoStatus });
});

app.get('/api/admin/relatorio', autenticar, apenasAdmin, (req, res) => {
  const { mes, ano } = req.query;
  const m = mes || new Date().getMonth() + 1;
  const a = ano || new Date().getFullYear();

  const totalGeral = db.prepare(`
    SELECT COALESCE(SUM(valor), 0) as total
    FROM despesas
    WHERE strftime('%m', data) = ? AND strftime('%Y', data) = ?
  `).get(String(m).padStart(2, '0'), String(a));

  const porUsuario = db.prepare(`
    SELECT u.nome, u.email, COALESCE(SUM(d.valor), 0) as total, COUNT(d.id) as qtd_despesas
    FROM usuarios u
    LEFT JOIN despesas d ON d.usuario_id = u.id AND strftime('%m', d.data) = ? AND strftime('%Y', d.data) = ?
    WHERE u.tipo != 'admin'
    GROUP BY u.id
    ORDER BY total DESC
  `).all(String(m).padStart(2, '0'), String(a));

  const porCategoria = db.prepare(`
    SELECT c.nome, COALESCE(SUM(d.valor), 0) as total
    FROM despesas d
    JOIN categorias c ON d.categoria_id = c.id
    WHERE strftime('%m', d.data) = ? AND strftime('%Y', d.data) = ?
    GROUP BY c.nome
    ORDER BY total DESC
  `).all(String(m).padStart(2, '0'), String(a));

  res.json({ totalGeral: totalGeral.total, porUsuario, porCategoria });
});

// ===== INICIAR SERVIDOR =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
