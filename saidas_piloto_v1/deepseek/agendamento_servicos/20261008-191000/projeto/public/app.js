let currentUser = null;
let activeTab = 'services';
let servicesCache = [];
let slotsCache = [];
let appointmentsCache = [];
let freeSlotsCache = [];

// ---------- Utils ----------
async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro');
  return data;
}

function msg(text, type = 'success') {
  return `<div class="msg ${type}">${text}</div>`;
}

function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function openModal(html) {
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('modal').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

// ---------- Render principal ----------
async function render() {
  const header = document.getElementById('userBox');
  if (currentUser) {
    header.innerHTML = `
      <span>Olá, <strong>${currentUser.name}</strong>${currentUser.role === 'admin' ? ' (admin)' : ''}</span>
      <button class="secondary small" onclick="logout()">Sair</button>
    `;
  } else {
    header.innerHTML = '';
  }

  const app = document.getElementById('app');
  if (!currentUser) {
    app.innerHTML = renderAuth();
    return;
  }

  if (currentUser.role === 'admin') {
    app.innerHTML = `
      <div class="tabs">
        <button class="${activeTab==='services'?'active':''}" onclick="setTab('services')">Serviços</button>
        <button class="${activeTab==='slots'?'active':''}" onclick="setTab('slots')">Horários</button>
        <button class="${activeTab==='appointments'?'active':''}" onclick="setTab('appointments')">Agendamentos</button>
      </div>
      <div id="tabContent"></div>
    `;
    if (activeTab === 'services') await renderAdminServices();
    else if (activeTab === 'slots') await renderAdminSlots();
    else await renderAdminAppointments();
  } else {
    app.innerHTML = `
      <div class="tabs">
        <button class="${activeTab==='services'?'active':''}" onclick="setTab('services')">Serviços</button>
        <button class="${activeTab==='appointments'?'active':''}" onclick="setTab('appointments')">Meus agendamentos</button>
      </div>
      <div id="tabContent"></div>
    `;
    if (activeTab === 'services') await renderClientServices();
    else await renderClientAppointments();
  }
}

function setTab(t) {
  activeTab = t;
  render();
}

async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    currentUser = await api('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    activeTab = currentUser.role === 'admin' ? 'services' : 'services';
    render();
  } catch (e) {
    document.getElementById('authMsg').innerHTML = msg(e.message, 'error');
  }
}

