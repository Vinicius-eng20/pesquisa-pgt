import express from "express";
import expressSession from "express-session";
import bcrypt from "bcryptjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_FILE = join(__dirname, "data.json");
const SALT_ROUNDS = 10;

const DEFAULT_STATUS = [
  "A fazer",
  "Em andamento",
  "Concluída"
];
const DEFAULT_PRIORIDADES = ["Baixa", "Média", "Alta"];

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

app.use(expressSession({
  name: "sessao_gestao",
  secret: process.env.SESSAO_SECRET || "chave-secreta-nao-use-em-producao",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 30
  }
}));

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function getDb() {
  const empty = {
    users: [],
    tasks: [],
    status: DEFAULT_STATUS.slice(),
    prioridades: DEFAULT_PRIORIDADES.slice()
  };
  if (!existsSync(DB_FILE)) {
    writeFileSync(DB_FILE, JSON.stringify(empty, null, 2));
    return empty;
  }
  try {
    const parsed = JSON.parse(readFileSync(DB_FILE, "utf8"));
    return {
      users: parsed.users || [],
      tasks: parsed.tasks || [],
      status: parsed.status || DEFAULT_STATUS.slice(),
      prioridades: parsed.prioridades || DEFAULT_PRIORIDADES.slice()
    };
  } catch (err) {
    return empty;
  }
}

function saveDb(db) {
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function publicUser(user) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    papel: user.papel
  };
}

function publicTask(task) {
  return {
    id: task.id,
    titulo: task.titulo,
    descricao: task.descricao,
    status: task.status,
    prioridade: task.prioridade,
    dataEntrega: task.dataEntrega,
    criadaPor: task.criadaPor,
    criadaPorNome: task.criadaPorNome,
    criadaEm: task.criadaEm,
    atualizadaEm: task.atualizadaEm,
    atribuidas: (task.atribuidas || []).map(a => ({
      userId: a.userId,
      nome: a.nome,
      done: !!a.done
    }))
  };
}

function isGerente(user) {
  return user && user.papel === "gerente";
}

function isAtribuida(user, task) {
  return (task.atribuidas || []).some(a => a.userId === user.id);
}

function auth(req, res, next) {
  const user = req.session.user;
  if (!user) {
    return res.status(401).json({ error: "Faça login para continuar." });
  }
  req.user = user;
  next();
}

function requireGerente(req, res, next) {
  if (!isGerente(req.user)) {
    return res.status(403).json({ error: "Só o gerente pode fazer isso." });
  }
  next();
}

// ===== AUTENTICACAO =====
app.post("/api/auth/registro", (req, res) => {
  const db = getDb();
  const { nome, email, senha } = req.body || {};
  if (!nome || !email || !senha) {
    return res.status(400).json({ error: "Preencha nome, e-mail e senha." });
  }
  if (senha.length < 4) {
    return res.status(400).json({ error: "A senha precisa ter pelo menos 4 caracteres." });
  }
  const emailNorm = String(email).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailNorm)) {
    return res.status(400).json({ error: "E-mail inválido." });
  }
  if (db.users.some(u => u.email === emailNorm)) {
    return res.status(409).json({ error: "Já existe uma conta com este e-mail." });
  }

  const primeiro = db.users.length === 0;
  const papel = primeiro ? "gerente" : "membro";
  const salt = bcrypt.genSaltSync(SALT_ROUNDS);
  const user = {
    id: uid(),
    nome: String(nome).trim(),
    email: emailNorm,
    salt,
    hash: bcrypt.hashSync(String(senha), salt),
    papel
  };
  db.users.push(user);
  saveDb(db);

  req.session.user = {
    id: user.id,
    nome: user.nome,
    email: user.email,
    papel: user.papel
  };
  res.json({ usuario: publicUser(user) });
});

app.post("/api/auth/login", (req, res) => {
  const db = getDb();
  const { email, senha } = req.body || {};
  const emailNorm = String(email || "").trim().toLowerCase();
  const user = db.users.find(u => u.email === emailNorm);
  if (!user || !bcrypt.compareSync(String(senha || ""), user.hash)) {
    return res.status(401).json({ error: "E-mail ou senha incorretos." });
  }
  req.session.user = {
    id: user.id,
    nome: user.nome,
    email: user.email,
    papel: user.papel
  };
  res.json({ usuario: publicUser(user) });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(err => {
    res.clearCookie("sessao_gestao");
    res.json({ ok: true });
  });
});

app.get("/api/auth/me", auth, (req, res) => {
  res.json({ usuario: publicUser(req.user) });
});

// ===== CONFIGURACOES =====
app.get("/api/config", auth, (req, res) => {
  const db = getDb();
  res.json({ status: db.status, prioridades: db.prioridades });
});

