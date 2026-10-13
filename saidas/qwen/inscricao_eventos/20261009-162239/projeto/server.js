import express from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import morgan from "morgan";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(__dirname, "app");
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(APP_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "data.json");

fs.mkdirSync(DATA_DIR, { recursive: true });

const SECRET = process.env.JWT_SECRET || "portal-eventos-dev-secret-change-me";
const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json());
app.use(morgan("dev"));

const roles = {
  participant: "participante",
  organizer: "organizador"
};

// ---------- armazenamento ----------
function loadDB() {
  if (!fs.existsSync(DATA_FILE)) {
    const seed = {
      users: [],
      events: [],
      registrations: [],
      seed: {
        done: true,
        admin: {
          email: "admin@portal.com",
          name: "Administrador",
          pass: "admin123"
        }
      }
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveDB(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

let db = loadDB();
saveDB(db);

// ---------- seed inicial ----------
function seedAdmin() {
  const s = db.seed;
  if (!s || !s.done || s.admin) return;
  const hash = bcrypt.hashSync(s.admin.pass, 10);
  db.users.push({
    id: crypto.randomUUID(),
    name: s.admin.name,
    email: s.admin.email.toLowerCase(),
    passwordHash: hash,
    role: roles.organizer,
    createdAt: Date.now()
  });
  db.seed = { done: true, admin: null };
  saveDB(db);
}
seedAdmin();

// ---------- helpers ----------
function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt };
}

function publicEvent(e) {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location,
    date: e.date,
    time: e.time,
    capacity: e.capacity,
    status: e.status,
    createdBy: e.createdBy,
    createdAt: e.createdAt,
    spots: e.spots
  };
}

function publicReg(r) {
  return {
    id: r.id,
    eventId: r.eventId,
    email: r.email,
    name: r.name,
    status: r.status,
    createdAt: r.createdAt
  };
}

function computeSpots() {
  for (const e of db.events) {
    if (e.status === "cancelled") continue;
    const count = db.registrations.filter(
      (r) => r.eventId === e.id && r.status !== "cancelled"
    ).length;
    e.spots = Math.max(0, e.capacity - count);
  }
}

function sign(user) {
  return jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: "7d" });
}

function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Sessão não encontrada" });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db.users.find((u) => u.id === payload.id);
    if (!user) return res.status(401).json({ error: "Sessão inválida" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Sessão inválida" });
  }
}

function requireOrganizer(req, res, next) {
  if (req.user.role !== roles.organizer)
    return res.status(403).json({ error: "Acesso restrito" });
  next();
}

// ---------- rotas ----------
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: "Preencha nome, email e senha" });
  if (password.length < 4)
    return res.status(400).json({ error: "A senha deve ter pelo menos 4 caracteres" });
  const emailNorm = email.toLowerCase().trim();
  if (db.users.some((u) => u.email === emailNorm))
    return res.status(409).json({ error: "Já existe uma conta com este email" });
  const hash = await bcrypt.hash(password, 10);
  const user = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: emailNorm,
    passwordHash: hash,
    role: roles.participant,
    createdAt: Date.now()
  };
  db.users.push(user);
  saveDB(db);
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "Preencha email e senha" });
  const emailNorm = email.toLowerCase().trim();
  const user = db.users.find((u) => u.email === emailNorm);
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return res.status(401).json({ error: "Email ou senha incorretos" });
  res.json({ token: sign(user), user: publicUser(user) });
});

