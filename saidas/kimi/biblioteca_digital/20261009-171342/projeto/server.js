const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database(path.join(__dirname, 'biblioteca.db'));
const PRAZO_DIAS = 14;

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'leitor',
  bloqueado INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  autor TEXT NOT NULL DEFAULT '',
  categoria TEXT NOT NULL DEFAULT '',
  ano INTEGER,
  descricao TEXT NOT NULL DEFAULT '',
  quantidade INTEGER NOT NULL DEFAULT 1,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS emprestimos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  data_emprestimo TEXT NOT NULL DEFAULT (datetime('now')),
  data_prevista TEXT NOT NULL,
  data_devolucao TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (item_id) REFERENCES itens(id)
);
`);

const adminExiste = db.prepare('SELECT id FROM usuarios WHERE papel = ?').get('bibliotecario');
if (!adminExiste) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO usuarios (nome, email, senha, papel) VALUES (?, ?, ?, ?)')
    .run('Bibliotecário', 'admin@biblioteca.com', hash, 'bibliotecario');
  console.log('Conta do bibliotecário criada: admin@biblioteca.com / admin123');
}

const totalItens = db.prepare('SELECT COUNT(*) AS c FROM itens').get().c;
if (totalItens === 0) {
  const ins = db.prepare('INSERT INTO itens (titulo, autor, categoria, ano, descricao, quantidade) VALUES (?, ?, ?, ?, ?, ?)');
  ins.run('Dom Casmurro', 'Machado de Assis', 'Romance', 1899, 'Clássico da literatura brasileira.', 3);
  ins.run('O Pequeno Príncipe', 'Antoine de Saint-Exupéry', 'Infantil', 1943, 'Fábula poética sobre amizade e vida.', 2);
  ins.run('1984', 'George Orwell', 'Ficção', 1949, 'Distopia sobre vigilância e totalitarismo.', 2);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'biblioteca-digital-segredo-mude-isso-em-producao',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use(express.static(path.join(__dirname, 'public')));

function limparAtrasados() {
  db.prepare(`UPDATE emprestimos SET status = 'atrasado'
    WHERE status = 'ativo' AND date(data_prevista) < date('now')`).run();
}

function reqLogin(req, res, next) {
  if (!req.session.usuario) return res.status(401).json({ erro: 'Faça login para continuar.' });
  next();
}

function reqBibliotecario(req, res, next) {
  if (!req.session.usuario) return res.status(401).json({ erro: 'Faça login para continuar.' });
  if (req.session.usuario.papel !== 'bibliotecario') return res.status(403).json({ erro: 'Acesso restrito ao bibliotecário.' });
  next();
}

function leitorTemAtraso(usuarioId) {
  limparAtrasados();
  const r = db.prepare(`SELECT COUNT(*) AS c FROM emprestimos WHERE usuario_id = ? AND status = 'atrasado'`).get(usuarioId);
  return r.c > 0;
}

// ============ AUTENTICAÇÃO ============

app.post('/api/cadastro', (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Preencha nome, e-mail e senha.' });
  if (senha.length < 4) return res.status(400).json({ erro: 'A senha precisa ter pelo menos 4 caracteres.' });
  const existe = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email.trim().toLowerCase());
  if (existe) return res.status(400).json({ erro: 'Este e-mail já está cadastrado.' });
  const hash = bcrypt.hashSync(senha, 10);
  const info = db.prepare('INSERT INTO usuarios (nome, email, senha, papel) VALUES (?, ?, ?, ?)')
    .run(nome.trim(), email.trim().toLowerCase(), hash, 'leitor');
  req.session.usuario = { id: info.lastInsertRowid, nome: nome.trim(), email: email.trim().toLowerCase(), papel: 'leitor' };
  res.json({ ok: true, usuario: req.session.usuario });
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Informe e-mail e senha.' });
  const u = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email.trim().toLowerCase());
  if (!u || !bcrypt.compareSync(senha, u.senha)) return res.status(400).json({ erro: 'E-mail ou senha incorretos.' });
  req.session.usuario = { id: u.id, nome: u.nome, email: u.email, papel: u.papel };
  res.json({ ok: true, usuario: req.session.usuario });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  res.json({ usuario: req.session.usuario || null });
});

// ============ ACERVO (PÚBLICO / LEITOR) ============

app.get('/api/itens', (req, res) => {
  limparAtrasados();
  const busca = (req.query.busca || '').trim();
  let itens;
  if (busca) {
    const like = `%${busca}%`;
    itens = db.prepare(`SELECT * FROM itens WHERE ativo = 1 AND (titulo LIKE ? OR autor LIKE ? OR categoria LIKE ?) ORDER BY titulo`).all(like, like, like);
  } else {
    itens = db.prepare('SELECT * FROM itens WHERE ativo = 1 ORDER BY titulo').all();
  }
  const disp = db.prepare(`SELECT item_id, COUNT(*) AS c FROM emprestimos WHERE status IN ('ativo','atrasado') GROUP BY item_id`).all();
  const mapa = {};
  disp.forEach(d => mapa[d.item_id] = d.c);
  itens = itens.map(i => ({
    ...i,
    emprestados: mapa[i.id] || 0,
    disponiveis: Math.max(0, i.quantidade - (mapa[i.id] || 0))
  }));
  res.json({ itens });
});

app.get('/api/itens/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM itens WHERE id = ? AND ativo = 1').get(req.params.id);
  if (!item) return res.status(404).json({ erro: 'Item não encontrado.' });
  const emp = db.prepare(`SELECT COUNT(*) AS c FROM emprestimos WHERE item_id = ? AND status IN ('ativo','atrasado')`).get(item.id).c;
  res.json({ item: { ...item, emprestados: emp, disponiveis: Math.max(0, item.quantidade - emp) } });
});

// ============ EMPRÉSTIMOS (LEITOR) ============

app.post('/api/emprestar/:itemId', reqLogin, (req, res) => {
  limparAtrasados();
  const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.session.usuario.id);
  if (u.bloqueado) return res.status(403).json({ erro: 'Sua conta está bloqueada para novos empréstimos. Procure o bibliotecário.' });
  if (leitorTemAtraso(u.id)) return res.status(403).json({ erro: 'Você possui itens em atraso. Devolva-os antes de pegar novos itens.' });

  const item = db.prepare('SELECT * FROM itens WHERE id = ? AND ativo = 1').get(req.params.itemId);
  if (!item) return res.status(404).json({ erro: 'Item não encontrado.' });

  const jaTem = db.prepare(`SELECT id FROM emprestimos WHERE usuario_id = ? AND item_id = ? AND status IN ('ativo','atrasado')`).get(u.id, item.id);
  if (jaTem) return res.status(400).json({ erro: 'Você já está com este item emprestado.' });

  const emp = db.prepare(`SELECT COUNT(*) AS c FROM emprestimos WHERE item_id = ? AND status IN ('ativo','atrasado')`).get(item.id).c;
  if (emp >= item.quantidade) return res.status(400).json({ erro: 'Não há exemplares disponíveis no momento.' });

  const ativos = db.prepare(`SELECT COUNT(*) AS c FROM emprestimos WHERE usuario_id = ? AND status IN ('ativo','atrasado')`).get(u.id).c;
  if (ativos >= 5) return res.status(400).json({ erro: 'Limite de 5 empréstimos simultâneos atingido.' });

  const prevista = new Date();
  prevista.setDate(prevista.getDate() + PRAZO_DIAS);
  db.prepare('INSERT INTO emprestimos (usuario_id, item_id, data_prevista) VALUES (?, ?, ?)')
    .run(u.id, item.id, prevista.toISOString().slice(0, 19).replace('T', ' '));
  res.json({ ok: true, mensagem: `Empréstimo realizado! Devolução até ${prevista.toLocaleDateString('pt-BR')}.` });
});

app.post('/api/devolver/:emprestimoId', reqLogin, (req, res) => {
  const emp = db.prepare('SELECT * FROM emprestimos WHERE id = ?').get(req.params.emprestimoId);
  if (!emp) return res.status(404).json({ erro: 'Empréstimo não encontrado.' });
  if (req.session.usuario.papel !== 'bibliotecario' && emp.usuario_id !== req.session.usuario.id) {
    return res.status(403).json({ erro: 'Você só pode devolver seus próprios itens.' });
  }
  if (emp.status === 'devolvido') return res.status(400).json({ erro: 'Este item já foi devolvido.' });
  db.prepare(`UPDATE emprestimos SET status = 'devolvido', data_devolucao = datetime('now') WHERE id = ?`).run(emp.id);
  res.json({ ok: true, mensagem: 'Devolução registrada com sucesso!' });
});

app.get('/api/meus-emprestimos', reqLogin, (req, res) => {
  limparAtrasados();
  const lista = db.prepare(`
    SELECT e.*, i.titulo, i.autor, i.categoria
    FROM emprestimos e JOIN itens i ON i.id = e.item_id
    WHERE e.usuario_id = ?
    ORDER BY e.status != 'devolvido' DESC, e.data_emprestimo DESC
  `).all(req.session.usuario.id);
  res.json({ emprestimos: lista });
});

// ============ BIBLIOTECÁRIO: ITENS ============

app.get('/api/admin/itens', reqBibliotecario, (req, res) => {
  const itens = db.prepare('SELECT * FROM itens ORDER BY titulo').all();
  const disp = db.prepare(`SELECT item_id, COUNT(*) AS c FROM emprestimos WHERE status IN ('ativo','atrasado') GROUP BY item_id`).all();
  const mapa = {};
  disp.forEach(d => mapa[d.item_id] = d.c);
  res.json({ itens: itens.map(i => ({ ...i, emprestados: mapa[i.id] || 0 })) });
});

app.post('/api/admin/itens', reqBibliotecario, (req, res) => {
  const { titulo, autor, categoria, ano, descricao, quantidade } = req.body;
  if (!titulo) return res.status(400).json({ erro: 'O título é obrigatório.' });
  const qtd = parseInt(quantidade) || 1;
  if (qtd < 1) return res.status(400).json({ erro: 'A quantidade deve ser pelo menos 1.' });
  const info = db.prepare('INSERT INTO itens (titulo, autor, categoria, ano, descricao, quantidade) VALUES (?, ?, ?, ?, ?, ?)')
    .run(titulo.trim(), (autor || '').trim(), (categoria || '').trim(), parseInt(ano) || null, (descricao || '').trim(), qtd);
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.put('/api/admin/itens/:id', reqBibliotecario, (req, res) => {
  const item = db.prepare('SELECT * FROM itens WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ erro: 'Item não encontrado.' });
  const { titulo, autor, categoria, ano, descricao, quantidade } = req.body;
  if (!titulo) return res.status(400).json({ erro: 'O título é obrigatório.' });
  const qtd = parseInt(quantidade);
  if (!qtd || qtd < 1) return res.status(400).json({ erro: 'A quantidade deve ser pelo menos 1.' });
  const emp = db.prepare(`SELECT COUNT(*) AS c FROM emprestimos WHERE item_id = ? AND status IN ('ativo','atrasado')`).get(item.id).c;
  if (qtd < emp) return res.status(400).json({ erro: `Há ${emp} exemplar(es) emprestado(s). A quantidade não pode ser menor que isso.` });
  db.prepare('UPDATE itens SET titulo=?, autor=?, categoria=?, ano=?, descricao=?, quantidade=? WHERE id=?')
    .run(titulo.trim(), (autor || '').trim(), (categoria || '').trim(), parseInt(ano) || null, (descricao || '').trim(), qtd, item.id);
  res.json({ ok: true });
});

app.delete('/api/admin/itens/:id', reqBibliotecario, (req, res) => {
  const item = db.prepare('SELECT * FROM itens WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ erro: 'Item não encontrado.' });
  const emp = db.prepare(`SELECT COUNT(*) AS c FROM emprestimos WHERE item_id = ? AND status IN ('ativo','atrasado')`).get(item.id).c;
  if (emp > 0) return res.status(400).json({ erro: 'Não é possível remover: há exemplares emprestados. Aguarde as devoluções.' });
  db.prepare('UPDATE itens SET ativo = 0 WHERE id = ?').run(item.id);
  res.json({ ok: true });
});

// ============ BIBLIOTECÁRIO: EMPRÉSTIMOS E LEITORES ============

app.get('/api/admin/emprestimos', reqBibliotecario, (req, res) => {
  limparAtrasados();
  const filtro = req.query.filtro || 'todos';
  let sql = `
    SELECT e.*, i.titulo, i.autor, u.nome AS leitor_nome, u.email AS leitor_email
    FROM emprestimos e
    JOIN itens i ON i.id = e.item_id
    JOIN usuarios u ON u.id = e.usuario_id
  `;
  if (filtro === 'ativos') sql += ` WHERE e.status = 'ativo'`;
  else if (filtro === 'atrasados') sql += ` WHERE e.status = 'atrasado'`;
  else if (filtro === 'devolvidos') sql += ` WHERE e.status = 'devolvido'`;
  sql += ` ORDER BY e.data_emprestimo DESC`;
  res.json({ emprestimos: db.prepare(sql).all() });
});

app.get('/api/admin/leitores', reqBibliotecario, (req, res) => {
  limparAtrasados();
  const leitores = db.prepare(`SELECT id, nome, email, bloqueado, criado_em FROM usuarios WHERE papel = 'leitor' ORDER BY nome`).all();
  const atrasos = db.prepare(`SELECT usuario_id, COUNT(*) AS c FROM emprestimos WHERE status = 'atrasado' GROUP BY usuario_id`).all();
  const emps = db.prepare(`SELECT usuario_id, COUNT(*) AS c FROM emprestimos WHERE status IN ('ativo','atrasado') GROUP BY usuario_id`).all();
  const ma = {}, me = {};
  atrasos.forEach(a => ma[a.usuario_id] = a.c);
  emps.forEach(e => me[e.usuario_id] = e.c);
  res.json({ leitores: leitores.map(l => ({ ...l, atrasados: ma[l.id] || 0, emprestimos_ativos: me[l.id] || 0 })) });
});

app.post('/api/admin/leitores/:id/bloquear', reqBibliotecario, (req, res) => {
  const l = db.prepare(`SELECT * FROM usuarios WHERE id = ? AND papel = 'leitor'`).get(req.params.id);
  if (!l) return res.status(404).json({ erro: 'Leitor não encontrado.' });
  db.prepare('UPDATE usuarios SET bloqueado = 1 WHERE id = ?').run(l.id);
  res.json({ ok: true, mensagem: `${l.nome} foi bloqueado para novos empréstimos.` });
});

app.post('/api/admin/leitores/:id/desbloquear', reqBibliotecario, (req, res) => {
  const l = db.prepare(`SELECT * FROM usuarios WHERE id = ? AND papel = 'leitor'`).get(req.params.id);
  if (!l) return res.status(404).json({ erro: 'Leitor não encontrado.' });
  db.prepare('UPDATE usuarios SET bloqueado = 0 WHERE id = ?').run(l.id);
  res.json({ ok: true, mensagem: `${l.nome} foi desbloqueado.` });
});

app.get('/api/admin/resumo', reqBibliotecario, (req, res) => {
  limparAtrasados();
  res.json({
    totalItens: db.prepare('SELECT COUNT(*) AS c FROM itens WHERE ativo = 1').get().c,
    totalLeitores: db.prepare(`SELECT COUNT(*) AS c FROM usuarios WHERE papel = 'leitor'`).get().c,
    emprestimosAtivos: db.prepare(`SELECT COUNT(*) AS c FROM emprestimos WHERE status = 'ativo'`).get().c,
    emprestimosAtrasados: db.prepare(`SELECT COUNT(*) AS c FROM emprestimos WHERE status = 'atrasado'`).get().c,
    leitoresComAtraso: db.prepare(`SELECT COUNT(DISTINCT usuario_id) AS c FROM emprestimos WHERE status = 'atrasado'`).get().c
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Biblioteca digital rodando em http://localhost:${PORT}`);
});
