// ESTADO DA APLICAÇÃO
let currentUser = null;
let currentServices = [];
let currentBusinessHours = [];
let authMode = 'login'; // 'login' ou 'register'

// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', async () => {
  // Limitar o input de data para hoje em diante
  const todayStr = new Date().toISOString().slice(0, 10);
  const dateInput = document.getElementById('booking-date');
  if (dateInput) {
    dateInput.min = todayStr;
    dateInput.value = todayStr;
  }

  await checkAuth();
  await loadServices();
  await loadBusinessHours();

  // Se o usuário já selecionou a data padrão, carregar slots
  if (dateInput) {
    fetchAvailableSlots();
  }
});

// SISTEMA DE NOTIFICAÇÕES (TOAST)
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// NAVEGAÇÃO ENTRE TELAS
function navigate(viewName) {
  const sections = document.querySelectorAll('.view-section');
  sections.forEach(sec => sec.classList.remove('active'));

  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (viewName === 'my-bookings') {
    loadMyBookings();
  } else if (viewName === 'admin') {
    loadAdminStats();
    loadAdminAppointments();
    renderAdminServices();
    renderBusinessHoursForm();
  } else if (viewName === 'services-list') {
    renderPublicServices();
  }
}

// ATUALIZAÇÃO DA BARRA DE NAVEGAÇÃO CONFORME ESTADO
function updateNavbar() {
  const navContainer = document.getElementById('nav-links');

  if (!currentUser) {
    navContainer.innerHTML = `
      <button class="nav-btn" onclick="navigate('home')">Início</button>
      <button class="nav-btn" onclick="navigate('services-list')">Serviços</button>
      <button class="btn btn-primary btn-sm" onclick="openAuthModal('login')">Entrar / Cadastrar</button>
    `;
  } else if (currentUser.role === 'admin') {
    navContainer.innerHTML = `
      <div class="user-badge">
        <span>${currentUser.name.split(' ')[0]}</span>
        <span class="admin-tag">Responsável</span>
      </div>
      <button class="nav-btn" onclick="navigate('admin')">Painel Geral</button>
      <button class="nav-btn" onclick="navigate('home')">Ver Site</button>
      <button class="btn btn-secondary btn-sm" onclick="logout()">Sair</button>
    `;
  } else {
    navContainer.innerHTML = `
      <div class="user-badge">
        <span>Olá, ${currentUser.name.split(' ')[0]}</span>
      </div>
      <button class="nav-btn" onclick="navigate('new-booking')">+ Agendar</button>
      <button class="nav-btn" onclick="navigate('my-bookings')">Meus Horários</button>
      <button class="btn btn-secondary btn-sm" onclick="logout()">Sair</button>
    `;
  }
}

// VERIFICAR SESSÃO NO SERVIDOR
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    currentUser = data.authenticated ? data.user : null;
    updateNavbar();
  } catch (err) {
    console.error('Erro ao verificar autenticação:', err);
  }
}

// MODAL DE AUTENTICAÇÃO
function openAuthModal(mode = 'login') {
  toggleAuthMode(mode);
  document.getElementById('modal-auth').classList.add('open');
}

function closeAuthModal() {
  document.getElementById('modal-auth').classList.remove('open');
}

function toggleAuthMode(mode) {
  authMode = mode;
  const loginTab = document.getElementById('auth-tab-login');
  const regTab = document.getElementById('auth-tab-register');
  const loginForm = document.getElementById('form-login');
  const regForm = document.getElementById('form-register');

  if (mode === 'login') {
    loginTab.classList.add('active');
    regTab.classList.remove('active');
    loginForm.style.display = 'block';
    regForm.style.display = 'none';
  } else {
    loginTab.classList.remove('active');
    regTab.classList.add('active');
    loginForm.style.display = 'none';
    regForm.style.display = 'block';
  }
}

async function submitLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao realizar login', 'error');
      return;
    }

    currentUser = data.user;
    updateNavbar();
    closeAuthModal();
    showToast(`Bem-vindo(a) de volta, ${currentUser.name}!`, 'success');

    if (currentUser.role === 'admin') {
      navigate('admin');
    } else {
      navigate('my-bookings');
    }
  } catch (err) {
    showToast('Falha na comunicação com o servidor.', 'error');
  }
}

