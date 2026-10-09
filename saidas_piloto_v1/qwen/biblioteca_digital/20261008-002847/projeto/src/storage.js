// Camada de persistência.
// Tudo fica salvo no localStorage do navegador, então continua existindo
// mesmo se você fechar e abrir o site de novo. Não usamos servidor externo.

const USERS_KEY = "bib_users_v1";
const ITEMS_KEY = "bib_items_v1";
const LOANS_KEY = "bib_loans_v1";
const SESSION_KEY = "bib_session_v1";
const SEED_FLAG = "bib_seeded_v1";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------- helpers ----------
export function uid(prefix = "id") {
  return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}

export function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function emailFromName(name) {
  const base = (name || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (!parts.length) return "leitor" + Math.floor(Math.random() * 1000);
  return parts.slice(0, 2).join(".");
}

// ---------- sessão ----------
export function getSession() {
  return read(SESSION_KEY, null);
}
export function setSession(session) {
  if (session) write(SESSION_KEY, session);
  else localStorage.removeItem(SESSION_KEY);
}

// ---------- usuários ----------
function loadUsers() {
  let users = read(USERS_KEY, []);
  if (!Array.isArray(users)) users = [];
  return users;
}
function saveUsers(users) {
  write(USERS_KEY, users);
}

export function getUsers() {
  return loadUsers();
}

// Conta inicial do bibliotecário para não depender de cadastro manual.
const BIB_SEED = {
  id: "user_bibliotecario",
  name: "Bibliotecário",
  email: "bibliotecario@biblioteca.local",
  password: "biblioteca123",
  role: "admin",
  createdAt: new Date().toISOString()
};

export function ensureSeed() {
  if (localStorage.getItem(SEED_FLAG)) return;
  const users = loadUsers();
  if (!users.some((u) => u.email === BIB_SEED.email)) {
    users.push(BIB_SEED);
    saveUsers(users);
  }
  // Alguns itens de exemplo para o acervo não ficar vazio.
  const items = read(ITEMS_KEY, []);
  if (!Array.isArray(items) || items.length === 0) {
    const now = new Date().toISOString();
    const sample = [
      { id: uid("item"), title: "Dom Casmurro", author: "Machado de Assis", category: "Romance", available: 1, borrowed: 0, createdAt: now, updatedAt: now },
      { id: uid("item"), title: "A Pequena Sereia", author: "Hans Christian Andersen", category: "Infantil", available: 2, borrowed: 0, createdAt: now, updatedAt: now },
      { id: uid("item"), title: "O Pequeno Príncipe", author: "Antoine de Saint-Exupéry", category: "Infantil", available: 1, borrowed: 0, createdAt: now, updatedAt: now },
      { id: uid("item"), title: "Cem Anos de Solidão", author: "Gabriel García Márquez", category: "Romance", available: 1, borrowed: 0, createdAt: now, updatedAt: now }
    ];
    write(ITEMS_KEY, sample);
  }
  localStorage.setItem(SEED_FLAG, "1");
}

export function findByEmail(email, password) {
  const users = loadUsers();
  return users.find((u) => u.email === normalizeEmail(email) && u.password === password) || null;
}

export function createUser({ name, role = "reader" }) {
  const users = loadUsers();
  const base = emailFromName(name);
  let email = base + "@biblioteca.local";
  let n = 2;
  while (users.some((u) => u.email === email)) {
    email = base + "." + n + "@biblioteca.local";
    n++;
  }
  // Senha provisória simples e previsível para o usuário novo.
  const password = base.split(".")[0] + "123";
  const user = {
    id: uid("user"),
    name: (name || "").trim(),
    email,
    password,
    role,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  saveUsers(users);
  return user;
}

export function updateUserPassword(userId, newPassword) {
  const users = loadUsers();
  const u = users.find((x) => x.id === userId);
  if (!u) return null;
  u.password = newPassword;
  saveUsers(users);
  return u;
}

// ---------- itens ----------
function loadItems() {
  let items = read(ITEMS_KEY, []);
  if (!Array.isArray(items)) items = [];
  return items;
}
function saveItems(items) {
  write(ITEMS_KEY, items);
}

export function getItems() {
  return loadItems();
}

export function getItem(id) {
  return loadItems().find((i) => i.id === id) || null;
}

export function createItem(data) {
  const items = loadItems();
  const now = new Date().toISOString();
  const item = {
    id: uid("item"),
    title: (data.title || "").trim(),
    author: (data.author || "").trim(),
    category: (data.category || "").trim() || "Sem categoria",
    available: data.available !== undefined ? data.available : 1,
    borrowed: 0,
    createdAt: now,
    updatedAt: now
  };
  items.unshift(item);
  saveItems(items);
  return item;
}

export function updateItem(id, data) {
  const items = loadItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const current = items[idx];
  const updated = {
    ...current,
    title: (data.title ?? current.title).trim(),
    author: (data.author ?? current.author).trim(),
    category: (data.category ?? current.category).trim() || "Sem categoria",
    updatedAt: new Date().toISOString()
  };
  items[idx] = updated;
  saveItems(items);
  return updated;
}

export function deleteItem(id) {
  let items = loadItems();
  // Só remove se não houver empréstimo ativo.
  const loans = loadLoans();
  const active = loans.find((l) => l.itemId === id && l.status === "active");
  if (active) return { ok: false, error: "Este item está emprestado e não pode ser removido." };
  items = items.filter((i) => i.id !== id);
  saveItems(items);
  return { ok: true };
}

export function adjustItemAvailability(id, delta) {
  const items = loadItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const it = items[idx];
  const available = Math.max(0, (it.available || 0) + delta);
  it.available = available;
  it.borrowed = it.borrowed - delta; // empréstimos ativos
  it.updatedAt = new Date().toISOString();
  saveItems(items);
  return it;
}

// ---------- empréstimos ----------
function loadLoans() {
  let loans = read(LOANS_KEY, []);
  if (!Array.isArray(loans)) loans = [];
  return loans;
}
function saveLoans(loans) {
  write(LOANS_KEY, loans);
}

const BORROW_DAYS = 14;

export function getLoans() {
  return loadLoans();
}

export function getLoanById(id) {
  return loadLoans().find((l) => l.id === id) || null;
}

export function getActiveLoans() {
  return loadLoans().filter((l) => l.status === "active");
}

export function getActiveLoanByUser(userId) {
  return loadLoans().find((l) => l.userId === userId && l.status === "active") || null;
}

export function getAllLoansByUser(userId) {
  return loadLoans()
    .filter((l) => l.userId === userId)
    .sort((a, b) => (a.borrowedAt < b.borrowedAt ? 1 : -1));
}

export function getAllLoansSorted() {
  return loadLoans().sort((a, b) => (a.borrowedAt < b.borrowedAt ? 1 : -1));
}

export function createLoan({ userId, itemId }) {
  const loans = loadLoans();
  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + BORROW_DAYS);
  const loan = {
    id: uid("loan"),
    userId,
    itemId,
    borrowedAt: now.toISOString(),
    dueAt: dueDate.toISOString(),
    returnedAt: null,
    status: "active"
  };
  loans.unshift(loan);
  saveLoans(loans);
  return loan;
}

export function returnLoan(loanId) {
  const loans = loadLoans();
  const idx = loans.findIndex((l) => l.id === loanId);
  if (idx === -1) return null;
  const loan = loans[idx];
  if (loan.status !== "active") return loan;
  loan.status = "returned";
  loan.returnedAt = new Date().toISOString();
  saveLoans(loans);
  return loan;
}

// ---------- status e regras ----------
export function isOverdue(loan) {
  return loan.status === "active" && new Date(loan.dueAt).getTime() < Date.now();
}

export function userIsOverdue(userId) {
  const loans = loadLoans().filter((l) => l.userId === userId && l.status === "active");
  return loans.some(isOverdue);
}

// Bloqueio: se o usuário tem empréstimo em atraso, não pode pegar mais.
export function userIsBlocked(userId) {
  return userIsOverdue(userId);
}

export function loanIsBlocked(loan) {
  return isOverdue(loan);
}

export function canBorrowItem(userId, itemId) {
  const item = getItem(itemId);
  if (!item) return { ok: false, error: "Item não encontrado." };
  if (userIsBlocked(userId)) {
    return { ok: false, error: "Você está com empréstimo em atraso e não pode pegar mais itens." };
  }
  if ((item.available || 0) <= 0) {
    return { ok: false, error: "Todos os exemplares deste item estão emprestados." };
  }
  const existing = getActiveLoanByUser(userId);
  if (existing && existing.itemId === itemId) {
    return { ok: false, error: "Você já tem este item emprestado." };
  }
  return { ok: true };
}

export function borrowItem(userId, itemId) {
  const check = canBorrowItem(userId, itemId);
  if (!check.ok) return check;
  const loan = createLoan({ userId, itemId });
  adjustItemAvailability(itemId, -1);
  return { ok: true, loan };
}

export function returnItem(loanId, itemId) {
  const loan = getLoanById(loanId);
  if (!loan) return { ok: false, error: "Empréstimo não encontrado." };
  if (loan.status !== "active") return { ok: false, error: "Este empréstimo já foi devolvido." };
  returnLoan(loanId);
  adjustItemAvailability(itemId, +1);
  return { ok: true, loan: getLoanById(loanId) };
}
```

```
