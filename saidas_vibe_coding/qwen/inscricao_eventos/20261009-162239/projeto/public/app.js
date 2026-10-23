// ---------- estado ----------
const state = {
  token: localStorage.getItem("pe_token") || null,
  user: JSON.parse(localStorage.getItem("pe_user") || "null"),
  route: location.hash.replace(/^#/, "") || "/",
  view: null,
  loading: false,
  error: null,
  success: null,
  data: null,
  modal: null
};

// ---------- API ----------
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers.Authorization = "Bearer " + state.token;
  const res = await fetch(path, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401 && path !== "/api/auth/login") {
      logout();
    }
    throw new Error((data && data.error) || "Erro ao comunicar com o servidor");
  }
  return data;
}

// ---------- sessão ----------
function setSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem("pe_token", token);
  localStorage.setItem("pe_user", JSON.stringify(user));
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("pe_token");
  localStorage.removeItem("pe_user");
  navigate("/");
}

// ---------- helpers ----------
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function fmtTime(t) {
  if (!t) return "";
  return t;
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function statusTag(s) {
  const map = {
    pending: "Pendente",
    confirmed: "Confirmado",
    cancelled: "Cancelado",
    active: "Ativo"
  };
  return `<span class="tag ${s}">${map[s] || s}</span>`;
}

function navigate(route) {
  if (location.hash === "#" + route) {
    render();
  } else {
    location.hash = route;
  }
}

function render() {
  const app = document.getElementById("app");
  app.innerHTML = "";
  const frag = document.createDocumentFragment();

  if (state.user) {
    frag.appendChild(renderHeader());
    frag.appendChild(renderMain());
  } else {
    frag.appendChild(renderAuth());
  }

  app.appendChild(frag);
  if (state.modal) frag.appendChild(renderModal());
}

function renderHeader() {
  const el = document.createElement("header");
  const isOrganizer = state.user.role === "organizador";
  const links = [
    { route: "/events", label: "Eventos" },
    { route: "/my-registrations", label: "Minhas inscrições" }
  ];
  if (isOrganizer) links.push({ route: "/admin", label: "Painel do organizador" });

  el.innerHTML = `
    <div class="brand"><span class="logo">&#128197;</span> Portal de Eventos</div>
    <nav class="nav">
      ${links
        .map(
          (l) =>
            `<a href="#${l.route}" class="${state.route === l.route ? "active" : ""}">${l.label}</a>`
        )
        .join("")}
      <div class="user-chip">
        <div>
          <div class="name">${escapeHtml(state.user.name)}</div>
          <div class="role">${state.user.role}</div>
        </div>
        <button class="btn ghost small" onclick="logout()">Sair</button>
      </div>
    </nav>
  `;
  return el;
}

function renderMain() {
  const el = document.createElement("div");
  const route = state.route;

  if (state.loading) {
    el.innerHTML = `<div class="empty">Carregando...</div>`;
    return el;
  }

  if (state.error) {
    el.innerHTML = `<div class="alert error">${escapeHtml(state.error)}</div>`;
    return el;
  }

  if (state.success) {
    el.innerHTML = `<div class="alert success">${escapeHtml(state.success)}</div>`;
  }

  if (route === "/events") {
    return renderEventsList();
  }
  if (route.startsWith("/events/")) {
    return renderEventDetail();
  }
  if (route === "/my-registrations") {
    return renderMyRegistrations();
  }
  if (route === "/admin") {
    return renderAdmin();
  }

  return el;
}

// ---------- AUTENTICAÇÃO ----------
function renderAuth() {
  const el = document.createElement("div");
  el.className = "auth-wrap";
  const mode = state.view === "register" ? "register" : "login";
  el.innerHTML = `
    <div class="card auth-card">
      <h1>Portal de Eventos</h1>
      <p class="sub">Entre com sua conta para ver os eventos e se inscrever.</p>
      <div class="auth-tabs">
        <button class="${mode === "login" ? "active" : ""}" onclick="setAuth('login')">Entrar</button>
        <button class="${mode === "register" ? "active" : ""}" onclick="setAuth('register')">Criar conta</button>
      </div>
      ${
        state.error
          ? `<div class="alert error">${escapeHtml(state.error)}</div>`
          : ""
      }
      <form class="form" onsubmit="submitAuth(event)">
        ${
          mode === "register"
            ? `<div class="field"><label>Nome</label><input name="name" required placeholder="Seu nome" /></div>`
            : ""
        }
        <div class="field"><label>Email</label><input type="email" name="email" required placeholder="voce@email.com" /></div>
        <div class="field"><label>Senha</label><input type="password" name="password" required placeholder="Sua senha" /></div>
        <button class="btn block" type="submit" ${state.loading ? "disabled" : ""}>
          ${state.loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
        </button>
      </form>
    </div>
  `;
  return el;
}

function setAuth(mode) {
  state.view = mode;
  state.error = null;
  render();
}

async function submitAuth(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const body = {
    email: fd.get("email"),
    password: fd.get("password")
  };
  if (state.view === "register") body.name = fd.get("name");

  state.loading = true;
  state.error = null;
  render();
  try {
    const path = state.view === "register" ? "/api/auth/register" : "/api/auth/login";
    const data = await api(path, { method: "POST", body });
    setSession(data.token, data.user);
    state.success = "Bem-vindo(a), " + state.user.name + "!";
    navigate(state.user.role === "organizador" ? "/admin" : "/events");
  } catch (err) {
    state.error = err.message;
    render();
  } finally {
    state.loading = false;
  }
}

// ---------- LISTA DE EVENTOS ----------
function renderEventsList() {
  const el = document.createElement("div");
  const events = (state.data && state.data.events) || [];
  el.innerHTML = `
    <div class="section-title"><h2>Eventos disponíveis</h2></div>
    ${
      events.length
        ? `<div class="grid">
            ${events.map(eventCard).join("")}
          </div>`
        : `<div class="empty">Nenhum evento disponível no momento.</div>`
    }
  `;
  return el;
}

function eventCard(e) {
  const full = e.status === "active" && e.spots <= 0;
  return `
    <div class="card event-card">
      <div class="date">
        <span>&#128197; ${fmtDate(e.date)}</span>
        <span>&#128336; ${fmtTime(e.time)}</span>
      </div>
      <h3>${escapeHtml(e.title)}</h3>
      ${e.location ? `<p class="hint">&#128205; ${escapeHtml(e.location)}</p>` : ""}
      ${e.description ? `<p>${escapeHtml(e.description)}</p>` : ""}
      <div class="meta">
        <span class="badge ${full ? "full" : "open"}">${full ? "Esgotado" : e.spots + " vagas"}</span>
        <a class="btn small" href="#/events/${e.id}">Ver detalhes</a>
      </div>
    </div>
  `;
}

// ---------- DETALHE DO EVENTO ----------
async function renderEventDetail() {
  const id = state.route.split("/")[2];
  const el = document.createElement("div");
  const e = state.data && state.data.event;
  if (!e) {
    el.innerHTML = `<div class="empty">Evento não encontrado.</div>`;
    return el;
  }
  const full = e.status === "active" && e.spots <= 0;
  el.innerHTML = `
    <div class="card">
      <div class="date muted" style="margin-bottom:10px">
        <span>&#128197; ${fmtDate(e.date)}</span>
        <span>&#128336; ${fmtTime(e.time)}</span>
        ${e.location ? `<span>&#128205; ${escapeHtml(e.location)}</span>` : ""}
      </div>
      <h2 style="margin-bottom:12px">${escapeHtml(e.title)}</h2>
      ${e.description ? `<p style="margin-bottom:16px;color:var(--muted)">${escapeHtml(e.description)}</p>` : ""}
      <div class="meta" style="margin-bottom:16px">
        <span class="badge ${full ? "full" : "open"}">${full ? "Esgotado" : e.spots + " vagas"}</span>
      </div>
      <div class="actions">
        ${
          full
            ? `<button class="btn" disabled>Evento esgotado</button>`
            : `<button class="btn success" onclick="registerToEvent('${e.id}')">Inscrever-se</button>`
        }
        <a class="btn ghost" href="#/events">Voltar</a>
      </div>
    </div>
  `;
  return el;
}

async function registerToEvent(id) {
  state.loading = true;
  state.error = null;
  state.success = null;
  render();
  try {
    await api("/api/events/" + id + "/register", { method: "POST" });
    state.success = "Inscrição realizada! Você pode ver e cancelar em 'Minhas inscrições'.";
    await loadEventDetail(id);
    navigate("/my-registrations");
  } catch (err) {
    state.error = err.message;
    render();
  } finally {
    state.loading = false;
  }
}

// ---------- MINHAS INSCRIÇÕES ----------
function renderMyRegistrations() {
  const el = document.createElement("div");
  const regs = (state.data && state.data.registrations) || [];
  el.innerHTML = `
    <div class="section-title"><h2>Minhas inscrições</h2></div>
    ${
      regs.length
        ? `<div class="table-wrap"><table>
            <thead><tr><th>Evento</th><th>Data</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${regs.map(regRow).join("")}
            </tbody>
          </table></div>`
        : `<div class="empty">Você ainda não se inscreveu em nenhum evento.</div>`
    }
  `;
  return el;
}

function regRow(r) {
  const e = r.event;
  return `
    <tr>
      <td>${escapeHtml(e ? e.title : "—")}</td>
      <td>${e ? fmtDate(e.date) + " " + fmtTime(e.time) : ""}</td>
      <td>${statusTag(r.status)}</td>
      <td>
        ${
          r.status === "cancelled"
            ? `<span class="muted">—</span>`
            : `<button class="btn danger small" onclick="cancelMyReg('${r.id}')">Cancelar</button>`
        }
      </td>
    </tr>
  `;
}

async function cancelMyReg(id) {
  if (!confirm("Tem certeza que deseja cancelar esta inscrição?")) return;
  state.loading = true;
  state.error = null;
  state.success = null;
  render();
  try {
    await api("/api/registrations/" + id + "/cancel", { method: "POST" });
    state.success = "Inscrição cancelada.";
    await loadMyRegistrations();
  } catch (err) {
    state.error = err.message;
    render();
  } finally {
    state.loading = false;
  }
}

// ---------- PAINEL DO ORGANIZADOR ----------
function renderAdmin() {
  const el = document.createElement("div");
  const events = (state.data && state.data.events) || [];
  const regs = (state.data && state.data.registrations) || [];
  el.innerHTML = `
    <div class="section-title">
      <h2>Eventos</h2>
      <button class="btn" onclick="openEventModal()">+ Novo evento</button>
    </div>
    ${
      events.length
        ? `<div class="table-wrap"><table>
            <thead><tr><th>Título</th><th>Data</th><th>Vagas</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${events.map(adminEventRow).join("")}
            </tbody>
          </table></div>`
        : `<div class="empty">Nenhum evento criado. Crie o primeiro.</div>`
    }

    <div class="section-title"><h2>Todas as inscrições</h2></div>
    ${
      regs.length
        ? `<div class="table-wrap"><table>
            <thead><tr><th>Participante</th><th>Evento</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${regs.map(adminRegRow).join("")}
            </tbody>
          </table></div>`
        : `<div class="empty">Nenhuma inscrição ainda.</div>`
    }
  `;
  return el;
}

function adminEventRow(e) {
  return `
    <tr>
      <td>${escapeHtml(e.title)}</td>
      <td>${fmtDate(e.date)} ${fmtTime(e.time)}</td>
      <td>${e.spots}/${e.capacity}</td>
      <td>${statusTag(e.status)}</td>
      <td>
        <div class="actions">
          <button class="btn small" onclick="openEventModal('${e.id}')">Editar</button>
          ${
            e.status === "active"
              ? `<button class="btn danger small" onclick="cancelEvent('${e.id}')">Cancelar</button>`
              : ""
          }
        </div>
      </td>
    </tr>
  `;
}

function adminRegRow(r) {
  const e = r.event;
  return `
    <tr>
      <td>${escapeHtml(r.name)}<br><span class="muted" style="font-size:0.8rem">${escapeHtml(r.email)}</span></td>
      <td>${escapeHtml(e ? e.title : "—")}</td>
      <td>${statusTag(r.status)}</td>
      <td>
        <div class="actions">
          ${
            r.status === "pending"
              ? `<button class="btn success small" onclick="confirmReg('${r.id}')">Confirmar</button>`
              : ""
          }
          ${
            r.status !== "cancelled"
              ? `<button class="btn danger small" onclick="cancelReg('${r.id}')">Cancelar</button>`
              : ""
          }
        </div>
      </td>
    </tr>
  `;
}

// ---------- MODAL DE EVENTO ----------
function openEventModal(id) {
  const events = (state.data && state.data.events) || [];
  const e = id ? events.find((x) => x.id === id) : null;
  state.modal = {
    id: id || null,
    title: e ? e.title : "",
    description: e ? e.description : "",
    location: e ? e.location : "",
    date: e ? e.date : "",
    time: e ? e.time : "",
    capacity: e ? e.capacity : "10"
  };
  render();
}

function closeModal() {
  state.modal = null;
  render();
}

function renderModal() {
  const m = state.modal;
  const el = document.createElement("div");
  el.className = "modal-backdrop";
  el.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <h3>${m.id ? "Editar evento" : "Novo evento"}</h3>
      <form class="form" onsubmit="saveEvent(event)">
        <div class="field"><label>Título</label><input name="title" required value="${escapeHtml(m.title)}" /></div>
        <div class="field"><label>Descrição</label><textarea name="description" placeholder="Detalhes do evento">${escapeHtml(m.description)}</textarea></div>
        <div class="field"><label>Local</label><input name="location" value="${escapeHtml(m.location)}" /></div>
        <div class="field"><label>Data</label><input type="date" name="date" required value="${escapeHtml(m.date)}" /></div>
        <div class="field"><label>Horário</label><input type="time" name="time" required value="${escapeHtml(m.time)}" /></div>
        <div class="field"><label>Vagas (capacidade)</label><input type="number" name="capacity" min="1" required value="${escapeHtml(m.capacity)}" /></div>
        <div class="actions">
          <button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button>
          <button type="submit" class="btn" ${state.loading ? "disabled" : ""}>Salvar</button>
        </div>
      </form>
    </div>
  `;
  el.addEventListener("click", closeModal);
  return el;
}

async function saveEvent(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = {
    title: fd.get("title"),
    description: fd.get("description"),
    location: fd.get("location"),
    date: fd.get("date"),
    time: fd.get("time"),
    capacity: fd.get("capacity")
  };
  state.loading = true;
  state.error = null;
  render();
  try {
    const id = state.modal.id;
    if (id) {
      await api("/api/events/" + id, { method: "PUT", body });
    } else {
      await api("/api/events", { method: "POST", body });
    }
    state.modal = null;
    state.success = "Evento salvo.";
    await loadAdmin();
  } catch (err) {
    state.error = err.message;
    render();
  } finally {
    state.loading = false;
  }
}

async function cancelEvent(id) {
  if (!confirm("Cancelar este evento? As inscrições pendentes serão canceladas.")) return;
  state.loading = true;
  state.error = null;
  render();
  try {
    await api("/api/events/" + id, { method: "DELETE" });
    state.success = "Evento cancelado.";
    await loadAdmin();
  } catch (err) {
    state.error = err.message;
    render();
  } finally {
    state.loading = false;
  }
}

async function confirmReg(id) {
  try {
    await api("/api/organizer/registrations/" + id + "/confirm", { method: "POST" });
    state.success = "Presença confirmada.";
    await loadAdmin();
  } catch (err) {
    state.error = err.message;
    render();
  }
}

async function cancelReg(id) {
  if (!confirm("Cancelar esta inscrição?")) return;
  try {
    await api("/api/organizer/registrations/" + id + "/cancel", { method: "POST" });
    state.success = "Inscrição cancelada.";
    await loadAdmin();
  } catch (err) {
    state.error = err.message;
    render();
  }
}

// ---------- carregamento por rota ----------
async function loadRoute() {
  const route = state.route;
  state.error = null;
  state.success = null;
  state.data = null;
  state.loading = true;
  state.modal = null;
  render();
  try {
    if (!state.user) {
      state.loading = false;
      return;
    }
    if (route === "/events") {
      state.data = await api("/api/events");
    } else if (route.startsWith("/events/")) {
      const id = route.split("/")[2];
      state.data = await api("/api/events/" + id);
    } else if (route === "/my-registrations") {
      state.data = await api("/api/my-registrations");
    } else if (route === "/admin") {
      const [events, regs] = await Promise.all([
        api("/api/organizer/events"),
        api("/api/organizer/registrations")
      ]);
      state.data = { events: events.events, registrations: regs.registrations };
    } else {
      // rota padrão
      navigate(state.user.role === "organizador" ? "/admin" : "/events");
      return;
    }
  } catch (err) {
    state.error = err.message;
  } finally {
    state.loading = false;
    render();
  }
}

function loadEventDetail(id) {
  return api("/api/events/" + id);
}

function loadMyRegistrations() {
  return api("/api/my-registrations").then((d) => {
    state.data = d;
    render();
  });
}

function loadAdmin() {
  return Promise.all([
    api("/api/organizer/events"),
    api("/api/organizer/registrations")
  ]).then(([events, regs]) => {
    state.data = { events: events.events, registrations: regs.registrations };
    render();
  });
}

// ---------- bootstrap ----------
window.addEventListener("hashchange", () => {
  state.route = location.hash.replace(/^#/, "") || "/";
  loadRoute();
});

window.addEventListener("DOMContentLoaded", async () => {
  state.route = location.hash.replace(/^#/, "") || "/";
  if (state.token) {
    try {
      const data = await api("/api/auth/me");
      state.user = data.user;
    } catch {
      state.token = null;
      state.user = null;
    }
  }
  if (!state.user) {
    state.route = "/";
    state.view = "login";
    render();
  } else {
    if (state.route === "/") {
      state.route = state.user.role === "organizador" ? "/admin" : "/events";
    }
    loadRoute();
  }
});

// funções expostas para o HTML
window.logout = logout;
window.setAuth = setAuth;
window.submitAuth = submitAuth;
window.registerToEvent = registerToEvent;
window.cancelMyReg = cancelMyReg;
window.openEventModal = openEventModal;
window.closeModal = closeModal;
window.saveEvent = saveEvent;
window.cancelEvent = cancelEvent;
window.confirmReg = confirmReg;
window.cancelReg = cancelReg;
