const app = document.getElementById('app');
const nav = document.getElementById('nav');

let state = { user: null };

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro');
  return data;
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function statusLabel(s) {
  return { pending: 'Pendente', confirmed: 'Confirmada', canceled: 'Cancelada' }[s] || s;
}

function renderNav() {
  if (state.user) {
    nav.innerHTML = `
      <span class="user">${esc(state.user.name)} (${state.user.role === 'organizer' ? 'Organizador' : 'Participante'})</span>
      <button id="logoutBtn">Sair</button>
    `;
    document.getElementById('logoutBtn').onclick = async () => {
      await api('/api/logout', { method: 'POST' });
      state.user = null;
      renderNav();
      location.hash = '#/events';
      route();
    };
  } else {
    nav.innerHTML = `
      <button onclick="location.hash='#/login'">Entrar</button>
      <button onclick="location.hash='#/register'">Criar conta</button>
    `;
  }
}

// ---------- Pages ----------

function pageAuthLogin() {
  app.innerHTML = `
    <h1>Entrar</h1>
    <div id="msg"></div>
    <form id="form">
      <label>E-mail</label>
      <input type="email" name="email" required />
      <label>Senha</label>
      <input type="password" name="password" required />
      <button type="submit">Entrar</button>
    </form>
  `;
  document.getElementById('form').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      const { user } = await api('/api/login', {
        method: 'POST',
        body: { email: f.email.value, password: f.password.value }
      });
      state.user = user;
      renderNav();
      location.hash = '#/events';
      route();
    } catch (err) {
      document.getElementById('msg').innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
  };
}

function pageAuthRegister() {
  app.innerHTML = `
    <h1>Criar conta</h1>
    <div id="msg"></div>
    <form id="form">
      <label>Nome</label>
      <input name="name" required />
      <label>E-mail</label>
      <input type="email" name="email" required />
      <label>Senha</label>
      <input type="password" name="password" required minlength="4" />
      <label>Tipo de conta</label>
      <select name="role" required>
        <option value="participant">Participante</option>
        <option value="organizer">Organizador</option>
      </select>
      <div class="hint">Escolha "Organizador" se você vai criar eventos.</div>
      <button type="submit">Criar conta</button>
    </form>
  `;
  document.getElementById('form').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      const { user } = await api('/api/register', {
        method: 'POST',
        body: {
          name: f.name.value,
          email: f.email.value,
          password: f.password.value,
          role: f.role.value
        }
      });
      state.user = user;
      renderNav();
      location.hash = user.role === 'organizer' ? '#/organizer' : '#/events';
      route();
    } catch (err) {
      document.getElementById('msg').innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
  };
}