async function submitRegister(e) {
  e.preventDefault();
  const name = document.getElementById('register-name').value;
  const phone = document.getElementById('register-phone').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao criar conta', 'error');
      return;
    }

    currentUser = data.user;
    updateNavbar();
    closeAuthModal();
    showToast('Conta criada com sucesso!', 'success');
    navigate('new-booking');
  } catch (err) {
    showToast('Falha na conexão ao criar conta.', 'error');
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    updateNavbar();
    showToast('Você saiu da sua conta.', 'info');
    navigate('home');
  } catch (err) {
    showToast('Erro ao sair.', 'error');
  }
}

function handleStartBooking(serviceId = null) {
  if (!currentUser) {
    showToast('Por favor, faça login ou cadastre-se para agendar.', 'info');
    openAuthModal('login');
    return;
  }
  navigate('new-booking');
  if (serviceId) {
    const select = document.getElementById('booking-service');
    select.value = serviceId;
    onBookingServiceChange();
  }
}

// ================= GESTÃO DE SERVIÇOS =================

async function loadServices() {
  try {
    const res = await fetch('/api/services');
    currentServices = await res.json();

    renderHomeServices();
    renderPublicServices();
    populateBookingServiceSelect();
  } catch (err) {
    console.error('Erro ao carregar serviços:', err);
  }
}

function renderHomeServices() {
  const container = document.getElementById('home-services-list');
  if (!container) return;

  container.innerHTML = currentServices.map(s => `
    <div class="card service-card">
      <div>
        <h3>${escapeHtml(s.name)}</h3>
        <p class="service-desc">${escapeHtml(s.description || 'Sem descrição informada.')}</p>
      </div>
      <div>
        <div class="service-meta">
          <span class="service-price">R$ ${Number(s.price).toFixed(2).replace('.', ',')}</span>
          <span class="service-duration">⏱ ${s.duration_minutes} min</span>
        </div>
        <button class="btn btn-outline btn-block" onclick="handleStartBooking(${s.id})">Agendar Este</button>
      </div>
    </div>
  `).join('');
}

function renderPublicServices() {
  const container = document.getElementById('public-services-container');
  if (!container) return;

  container.innerHTML = currentServices.map(s => `
    <div class="card service-card">
      <div>
        <h3>${escapeHtml(s.name)}</h3>
        <p class="service-desc">${escapeHtml(s.description || 'Sem descrição informada.')}</p>
      </div>
      <div>
        <div class="service-meta">
          <span class="service-price">R$ ${Number(s.price).toFixed(2).replace('.', ',')}</span>
          <span class="service-duration">⏱ ${s.duration_minutes} min</span>
        </div>
        <button class="btn btn-primary btn-block" onclick="handleStartBooking(${s.id})">Agendar Horário</button>
      </div>
    </div>
  `).join('');
}

function populateBookingServiceSelect() {
  const select = document.getElementById('booking-service');
  if (!select) return;

  if (currentServices.length === 0) {
    select.innerHTML = '<option value="">Nenhum serviço disponível no momento</option>';
    return;
  }

  select.innerHTML = '<option value="">Selecione um serviço...</option>' +
    currentServices.map(s => `
      <option value="${s.id}" data-duration="${s.duration_minutes}" data-price="${s.price}">
        ${escapeHtml(s.name)} — R$ ${Number(s.price).toFixed(2).replace('.', ',')} (${s.duration_minutes} min)
      </option>
    `).join('');
}

function onBookingServiceChange() {
  const select = document.getElementById('booking-service');
  const badge = document.getElementById('service-details-badge');
  const selected = select.options[select.selectedIndex];

  if (select.value) {
    badge.style.display = 'block';
    badge.textContent = `Duração aproximada: ${selected.dataset.duration} minutos | Valor: R$ ${Number(selected.dataset.price).toFixed(2).replace('.', ',')}`;
  } else {
    badge.style.display = 'none';
  }

  fetchAvailableSlots();
}

// ================= HORÁRIOS & CONSULTA DE SLOTS =================

async function loadBusinessHours() {
  try {
    const res = await fetch('/api/business-hours');
    currentBusinessHours = await res.json();
  } catch (err) {
    console.error('Erro ao buscar horários:', err);
  }
}

