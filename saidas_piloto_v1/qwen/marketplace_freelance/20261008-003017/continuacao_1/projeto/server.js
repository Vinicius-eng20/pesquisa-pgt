import express from 'express';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
const DB_FILE = join(DATA_DIR, 'dados.json');
const PORT = process.env.PORT || 3000;

/* ------------------------------------------------------------------ *
 *  Utilidades: senhas, ids, sessões
 * ------------------------------------------------------------------ */
const saltRnd = 1000; // tamanho do salt em bytes

function gerarId() {
  return crypto.randomBytes(12).toString('hex');
}

function gerarToken() {
  return crypto.randomBytes(24).toString('hex');
}

function hashSenha(senha, salt) {
  return crypto
    .scryptSync(String(senha), salt, 64)
    .toString('hex');
}

function senhaCorreta(senha, salt, hash) {
  const nova = hashSenha(senha, salt);
  const a = Buffer.from(nova, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function novoUsuario() {
  const salt = crypto.randomBytes(saltRnd).toString('hex');
  return { salt, senhaHash: '' };
}

/* ------------------------------------------------------------------ *
 *  Persistência (arquivo JSON local)
 * ------------------------------------------------------------------ */
const DB = {
  usuarios: {},      // id -> { id, nome, email, salt, senhaHash, role, ativo, criadoEm }
  servicos: {},      // id -> serviço
  contratos: {},     // id -> contrato
  sessoes: {},       // token -> userId
  ordemServicos: [], // ids na ordem de criação
  ordemContratos: [] // ids na ordem de criação
};

function carregar() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DB_FILE)) {
    // Cria a conta de administrador inicial.
    const salt = crypto.randomBytes(saltRnd).toString('hex');
    const email = (process.env.ADMIN_EMAIL || 'admin@marketplace.com').toLowerCase();
    const senha = process.env.ADMIN_INITIAL_PASSWORD || 'admin123';
    DB.usuarios['admin'] = {
      id: 'admin',
      nome: 'Administrador',
      email,
      salt,
      senhaHash: hashSenha(senha, salt),
      role: 'admin',
      ativo: true,
      criadoEm: new Date().toISOString()
    };
    salvar();
    console.log('▶ Banco inicializado. Admin: %s', email);
    return;
  }
  try {
    const dados = JSON.parse(readFileSync(DB_FILE, 'utf8'));
    Object.assign(DB, dados);
    console.log('▶ Banco carregado.');
  } catch (e) {
    console.error('✖ Erro ao carregar o banco de dados:', e.message);
    process.exit(1);
  }
}

function salvar() {
  // Grava de forma atômica simples: escreve em .tmp e renomeia.
  const tmp = DB_FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify(DB, null, 2));
  renameSyncSafe(tmp, DB_FILE);
}

function renameSyncSafe(a, b) {
  try {
    const { renameSync } = require('node:fs');
    renameSync(a, b);
  } catch {
    // fallback para ambientes onde renameSync não foi importado no topo
    writeFileSync(b, readFileSync(a, 'utf8'));
    try { unlinkSync(a); } catch {}
  }
}
// Import helpers usados acima em alguns paths
import { renameSync, unlinkSync } from 'node:fs';

/* ------------------------------------------------------------------ *
 *  Validações
 * ------------------------------------------------------------------ */
