import express from "express";
import cors from "cors";
import crypto from "crypto";
import Database from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "data.sqlite");
const SECRET = process.env.SECRET || "freelancemarket-secret-change-me";
const PORT = process.env.PORT || 3000;

const db = new Database(DB_FILE, (err) => {
  if (err) {
    console.error("Erro ao abrir o banco de dados:", err.message);
    process.exit(1);
  }
  db.run("PRAGMA journal_mode = WAL");
});

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

const esc = (v) =>
  (v === null || v === undefined)
    ? ""
    : String(v).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c]));
const qs = (v) => (v === null || v === undefined ? null : "'" + String(v).replace(/'/g, "''") + "'");

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function initDB() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    suspended INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`);
  await run(`CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
  )`);
  await run(`CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    provider_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL
  )`);
  await run(`CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`);
  await run(`CREATE INDEX IF NOT EXISTS idx_services_owner ON services(owner_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_contracts_provider ON contracts(provider_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_tokens_user ON tokens(user_id)`);

  // Conta de administrador inicial.
  const admin = await get("SELECT id FROM users WHERE role='admin' LIMIT 1");
  if (!admin) {
    const hash = hashPassword("admin123");
    const now = new Date().toISOString();
    await run(
      "INSERT INTO users (name, email, password_hash, role, suspended, created_at) VALUES (?,?,?,?,?,?)",
      ["Administrador", "admin@freelance.com", hash, "admin", 0, now]
    );
    console.log("");
    console.log("====================================================");
    console.log(" Conta de administrador criada (usar UMA vez só).");
    console.log("   E-mail:    admin@freelance.com");
    console.log("   Senha:     admin123");
    console.log(" IMPORTANTE: entre no Painel do Admin e mude essa senha.");
    console.log("====================================================");
    console.log("");
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha256").toString("hex");
  return salt + ":" + hash;
}
function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const test = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha256").toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(test, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}
function makeToken() {
  return crypto.randomBytes(32).toString("hex");
}

// --- Autenticação ---
async function getUserByToken(token) {
  if (!token) return null;
  const row = await get(
    "SELECT u.* FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.token = ? LIMIT 1",
    [token]
  );
  if (!row) return null;
  if (row.suspended) {
    await run("DELETE FROM tokens WHERE user_id = ?", [row.id]);
    return { suspended: true, user: row };
  }
  return row;
}
function sendLoginError(res, code, message) {
  res.status(code).json({ error: esc(message) });
}
function requireAuth(req, res, next) {
  getUserByToken(req.headers.authorization || "").then((u) => {
    if (u && u.suspended) return sendLoginError(res, 401, "Sua conta foi suspensa. Contate o administrador.");
    if (!u) return sendLoginError(res, 401, "Faça login para continuar.");
    req.user = u;
    next();
  });
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin")
    return sendLoginError(res, 403, "Acesso somente para administradores.");
  next();
}
function cleanUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: esc(u.name),
    email: esc(u.email),
    role: esc(u.role),
    suspended: !!u.suspended,
  };
}
function cleanService(s) {
  if (!s) return null;
  return {
    id: s.id,
    title: esc(s.title),
    description: esc(s.description),
    category: esc(s.category),
    price: Number(s.price),
    status: esc(s.status),
    ownerName: s.owner_name != null ? esc(s.owner_name) : "",
    clientName: s.client_name != null ? esc(s.client_name) : "",
    createdAt: esc(s.created_at),
  };
}
function cleanContract(c) {
  if (!c) return null;
  return {
    id: c.id,
    serviceTitle: esc(c.service_title),
    clientName: esc(c.client_name),
    providerName: esc(c.provider_name),
    status: esc(c.status),
    createdAt: esc(c.created_at),
  };
}

// ==================== ROTAS DE AUTENTICAÇÃO ====================
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: "Informe seu nome." });
    if (!email || !/^\S+@\S+\.\S+$/.test(String(email))) return res.status(400).json({ error: "Informe um e-mail válido." });
    if (!password || String(password).length < 6) return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });

    const existing = await get("SELECT id FROM users WHERE email = ?", [String(email).trim().toLowerCase()]);
    if (existing) return res.status(409).json({ error: "Já existe uma conta com este e-mail." });

    const now = new Date().toISOString();
    const { id } = await run(
      "INSERT INTO users (name, email, password_hash, role, suspended, created_at) VALUES (?,?,?,?,?,?)",
      [String(name).trim(), String(email).trim().toLowerCase(), hashPassword(String(password)), "user", 0, now]
    );
    const token = makeToken();
    await run("INSERT INTO tokens (token, user_id, created_at) VALUES (?,?,?)", [token, id, now]);
    const user = await get("SELECT * FROM users WHERE id = ?", [id]);
    res.json({ token, user: cleanUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao criar a conta. Tente novamente." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Informe e-mail e senha." });
    const user = await get("SELECT * FROM users WHERE email = ?", [String(email).trim().toLowerCase()]);
    if (!user || !verifyPassword(String(password), user.password_hash))
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    if (user.suspended) return res.status(403).json({ error: "Sua conta foi suspensa. Contate o administrador." });

    const token = makeToken();
    await run("INSERT INTO tokens (token, user_id, created_at) VALUES (?,?,?)", [token, user.id, new Date().toISOString()]);
    res.json({ token, user: cleanUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao entrar. Tente novamente." });
  }
});

app.post("/api/logout", requireAuth, async (req, res) => {
  const token = req.headers.authorization;
  await run("DELETE FROM tokens WHERE token = ?", [token]);
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, async (req, res) => {
  res.json({ user: cleanUser(req.user) });
});

app.put("/api/me", requireAuth, async (req, res) => {
  try {
    const { name, password } = req.body || {};
    if (name && String(name).trim()) await run("UPDATE users SET name = ? WHERE id = ?", [String(name).trim(), req.user.id]);
    if (password && String(password).length >= 6)
      await run("UPDATE users SET password_hash = ? WHERE id = ?", [hashPassword(String(password)), req.user.id]);
    const user = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);
    res.json({ user: cleanUser(user) });
  } catch (e) {
    res.status(500).json({ error: "Erro ao salvar. Tente novamente." });
  }
});

// ==================== ROTAS PÚBLICAS ====================
app.get("/api/services", async (req, res) => {
  const rows = await all(
    "SELECT s.*, u.name AS owner_name FROM services s JOIN users u ON u.id = s.owner_id WHERE s.status='approved' ORDER BY s.created_at DESC, s.id DESC"
  );
  res.json({ services: rows.map(cleanService) });
});

// ==================== ROTAS DO USUÁRIO ====================
app.post("/api/services", requireAuth, async (req, res) => {
  try {
    const { title, description, category, price } = req.body || {};
    if (!title || !String(title).trim()) return res.status(400).json({ error: "Dê um título para o serviço." });
    if (!description || !String(description).trim()) return res.status(400).json({ error: "Escreva a descrição do serviço." });
    if (!category || !String(category).trim()) return res.status(400).json({ error: "Escolha uma categoria." });
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) return res.status(400).json({ error: "Informe um preço válido (maior ou igual a zero)." });

    const now = new Date().toISOString();
    const { id } = await run(
      "INSERT INTO services (owner_id, title, description, category, price, status, created_at) VALUES (?,?,?,?,?,'pending',?)",
      [req.user.id, String(title).trim(), String(description).trim(), String(category).trim(), priceNum, now]
    );
    const s = await get("SELECT s.*, u.name AS owner_name FROM services s JOIN users u ON u.id = s.owner_id WHERE s.id = ?", [id]);
    res.json({ service: cleanService(s) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao publicar o serviço. Tente novamente." });
  }
});

app.get("/api/services/mine", requireAuth, async (req, res) => {
  const rows = await all(
    "SELECT s.*, u.name AS owner_name FROM services s JOIN users u ON u.id = s.owner_id WHERE s.owner_id = ? ORDER BY s.created_at DESC, s.id DESC",
    [req.user.id]
  );
  res.json({ services: rows.map(cleanService) });
});

app.delete("/api/services/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const s = await get("SELECT * FROM services WHERE id = ?", [id]);
  if (!s) return res.status(404).json({ error: "Serviço não encontrado." });
  if (req.user.role !== "admin" && s.owner_id !== req.user.id) return res.status(403).json({ error: "Você não pode remover este serviço." });
  await run("DELETE FROM contracts WHERE service_id = ?", [id]);
  await run("DELETE FROM services WHERE id = ?", [id]);
  res.json({ ok: true });
});

app.get("/api/contracts/mine", requireAuth, async (req, res) => {
  const rows = await all(
    "SELECT c.id, c.status, c.created_at, c.client_id, c.provider_id, s.title AS service_title, uc.name AS client_name, up.name AS provider_name " +
      "FROM contracts c JOIN services s ON s.id = c.service_id " +
      "JOIN users uc ON uc.id = c.client_id JOIN users up ON up.id = c.provider_id " +
      "WHERE c.client_id = ? OR c.provider_id = ? ORDER BY c.created_at DESC, c.id DESC",
    [req.user.id, req.user.id]
  );
  res.json({ contracts: rows.map(cleanContract) });
});

app.post("/api/contracts", requireAuth, async (req, res) => {
  const serviceId = Number((req.body || {}).serviceId);
  const s = await get("SELECT * FROM services WHERE id = ?", [serviceId]);
  if (!s) return res.status(404).json({ error: "Serviço não encontrado." });
  if (s.status !== "approved") return res.status(400).json({ error: "Este serviço não está disponível para contratação." });
  if (s.owner_id === req.user.id) return res.status(400).json({ error: "Você não pode contratar um serviço seu." });
  const dup = await get("SELECT id FROM contracts WHERE service_id = ? AND client_id = ?", [serviceId, req.user.id]);
  if (dup) return res.status(409).json({ error: "Você já tem um contrato para este serviço." });

  const now = new Date().toISOString();
  const { id } = await run(
    "INSERT INTO contracts (service_id, client_id, provider_id, status, created_at) VALUES (?,?,?,'active',?)",
    [serviceId, req.user.id, s.owner_id, now]
  );
  const c = await get(
    "SELECT c.id, c.status, c.created_at, c.client_id, c.provider_id, s.title AS service_title, uc.name AS client_name, up.name AS provider_name " +
      "FROM contracts c JOIN services s ON s.id = c.service_id JOIN users uc ON uc.id = c.client_id JOIN users up ON up.id = c.provider_id WHERE c.id = ?",
    [id]
  );
  res.json({ contract: cleanContract(c) });
});

// ==================== ROTAS DO ADMINISTRADOR ====================
app.get("/api/admin/services", requireAuth, requireAdmin, async (req, res) => {
  const rows = await all(
    "SELECT s.*, u.name AS owner_name, (SELECT COUNT(*) FROM contracts ct WHERE ct.service_id = s.id) AS contract_count " +
      "FROM services s JOIN users u ON u.id = s.owner_id ORDER BY s.created_at DESC, s.id DESC"
  );
  res.json({ services: rows.map(cleanService) });
});

app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const rows = await all(
    "SELECT u.*, (SELECT COUNT(*) FROM services s WHERE s.owner_id = u.id) AS service_count, " +
      "(SELECT COUNT(*) FROM contracts c WHERE c.client_id = u.id OR c.provider_id = u.id) AS contract_count " +
      "FROM users u ORDER BY u.created_at DESC, u.id DESC"
  );
  res.json({
    users: rows.map((u) => ({
      id: u.id,
      name: esc(u.name),
      email: esc(u.email),
      role: esc(u.role),
      suspended: !!u.suspended,
      serviceCount: u.service_count,
      contractCount: u.contract_count,
      createdAt: esc(u.created_at),
    })),
  });
});

app.get("/api/admin/contracts", requireAuth, requireAdmin, async (req, res) => {
  const rows = await all(
    "SELECT c.id, c.status, c.created_at, s.title AS service_title, uc.name AS client_name, up.name AS provider_name " +
      "FROM contracts c JOIN services s ON s.id = c.service_id JOIN users uc ON uc.id = c.client_id JOIN users up ON up.id = c.provider_id " +
      "ORDER BY c.created_at DESC, c.id DESC"
  );
  res.json({ contracts: rows.map(cleanContract) });
});

app.put("/api/admin/services/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const status = (req.body || {}).status;
  const s = await get("SELECT * FROM services WHERE id = ?", [id]);
  if (!s) return res.status(404).json({ error: "Serviço não encontrado." });
  if (!["approved", "pending", "removed"].includes(status)) return res.status(400).json({ error: "Status inválido." });
  await run("UPDATE services SET status = ? WHERE id = ?", [status, id]);
  res.json({ ok: true });
});

app.put("/api/admin/users/:id/suspend", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const suspended = (req.body || {}).suspended ? 1 : 0;
  if (id === req.user.id) return res.status(400).json({ error: "Você não pode suspender a sua própria conta." });
  const u = await get("SELECT * FROM users WHERE id = ?", [id]);
  if (!u) return res.status(404).json({ error: "Usuário não encontrado." });
  await run("UPDATE users SET suspended = ? WHERE id = ?", [suspended, id]);
  if (suspended) await run("DELETE FROM tokens WHERE user_id = ?", [id]);
  const user = await get("SELECT * FROM users WHERE id = ?", [id]);
  res.json({ user: cleanUser(user) });
});

// ==================== SERVIDOR HTTP ====================
const dist = path.join(__dirname, "dist");
app.use(express.static(dist));
app.get("/", (req, res) => res.sendFile(path.join(dist, "index.html")));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, "index.html")));

// Roteamento protegido
app.post("/api/logout", requireAuth, async (req, res) => {
  const token = req.headers.authorization;
  await run("DELETE FROM tokens WHERE token = ?", [token]);
  res.json({ ok: true });
});

let listening = false;
app.listen(PORT, () => {
  if (listening) return;
  listening = true;
  console.log("");
  console.log("====================================================");
  console.log(" Seu site está rodando.");
  console.log(" Abra no navegador:  http://localhost:" + PORT);
  console.log("====================================================");
});

initDB().catch((e) => {
  console.error("Erro ao preparar o banco:", e);
  process.exit(1);
});