app.get("/api/auth/me", auth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Eventos
app.get("/api/events", auth, (req, res) => {
  const list = db.events
    .filter((e) => e.status === "active")
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(publicEvent);
  res.json({ events: list });
});

app.get("/api/events/:id", auth, (req, res) => {
  const e = db.events.find((x) => x.id === req.params.id);
  if (!e) return res.status(404).json({ error: "Evento não encontrado" });
  res.json({ event: publicEvent(e) });
});

app.post("/api/events", auth, requireOrganizer, (req, res) => {
  const { title, description, location, date, time, capacity } = req.body || {};
  if (!title || !date || !time)
    return res.status(400).json({ error: "Informe título, data e horário" });
  const cap = Math.max(1, parseInt(capacity, 10) || 1);
  const e = {
    id: crypto.randomUUID(),
    title: title.trim(),
    description: (description || "").trim(),
    location: (location || "").trim(),
    date,
    time,
    capacity: cap,
    status: "active",
    createdBy: req.user.id,
    createdAt: Date.now(),
    spots: cap
  };
  db.events.push(e);
  saveDB(db);
  res.status(201).json({ event: publicEvent(e) });
});

app.put("/api/events/:id", auth, requireOrganizer, (req, res) => {
  const e = db.events.find((x) => x.id === req.params.id);
  if (!e) return res.status(404).json({ error: "Evento não encontrado" });
  const { title, description, location, date, time, capacity } = req.body || {};
  if (title !== undefined) e.title = title.trim();
  if (description !== undefined) e.description = description.trim();
  if (location !== undefined) e.location = location.trim();
  if (date !== undefined) e.date = date;
  if (time !== undefined) e.time = time;
  if (capacity !== undefined) e.capacity = Math.max(1, parseInt(capacity, 10) || 1);
  computeSpots();
  saveDB(db);
  res.json({ event: publicEvent(e) });
});

app.delete("/api/events/:id", auth, requireOrganizer, (req, res) => {
  const e = db.events.find((x) => x.id === req.params.id);
  if (!e) return res.status(404).json({ error: "Evento não encontrado" });
  e.status = "cancelled";
  for (const r of db.registrations) {
    if (r.eventId === e.id && r.status === "pending") r.status = "cancelled";
  }
  computeSpots();
  saveDB(db);
  res.json({ event: publicEvent(e) });
});

// Inscrições
function registerToEvent(req, res) {
  const e = db.events.find((x) => x.id === req.params.id);
  if (!e) return res.status(404).json({ error: "Evento não encontrado" });
  if (e.status !== "active")
    return res.status(400).json({ error: "Este evento não está disponível para inscrição" });
  const existing = db.registrations.find(
    (r) => r.eventId === e.id && r.email === req.user.email && r.status !== "cancelled"
  );
  if (existing) return res.status(409).json({ error: "Você já está inscrito neste evento" });
  if (e.spots <= 0)
    return res.status(400).json({ error: "Não há vagas disponíveis neste evento" });
  const r = {
    id: crypto.randomUUID(),
    eventId: e.id,
    email: req.user.email,
    name: req.user.name,
    status: "pending",
    createdAt: Date.now()
  };
  db.registrations.push(r);
  computeSpots();
  saveDB(db);
  res.status(201).json({ registration: publicReg(r) });
}

app.post("/api/events/:id/register", auth, (req, res) => registerToEvent(req, res));

app.post("/api/registrations/:id/cancel", auth, (req, res) => {
  const r = db.registrations.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: "Inscrição não encontrada" });
  if (r.email !== req.user.email && req.user.role !== roles.organizer)
    return res.status(403).json({ error: "Você não pode cancelar esta inscrição" });
  r.status = "cancelled";
  computeSpots();
  saveDB(db);
  res.json({ registration: publicReg(r) });
});

app.get("/api/my-registrations", auth, (req, res) => {
  const list = db.registrations
    .filter((r) => r.email === req.user.email)
    .map((r) => {
      const e = db.events.find((x) => x.id === r.eventId);
      return {
        ...publicReg(r),
        event: e ? publicEvent(e) : null
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json({ registrations: list });
});

// Painel do organizador
app.get("/api/organizer/events", auth, requireOrganizer, (req, res) => {
  const list = db.events
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(publicEvent);
  res.json({ events: list });
});

app.get("/api/organizer/registrations", auth, requireOrganizer, (req, res) => {
  const list = db.registrations
    .map((r) => {
      const e = db.events.find((x) => x.id === r.eventId);
      return { ...publicReg(r), event: e ? publicEvent(e) : null };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json({ registrations: list });
});

app.get("/api/organizer/registrations/:id", auth, requireOrganizer, (req, res) => {
  const r = db.registrations.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: "Inscrição não encontrada" });
  const e = db.events.find((x) => x.id === r.eventId);
  res.json({ registration: { ...publicReg(r), event: e ? publicEvent(e) : null } });
});

app.post("/api/organizer/registrations/:id/confirm", auth, requireOrganizer, (req, res) => {
  const r = db.registrations.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: "Inscrição não encontrada" });
  if (r.status === "cancelled")
    return res.status(400).json({ error: "Inscrição já cancelada" });
  r.status = "confirmed";
  saveDB(db);
  res.json({ registration: publicReg(r) });
});

app.post("/api/organizer/registrations/:id/cancel", auth, requireOrganizer, (req, res) => {
  const r = db.registrations.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: "Inscrição não encontrada" });
  r.status = "cancelled";
  computeSpots();
  saveDB(db);
  res.json({ registration: publicReg(r) });
});

// ---------- dados estáticos ----------
app.use(express.static(PUBLIC_DIR));

app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Portal de eventos rodando em http://localhost:${PORT}`);
});