// ===== USUARIOS (para atribuir tarefas) =====
app.get("/api/users", auth, (req, res) => {
  const db = getDb();
  res.json({ users: db.users.map(publicUser) });
});

// ===== TAREFAS: listar =====
app.get("/api/tasks", auth, (req, res) => {
  const db = getDb();
  let tasks = db.tasks;
  if (!isGerente(req.user)) {
    tasks = tasks.filter(t => isAtribuida(req.user, t));
  }
  tasks = tasks.slice().sort((a, b) => (b.criadaEm || 0) - (a.criadaEm || 0));
  res.json({ tasks: tasks.map(publicTask) });
});

// ===== TAREFAS: criar =====
app.post("/api/tasks", auth, (req, res) => {
  const db = getDb();
  const { titulo, descricao, prioridade, dataEntrega, atribuidas, paraSi } = req.body || {};
  if (!titulo || !String(titulo).trim()) {
    return res.status(400).json({ error: "A tarefa precisa de um título." });
  }
  const agora = Date.now();

  let lista;
  if (isGerente(req.user)) {
    lista = [];
    (atribuidas || []).forEach(id => {
      const u = db.users.find(x => x.id === id);
      if (u) lista.push({ userId: u.id, nome: u.nome, done: false });
    });
  } else {
    if (!paraSi) {
      return res.status(403).json({ error: "Você não pode atribuir tarefa para outros." });
    }
    lista = [{ userId: req.user.id, nome: req.user.nome, done: false }];
  }

  const task = {
    id: uid(),
    titulo: String(titulo).trim(),
    descricao: String(descricao || "").trim(),
    status: "A fazer",
    prioridade: prioridade || "Média",
    dataEntrega: dataEntrega || "",
    criadaPor: req.user.id,
    criadaPorNome: req.user.nome,
    criadaEm: agora,
    atualizadaEm: agora,
    atribuidas: lista
  };
  db.tasks.push(task);
  saveDb(db);
  res.json({ task: publicTask(task) });
});

// ===== TAREFAS: editar =====
app.put("/api/tasks/:id", auth, requireGerente, (req, res) => {
  const db = getDb();
  const task = db.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "Tarefa não encontrada." });

  const { titulo, descricao, prioridade, status, dataEntrega, atribuidas } = req.body || {};
  if (titulo !== undefined) task.titulo = String(titulo).trim();
  if (titulo && !String(titulo).trim()) {
    return res.status(400).json({ error: "O título não pode ficar vazio." });
  }
  if (descricao !== undefined) task.descricao = String(descricao).trim();
  if (prioridade !== undefined) task.prioridade = prioridade;
  if (status !== undefined) task.status = status;
  if (dataEntrega !== undefined) task.dataEntrega = dataEntrega;
  if (atribuidas !== undefined) {
    task.atribuidas = [];
    (atribuidas || []).forEach(id => {
      const u = db.users.find(x => x.id === id);
      if (u) task.atribuidas.push({ userId: u.id, nome: u.nome, done: false });
    });
  }
  task.atualizadaEm = Date.now();
  saveDb(db);
  res.json({ task: publicTask(task) });
});

// ===== TAREFAS: remover =====
app.delete("/api/tasks/:id", auth, requireGerente, (req, res) => {
  const db = getDb();
  const idx = db.tasks.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Tarefa não encontrada." });
  db.tasks.splice(idx, 1);
  saveDb(db);
  res.json({ ok: true });
});

// ===== ATUALIZAR STATUS (membro) =====
app.put("/api/tasks/:id/status", auth, (req, res) => {
  const db = getDb();
  const task = db.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "Tarefa não encontrada." });
  if (!isGerente(req.user) && !isAtribuida(req.user, task)) {
    return res.status(403).json({ error: "Você não pode mudar o status desta tarefa." });
  }
  const { status } = req.body || {};
  if (!db.status.includes(status)) {
    return res.status(400).json({ error: "Status inválido." });
  }
  task.status = status;
  task.atualizadaEm = Date.now();
  saveDb(db);
  res.json({ task: publicTask(task) });
});

// ===== MARCAR COMO CONCLUIDA POR QUEM RECEBEU =====
app.put("/api/tasks/:id/done", auth, (req, res) => {
  const db = getDb();
  const task = db.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "Tarefa não encontrada." });
  if (!isGerente(req.user) && !isAtribuida(req.user, task)) {
    return res.status(403).json({ error: "Você não pode alterar esta tarefa." });
  }
  const { done } = req.body || {};
  const a = (task.atribuidas || []).find(x => x.userId === req.user.id);
  if (a) a.done = !!done;
  else if (isGerente(req.user) && !task.atribuidas.length) {
    task.status = done ? "Concluída" : "A fazer";
  }
  task.atualizadaEm = Date.now();
  saveDb(db);
  res.json({ task: publicTask(task) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Gestão de Tarefas rodando em http://localhost:${PORT}`);
});