async function register() {
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  try {
    currentUser = await api('/api/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    render();
  } catch (e) {
    document.getElementById('authMsg').innerHTML = msg(e.message, 'error');
  }
}

async function logout() {
  await api('/api/logout', { method: 'POST' });
  currentUser = null;
  render();
}

function renderAuth() {
  return `
    <div class="card">
      <h2>Entrar</h2>
      <div id="authMsg"></div>
      <label>Email</label>
      <input id="email" type="email" placeholder="seu@email.com">
      <label>Senha</label>
      <input id="password" type="password" placeholder="Sua senha">
      <button onclick="login()">Entrar</button>
      <hr style="margin:20px 0; border:none; border-top:1px solid #eee;">
      <h3>Criar conta</h3>
      <label>Nome</label>
      <input id="regName" placeholder="Seu nome">
      <label>Email</label>
      <input id="regEmail" type="email" placeholder="seu@email.com">
      <label>Senha</label>
      <input id="regPassword" type="password" placeholder="Crie uma senha">
      <button class="success" onclick="register()">Cadastrar</button>
      <p style="margin-top:14px;font-size:12px;color:#888;">Admin padrão: admin@admin.com / admin123</p>
    </div>
  `;
}

// ---------- Admin: Serviços ----------
async function renderAdminServices() {
  servicesCache = await api('/api/services');
  const el = document.getElementById('tabContent');
  const cards = servicesCache.map(s => `
    <div class="item">
      <h4>${s.name}</h4>
      <p>${s.description || 'Sem descrição'}</p>
      <p><strong>Duração:</strong> ${s.duration} | <strong>Preço:</strong> ${s.price || '-'}</p>
      <div class="row">
        <button class="small" onclick="editService('${s.id}')">Editar</button>
        <button class="small danger" onclick="deleteService('${s.id}')">Excluir</button>
      </div>
    </div>
  `).join('') || '<p class="empty">Nenhum serviço cadastrado.</p>';

  el.innerHTML = `
    <div class="card">
      <h2>Novo serviço</h2>
      <div id="svcMsg"></div>
      <label>Nome</label>
      <input id="svcName" placeholder="Ex: Corte de cabelo">
      <label>Descrição</label>
      <textarea id="svcDesc" rows="2" placeholder="Descrição opcional"></textarea>
      <label>Duração</label>
      <input id="svcDur" placeholder="Ex: 30 min">
      <label>Preço</label>
      <input id="svcPrice" placeholder="Ex: R$ 50,00">
      <button onclick="createService()">Cadastrar serviço</button>
    </div>
    <div class="card">
      <h2>Serviços cadastrados</h2>
      <div class="grid">${cards}</div>
    </div>
  `;
}

async function createService() {
  const name = document.getElementById('svcName').value;
  const description = document.getElementById('svcDesc').value;
  const duration = document.getElementById('svcDur').value;
  const price = document.getElementById('svcPrice').value;
  try {
    await api('/api/services', { method: 'POST', body: JSON.stringify({ name, description, duration, price }) });
    renderAdminServices();
  } catch (e) {
    document.getElementById('svcMsg').innerHTML = msg(e.message, 'error');
  }
}

async function editService(id) {
  const s = servicesCache.find(x => x.id === id);
  openModal(`
    <h3>Editar serviço</h3>
    <div id="editMsg"></div>
    <label>Nome</label>
    <input id="editName" value="${s.name}">
    <label>Descrição</label>
    <textarea id="editDesc" rows="2">${s.description || ''}</textarea>
    <label>Duração</label>
    <input id="editDur" value="${s.duration || ''}">
    <label>Preço</label>
    <input id="editPrice" value="${s.price || ''}">
    <button onclick="saveService('${id}')">Salvar</button>
  `);
}

async function saveService(id) {
  const name = document.getElementById('editName').value;
  const description = document.getElementById('editDesc').value;
  const duration = document.getElementById('editDur').value;
  const price = document.getElementById('editPrice').value;
  try {
    await api('/api/services/' + id, { method: 'PUT', body: JSON.stringify({ name, description, duration, price }) });
    closeModal();
    renderAdminServices();
  } catch (e) {
    document.getElementById('editMsg').innerHTML = msg(e.message, 'error');
  }
}

async function deleteService(id) {
  if (!confirm('Excluir este serviço?')) return;
  await api('/api/services/' + id, { method: 'DELETE' });
  renderAdminServices();
}

// ---------- Admin: Horários ----------
async function renderAdminSlots() {
  slotsCache = await api('/api/slots');
  appointmentsCache = await api('/api/appointments');
  const busyIds = appointmentsCache.filter(a => a.status !== 'recusado' && a.status !== 'cancelado').map(a => a.slotId);
  const el = document.getElementById('tabContent');
  const cards = slotsCache.map(s => {
    const busy = busyIds.includes(s.id);
    return `
      <div class="item">
        <h4>${fmtDate(s.date)}</h4>
        <p>Horário: <strong>${s.time}</strong></p>
        <p><span class="badge ${busy ? 'recusado' : 'confirmado'}">${busy ? 'Ocupado' : 'Livre'}</span></p>
        <button class="small danger" onclick="deleteSlot('${s.id}')">Excluir</button>
      </div>
    `;
  }).join('') || '<p class="empty">Nenhum horário cadastrado.</p>';

  el.innerHTML = `
    <div class="card">
      <h2>Novo horário</h2>
      <div id="slotMsg"></div>
      <label>Data</label>
      <input id="slotDate" type="date">
      <label>Hora</label>
      <input id="slotTime" type="time">
      <button onclick="createSlot()">Cadastrar horário</button>
    </div>
    <div class="card">
      <h2>Horários cadastrados</h2>
      <div class="grid">${cards}</div>
    </div>
  `;
}

async function createSlot() {
  const date = document.getElementById('slotDate').value;
  const time = document.getElementById('slotTime').value;
  try {
    await api('/api/slots', { method: 'POST', body: JSON.stringify({ date, time }) });
    renderAdminSlots();
  } catch (e) {
    document.getElementById('slotMsg').innerHTML = msg(e.message, 'error');
  }
}

async function deleteSlot(id) {
  if (!confirm('Excluir este horário? Agendamentos vinculados serão removidos.')) return;
  await api('/api/slots/' + id, { method: 'DELETE' });
  renderAdminSlots();
}

// ---------- Admin: Agendamentos ----------
async function renderAdminAppointments() {
  appointmentsCache = await api('/api/appointments');
  const el = document.getElementById('tabContent');
  const cards = appointmentsCache.map(a => `
    <div class="item">
      <h4>${a.serviceName}</h4>
      <p><strong>Cliente:</strong> ${a.clientName} (${a.clientEmail})</p>
      <p><strong>Data:</strong> ${fmtDate(a.date)} às ${a.time}</p>
      <p><strong>Status:</strong> <span class="badge ${a.status}">${a.status}</span></p>
      <div class="row">
        ${a.status === 'pendente' ? `
          <button class="small success" onclick="setApptStatus('${a.id}','confirmado')">Confirmar</button>
          <button class="small danger" onclick="setApptStatus('${a.id}','recusado')">Recusar</button>
        ` : ''}
        ${a.status === 'confirmado' ? `
          <button class="small danger" onclick="setApptStatus('${a.id}','recusado')">Recusar</button>
        ` : ''}
        ${a.status === 'recusado' ? `
          <button class="small" onclick="setApptStatus('${a.id}','pendente')">Reabrir</button>
        ` : ''}
      </div>
    </div>
  `).join('') || '<p class="empty">Nenhum agendamento.</p>';

  el.innerHTML = `
    <div class="card">
      <h2>Todos os agendamentos</h2>
      <div class="grid">${cards}</div>
    </div>
  `;
}

async function setApptStatus(id, status) {
  await api('/api/appointments/' + id, { method: 'PUT', body: JSON.stringify({ status }) });
  renderAdminAppointments();
}

// ---------- Cliente: Serviços ----------
async function renderClientServices() {
  servicesCache = await api('/api/services');
  freeSlotsCache = await api('/api/free-slots');
  const el = document.getElementById('tabContent');
  const cards = servicesCache.map(s => `
    <div class="item">
      <h4>${s.name}</h4>
      <p>${s.description || 'Sem descrição'}</p>
      <p><strong>Duração:</strong> ${s.duration} | <strong>Preço:</strong> ${s.price || '-'}</p>
      <button class="small" onclick="openBooking('${s.id}')">Agendar</button>
    </div>
  `).join('') || '<p class="empty">Nenhum serviço disponível.</p>';

  el.innerHTML = `
    <div class="card">
      <h2>Serviços disponíveis</h2>
      <div class="grid">${cards}</div>
    </div>
  `;
}

function openBooking(serviceId) {
  const options = freeSlotsCache.map(s =>
    `<option value="${s.id}">${fmtDate(s.date)} às ${s.time}</option>`
  ).join('');
  openModal(`
    <h3>Escolha um horário</h3>
    <div id="bookMsg"></div>
    ${freeSlotsCache.length === 0 ? '<p class="empty">Nenhum horário disponível no momento.</p>' : `
      <label>Horário disponível</label>
      <select id="bookSlot">${options}</select>
      <button onclick="confirmBooking('${serviceId}')">Confirmar agendamento</button>
    `}
  `);
}

async function confirmBooking(serviceId) {
  const slotId = document.getElementById('bookSlot').value;
  try {
    await api('/api/appointments', { method: 'POST', body: JSON.stringify({ serviceId, slotId }) });
    closeModal();
    alert('Agendamento enviado! Aguarde a confirmação.');
    renderClientServices();
  } catch (e) {
    document.getElementById('bookMsg').innerHTML = msg(e.message, 'error');
  }
}

// ---------- Cliente: Meus agendamentos ----------
async function renderClientAppointments() {
  appointmentsCache = await api('/api/appointments');
  const el = document.getElementById('tabContent');
  const cards = appointmentsCache.map(a => `
    <div class="item">
      <h4>${a.serviceName}</h4>
      <p><strong>Data:</strong> ${fmtDate(a.date)} às ${a.time}</p>
      <p><strong>Preço:</strong> ${a.servicePrice || '-'}</p>
      <p><strong>Status:</strong> <span class="badge ${a.status}">${a.status}</span></p>
      ${(a.status === 'pendente' || a.status === 'confirmado') ? `
        <button class="small danger" onclick="cancelAppt('${a.id}')">Cancelar</button>
      ` : ''}
    </div>
  `).join('') || '<p class="empty">Você ainda não tem agendamentos.</p>';

  el.innerHTML = `
    <div class="card">
      <h2>Meus agendamentos</h2>
      <div class="grid">${cards}</div>
    </div>
  `;
}

async function cancelAppt(id) {
  if (!confirm('Cancelar este agendamento?')) return;
  await api('/api/appointments/' + id, { method: 'PUT', body: JSON.stringify({ status: 'cancelado' }) });
  renderClientAppointments();
}

// ---------- Init ----------
(async function init() {
  currentUser = await api('/api/me');
  render();
})();
