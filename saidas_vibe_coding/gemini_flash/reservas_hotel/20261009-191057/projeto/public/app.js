// ESTADO GLOBAL DA APLICAÇÃO
let currentUser = null;
let allRooms = [];
let allBookings = [];
let currentSearch = {
  checkIn: '',
  checkOut: '',
  guests: 2
};
let selectedRoomForBooking = null;

// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', async () => {
  setupDateDefaults();
  await checkAuth();
  await loadRooms();
});

// CONFIGURA DATAS PADRÕES (Hoje e Amanhã)
function setupDateDefaults() {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const format = (d) => d.toISOString().split('T')[0];

  const inInput = document.getElementById('searchCheckIn');
  const outInput = document.getElementById('searchCheckOut');
  
  inInput.min = format(today);
  inInput.value = format(today);

  outInput.min = format(tomorrow);
  outInput.value = format(tomorrow);

  currentSearch.checkIn = format(today);
  currentSearch.checkOut = format(tomorrow);
}

// ---------------- AUTENTICAÇÃO E SESSÃO ----------------

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    currentUser = data.user;
    updateAuthUI();
  } catch (err) {
    console.error('Erro ao verificar sessão:', err);
    currentUser = null;
    updateAuthUI();
  }
}

function updateAuthUI() {
  const authBox = document.getElementById('authBox');
  const btnMyBookings = document.getElementById('btnNavMyBookings');
  const btnManager = document.getElementById('btnNavManager');

  if (currentUser) {
    const isManager = currentUser.role === 'manager';
    btnMyBookings.style.display = isManager ? 'none' : 'inline-block';
    btnManager.style.display = isManager ? 'inline-block' : 'none';

    authBox.innerHTML = `
      <div class="user-tag">
        <div>
          <span class="user-name">${escapeHtml(currentUser.name)}</span>
          <span class="user-role-badge ${isManager ? 'manager' : ''}">${isManager ? 'Gerente' : 'Hóspede'}</span>
        </div>
        <button class="btn-secondary" onclick="handleLogout()">Sair</button>
      </div>
    `;
  } else {
    btnMyBookings.style.display = 'none';
    btnManager.style.display = 'none';
    authBox.innerHTML = `<button class="btn-primary" onclick="openModal('authModal')">Entrar / Cadastrar</button>`;
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

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
    updateAuthUI();
    closeModal('authModal');
    showToast(`Bem-vindo(a), ${currentUser.name}!`, 'success');

    if (currentUser.role === 'manager') {
      navigate('manager');
    } else {
      navigate('home');
    }
  } catch (err) {
    showToast('Falha na conexão com o servidor.', 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const phone = document.getElementById('regPhone').value;
  const password = document.getElementById('regPassword').value;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao realizar cadastro', 'error');
      return;
    }

    currentUser = data.user;
    updateAuthUI();
    closeModal('authModal');
    showToast('Cadastro realizado com sucesso!', 'success');
  } catch (err) {
    showToast('Falha na conexão com o servidor.', 'error');
  }
}

async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  currentUser = null;
  updateAuthUI();
  navigate('home');
  showToast('Você saiu da sua conta.', 'success');
}

// ---------------- NAVEGAÇÃO ENTRE TELAS ----------------