function emailValido(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function usuarioAtivo(id) {
  const u = DB.usuarios[id];
  return u && u.ativo !== false;
}

function listarServicos() {
  return DB.ordemServicos
    .map(id => DB.servicos[id])
    .filter(Boolean)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

function listarContratos() {
  return DB.ordemContratos
    .map(id => DB.contratos[id])
    .filter(Boolean)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

function publico(u) {
  if (!u) return null;
  return { id: u.id, nome: u.nome, email: u.email, role: u.role, ativo: u.ativo !== false };
}

function resumoUsuario(p) {
  if (!p) return null;
  return { id: p.id, nome: p.nome, email: p.email, role: p.role };
}

function servicoPublico(s) {
  if (!s) return null;
  return {
    ...s,
    prestador: resumoUsuario(DB.usuarios[s.prestadorId])
  };
}

function contratoPublico(c) {
  if (!c) return null;
  const servico = DB.servicos[c.servicoId];
  const prestador = DB.usuarios[c.prestadorId];
  const contratante = DB.usuarios[c.contratanteId];
  return {
    ...c,
    servico: servico ? {
      id: servico.id,
      titulo: servico.titulo,
      categoria: servico.categoria,
      preco: servico.preco,
      formaPagamento: servico.formaPagamento
    } : null,
    prestador: resumoUsuario(prestador),
    contratante: resumoUsuario(contratante)
  };
}

function servicoAdmin(s) {
  const u = DB.usuarios[s.prestadorId];
  return {
    ...s,
    prestador: {
      id: u?.id || s.prestadorId,
      nome: u?.nome || 'Usuário removido',
      email: u?.email || '—',
      ativo: u?.ativo !== false
    }
  };
}

function contratoAdmin(c) {
  return {
    ...c,
    servicoTitulo: DB.servicos[c.servicoId]?.titulo || '—',
    prestador: DB.usuarios[c.prestadorId]
      ? { id: c.prestadorId, nome: DB.usuarios[c.prestadorId].nome, email: DB.usuarios[c.prestadorId].email }
      : { id: c.prestadorId, nome: 'Usuário removido', email: '—' },
    contratante: DB.usuarios[c.contratanteId]
      ? { id: c.contratanteId, nome: DB.usuarios[c.contratanteId].nome, email: DB.usuarios[c.contratanteId].email }
      : { id: c.contratanteId, nome: 'Usuário removido', email: '—' }
  };
}

/* ------------------------------------------------------------------ *
 *  Middlewares
 * ------------------------------------------------------------------ */
function auth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ erro: 'Não autenticado' });
  const userId = DB.sessoes[token];
  if (!userId) return res.status(401).json({ erro: 'Sessão expirada' });
  const u = DB.usuarios[userId];
  if (!u || u.ativo === false) return res.status(401).json({ erro: 'Conta suspensa ou inexistente' });
  req.usuario = u;
  next();
}

function admin(req, res, next) {
  if (req.usuario?.role !== 'admin') {
    return res.status(403).json({ erro: 'Acesso restrito ao administrador' });
  }
  next();
}

/* ------------------------------------------------------------------ *
 *  Rotas públicas
 * ------------------------------------------------------------------ */
const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(express.static(join(__dirname, 'public')));

app.post('/api/registro', (req, res) => {
  const { nome, email, senha } = req.body || {};
  if (!nome || String(nome).trim().length < 2)
    return res.status(400).json({ erro: 'Informe um nome (mínimo 2 caracteres).' });
  const emailN = String(email || '').toLowerCase().trim();
  if (!emailValido(emailN))
    return res.status(400).json({ erro: 'Informe um e-mail válido.' });
  if (Object.values(DB.usuarios).some(u => u.email === emailN))
    return res.status(409).json({ erro: 'Este e-mail já está cadastrado.' });
  if (!senha || String(senha).length < 6)
    return res.status(400).json({ erro: 'A senha precisa ter no mínimo 6 caracteres.' });

  const salt = crypto.randomBytes(saltRnd).toString('hex');
  const id = gerarId();
  const u = {
    id,
    nome: String(nome).trim(),
    email: emailN,
    salt,
    senhaHash: hashSenha(senha, salt),
    role: 'user',
    ativo: true,
    criadoEm: new Date().toISOString()
  };
  DB.usuarios[id] = u;

  const token = gerarToken();
  DB.sessoes[token] = id;
  salvar();
  res.status(201).json({ token, usuario: publico(u) });
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body || {};
  const emailN = String(email || '').toLowerCase().trim();
  const u = Object.values(DB.usuarios).find(x => x.email === emailN);
  if (!u || !senhaCorreta(senha, u.salt, u.senhaHash))
    return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
  if (u.ativo === false)
    return res.status(403).json({ erro: 'Sua conta está suspensa. Fale com a administração.' });
  const token = gerarToken();
  DB.sessoes[token] = u.id;
  salvar();
  res.json({ token, usuario: publico(u) });
});