async function fetchAvailableSlots() {
  const dateInput = document.getElementById('booking-date');
  const serviceSelect = document.getElementById('booking-service');
  const slotsContainer = document.getElementById('slots-container');
  const loading = document.getElementById('slots-loading');
  const submitBtn = document.getElementById('btn-submit-booking');
  const selectedSlotInput = document.getElementById('selected-slot-time');

  selectedSlotInput.value = '';
  submitBtn.disabled = true;

  if (!dateInput.value) {
    slotsContainer.innerHTML = '<p class="text-muted">Selecione uma data para ver os horários.</p>';
    return;
  }

  loading.style.display = 'block';
  slotsContainer.innerHTML = '';

  try {
    const res = await fetch(`/api/available-slots?date=${dateInput.value}&service_id=${serviceSelect.value}`);
    const data = await res.json();
    loading.style.display = 'none';

    if (data.slots && data.slots.length > 0) {
      slotsContainer.innerHTML = data.slots.map(time => `
        <button type="button" class="slot-btn" onclick="selectSlot(this, '${time}')">${time}</button>
      `).join('');
    } else {
      slotsContainer.innerHTML = `<p class="text-muted">${data.message || 'Nenhum horário disponível para este dia.'}</p>`;
    }
  } catch (err) {
    loading.style.display = 'none';
    slotsContainer.innerHTML = '<p class="text-muted">Erro ao carregar horários livres.</p>';
  }
}

function selectSlot(button, time) {
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
  button.classList.add('selected');
  document.getElementById('selected-slot-time').value = time;
  document.getElementById('btn-submit-booking').disabled = false;
}

// ================= ENVIAR AGENDAMENTO (CLIENTE) =================

async function submitBooking(e) {
  e.preventDefault();
  if (!currentUser) {
    showToast('Você precisa entrar na sua conta para confirmar.', 'error');
    openAuthModal('login');
    return;
  }

  const service_id = document.getElementById('booking-service').value;
  const appointment_date = document.getElementById('booking-date').value;
  const appointment_time = document.getElementById('selected-slot-time').value;
  const notes = document.getElementById('booking-notes').value;

  if (!service_id || !appointment_date || !appointment_time) {
    showToast('Por favor, escolha o serviço, o dia e o horário.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_id, appointment_date, appointment_time, notes })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao realizar agendamento.', 'error');
      fetchAvailableSlots();
      return;
    }

    showToast('Agendamento realizado com sucesso!', 'success');
    document.getElementById('form-booking').reset();
    document.getElementById('selected-slot-time').value = '';
    document.getElementById('service-details-badge').style.display = 'none';
    navigate('my-bookings');
  } catch (err) {
    showToast('Erro de conexão com o servidor.', 'error');
  }
}

// ================= LISTAGEM CLIENTE =================