function navigate(viewName) {
  document.querySelectorAll('.view-section').forEach((sec) => sec.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.remove('active'));

  if (viewName === 'home') {
    document.getElementById('sectionHome').classList.add('active');
    document.getElementById('btnNavHome').classList.add('active');
  } else if (viewName === 'my-bookings') {
    if (!currentUser) {
      openModal('authModal');
      return;
    }
    document.getElementById('sectionMyBookings').classList.add('active');
    document.getElementById('btnNavMyBookings').classList.add('active');
    loadMyBookings();
  } else if (viewName === 'manager') {
    if (!currentUser || currentUser.role !== 'manager') {
      showToast('Acesso restrito ao gerente.', 'error');
      return;
    }
    document.getElementById('sectionManager').classList.add('active');
    document.getElementById('btnNavManager').classList.add('active');
    loadManagerData();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------------- CARREGAR E BUSCAR QUARTOS ----------------

async function loadRooms(params = null) {
  try {
    let url = '/api/rooms';
    if (params) {
      const q = new URLSearchParams(params);
      url += `?${q.toString()}`;
    }

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao buscar quartos.', 'error');
      return;
    }

    allRooms = data;
    renderRoomsGrid(allRooms);
  } catch (err) {
    showToast('Erro ao carregar quartos.', 'error');
  }
}

function handleSearch(e) {
  e.preventDefault();
  const checkIn = document.getElementById('searchCheckIn').value;
  const checkOut = document.getElementById('searchCheckOut').value;
  const guests = document.getElementById('searchGuests').value;

  if (checkIn >= checkOut) {
    showToast('A data de check-out deve ser após o check-in.', 'error');
    return;
  }

  currentSearch = { checkIn, checkOut, guests };

  loadRooms(currentSearch);

  const infoBar = document.getElementById('searchInfoBar');
  const feedbackText = document.getElementById('searchFeedbackText');
  infoBar.style.display = 'flex';
  feedbackText.innerHTML = `Mostrando quartos livres de <strong>${formatDate(checkIn)}</strong> até <strong>${formatDate(checkOut)}</strong> para <strong>${guests} pessoa(s)</strong>.`;
}

function clearSearchFilter() {
  document.getElementById('searchInfoBar').style.display = 'none';
  loadRooms();
}

function renderRoomsGrid(rooms) {
  const container = document.getElementById('roomsGrid');

  if (!rooms || rooms.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; background: white; border-radius: 12px;">
        <h3>Nenhum quarto disponível para estas datas</h3>
        <p style="color: #64748b; margin-top: 8px;">Tente selecionar outro período ou diminuir o número de hóspedes.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = rooms
    .map((room) => {
      const amenitiesHtml = (room.amenities || [])
        .map((a) => `<span class="amenity-tag">${escapeHtml(a)}</span>`)
        .join('');

      return `
        <div class="room-card">
          <div class="room-image-wrap">
            <img src="${escapeHtml(room.imageUrl)}" alt="${escapeHtml(room.name)}" onerror="this.src='https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'" />
            <span class="room-badge">${escapeHtml(room.category || 'Standard')}</span>
          </div>
          <div class="room-body">
            <h3 class="room-title">${escapeHtml(room.name)}</h3>
            <div class="room-meta">
              <span>👥 Até ${room.capacity} hóspedes</span>
            </div>
            <p class="room-description">${escapeHtml(room.description || 'Acomodação confortável e completa para sua estadia.')}</p>
            <div class="room-amenities">
              ${amenitiesHtml}
            </div>
            <div class="room-footer">
              <div>
                <span class="room-price-val">R$ ${Number(room.pricePerNight).toFixed(2)}</span>
                <span class="room-price-sub">por noite</span>
              </div>
              <button class="btn-primary" onclick="startBooking('${room.id}')">Reservar Agora</button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

// ---------------- FLUXO DE RESERVA ----------------

function startBooking(roomId) {
  if (!currentUser) {
    showToast('Faça login ou cadastre-se para reservar um quarto.', 'error');
    openModal('authModal');
    return;
  }

  const room = allRooms.find((r) => r.id === roomId);
  if (!room) return;

  selectedRoomForBooking = room;

  document.getElementById('bookRoomId').value = room.id;
  document.getElementById('bookCheckIn').value = currentSearch.checkIn || '';
  document.getElementById('bookCheckOut').value = currentSearch.checkOut || '';
  document.getElementById('bookGuestsCount').value = currentSearch.guests || 2;
  document.getElementById('bookGuestsCount').max = room.capacity;

  const todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('bookCheckIn').min = todayStr;

  document.getElementById('bookingSummary').innerHTML = `
    <strong>${escapeHtml(room.name)}</strong>
    <p style="font-size:13px; color:#64748b; margin-top:4px;">Capacidade: até ${room.capacity} pessoas | R$ ${Number(room.pricePerNight).toFixed(2)}/noite</p>
  `;

  recalcBookingModal();
  openModal('bookingModal');
}

function recalcBookingModal() {
  if (!selectedRoomForBooking) return;

  const cIn = document.getElementById('bookCheckIn').value;
  const cOut = document.getElementById('bookCheckOut').value;
  const btnSubmit = document.getElementById('btnSubmitBooking');

  if (!cIn || !cOut || cIn >= cOut) {
    document.getElementById('calcNights').innerText = '0 noites';
    document.getElementById('calcPerNight').innerText = `R$ ${Number(selectedRoomForBooking.pricePerNight).toFixed(2)}`;
    document.getElementById('calcTotalPrice').innerText = 'R$ 0,00';
    btnSubmit.disabled = true;
    return;
  }

  const dIn = new Date(cIn);
  const dOut = new Date(cOut);
  const diffDays = Math.ceil((dOut - dIn) / (1000 * 60 * 60 * 24));
  const total = diffDays * selectedRoomForBooking.pricePerNight;

  document.getElementById('calcNights').innerText = `${diffDays} noite(s)`;
  document.getElementById('calcPerNight').innerText = `R$ ${Number(selectedRoomForBooking.pricePerNight).toFixed(2)}`;
  document.getElementById('calcTotalPrice').innerText = `R$ ${total.toFixed(2)}`;
  btnSubmit.disabled = false;
}

async function handleConfirmBooking(e) {
  e.preventDefault();
  const roomId = document.getElementById('bookRoomId').value;
  const checkIn = document.getElementById('bookCheckIn').value;
  const checkOut = document.getElementById('bookCheckOut').value;
  const guestsCount = document.getElementById('bookGuestsCount').value;

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, checkIn, checkOut, guestsCount })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao realizar reserva.', 'error');
      return;
    }

    closeModal('bookingModal');
    showToast('Reserva solicitada com sucesso!', 'success');
    navigate('my-bookings');
  } catch (err) {
    showToast('Erro de comunicação com o servidor.', 'error');
  }
}

// ---------------- MINHAS RESERVAS (HÓSPEDE) ----------------

async function loadMyBookings() {
  const container = document.getElementById('myBookingsList');
  container.innerHTML = '<p>Carregando reservas...</p>';

  try {
    const res = await fetch('/api/my-bookings');
    const bookings = await res.json();

    if (!res.ok) {
      showToast('Erro ao carregar reservas.', 'error');
      return;
    }

    if (bookings.length === 0) {
      container.innerHTML = `
        <div style="background:white; padding:40px; text-align:center; border-radius:12px; border:1px solid #e2e8f0;">
          <h3>Você ainda não fez nenhuma reserva</h3>
          <p style="color:#64748b; margin:10px 0 20px;">Explore nossos quartos e garanta já suas férias dos sonhos.</p>
          <button class="btn-primary" onclick="navigate('home')">Buscar Quartos</button>
        </div>
      `;
      return;
    }

    container.innerHTML = bookings
      .map((b) => {
        const canCancel = b.status === 'pendente' || b.status === 'confirmada';
        return `
          <div class="booking-item-card">
            <div>
              <div class="booking-header">
                <span class="booking-code">#${b.id.toUpperCase()}</span>
                <span class="status-badge status-${b.status}">${b.status}</span>
              </div>
              <h3 class="booking-room-name">${escapeHtml(b.roomName)}</h3>
              <div class="booking-details-grid">
                <div class="detail-item">
                  <strong>Entrada (Check-in)</strong>
                  <span>${formatDate(b.checkIn)}</span>
                </div>
                <div class="detail-item">
                  <strong>Saída (Check-out)</strong>
                  <span>${formatDate(b.checkOut)}</span>
                </div>
                <div class="detail-item">
                  <strong>Duração</strong>
                  <span>${b.nights} noite(s)</span>
                </div>
                <div class="detail-item">
                  <strong>Hóspedes</strong>
                  <span>${b.guestsCount} pessoa(s)</span>
                </div>
                <div class="detail-item">
                  <strong>Total</strong>
                  <span style="font-weight:700; color:var(--primary);">R$ ${Number(b.totalPrice).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div class="booking-actions">
              ${
                canCancel
                  ? `<button class="btn-danger" onclick="cancelBooking('${b.id}')">Cancelar Reserva</button>`
                  : `<span style="font-size:12px; color:#94a3b8;">Reserva finalizada</span>`
              }
            </div>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    container.innerHTML = '<p>Erro ao carregar reservas.</p>';
  }
}

async function cancelBooking(bookingId) {
  if (!confirm('Tem certeza de que deseja cancelar esta reserva?')) return;

  try {
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao cancelar reserva.', 'error');
      return;
    }

    showToast('Reserva cancelada com sucesso.', 'success');
    loadMyBookings();
  } catch (err) {
    showToast('Erro ao se comunicar com o servidor.', 'error');
  }
}

// ---------------- PAINEL DO GERENTE ----------------

function switchManagerTab(tab) {
  document.getElementById('tabBtnReservas').classList.toggle('active', tab === 'reservas');
  document.getElementById('tabBtnQuartos').classList.toggle('active', tab === 'quartos');
  document.getElementById('managerTabReservas').classList.toggle('active', tab === 'reservas');
  document.getElementById('managerTabQuartos').classList.toggle('active', tab === 'quartos');
}

async function loadManagerData() {
  await Promise.all([loadManagerBookings(), loadManagerRooms()]);
}

async function loadManagerBookings() {
  try {
    const res = await fetch('/api/admin/bookings');
    allBookings = await res.json();
    renderManagerBookings();
  } catch (err) {
    showToast('Erro ao carregar reservas da gerência.', 'error');
  }
}

function renderManagerBookings() {
  const container = document.getElementById('managerBookingsList');
  const filter = document.getElementById('filterManagerStatus').value;

  let filtered = allBookings;
  if (filter !== 'todos') {
    filtered = allBookings.filter((b) => b.status === filter);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="background:white; padding:30px; text-align:center; border-radius:12px;">
        <p style="color:#64748b;">Nenhuma reserva encontrada para este filtro.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((b) => {
      const isPending = b.status === 'pendente';
      return `
        <div class="booking-item-card">
          <div>
            <div class="booking-header">
              <span class="booking-code">#${b.id.toUpperCase()}</span>
              <span class="status-badge status-${b.status}">${b.status}</span>
              <span style="font-size:12px; color:#64748b;">Solicitado em: ${formatDateTime(b.createdAt)}</span>
            </div>
            <h3 class="booking-room-name">${escapeHtml(b.roomName)}</h3>
            <div style="margin: 6px 0; font-size:14px; color:#1e3a5f;">
              <strong>Hóspede:</strong> ${escapeHtml(b.userName)} (${escapeHtml(b.userEmail)}) | <strong>Tel:</strong> ${escapeHtml(b.userPhone || 'Não informado')}
            </div>
            <div class="booking-details-grid">
              <div class="detail-item">
                <strong>Check-in</strong>
                <span>${formatDate(b.checkIn)}</span>
              </div>
              <div class="detail-item">
                <strong>Check-out</strong>
                <span>${formatDate(b.checkOut)}</span>
              </div>
              <div class="detail-item">
                <strong>Diárias</strong>
                <span>${b.nights} noites</span>
              </div>
              <div class="detail-item">
                <strong>Pessoas</strong>
                <span>${b.guestsCount}</span>
              </div>
              <div class="detail-item">
                <strong>Valor a Receber</strong>
                <span style="font-weight:700; color:#0f766e;">R$ ${Number(b.totalPrice).toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div class="booking-actions">
            ${
              isPending
                ? `
                  <button class="btn-success" onclick="updateBookingStatus('${b.id}', 'confirmada')">✓ Confirmar</button>
                  <button class="btn-danger" onclick="updateBookingStatus('${b.id}', 'recusada')">✕ Recusar</button>
                `
                : `<span style="font-size:13px; font-weight:600; color:#64748b;">Status: ${b.status.toUpperCase()}</span>`
            }
          </div>
        </div>
      `;
    })
    .join('');
}

async function updateBookingStatus(bookingId, status) {
  try {
    const res = await fetch(`/api/admin/bookings/${bookingId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao alterar reserva.', 'error');
      return;
    }

    showToast(data.message, 'success');
    await loadManagerBookings();
  } catch (err) {
    showToast('Erro ao atualizar reserva.', 'error');
  }
}

async function loadManagerRooms() {
  try {
    const res = await fetch('/api/rooms');
    const rooms = await res.json();
    renderManagerRooms(rooms);
  } catch (err) {
    showToast('Erro ao carregar quartos para gerência.', 'error');
  }
}

function renderManagerRooms(rooms) {
  const container = document.getElementById('managerRoomsList');

  if (rooms.length === 0) {
    container.innerHTML = '<p>Nenhum quarto cadastrado.</p>';
    return;
  }

  container.innerHTML = rooms
    .map((r) => {
      return `
        <div class="manager-room-card">
          <img src="${escapeHtml(r.imageUrl)}" alt="${escapeHtml(r.name)}" onerror="this.src='https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'" />
          <h4 class="manager-room-title">${escapeHtml(r.name)}</h4>
          <span style="font-size:12px; color:#64748b; margin-top:2px;">${escapeHtml(r.category || 'Standard')} • Até ${r.capacity} pessoas</span>
          <span style="font-weight:700; color:var(--primary); margin-top:6px;">R$ ${Number(r.pricePerNight).toFixed(2)} / noite</span>
          <div class="manager-room-actions">
            <button class="btn-secondary" style="flex:1;" onclick="editRoom('${r.id}')">Editar</button>
            <button class="btn-danger" onclick="deleteRoom('${r.id}')">Excluir</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function openRoomModal(isEdit = false) {
  document.getElementById('roomModalTitle').innerText = isEdit ? 'Editar Quarto' : 'Cadastrar Novo Quarto';
  if (!isEdit) {
    document.getElementById('formRoom').reset();
    document.getElementById('editRoomId').value = '';
  }
  openModal('roomModal');
}

function editRoom(roomId) {
  const room = allRooms.find((r) => r.id === roomId);
  if (!room) return;

  document.getElementById('editRoomId').value = room.id;
  document.getElementById('roomNameInput').value = room.name;
  document.getElementById('roomCategoryInput').value = room.category || '';
  document.getElementById('roomCapacityInput').value = room.capacity;
  document.getElementById('roomPriceInput').value = room.pricePerNight;
  document.getElementById('roomImageInput').value = room.imageUrl || '';
  document.getElementById('roomAmenitiesInput').value = (room.amenities || []).join(', ');
  document.getElementById('roomDescInput').value = room.description || '';

  openRoomModal(true);
}

async function handleSaveRoom(e) {
  e.preventDefault();
  const id = document.getElementById('editRoomId').value;
  const name = document.getElementById('roomNameInput').value;
  const category = document.getElementById('roomCategoryInput').value;
  const capacity = document.getElementById('roomCapacityInput').value;
  const pricePerNight = document.getElementById('roomPriceInput').value;
  const imageUrl = document.getElementById('roomImageInput').value;
  const amenities = document.getElementById('roomAmenitiesInput').value;
  const description = document.getElementById('roomDescInput').value;

  const payload = { name, category, capacity, pricePerNight, imageUrl, amenities, description };

  try {
    const url = id ? `/api/admin/rooms/${id}` : '/api/admin/rooms';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao salvar quarto.', 'error');
      return;
    }

    closeModal('roomModal');
    showToast(data.message, 'success');
    await loadRooms();
    await loadManagerRooms();
  } catch (err) {
    showToast('Erro ao salvar quarto.', 'error');
  }
}

async function deleteRoom(roomId) {
  if (!confirm('Deseja realmente excluir este quarto?')) return;

  try {
    const res = await fetch(`/api/admin/rooms/${roomId}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao excluir quarto.', 'error');
      return;
    }

    showToast('Quarto excluído com sucesso!', 'success');
    await loadRooms();
    await loadManagerRooms();
  } catch (err) {
    showToast('Erro ao excluir quarto.', 'error');
  }
}

// ---------------- UTILITÁRIOS ----------------

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('open');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open');
}

function switchAuthMode(mode) {
  document.getElementById('tabLoginBtn').classList.toggle('active', mode === 'login');
  document.getElementById('tabRegisterBtn').classList.toggle('active', mode === 'register');
  document.getElementById('formLogin').style.display = mode === 'login' ? 'block' : 'none';
  document.getElementById('formRegister').style.display = mode === 'register' ? 'block' : 'none';
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.innerText = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';

  setTimeout(() => {
    toast.style.display = 'none';
  }, 4000);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function formatDateTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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

// Fecha modais ao clicar no fundo escuro
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('open');
  }
});