app.get('/api/servicos/publicos', (req, res) => {
  const lista = listarServicos()
    .filter(s => s.status === 'aprovado')
    .map(servicoPublico);
  res.json({ servicos: lista });
});

/* ------------------------------------------------------------------ *
 *  Rotas autenticadas
 * ------------------------------------------------------------------ */
app.get('/api/conta', auth, (req, res) => {
  res.json({ usuario: publico(req.usuario) });
});

app.post('/api/logout', auth, (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  delete DB.sessoes[token];
  salvar();
  res.json({ ok: true });
});

app.patch('/api/conta/senha', auth, (req, res) => {
  const { senhaAtual, novaSenha } = req.body || {};
  if (!senhaAtual || !novaSenha)
    return res.status(400).json({ erro: 'Informe a senha atual e a nova senha.' });
  if (!senhaCorreta(senhaAtual, req.usuario.salt, req.usuario.senhaHash))
    return res.status(400).json({ erro: 'A senha atual está incorreta.' });
  if (String(novaSenha).length < 6)
    return res.status(400).json({ erro: 'A nova senha precisa ter no mínimo 6 caracteres.' });
  const salt = crypto.randomBytes(saltRnd).toString('hex');
  req.usuario.salt = salt;
  req.usuario.senhaHash = hashSenha(novaSenha, salt);
  salvar();
  res.json({ ok: true });
});

// ——— Publicar serviço ———
app.post('/api/servicos', auth, (req, res) => {
  const b = req.body || {};
  const titulo = String(b.titulo || '').trim();
  const categoria = String(b.categoria || '').trim();
  const descricao = String(b.descricao || '').trim();
  const preco = Number(b.preco);
  const formaPagamento = String(b.formaPagamento || 'Por hora').trim();

  if (titulo.length < 4) return res.status(400).json({ erro: 'Título curto demais (mínimo 4 caracteres).' });
  if (categoria.length < 2) return res.status(400).json({ erro: 'Informe a categoria.' });
  if (descricao.length < 10) return res.status(400).json({ erro: 'A descrição precisa ter ao menos 10 caracteres.' });
  if (!Number.isFinite(preco) || preco < 0) return res.status(400).json({ erro: 'Informe um preço válido (número maior ou igual a 0).' });

  const id = gerarId();
  const s = {
    id,
    prestadorId: req.usuario.id,
    titulo,
    categoria,
    descricao,
    preco,
    formaPagamento,
    status: 'pendente',
    criadoEm: new Date().toISOString()
  };
  DB.servicos[id] = s;
  DB.ordemServicos.push(id);
  salvar();
  res.status(201).json({ servico: servicoPublico(s) });
});

app.get('/api/servicos/meus', auth, (req, res) => {
  const meus = listarServicos()
    .filter(s => s.prestadorId === req.usuario.id)
    .map(servicoPublico);
  res.json({ servicos: meus });
});

// ——— Contratos ———
app.post('/api/contratos', auth, (req, res) => {
  const { servicoId, mensagem } = req.body || {};
  const s = DB.servicos[servicoId];
  if (!s) return res.status(404).json({ erro: 'Serviço não encontrado.' });
  if (s.status !== 'aprovado') return res.status(400).json({ erro: 'Este serviço não está aprovado.' });
  if (s.prestadorId === req.usuario.id)
    return res.status(400).json({ erro: 'Você não pode contratar o seu próprio serviço.' });

  const contrato = {
    id: gerarId(),
    servicoId: s.id,
    prestadorId: s.prestadorId,
    contratanteId: req.usuario.id,
    mensagem: String(mensagem || '').trim(),
    status: 'pendente', // pendente | aceito | recusado | concluido
    criadoEm: new Date().toISOString()
  };
  DB.contratos[contrato.id] = contrato;
  DB.ordemContratos.push(contrato.id);
  salvar();
  res.status(201).json({ contrato: contratoPublico(contrato) });
});

