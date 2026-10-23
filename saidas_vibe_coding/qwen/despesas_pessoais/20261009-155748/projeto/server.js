const path = require("path");
const fs = require("fs");
const express = require("express");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");

// ---------------- Configuração ----------------
function carregarEnv() {
  const arquivo = path.join(__dirname, ".env");
  const valores = {};
  if (fs.existsSync(arquivo)) {
    fs.readFileSync(arquivo, "utf8").split(/\r?\n/).forEach((linha) => {
      const m = linha.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) valores[m[1]] = m[2];
    });
  }
  return valores;
}
const env = carregarEnv();

const PORTA = env.PORTA ? parseInt(env.PORTA, 10) : 3000;
const ADMIN_USUARIO = env.ADMIN_USUARIO || "admin";
const ADMIN_SENHA = env.ADMIN_SENHA || "admin123";
const BANCO_DB = env.BANCO_DB || "despesas";
const STRING_CONEXAO = env.STRING_CONEXAO || "mongodb://localhost:27017";

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------------- Hash de senhas ----------------
function hashSenha(senha, salt) {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(senha), s, 64).toString("hex");
  return s + ":" + hash;
}
function confereSenha(senha, armazenado) {
  const [salt, hash] = String(armazenado).split(":");
  const teste = crypto.scryptSync(String(senha), salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(teste, "hex"));
}

// ---------------- Sessão ----------------
let sessoes = {};
function criarSessao(dados) {
  const id = crypto.randomBytes(24).toString("hex");
  sessoes[id] = dados;
  return id;
}
function getReq(req) {
  const c = req.headers.cookie || "";
  const m = c.match(/sid=([a-f0-9]+)/);
  const id = m ? m[1] : null;
  const dados = id ? sessoes[id] : null;
  req.sid = id;
  req.sessao = dados;
  return dados;
}
function sessaoAtiva(dados) {
  if (!dados) return false;
  if (dados.tipo === "admin") return true;
  return dados.ativo === true;
}
function sessaoDe(req) {
  const d = req.sessao;
  if (!sessaoAtiva(d)) return null;
  if (d.tipo === "admin") return { tipo: "admin" };
  return { tipo: "user", id: d.id, nome: d.nome };
}
app.use(function (req, res, next) {
  if (req.method === "POST" && /^\/api\/(despesas|usuarios|categorias)/.test(req.path)) {
    const d = getReq(req);
    if (!d) return res.status(401).json({ erro: "Faça login para continuar." });
    if (d.tipo === "user" && d.ativo === false) return res.status(401).json({ erro: "Conta desativada. Fale com o administrador." });
  }
  next();
});
app.use(function (req, res, next) {
  const dados = getReq(req);
  if (dados && sessaoAtiva(dados) && dados.tipo === "user") {
    db.collection("usuarios").findOne({ _id: dados.id }).then((u) => {
      req._ativoAtual = u ? !!u.ativo : false;
      next();
    }).catch(next);
  } else {
    next();
  }
});

// ---------------- Banco de dados ----------------
let db = null;
let dbDisco = null;
const modo = { disco: false };
const colecoes = {
  usuarios: [],
  despesas: [],
  categorias: []
};

function genId() {
  return crypto.randomBytes(12).toString("hex");
}