async function loadMyBookings() {
  const container = document.getElementById('my-bookings-list');
  container.innerHTML = '<p class="text-muted">Buscando seus agendamentos...</p>';

  try {
    const res = await fetch('/api/appointments/my');
    const list = await res.json();

    if (!list || list.length === 0) {
      container.innerHTML = `
        <div class="card text-center p-4">
          <p class="text-muted">Você ainda não tem nenhum horário agendado.</p>
          <button class="btn btn-primary btn-sm mt-3" onclick="navigate('new-booking')">Agendar Agora</button>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(item => {
      const formattedDate = formatDateBR(item.appointment_date);
      const canCancel = item.status === 'pendente' || item.status === 'confirmado';

      return `
        <div class="appointment-item">
          <div class="appointment-info">
            <h4>${escapeHtml(item.service_name)}</h4>
            <p>🗓 <strong>${formattedDate}</strong> às <strong>${item.appointment_time}</strong> (${item.duration_minutes} min)</p>
            <p>Valor: R$ ${Number(item.price).toFixed(2).replace('.', ',')} ${item.notes ? `| <em>"${escapeHtml(item.notes)}"</em>` : ''}</p>
          </div>
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <span class="appointment-status status-${item.status}">${item.status}</span>
            ${canCancel ? `<button class="btn btn-danger btn-sm" onclick="cancelAppointment(${item.id})">Cancelar</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = '<p class="text-muted">Erro ao carregar agendamentos.</p>';
  }
}

async function cancelAppointment(id) {
  if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;

  try {
    const res = await fetch(`/api/appointments/${id}/cancel`, { method: 'PATCH' });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao cancelar.', 'error');
      return;
    }

    showToast('Agendamento cancelado com sucesso.', 'info');
    if (currentUser.role === 'admin') {
      loadAdminAppointments();
      loadAdminStats();
    } else {
      loadMyBookings();
    }
  } catch (err) {
    showToast('Erro ao solicitar cancelamento.', 'error');
  }
}

// ================= PAINEL DO RESPONSÁVEL (ADMIN) =================

function switchAdminTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));

  event.currentTarget.classList.add('active');
  document.getElementById(`admin-tab-${tabName}`).classList.add('active');
}

async function loadAdminStats() {
  try {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();
    document.getElementById('stat-pendentes').textContent = data.pendentes || 0;
    document.getElementById('stat-confirmados').textContent = data.confirmados || 0;
    document.getElementById('stat-hoje').textContent = data.hoje || 0;
    document.getElementById('stat-total').textContent = data.total || 0;
  } catch (err) {
    console.error('Erro ao carregar estatísticas:', err);
  }
}

async function loadAdminAppointments() {
  const status = document.getElementById('admin-filter-status').value;
  const date = document.getElementById('admin-filter-date').value;
  const container = document.getElementById('admin-appointments-list');

  container.innerHTML = '<p class="p-3 text-muted">Atualizando agendamentos...</p>';

  try {
    const res = await fetch(`/api/admin/appointments?status=${status}&date=${date}`);
    const rows = await res.json();

    if (rows.length === 0) {
      container.innerHTML = '<p class="p-3 text-muted">Nenhum agendamento encontrado para este filtro.</p>';
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Telefone / Contato</th>
            <th>Serviço</th>
            <th>Data e Horário</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(item => `
            <tr>
              <td>
                <strong>${escapeHtml(item.client_name)}</strong>
                ${item.notes ? `<div style="font-size:0.8rem; color:#64748b;">Obs: ${escapeHtml(item.notes)}</div>` : ''}
              </td>
              <td>${escapeHtml(item.client_phone)}<br><small style="color:#64748b;">${escapeHtml(item.client_email)}</small></td>
              <td>${escapeHtml(item.service_name)} (R$ ${Number(item.price).toFixed(2).replace('.', ',')})</td>
              <td><strong>${formatDateBR(item.appointment_date)}</strong><br>às ${item.appointment_time}</td>
              <td><span class="appointment-status status-${item.status}">${item.status}</span></td>
              <td>
                <div class="actions-cell">
                  ${item.status === 'pendente' ? `
                    <button class="btn btn-success btn-sm" title="Confirmar Agendamento" onclick="setAppointmentStatus(${item.id}, 'confirmado')">Aprovar</button>
                    <button class="btn btn-danger btn-sm" title="Recusar Agendamento" onclick="setAppointmentStatus(${item.id}, 'recusado')">Recusar</button>
                  ` : ''}
                  ${item.status === 'confirmado' ? `
                    <button class="btn btn-secondary btn-sm" onclick="setAppointmentStatus(${item.id}, 'concluido')">Concluir</button>
                    <button class="btn btn-danger btn-sm" onclick="cancelAppointment(${item.id})">Cancelar</button>
                  ` : ''}
                  ${(item.status === 'recusado' || item.status === 'cancelado' || item.status === 'concluido') ? `
                    <span style="font-size:0.85rem; color:#94a3b8;">Finalizado</span>
                  ` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = '<p class="p-3 text-muted">Erro ao carregar agendamentos.</p>';
  }
}

async function setAppointmentStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/admin/appointments/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao mudar status.', 'error');
      return;
    }

    showToast(`Agendamento marcado como: ${newStatus}`, 'success');
    loadAdminAppointments();
    loadAdminStats();
  } catch (err) {
    showToast('Falha na comunicação com o servidor.', 'error');
  }
}

function clearAdminFilters() {
  document.getElementById('admin-filter-status').value = 'todos';
  document.getElementById('admin-filter-date').value = '';
  loadAdminAppointments();
}

// ================= GESTÃO DE SERVIÇOS NO ADMIN =================

function renderAdminServices() {
  const container = document.getElementById('admin-services-list');
  if (!container) return;

  container.innerHTML = currentServices.map(s => `
    <div class="card service-card">
      <div>
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <h3>${escapeHtml(s.name)}</h3>
          <span style="font-size:0.75rem; padding:2px 6px; border-radius:4px; ${s.active ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">
            ${s.active ? 'Ativo' : 'Inativo'}
          </span>
        </div>
        <p class="service-desc">${escapeHtml(s.description || 'Sem descrição')}</p>
      </div>
      <div>
        <div class="service-meta">
          <span class="service-price">R$ ${Number(s.price).toFixed(2).replace('.', ',')}</span>
          <span class="service-duration">${s.duration_minutes} min</span>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="openServiceModal(${s.id})">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteService(${s.id})">Excluir</button>
        </div>
      </div>
    </div>
  `).join('');
}