app.get('/api/contratos/meus', auth, (req, res) => {
  const meus = listarContratos()
    .filter(c => c.prestadorId === req.usuario.id || c.contratanteId === req.usuario.id)
    .map(contratoPublico);
  res.json({ contratos: meus });
});

app.post('/api/contratos/:id/acao', auth, (req, res) => {
  const c = DB.contratos[req.params.id];
  if (!c) return res.status(404).json({ erro: 'Contrato não encontrado.' });
  const { acao } = req.body || {};
  const ePrestador = req.usuario.id === c.prestadorId;
  const eContratante = req.usuario.id === c.contratanteId;

  if (acao === 'aceitar') {
    if (!ePrestador) return res.status(403).json({ erro: 'Apenas o prestador pode aceitar.' });
    if (c.status !== 'pendente') return res.status(400).json({ erro: 'Já houve uma decisão sobre este contrato.' });
    c.status = 'aceito';
  } else if (acao === 'recusar') {
    if (!ePrestador) return res.status(403).json({ erro: 'Apenas o prestador pode recusar.' });
    if (c.status !== 'pendente') return res.status(400).json({ erro: 'Já houve uma decisão sobre este contrato.' });
    c.status = 'recusado';
  } else if (acao === 'concluir') {
    if (!eContratante) return res.status(403).json({ erro: 'Apenas o contratante pode concluir.' });
    if (c.status !== 'aceito') return res.status(400).json({ erro: 'Só é possível concluir um contrato aceito.' });
    c.status = 'concluido';
  } else {
    return res.status(400).json({ erro: 'Ação inválida.' });
  }
  salvar();
  res.json({ contrato: contratoPublico(c) });
});

/* ------------------------------------------------------------------ *
 *  Rotas do administrador
 * ------------------------------------------------------------------ */
app.get('/api/admin/servicos', auth, admin, (req, res) => {
  res.json({ servicos: listarServicos().map(servicoAdmin) });
});

app.get('/api/admin/contratos', auth, admin, (req, res) => {
  res.json({ contratos: listarContratos().map(contratoAdmin) });
});

app.get('/api/admin/usuarios', auth, admin, (req, res) => {
  const usuarios = Object.values(DB.usuarios).map(publico);
  res.json({ usuarios });
});

app.post('/api/admin/servicos/:id/aprovar', auth, admin, (req, res) => {
  const s = DB.servicos[req.params.id];
  if (!s) return res.status(404).json({ erro: 'Serviço não encontrado.' });
  s.status = 'aprovado';
  salvar();
  res.json({ servico: servicoAdmin(s) });
});

app.post('/api/admin/servicos/:id/remover', auth, admin, (req, res) => {
  const s = DB.servicos[req.params.id];
  if (!s) return res.status(404).json({ erro: 'Serviço não encontrado.' });
  delete DB.servicos[s.id];
  DB.ordemServicos = DB.ordemServicos.filter(x => x !== s.id);
  salvar();
  res.json({ ok: true });
});

app.post('/api/admin/usuarios/:id/toggle', auth, admin, (req, res) => {
  const u = DB.usuarios[req.params.id];
  if (!u) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  if (u.role === 'admin')
    return res.status(400).json({ erro: 'Não é possível suspender o administrador.' });
  u.ativo = u.ativo === false ? true : false;
  // Remove sessões ativas do usuário suspenso.
  if (u.ativo === false) {
    for (const [t, uid] of Object.entries(DB.sessoes)) {
      if (uid === u.id) delete DB.sessoes[t];
    }
  }
  salvar();
  res.json({ usuario: publico(u) });
});

/* ------------------------------------------------------------------ *
 *  Erros e fallback SPA
 * ------------------------------------------------------------------ */
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ erro: 'Rota não encontrada' });
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

/* ------------------------------------------------------------------ *
 *  Start
 * ------------------------------------------------------------------ */
carregar();
app.listen(PORT, () => {
  console.log(`✔ Marketplace rodando em http://localhost:${PORT}`);
});