async function pageEvents() {
  app.innerHTML = `<h1>Eventos disponíveis</h1><div id="list">Carregando...</div>`;
  try {
    const { events } = await api('/api/events');
    const list = document.getElementById('list');
    if (!events.length) {
      list.innerHTML = `<div class="empty">Nenhum evento cadastrado ainda.</div>`;
      return;
    }
    list.innerHTML = events.map(ev => {
      const full = ev.capacity > 0 && ev.registrations_count >= ev.capacity;
      const canceled = ev.canceled;
      let mainBtn = '';
      if (state.user?.role === 'participant' && !canceled) {
        mainBtn = full
          ? `<button disabled>Lotado</button>`
          : `<button data-action="register" data-id="${ev.id}">Inscrever-se</button>`;
      }
      return `
        <div class="card">
          ${canceled ? '<span class="badge canceled-event">Cancelado</span>' : ''}
          <h3>${esc(ev.title)}</h3>
          <div class="meta">
            🗓 ${fmtDate(ev.starts_at)} · 📍 ${esc(ev.location || 'Local a definir')} · Organizador: ${esc(ev.organizer_name)}
          </div>
          <div>${ev.registrations_count} inscrito(s)${ev.capacity > 0 ? ` de ${ev.capacity}` : ''}</div>
          ${ev.description ? `<div class="desc">${esc(ev.description)}</div>` : ''}
          <div class="actions">${mainBtn}</div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-action="register"]').forEach(btn => {
      btn.onclick = async () => {
        try {
          await api(`/api/events/${btn.dataset.id}/register`, { method: 'POST' });
          alert('Inscrição realizada com sucesso!');
          pageEvents();
        } catch (err) { alert(err.message); }
      };
    });
  } catch (err) {
    document.getElementById('list').innerHTML = `<div class="error">${esc(err.message)}</div>`;
  }
}

async function pageMyRegistrations() {
  app.innerHTML = `<h1>Minhas inscrições</h1><div id="list">Carregando...</div>`;
  try {
    const { registrations } = await api('/api/my-registrations');
    const list = document.getElementById('list');
    if (!registrations.length) {
      list.innerHTML = `<div class="empty">Você ainda não tem inscrições.</div>`;
      return;
    }
    list.innerHTML = registrations.map(r => {
      const canCancel = (r.status === 'pending') && !r.canceled;
      return `
        <div class="card">
          ${r.canceled ? '<span class="badge canceled-event">Evento cancelado</span>' : ''}
          <span class="badge ${r.status}">${statusLabel(r.status)}</span>
          <h3>${esc(r.title)}</h3>
          <div class="meta">🗓 ${fmtDate(r.starts_at)} · 📍 ${esc(r.location || 'Local a definir')}</div>
          ${r.description ? `<div class="desc">${esc(r.description)}</div>` : ''}
          <div class="actions">
            ${canCancel ? `<button class="danger" data-action="cancel" data-id="${r.registration_id}">Cancelar inscrição</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-action="cancel"]').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Cancelar esta inscrição?')) return;
        try {
          await api(`/api/registrations/${btn.dataset.id}`, { method: 'DELETE' });
          pageMyRegistrations();
        } catch (err) { alert(err.message); }
      };
    });
  } catch (err) {
    document.getElementById('list').innerHTML = `<div class="error">${esc(err.message)}</div>`;
  }
}

async function pageOrganizer() {
  app.innerHTML = `
    <h1>Painel do Organizador</h1>
    <div class="tabs">
      <button class="active" data-tab="events">Meus Eventos</button>
      <button data-tab="registrations">Todas as Inscrições</button>
    </div>
    <div id="content"><div class="empty">Carregando...</div></div>
  `;
  document.querySelectorAll('.tabs button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.tab === 'events') renderOrganizerEvents();
      else renderOrganizerRegistrations();
    };
  });
  renderOrganizerEvents();
}

async function renderOrganizerEvents() {
  const content = document.getElementById('content');
  content.innerHTML = `<button id="newEventBtn" style="margin-bottom:12px">+ Novo evento</button><div id="list"></div>`;
  document.getElementById('newEventBtn').onclick = () => showEventForm();
  const { events } = await api('/api/organizer/events');
  const list = document.getElementById('list');
  if (!events.length) {
    list.innerHTML = `<div class="empty">Você ainda não criou eventos.</div>`;
    return;
  }
  list.innerHTML = events.map(ev => `
    <div class="card">
      ${ev.canceled ? '<span class="badge canceled-event">Cancelado</span>' : ''}
      <h3>${esc(ev.title)}</h3>
      <div class="meta">🗓 ${fmtDate(ev.starts_at)} · 📍 ${esc(ev.location || 'Local a definir')}</div>
      <div>${ev.registrations_count} inscrito(s) · ${ev.confirmed_count} confirmado(s)${ev.capacity > 0 ? ` · capacidade ${ev.capacity}` : ''}</div>
      ${ev.description ? `<div class="desc">${esc(ev.description)}</div>` : ''}
      <div class="actions">
        <button data-action="edit" data-id="${ev.id}">Editar</button>
        ${!ev.canceled ? `<button class="danger" data-action="cancel" data-id="${ev.id}">Cancelar evento</button>` : ''}
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.onclick = () => {
      const ev = events.find(e => e.id == btn.dataset.id);
      showEventForm(ev);
    };
  });
  list.querySelectorAll('[data-action="cancel"]').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Cancelar este evento? Os inscritos continuarão listados.')) return;
      try {
        await api(`/api/events/${btn.dataset.id}`, { method: 'DELETE' });
        renderOrganizerEvents();
      } catch (err) { alert(err.message); }
    };
  });
}

