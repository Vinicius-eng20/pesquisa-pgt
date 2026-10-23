// ===== Estado =====
const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  view: 'services', // services, mybookings, owner
  selectedService: null,
  selectedDay: null,
  selectedTime: null,
};

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const WEEKDAYS_FULL = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const STATUS_LABEL = { pending: 'Pendente', confirmed: 'Confirmado', rejected: 'Recusado', cancelled: 'Cancelado' };

// ===== API =====
async function api(path, opts = {}) {
  opts.headers = opts.headers || {};
  if (state.token) opts.headers['Authorization'] = 'Bearer ' + state.token;
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch('/api' + path, opts);
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const msg = (data && data.error) ? data.error : 'Erro inesperado. Tente novamente.';
    throw new Error(msg);
  }
  return data;
}

function fmtDate(dateStr) {
  // dateStr = AAAA-MM-DD -> DD/MM/AAAA
  const [y, m, d] = dateStr.split('-');
  return d + '/' + m + '/' + y;
}
function fmtPrice(p) {
  const n = parseFloat(p || 0);
  if (!isFinite(n)) return 'Gratuito';
  return 'R$ ' + n.toFixed(2).replace('.', ',');
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ===== Toast / Modal =====
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.getElementById('toastRoot').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 3000);
}
function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}
function openModal(html) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal">' + html + '</div></div>';
  return root;
}

// ===== Auth UI =====
function renderAuthArea() {
  const area = document.getElementById('authArea');
  if (state.user) {
    const isOwner = state.user.role === 'owner';
    area.innerHTML = `
      <div class="user-chip">
        <span class="un">${esc(state.user.name)}</span>
        <span class="ur ${isOwner ? 'owner' : ''}">${isOwner ? 'Responsável' : 'Cliente'}</span>
      </div>
      <button class="btn small secondary" onclick="doLogout()">Sair</button>`;
  } else {
    area.innerHTML = `<button class="btn small" onclick="renderAuth()">Entrar / Cadastrar</button>`;
  }
}

async function doLogout() {
  try { await api('/logout', { method: 'POST' }); } catch (e) {}
  state.token = null; state.user = null;
  localStorage.removeItem('token'); localStorage.removeItem('user');
  state.view = 'services';
  renderAuthArea();
  render();
}