function carregarArquivo(nome, padrao) {
  const p = path.join(__dirname, "data", nome + ".json");
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return padrao; }
}
function salvarArquivo(nome, dados) {
  const dir = path.join(__dirname, "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, nome + ".json"), JSON.stringify(dados, null, 2));
}

async function conectarBanco() {
  try {
    const client = new MongoClient(STRING_CONEXAO);
    await client.connect({ serverSelectionTimeoutMS: 5000 });
    const database = client.db(BANCO_DB);
    db = database;
    modo.disco = true;
    console.log("Conectado ao MongoDB (dados salvos no banco).");
    return true;
  } catch (e) {
    console.warn("Aviso: MongoDB não disponível (" + e.message + "). Usando armazenamento local em data/*.json (modo de teste).");
    modo.disco = false;
    const dados = carregarArquivo("dados", null);
    if (dados) {
      colecoes.usuarios = dados.usuarios || [];
      colecoes.despesas = dados.despesas || [];
      colecoes.categorias = dados.categorias || [];
    }
    dbDisco = {
      usuarios: colecoes.usuarios,
      despesas: colecoes.despesas,
      categorias: colecoes.categorias
    };
    return false;
  }
}

function collection(nome) {
  return modo.disco ? db.collection(nome) : dbDisco[nome];
}
function salvarDisco() {
  if (modo.disco) return;
  salvarArquivo("dados", {
    usuarios: colecoes.usuarios,
    despesas: colecoes.despesas,
    categorias: colecoes.categorias
  });
}
async function upsert(doc) {
  if (modo.disco) return collection(doc._col).updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
  let i = colecoes[doc._col].findIndex(x => x._id === doc._id);
  if (i === -1) colecoes[doc._col].push(doc); else colecoes[doc._col][i] = doc;
  salvarDisco();
}
async function remove(_col, id) {
  if (modo.disco) return collection(_col).deleteOne({ _id: id });
  const arr = colecoes[_col];
  const i = arr.findIndex(x => x._id === id);
  if (i !== -1) arr.splice(i, 1);
  salvarDisco();
}
async function bulkDelete(_col, ids) {
  if (modo.disco) return collection(_col).deleteMany({ _id: { $in: ids } });
  const arr = colecoes[_col];
  for (let i = arr.length - 1; i >= 0; i--) if (ids.includes(arr[i]._id)) arr.splice(i, 1);
  salvarDisco();
}

// ---------------- Categorias padrão ----------------
const CATEGORIAS_PADRAO = [
  { nome: "Alimentação", cor: "#22c55e" },
  { nome: "Moradia", cor: "#f97316" },
  { nome: "Transporte", cor: "#3b82f6" },
  { nome: "Saúde", cor: "#ef4444" },
  { nome: "Lazer", cor: "#a855f7" },
  { nome: "Educação", cor: "#eab308" },
  { nome: "Outros", cor: "#64748b" }
];

// ---------------- Helpers de data ----------------
function fmtDataBR(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
}
function chaveMes(iso) {
  const d = new Date(iso);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

// ================= ROTA DA PÁGINA =================
app.get("/", (req, res) => {
  const dados = getReq(req);
  if (!dados) return res.sendFile(path.join(__dirname, "views", "login.html"));
  if (!sessaoAtiva(dados)) {
    res.sendFile(path.join(__dirname, "views", "login.html"));
    return;
  }
  if (dados.tipo === "admin") return res.sendFile(path.join(__dirname, "views", "admin.html"));
  res.sendFile(path.join(__dirname, "views", "usuario.html"));
});

// ================= AUTENTICAÇÃO =================
app.post("/api/registro", async (req, res) => {
  const { usuario, senha, nome } = req.body || {};
  if (!usuario || !senha) return res.status(400).json({ erro: "Informe usuário e senha." });
  const u = String(usuario).trim();
  if (u.length < 3) return res.status(400).json({ erro: "O usuário precisa ter pelo menos 3 caracteres." });
  if (String(senha).length < 4) return res.status(400).json({ erro: "A senha precisa ter pelo menos 4 caracteres." });
  const existe = await collection("usuarios").findOne({ usuario: u });
  if (existe) return res.status(409).json({ erro: "Este usuário já existe. Escolha outro." });
  const id = genId();
  const doc = { _id: id, _col: "usuarios", usuario: u, senha: hashSenha(senha), nome: (nome || u).trim(), ativo: true, criadoEm: new Date().toISOString() };
  await upsert(doc);
  const sid = criarSessao({ tipo: "user", id: id, nome: doc.nome, ativo: true });
  res.setHeader("Set-Cookie", "sid=" + sid + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000");
  res.json({ ok: true });
});

app.post("/api/login", async (req, res) => {
  const { usuario, senha } = req.body || {};
  const u = String(usuario || "").trim();
  if (u === ADMIN_USUARIO && senha === ADMIN_SENHA) {
    const sid = criarSessao({ tipo: "admin", nome: "Administrador" });
    res.setHeader("Set-Cookie", "sid=" + sid + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000");
    return res.json({ ok: true });
  }
  const doc = await collection("usuarios").findOne({ usuario: u });
  if (!doc) return res.status(401).json({ erro: "Usuário ou senha incorretos." });
  if (!confereSenha(senha, doc.senha)) return res.status(401).json({ erro: "Usuário ou senha incorretos." });
  if (!doc.ativo) return res.status(403).json({ erro: "Sua conta está desativada. Fale com o administrador." });
  const sid = criarSessao({ tipo: "user", id: doc._id, nome: doc.nome, ativo: true });
  res.setHeader("Set-Cookie", "sid=" + sid + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000");
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  if (req.sid) delete sessoes[req.sid];
  res.setHeader("Set-Cookie", "sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  res.json({ ok: true });
});

app.get("/api/status", (req, res) => {
  const dados = getReq(req);
  if (!dados) return res.json({ logado: false, modo: modo.disco ? "banco" : "local" });
  if (!sessaoAtiva(dados)) return res.json({ logado: false, modo: modo.disco ? "banco" : "local" });
  res.json({ logado: true, tipo: dados.tipo, nome: dados.nome, modo: modo.disco ? "banco" : "local" });
});

// ================= PAINEL DO USUÁRIO =================
app.post("/api/senha", async (req, res) => {
  const s = sessaoDe(req);
  if (!s) return res.status(401).json({ erro: "Faça login." });
  if (s.tipo === "admin") return res.status(400).json({ erro: "Administrador não muda senha por aqui." });
  const { senhaAtual, senhaNova } = req.body || {};
  const doc = await collection("usuarios").findOne({ _id: s.id });
  if (!confereSenha(senhaAtual, doc.senha)) return res.status(400).json({ erro: "A senha atual está incorreta." });
  if (String(senhaNova).length < 4) return res.status(400).json({ erro: "A nova senha precisa ter pelo menos 4 caracteres." });
  doc.senha = hashSenha(senhaNova);
  await upsert(doc);
  res.json({ ok: true });
});

app.get("/api/meu-resumo", async (req, res) => {
  const s = sessaoDe(req);
  if (!s || s.tipo !== "user") return res.status(403).json({ erro: "Não autorizado." });
  const col = collection("despesas");
  const todas = modo.disco
    ? await col.find({ usuarioId: s.id }).toArray()
    : colecoes.despesas.filter(d => d.usuarioId === s.id);
  const porMes = {};
  let totalGeral = 0;
  for (const d of todas) {
    const v = Number(d.valor) || 0;
    totalGeral += v;
    const km = chaveMes(d.data);
    porMes[km] = (porMes[km] || 0) + v;
  }
  res.json({
    totalGeral,
    porMes,
    totalMesAtual: porMes[chaveMes(new Date().toISOString())] || 0,
    qtd: todas.length
  });
});

app.get("/api/minhas-despesas", async (req, res) => {
  const s = sessaoDe(req);
  if (!s || s.tipo !== "user") return res.status(403).json({ erro: "Não autorizado." });
  const col = collection("despesas");
  const todas = modo.disco
    ? await col.find({ usuarioId: s.id }).toArray()
    : colecoes.despesas.filter(d => d.usuarioId === s.id);
  const catCol = collection("categorias");
  const cats = modo.disco
    ? await catCol.find().toArray()
    : colecoes.categorias.slice();
  const mapaCat = {};
  cats.forEach(c => mapaCat[c._id] = { nome: c.nome, cor: c.cor });
  const lista = todas
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .map(d => ({
      id: d._id,
      descricao: d.descricao,
      valor: Number(d.valor) || 0,
      data: d.data,
      dataBR: fmtDataBR(d.data),
      categoriaId: d.categoriaId,
      categoria: mapaCat[d.categoriaId] || { nome: "Sem categoria", cor: "#94a3b8" }
    }));
  res.json({ despesas: lista });
});

app.post("/api/despesas", async (req, res) => {
  const s = sessaoDe(req);
  if (!s || s.tipo !== "user") return res.status(403).json({ erro: "Não autorizado." });
  const { descricao, valor, data, categoriaId } = req.body || {};
  const v = Number(valor);
  if (!descricao || !String(descricao).trim()) return res.status(400).json({ erro: "Descreva o gasto." });
  if (!v || v <= 0) return res.status(400).json({ erro: "Informe um valor maior que zero." });
  const dataIso = data ? new Date(data + "T00:00:00").toISOString() : new Date().toISOString();
  const id = genId();
  const doc = { _id: id, _col: "despesas", usuarioId: s.id, descricao: String(descricao).trim(), valor: v, data: dataIso, categoriaId: categoriaId || null };
  await upsert(doc);
  res.json({ ok: true, id });
});

app.delete("/api/despesas/:id", async (req, res) => {
  const s = sessaoDe(req);
  if (!s || s.tipo !== "user") return res.status(403).json({ erro: "Não autorizado." });
  const doc = await collection("despesas").findOne({ _id: req.params.id });
  if (!doc) return res.status(404).json({ erro: "Gasto não encontrado." });
  if (doc.usuarioId !== s.id) return res.status(403).json({ erro: "Você só pode apagar seus próprios gastos." });
  await remove("despesas", req.params.id);
  res.json({ ok: true });
});

// ================= PAINEL DO ADMINISTRADOR =================
function exigeAdmin(req, res) {
  const s = sessaoDe(req);
  if (!s || s.tipo !== "admin") { res.status(403).json({ erro: "Acesso do administrador." }); return null; }
  return s;
}

app.get("/api/admin/resumo", async (req, res) => {
  if (!exigeAdmin(req, res)) return;
  const col = collection("despesas");
  const todas = modo.disco ? await col.find().toArray() : colecoes.despesas.slice();
  const totalGeral = todas.reduce((s, d) => s + (Number(d.valor) || 0), 0);
  const usuarios = modo.disco
    ? await collection("usuarios").find().toArray()
    : colecoes.usuarios.slice();
  const totalPorUsuario = {};
  const mesAtual = chaveMes(new Date().toISOString());
  usuarios.forEach(u => totalPorUsuario[u._id] = 0);
  for (const d of todas) {
    const v = Number(d.valor) || 0;
    totalPorUsuario[d.usuarioId] = (totalPorUsuario[d.usuarioId] || 0) + v;
    if (chaveMes(d.data) === mesAtual) {
      totalPorUsuario.__mesAtual = (totalPorUsuario.__mesAtual || 0) + v;
    }
  }
  const totalMesAtual = totalPorUsuario.__mesAtual || 0;
  res.json({
    totalGeral,
    totalMesAtual,
    qtdUsuarios: usuarios.length,
    qtdDespesas: todas.length,
    usuarios: usuarios.map(u => ({
      id: u._id,
      nome: u.nome,
      usuario: u.usuario,
      ativo: !!u.ativo,
      criadoEm: u.criadoEm,
      total: totalPorUsuario[u._id] || 0
    }))
  });
});

app.post("/api/admin/usuarios", async (req, res) => {
  if (!exigeAdmin(req, res)) return;
  const { usuario, senha, nome } = req.body || {};
  if (!usuario || !senha) return res.status(400).json({ erro: "Informe usuário e senha." });
  const u = String(usuario).trim();
  if (u.length < 3) return res.status(400).json({ erro: "O usuário precisa ter pelo menos 3 caracteres." });
  if (String(senha).length < 4) return res.status(400).json({ erro: "A senha precisa ter pelo menos 4 caracteres." });
  if (u === ADMIN_USUARIO) return res.status(400).json({ erro: "Este nome é reservado." });
  const existe = await collection("usuarios").findOne({ usuario: u });
  if (existe) return res.status(409).json({ erro: "Usuário já existe." });
  const id = genId();
  await upsert({ _id: id, _col: "usuarios", usuario: u, senha: hashSenha(senha), nome: (nome || u).trim(), ativo: true, criadoEm: new Date().toISOString() });
  res.json({ ok: true, id });
});

app.post("/api/admin/usuarios/:id/toggle", async (req, res) => {
  if (!exigeAdmin(req, res)) return;
  const doc = await collection("usuarios").findOne({ _id: req.params.id });
  if (!doc) return res.status(404).json({ erro: "Usuário não encontrado." });
  doc.ativo = !doc.ativo;
  await upsert(doc);
  if (sessoes[doc._id]) sessoes[doc._id].ativo = doc.ativo;
  res.json({ ok: true, ativo: doc.ativo });
});

app.delete("/api/admin/usuarios/:id", async (req, res) => {
  if (!exigeAdmin(req, res)) return;
  const doc = await collection("usuarios").findOne({ _id: req.params.id });
  if (!doc) return res.status(404).json({ erro: "Usuário não encontrado." });
  const despesasDoUsuario = modo.disco
    ? await collection("despesas").find({ usuarioId: doc._id }).toArray()
    : colecoes.despesas.filter(d => d.usuarioId === doc._id);
  await bulkDelete("despesas", despesasDoUsuario.map(d => d._id));
  await remove("usuarios", doc._id);
  delete sessoes[doc._id];
  res.json({ ok: true });
});

app.get("/api/admin/despesas-todas", async (req, res) => {
  if (!exigeAdmin(req, res)) return;
  const todas = modo.disco ? await collection("despesas").find().toArray() : colecoes.despesas.slice();
  const usuarios = modo.disco ? await collection("usuarios").find().toArray() : colecoes.usuarios.slice();
  const cats = modo.disco ? await collection("categorias").find().toArray() : colecoes.categorias.slice();
  const mapaU = {}, mapaC = {};
  usuarios.forEach(u => mapaU[u._id] = u.nome);
  cats.forEach(c => mapaC[c._id] = c.nome);
  const lista = todas
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .map(d => ({
      id: d._id,
      descricao: d.descricao,
      valor: Number(d.valor) || 0,
      data: d.data,
      dataBR: fmtDataBR(d.data),
      usuario: mapaU[d.usuarioId] || "removido",
      categoria: mapaC[d.categoriaId] || "Sem categoria"
    }));
  res.json({ despesas: lista });
});

app.post("/api/admin/despesas/:id/remover-categoria", async (req, res) => {
  if (!exigeAdmin(req, res)) return;
  const doc = await collection("despesas").findOne({ _id: req.params.id });
  if (!doc) return res.status(404).json({ erro: "Gasto não encontrado." });
  doc.categoriaId = null;
  await upsert(doc);
  res.json({ ok: true });
});

app.delete("/api/admin/despesas/:id", async (req, res) => {
  if (!exigeAdmin(req, res)) return;
  await remove("despesas", req.params.id);
  res.json({ ok: true });
});

app.get("/api/categorias", async (req, res) => {
  const s = sessaoDe(req);
  if (!s) return res.status(401).json({ erro: "Faça login." });
  const cats = modo.disco ? await collection("categorias").find().toArray() : colecoes.categorias.slice();
  res.json({
    categorias: cats.map(c => ({ id: c._id, nome: c.nome, cor: c.cor, ativa: c.ativa !== false }))
  });
});

app.post("/api/admin/categorias", async (req, res) => {
  if (!exigeAdmin(req, res)) return;
  const { nome, cor } = req.body || {};
  const n = String(nome || "").trim();
  if (!n) return res.status(400).json({ erro: "Dê um nome à categoria." });
  const existe = colecoes.categorias.some(c => c.nome.toLowerCase() === n.toLowerCase());
  const id = genId();
  await upsert({ _id: id, _col: "categorias", nome: n, cor: cor || "#64748b", ativa: true });
  res.json({ ok: true, id });
});

app.post("/api/admin/categorias/:id/toggle", async (req, res) => {
  if (!exigeAdmin(req, res)) return;
  const doc = await collection("categorias").findOne({ _id: req.params.id });
  if (!doc) return res.status(404).json({ erro: "Categoria não encontrada." });
  doc.ativa = !doc.ativa;
  await upsert(doc);
  res.json({ ok: true, ativa: doc.ativa });
});

app.delete("/api/admin/categorias/:id", async (req, res) => {
  if (!exigeAdmin(req, res)) return;
  await remove("categorias", req.params.id);
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: "Erro interno. Tente de novo." });
});

// ---------------- Inicialização ----------------
async function inicializar() {
  await conectarBanco();
  const cats = modo.disco ? await collection("categorias").find().toArray() : colecoes.categorias.slice();
  if (cats.length === 0) {
    for (const c of CATEGORIAS_PADRAO) {
      await upsert({ _id: genId(), _col: "categorias", nome: c.nome, cor: c.cor, ativa: true });
    }
    console.log("Categorias padrão criadas.");
  }
  app.listen(PORTA, () => {
    console.log("");
    console.log("========================================");
    console.log("  CONTROLE DE DESPESAS - NO AR");
    console.log("  Abra no navegador: http://localhost:" + PORTA);
    console.log("  Admin: usuario='" + ADMIN_USUARIO + "'  senha='" + ADMIN_SENHA + "'");
    console.log("  Dados salvos no: " + (modo.disco ? "MongoDB" : "arquivo local (data/)"));
    console.log("========================================");
    console.log("");
  });
}

inicializar();