function toLocalInput(s) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d)) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function showEventForm(ev) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <h2>${ev ? 'Editar evento' : 'Novo evento'}</h2>
    <div id="msg"></div>
    <form id="form">
      <label>Título</label>
      <input name="title" required value="${esc(ev?.title || '')}" />
      <label>Descrição</label>
      <textarea name="description">${esc(ev?.description || '')}</textarea>
      <label>Local</label>
      <input name="location" value="${esc(ev?.location || '')}" />
      <label>Data e hora</label>
      <input type="datetime-local" name="starts_at" required value="${toLocalInput(ev?.starts_at)}" />
      <label>Capacidade (0 = sem limite)</label>
      <input type="number" name="capacity" min="0" value="${ev?.capacity || 0}" />
      <div class="actions">
        <button type="submit">Salvar</button>
        <button type="button" class="secondary" id="cancelBtn">Voltar</button>
      </div>
    </form>
  `;
  document.getElementById('cancelBtn').onclick = renderOrganizerEvents;
  document.getElementById('form').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = {
      title: f.title.value,
      description: f.description.value,
      location: f.location.value,
      starts_at: new Date(f.starts_at.value).toISOString(),
      capacity: Number(f.capacity.value) || 0,
    };
    try {
      if (ev) await api(`/api/events/${ev.id}`, { method: 'PUT', body });
      else await api('/api/events', { method: 'POST', body });
      renderOrganizerEvents();
    } catch (err) {
      document.getElementById('msg').innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
  };
}

async function renderOrganizerRegistrations() {
  const content = document.getElementById('content');
  content.innerHTML = `<div class="empty">Carregando...</div>`;
  try {
    const { registrations } = await api('/api/organizer/registrations');
    if (!registrations.length) {
      content.innerHTML = `<div class="empty">Nenhuma inscrição ainda.</div>`;
      return;
    }
    content.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Evento</th><th>Data</th><th>Participante</th><th>E-mail</th><th>Status</th><th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${registrations.map(r => `
            <tr>
              <td>${esc(r.event_title)}</td>
              <td>${fmtDate(r.event_starts_at)}</td>
              <td>${esc(r.participant_name)}</td>
              <td>${esc(r.participant_email)}</td>
              <td><span class="badge ${r.status}">${statusLabel(r.status)}</span></td>
              <td>
                ${r.status === 'pending' ? `
                  <button class="success" data-status="confirmed" data-id="${r.registration_id}">Confirmar</button>
                  <button class="danger" data-status="canceled" data-id="${r.registration_id}">Cancelar</button>
                ` : r.status === 'confirmed' ? `
                  <button class="secondary" data-status="pending" data-id="${r.registration_id}">Reverter</button>
                ` : `
                  <button class="secondary" data-status="pending" data-id="${r.registration_id}">Reativar</button>
                `}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    content.querySelectorAll('button[data-status]').forEach(btn => {
      btn.onclick = async () => {
        try {
          await api(`/api/organizer/registrations/${btn.dataset.id}/status`, {
            method: 'POST',
            body: { status: btn.dataset.status }
          });
          renderOrganizerRegistrations();
        } catch (err) { alert(err.message); }
      };
    });
  } catch (err) {
    content.innerHTML = `<div class="error">${esc(err.message)}</div>`;
  }
}

// ---------- Router ----------

function route() {
  const hash = location.hash || '#/events';
  if (!state.user) {
    if (hash === '#/register') return pageAuthRegister();
    return pageAuthLogin();
  }
  if (state.user.role === 'participant') {
    if (hash === '#/my') return pageMyRegistrations();
    return pageEvents();
  }
  // organizer
  if (hash === '#/events') return pageEvents();
  return pageOrganizer();
}

window.addEventListener('hashchange', route);

async function init() {
  try {
    const { user } = await api('/api/me');
    state.user = user;
  } catch (_) {}
  renderNav();
  route();
}
init();