function renderAuth() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-wrap">
      <div class="tabs">
        <div class="tab active" id="tabLogin" onclick="switchAuthTab('login')">Entrar</div>
        <div class="tab" id="tabReg" onclick="switchAuthTab('register')">Criar conta</div>
      </div>
      <div class="card" id="authForm"></div>
    </div>`;
  switchAuthTab('login');
}

function switchAuthTab(tab) {
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabReg').classList.toggle('active', tab === 'register');
  const f = document.getElementById('authForm');
  if (tab === 'login') {
    f.innerHTML = `
      <h2>Bem-vindo(a) 👋</h2>
      <p class="muted" style="margin-top:0">Entre com a sua conta para ver serviços e horários.</p>
      <div class="field"><label>Usuário</label><input id="lUser" autocomplete="username" /></div>
      <div class="field"><label>Senha</label><input id="lPass" type="password" autocomplete="current-password" /></div>
      <button class="btn" style="width:100%" onclick="doLogin()">Entrar</button>`;
  } else {
    f.innerHTML = `
      <h2>Criar conta de cliente</h2>
      <p class="muted" style="margin-top:0">Preencha seus dados para marcar serviços.</p>
      <div class="field"><label>Nome completo</label><input id="rName" /></div>
      <div class="field"><label>Telefone / WhatsApp</label><input id="rPhone" placeholder="(11) 99999-9999" /></div>
      <div class="field"><label>Usuário</label><input id="rUser" autocomplete="username" /></div>
      <div class="field"><label>Senha</label><input id="rPass" type="password" autocomplete="new-password" /></div>
      <button class="btn" style="width:100%" onclick="doRegister()">Criar conta</button>`;
  }
}

async function doLogin() {
  const username = document.getElementById('lUser').value.trim();
  const password = document.getElementById('lPass').value;
  if (!username || !password) return toast('Preencha usuário e senha.', 'error');
  try {
    const d = await api('/login', { method: 'POST', body: { username, password } });
    state.token = d.token; state.user = d.user;
    localStorage.setItem('token', d.token); localStorage.setItem('user', JSON.stringify(d.user));
    state.view = d.user.role === 'owner' ? 'owner' : 'services';
    renderAuthArea(); render();
    toast('Olá, ' + d.user.name + '!');
  } catch (e) { toast(e.message, 'error'); }
}

async function doRegister() {
  const name = document.getElementById('rName').value.trim();
  const phone = document.getElementById('rPhone').value.trim();
  const username = document.getElementById('rUser').value.trim();
  const password = document.getElementById('rPass').value;
  if (!name || !phone || !username || !password) return toast('Preencha todos os campos.', 'error');
  try {
    const d = await api('/register', { method: 'POST', body: { name, phone, username, password } });
    state.token = d.token; state.user = d.user;
    localStorage.setItem('token', d.token); localStorage.setItem('user', JSON.stringify(d.user));
    state.view = 'services';
    renderAuthArea(); render();
    toast('Conta criada! Agora escolha um serviço.');
  } catch (e) { toast(e.message, 'error'); }
}

// ===== Tabs do app =====
function renderTabbar() {
  const isOwner = state.user.role === 'owner';
  let html = `<div class="tabbar">`;
  html += `<div class="tab ${state.view === 'services' ? 'active' : ''}" onclick="setView('services')">Marcar serviço</div>`;
  html += `<div class="tab ${state.view === 'mybookings' ? 'active' : ''}" onclick="setView('mybookings')">Meus agendamentos</div>`;
  if (isOwner) html += `<div class="tab ${state.view === 'owner' ? 'active' : ''}" onclick="setView('owner')">Painel</div>`;
  html += `</div>`;
  document.getElementById('app').insertAdjacentHTML('afterbegin', html);
}
function setView(v) {
  state.view = v;
  state.selectedService = null; state.selectedDay = null; state.selectedTime = null;
  render();
}

// ===== Render principal =====
function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  if (!state.user) { renderAuth(); return; }
  renderTabbar();
  if (state.view === 'services') renderServices(app);
  else if (state.view === 'mybookings') renderMyBookings(app);
  else if (state.view === 'owner') renderOwner(app);
}

// ===== Serviços (cliente) =====
async function renderServices(app) {
  app.innerHTML += `<div class="card"><h2>Escolha um serviço</h2><p class="muted" style="margin-top:0">Toque em um serviço para ver os horários livres.</p><div class="grid" id="svcGrid"><p class="muted">Carregando...</p></div></div><div class="avail-wrap" id="availWrap"></div>`;
  let services;
  try { services = await api('/services'); }
  catch (e) { document.getElementById('svcGrid').innerHTML = '<p class="muted">Erro ao carregar serviços: ' + esc(e.message) + '</p>'; return; }
  if (!services.length) {
    document.getElementById('svcGrid').innerHTML = '<p class="empty">Nenhum serviço cadastrado ainda.</p>';
    return;
  }
  const grid = document.getElementById('svcGrid');
  grid.innerHTML = services.map(s => `
    <div class="card service-card ${state.selectedService && state.selectedService.id === s.id ? 'selected' : ''}" onclick="pickService(${s.id})">
      <div class="service-name">${esc(s.name)}</div>
      <div class="service-desc">${esc(s.description || '')}</div>
      <div class="service-meta">
        <span class="price">${fmtPrice(s.price)}</span>
        <span class="duration">⏱ ${esc(s.duration_min)} min</span>
      </div>
    </div>`).join('');
}

async function pickService(id) {
  const s = await api('/services').then(a => a.find(x => x.id === id));
  state.selectedService = s;
  state.selectedDay = null; state.selectedTime = null;
  renderServices(document.getElementById('app'));
  loadAvailability();
}

async function loadAvailability() {
  const wrap = document.getElementById('availWrap');
  wrap.innerHTML = '<div class="card"><p class="muted">Carregando horários...</p></div>';
  let data;
  try { data = await api('/availability?serviceId=' + state.selectedService.id + '&days=21'); }
  catch (e) { wrap.innerHTML = '<div class="card"><p class="muted">Erro: ' + esc(e.message) + '</p></div>'; return; }
  wrap.innerHTML = `<div class="card">
    <h2>Horários para: ${esc(state.selectedService.name)}</h2>
    <p class="muted" style="margin-top:0">Escolha um dia e um horário livre.</p>
    <div class="avail-days" id="dayChips"></div>
    <div id="slotsArea"><p class="muted" style="margin-top:12px">Selecione um dia acima.</p></div>
    <div id="summaryArea"></div>
  </div>`;
  const chips = document.getElementById('dayChips');
  chips.innerHTML = data.days.map(d => {
    const hasFree = d.freeTimes.length > 0;
    return `<div class="day-chip ${!hasFree ? 'nofree' : ''}" data-date="${d.date}" onclick="${hasFree ? 'pickDay(\'' + d.date + '\')' : ''}">
      <div class="dw">${WEEKDAYS[d.weekday]}</div>
      <div class="dd">${d.date.slice(8,10)}</div>
    </div>`;
  }).join('');
  state._days = data.days;
}

function pickDay(date) {
  state.selectedDay = date;
  state.selectedTime = null;
  const day = state._days.find(d => d.date === date);
  document.querySelectorAll('.day-chip').forEach(c => c.classList.toggle('active', c.dataset.date === date));
  const area = document.getElementById('slotsArea');
  if (!day.freeTimes.length) { area.innerHTML = '<p class="muted" style="margin-top:12px">Nenhum horário livre neste dia.</p>'; }
  else {
    area.innerHTML = '<div class="slots">' + day.freeTimes.map(t =>
      `<div class="slot" onclick="pickTime('${t}')">${t}</div>`).join('') + '</div>';
  }
  document.getElementById('summaryArea').innerHTML = '';
}

function pickTime(time) {
  state.selectedTime = time;
  document.querySelectorAll('.slot').forEach(s => s.classList.toggle('selected', s.textContent === time));
  const s = state.selectedService;
  document.getElementById('summaryArea').innerHTML = `
    <div class="summary-bar">
      <div>
        <div style="font-weight:700">${esc(s.name)}</div>
        <div class="muted">${fmtDate(state.selectedDay)} às ${time} · ${fmtPrice(s.price)}</div>
      </div>
      <button class="btn" onclick="confirmBooking()">Confirmar agendamento</button>
    </div>`;
}

async function confirmBooking() {
  if (!state.selectedDay || !state.selectedTime) return toast('Escolha dia e horário.', 'error');
  try {
    const row = await api('/bookings', {
      method: 'POST',
      body: { serviceId: state.selectedService.id, date: state.selectedDay, time: state.selectedTime }
    });
    toast('Agendamento marcado! Aguardando confirmação.');
    state.selectedTime = null; state.selectedDay = null;
    setView('mybookings');
  } catch (e) { toast(e.message, 'error'); }
}

// ===== Meus agendamentos (cliente) =====
async function renderMyBookings(app) {
  app.innerHTML += `<div class="card"><h2>Meus agendamentos</h2><div id="myList"><p class="muted">Carregando...</p></div></div>`;
  let rows;
  try { rows = await api('/bookings/mine'); }
  catch (e) { document.getElementById('myList').innerHTML = '<p class="muted">Erro: ' + esc(e.message) + '</p>'; return; }
  const list = document.getElementById('myList');
  if (!rows.length) { list.innerHTML = '<p class="empty">Você ainda não tem agendamentos. Marque um serviço! 📅</p>'; return; }
  list.innerHTML = rows.map(b => `
    <div class="booking">
      <div class="info">
        <div class="sname">${esc(b.service_name)}</div>
        <div class="stime">${fmtDate(b.date)} às ${esc(b.time)}</div>
        <div class="client">${fmtPrice(b.price)}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
        <span class="badge ${b.status}">${STATUS_LABEL[b.status]}</span>
        ${(b.status === 'pending' || b.status === 'confirmed')
          ? `<button class="btn small danger" onclick="cancelBooking(${b.id})">Cancelar</button>`
          : ''}
      </div>
    </div>`).join('');
}

async function cancelBooking(id) {
  if (!confirm('Deseja cancelar este agendamento?')) return;
  try {
    await api('/bookings/' + id + '/cancel', { method: 'POST' });
    toast('Agendamento cancelado.');
    renderMyBookings(document.getElementById('app'));
  } catch (e) { toast(e.message, 'error'); }
}

// ===== Painel do responsável =====
let ownerTab = 'bookings';
async function renderOwner(app) {
  app.innerHTML += `<div class="card">
    <h2>Painel do responsável</h2>
    <div class="filter-row">
      <select id="ownerTabSel" onchange="ownerTab=this.value;renderOwner(document.getElementById('app'))">
        <option value="bookings">Agendamentos</option>
        <option value="services">Serviços</option>
        <option value="slots">Horários de atendimento</option>
      </select>
    </div>
    <div id="ownerContent"><p class="muted">Carregando...</p></div>
  </div>`;
  const c = document.getElementById('ownerContent');
  if (ownerTab === 'bookings') ownerLoadBookings(c);
  else if (ownerTab === 'services') ownerLoadServices(c);
  else if (ownerTab === 'slots') ownerLoadSlots(c);
}

async function ownerLoadBookings(c) {
  let rows;
  try { rows = await api('/owner/bookings'); }
  catch (e) { c.innerHTML = '<p class="muted">Erro: ' + esc(e.message) + '</p>'; return; }
  let filter = 'all';
  if (!rows.length) { c.innerHTML = '<p class="empty">Nenhum agendamento ainda.</p>'; return; }
  function draw() {
    const shown = rows.filter(r => filter === 'all' ? true : r.status === filter);
    if (!shown.length) { c.innerHTML = '<p class="empty">Nenhum agendamento nesta situação.</p>'; return; }
    c.innerHTML = `<div class="filter-row" style="margin-top:14px">
        <select onchange="ownerFilterStatus(this.value)">
          <option value="all">Todos</option>
          <option value="pending">Pendentes</option>
          <option value="confirmed">Confirmados</option>
          <option value="rejected">Recusados</option>
          <option value="cancelled">Cancelados</option>
        </select>
      </div>
      <div class="section-title">Lista</div>
      ${shown.map(b => `
        <div class="booking">
          <div class="info">
            <div class="sname">${esc(b.service_name)}</div>
            <div class="stime">${fmtDate(b.date)} às ${esc(b.time)}</div>
            <div class="client">👤 ${esc(b.client_name)} · 📞 ${esc(b.client_phone)} · <span class="badge ${b.status}" style="margin-left:4px">${STATUS_LABEL[b.status]}</span></div>
          </div>
          <div class="actions">
            ${b.status === 'pending' ? `
              <button class="btn small" onclick="ownerAction(${b.id},'confirm')">Confirmar</button>
              <button class="btn small danger" onclick="ownerAction(${b.id},'reject')">Recusar</button>` : ''}
          </div>
        </div>`).join('')}
    `;
  }
  draw();
  window._ownerRows = rows;
}
function ownerFilterStatus(v) {
  const c = document.getElementById('ownerContent');
  const rows = window._ownerRows || [];
  const shown = rows.filter(r => v === 'all' ? true : r.status === v);
  if (!shown.length) { c.innerHTML = '<p class="empty">Nenhum agendamento nesta situação.</p>'; return; }
  c.innerHTML = `<div class="filter-row"><select onchange="ownerFilterStatus(this.value)">
      <option value="all">Todos</option>
      <option value="pending" ${v==='pending'?'selected':''}>Pendentes</option>
      <option value="confirmed" ${v==='
