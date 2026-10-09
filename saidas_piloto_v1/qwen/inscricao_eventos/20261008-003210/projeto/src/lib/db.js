// Banco de dados simples usando o localStorage do navegador.
// Tudo fica salvo no seu computador e continua lá mesmo fechando o site.
// Para que várias pessoas diferentes consigam usar, o site precisa ser
// publicado na internet (veja o README.md) para todos verem a mesma página.

const K = {
  users: 'portal.eventos.users',
  events: 'portal.eventos.eventos',
  insc: 'portal.eventos.inscricoes',
  session: 'portal.eventos.sessao'
};

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

export function getUsers() {
  return read(K.users, []);
}

export function getEvents() {
  return read(K.events, []);
}

export function getInscriptions() {
  return read(K.insc, []);
}

export function setUsers(u) { write(K.users, u); }
export function setEvents(e) { write(K.events, e); }
export function setInscriptions(i) { write(K.insc, i); }

export function getSession() {
  return read(K.session, null);
}

export function setSession(userId) {
  if (userId) {
    write(K.session, userId);
  } else {
    localStorage.removeItem(K.session);
  }
}

// --- Usuários ---

export function createUser({ name, email, password, role }) {
  const users = getUsers();
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { ok: false, error: 'Já existe uma conta com este e-mail.' };
  }
  const user = { id: 'u_' + Date.now() + Math.random().toString(16).slice(2, 7), name, email, password, role };
  users.push(user);
  setUsers(users);
  return { ok: true, user };
}

export function login(email, password) {
  const users = getUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return { ok: false, error: 'Conta não encontrada. Verifique o e-mail.' };
  if (user.password !== password) return { ok: false, error: 'Senha incorreta.' };
  setSession(user.id);
  return { ok: true, user };
}

export function getUserById(id) {
  return getUsers().find(u => u.id === id) || null;
}

// --- Eventos ---

export function createEvent(data) {
  const events = getEvents();
  const ev = {
    id: 'e_' + Date.now() + Math.random().toString(16).slice(2, 7),
    status: 'aberto',
    createdAt: Date.now(),
    ...data
  };
  events.unshift(ev);
  setEvents(events);
  return ev;
}

export function updateEvent(id, patch) {
  const events = getEvents();
  const idx = events.findIndex(e => e.id === id);
  if (idx === -1) return null;
  events[idx] = { ...events[idx], ...patch };
  setEvents(events);
  return events[idx];
}

export function setEventStatus(id, status) {
  return updateEvent(id, { status });
}

// --- Inscrições ---

export function addInscription({ eventId, userId, name, email, phone, note }) {
  const insc = getInscriptions();
  // Evita a mesma pessoa se inscrever duas vezes no mesmo evento
  const exists = insc.some(i => i.eventId === eventId && i.userId === userId);
  if (exists) return { ok: false, error: 'Você já está inscrito(a) neste evento.' };
  const item = {
    id: 'i_' + Date.now() + Math.random().toString(16).slice(2, 7),
    eventId, userId,
    name, email, phone: phone || '', note: note || '',
    status: 'pendente',
    createdAt: Date.now()
  };
  insc.push(item);
  setInscriptions(insc);
  return { ok: true, item };
}

export function cancelInscription(id) {
  setInscriptions(getInscriptions().filter(i => i.id !== id));
}

export function setInscriptionStatus(id, status) {
  const insc = getInscriptions();
  const idx = insc.findIndex(i => i.id === id);
  if (idx === -1) return null;
  insc[idx] = { ...insc[idx], status };
  setInscriptions(insc);
  return insc[idx];
}

export function getEventsForUser() {
  const insc = getInscriptions();
  const ids = new Set(insc.filter(i => i.status !== 'cancelado').map(i => i.eventId));
  return getEvents().filter(e => ids.has(e.id));
}

export function getInscriptionsForUser(userId) {
  return getInscriptions().filter(i => i.userId === userId);
}

// --- Utilidades de exibição ---

export function formatDate(s) {
  if (!s) return 'Data a definir';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function formatTime(s) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(s) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export const STATUS_EVENTO = {
  aberto: { label: 'Inscrições abertas', cls: 'badge--ok' },
  fechado: { label: 'Inscrições encerradas', cls: 'badge--warn' },
  cancelado: { label: 'Evento cancelado', cls: 'badge--danger' }
};

export const STATUS_INSCRICAO = {
  pendente: { label: 'Pendente', cls: 'badge--warn' },
  confirmada: { label: 'Confirmada', cls: 'badge--ok' },
  cancelada: { label: 'Cancelada', cls: 'badge--danger' }
};