function openServiceModal(serviceId = null) {
  const form = document.getElementById('form-save-service');
  form.reset();

  const idInput = document.getElementById('service-id');
  const title = document.getElementById('service-modal-title');
  const activeToggle = document.getElementById('service-status-toggle');

  if (serviceId) {
    const s = currentServices.find(item => item.id === serviceId);
    if (!s) return;
    idInput.value = s.id;
    title.textContent = 'Editar Serviço';
    document.getElementById('service-name').value = s.name;
    document.getElementById('service-description').value = s.description;
    document.getElementById('service-duration').value = s.duration_minutes;
    document.getElementById('service-price').value = s.price;
    document.getElementById('service-active').checked = s.active === 1;
    activeToggle.style.display = 'block';
  } else {
    idInput.value = '';
    title.textContent = 'Cadastrar Novo Serviço';
    document.getElementById('service-active').checked = true;
    activeToggle.style.display = 'none';
  }

  document.getElementById('modal-service').classList.add('open');
}

function closeServiceModal() {
  document.getElementById('modal-service').classList.remove('open');
}

async function saveService(e) {
  e.preventDefault();
  const id = document.getElementById('service-id').value;
  const name = document.getElementById('service-name').value;
  const description = document.getElementById('service-description').value;
  const duration_minutes = document.getElementById('service-duration').value;
  const price = document.getElementById('service-price').value;
  const active = document.getElementById('service-active').checked ? 1 : 0;

  const url = id ? `/api/services/${id}` : '/api/services';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, duration_minutes, price, active })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao salvar serviço.', 'error');
      return;
    }

    showToast('Serviço gravado com sucesso!', 'success');
    closeServiceModal();
    await loadServices();
    renderAdminServices();
  } catch (err) {
    showToast('Erro ao conectar ao servidor.', 'error');
  }
}

async function deleteService(id) {
  if (!confirm('Deseja realmente excluir este serviço do catálogo?')) return;

  try {
    const res = await fetch(`/api/services/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao excluir.', 'error');
      return;
    }

    showToast('Serviço excluído.', 'info');
    await loadServices();
    renderAdminServices();
  } catch (err) {
    showToast('Erro ao excluir serviço.', 'error');
  }
}

// ================= GESTÃO DE HORÁRIOS DE ATENDIMENTO =================

function renderBusinessHoursForm() {
  const container = document.getElementById('business-hours-rows');
  if (!container) return;

  container.innerHTML = currentBusinessHours.map(d => `
    <div class="hour-row" data-day="${d.day_of_week}">
      <div class="hour-row-day">
        <label class="checkbox-label">
          <input type="checkbox" class="hour-is-open" ${d.is_open ? 'checked' : ''}>
          <span>${d.day_name}</span>
        </label>
      </div>

      <div class="hour-row-times">
        <label style="font-size:0.8rem; color:#64748b;">Das</label>
        <input type="time" class="input-control hour-start" value="${d.start_time}" style="width:115px; padding:0.4rem;">
        <label style="font-size:0.8rem; color:#64748b;">às</label>
        <input type="time" class="input-control hour-end" value="${d.end_time}" style="width:115px; padding:0.4rem;">
      </div>

      <div style="display:flex; align-items:center; gap:0.5rem;">
        <label style="font-size:0.8rem; color:#64748b;">Intervalo (min):</label>
        <input type="number" class="input-control hour-interval" value="${d.slot_interval || 30}" min="10" step="5" style="width:75px; padding:0.4rem;">
      </div>
    </div>
  `).join('');
}

async function saveBusinessHours(e) {
  e.preventDefault();
  const rows = document.querySelectorAll('.hour-row');
  const schedule = [];

  rows.forEach(row => {
    schedule.push({
      day_of_week: parseInt(row.dataset.day, 10),
      is_open: row.querySelector('.hour-is-open').checked ? 1 : 0,
      start_time: row.querySelector('.hour-start').value,
      end_time: row.querySelector('.hour-end').value,
      slot_interval: parseInt(row.querySelector('.hour-interval').value, 10) || 30
    });
  });

  try {
    const res = await fetch('/api/business-hours', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao salvar expediente.', 'error');
      return;
    }

    showToast('Horários de funcionamento atualizados com sucesso!', 'success');
    await loadBusinessHours();
  } catch (err) {
    showToast('Falha ao gravar horários.', 'error');
  }
}

// UTILITÁRIOS
function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
