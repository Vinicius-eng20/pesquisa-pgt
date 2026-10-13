let currentUser = null;
let searchDates = { dataInicio: null, dataFim: null };

async function checkAuth() {
  try {
    const response = await fetch('/api/me');
    if (!response.ok) {
      window.location.href = '/login';
      return;
    }
    const user = await response.json();
    if (user.tipo !== 'hospede') {
      window.location.href = '/gerente';
      return;
    }
    currentUser = user;
    document.getElementById('userName').textContent = `Olá, ${user.nome}`;
  } catch (error) {
    window.location.href = '/login';
  }
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/';
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    btn.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    if (tabName === 'minhas') {
      loadReservations();
    }
  });
});

const today = new Date().toISOString().split('T')[0];
document.getElementById('dataInicio').setAttribute('min', today);
document.getElementById('dataFim').setAttribute('min', today);

document.getElementById('dataInicio').addEventListener('change', (e) => {
  document.getElementById('dataFim').setAttribute('min', e.target.value);
});

document.getElementById('searchForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const dataInicio = document.getElementById('dataInicio').value;
  const dataFim = document.getElementById('dataFim').value;
  const errorDiv = document.getElementById('errorMessage');
  const successDiv = document.getElementById('successMessage');
  
  errorDiv.textContent = '';
  errorDiv.classList.remove('show');
  successDiv.classList.remove('show');
  
  if (new Date(dataInicio) >= new Date(dataFim)) {
    errorDiv.textContent = 'A data de saída deve ser posterior à data de entrada';
    errorDiv.classList.add('show');
    return;
  }
  
  searchDates = { dataInicio, dataFim };
  await loadRooms();
});

async function loadRooms() {
  const roomsList = document.getElementById('roomsList');
  
  try {
    const params = new URLSearchParams(searchDates);
    const response = await fetch(`/api/rooms?${params}`);
    const rooms = await response.json();
    
    if (rooms.length === 0) {
      roomsList.innerHTML = '<div class="empty-state"><h3>Nenhum quarto encontrado</h3><p>Tente outras datas</p></div>';
      return;
    }
    
    roomsList.innerHTML = rooms.map(room => `
      <div class="room-card ${!room.disponivel ? 'unavailable' : ''}">
        <div class="room-header">
          <div class="room-title">
            <h3>Quarto ${room.numero}</h3>
            <span class="room-type">${room.tipo}</span>
          </div>
          <div class="room-price">R$ ${room.precoPorNoite.toFixed(2)}<small>/noite</small></div>
        </div>
        
        <div class="room-info">
          <div class="info-item">
            <strong>👥</strong> ${room.capacidade} pessoa${room.capacidade > 1 ? 's' : ''}
          </div>
          ${!room.disponivel ? '<div class="info-item"><strong>❌</strong> Indisponível</div>' : '<div class="info-item"><strong>✅</strong> Disponível</div>'}
        </div>
        
        ${room.descricao ? `<p class="room-description">${room.descricao}</p>` : ''}
        
        ${room.comodidades && room.comodidades.length > 0 ? `
          <div class="room-amenities">
            ${room.comodidades.map(c => `<span class="amenity-tag">${c}</span>`).join('')}
          </div>
        ` : ''}
        
        <div class="room-actions">
          ${room.disponivel ? `
            <button class="btn btn-primary" onclick="makeReservation(${room.id})">Reservar</button>
          ` : `
            <button class="btn btn-secondary" disabled>Indisponível</button>
          `}
        </div>
      </div>
    `).join('');
  } catch (error) {
    roomsList.innerHTML = '<div class="empty-state"><h3>Erro ao carregar quartos</h3></div>';
  }
}

async function makeReservation(quartoId) {
  if (!searchDates.dataInicio || !searchDates.dataFim) {
    alert('Por favor, selecione as datas antes de reservar');
    return;
  }
  
  const errorDiv = document.getElementById('errorMessage');
  const successDiv = document.getElementById('successMessage');
  
  errorDiv.classList.remove('show');
  successDiv.classList.remove('show');
  
  try {
    const response = await fetch('/api/reservations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        quartoId,
        dataInicio: searchDates.dataInicio,
        dataFim: searchDates.dataFim
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      successDiv.textContent = 'Reserva solicitada com sucesso! Aguarde confirmação do gerente.';
      successDiv.classList.add('show');
      await loadRooms();
      
      setTimeout(() => {
        document.querySelector('[data-tab="minhas"]').click();
      }, 2000);
    } else {
      errorDiv.textContent = data.error;
      errorDiv.classList.add('show');
    }
  } catch (error) {
    errorDiv.textContent = 'Erro ao fazer reserva. Tente novamente.';
    errorDiv.classList.add('show');
  }
}

async function loadReservations() {
  const reservationsList = document.getElementById('reservationsList');
  
  try {
    const response = await fetch('/api/reservations');
    const reservations = await response.json();
    
    if (reservations.length === 0) {
      reservationsList.innerHTML = '<div class="empty-state"><h3>Você não tem reservas</h3><p>Busque quartos disponíveis e faça sua primeira reserva</p></div>';
      return;
    }
    
    reservationsList.innerHTML = reservations.map(reservation => {
      const dataInicio = new Date(reservation.dataInicio).toLocaleDateString('pt-BR');
      const dataFim = new Date(reservation.dataFim).toLocaleDateString('pt-BR');
      
      return `
        <div class="reservation-card">
          <div class="reservation-header">
            <div>
              <h3>Quarto ${reservation.quarto.numero} - ${reservation.quarto.tipo}</h3>
              <span class="status-badge status-${reservation.status}">${getStatusText(reservation.status)}</span>
            </div>
          </div>
          
          <div class="reservation-info">
            <div class="info-item">
              <strong>📅 Check-in:</strong> ${dataInicio}
            </div>
            <div class="info-item">
              <strong>📅 Check-out:</strong> ${dataFim}
            </div>
            <div class="info-item">
              <strong>💰 Valor Total:</strong> R$ ${reservation.valorTotal.toFixed(2)}
            </div>
            <div class="info-item">
              <strong>👥 Capacidade:</strong> ${reservation.quarto.capacidade} pessoa${reservation.quarto.capacidade > 1 ? 's' : ''}
            </div>
          </div>
          
          ${reservation.quarto.descricao ? `<p class="room-description">${reservation.quarto.descricao}</p>` : ''}
          
          <div class="reservation-actions">
            ${reservation.status === 'pendente' || reservation.status === 'confirmada' ? `
              <button class="btn btn-danger" onclick="cancelReservation(${reservation.id})">Cancelar Reserva</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    reservationsList.innerHTML = '<div class="empty-state"><h3>Erro ao carregar reservas</h3></div>';
  }
}

async function cancelReservation(reservationId) {
  if (!confirm('Tem certeza que deseja cancelar esta reserva?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/reservations/${reservationId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'cancelada' })
    });
    
    if (response.ok) {
      await loadReservations();
    } else {
      const data = await response.json();
      alert(data.error || 'Erro ao cancelar reserva');
    }
  } catch (error) {
    alert('Erro ao cancelar reserva. Tente novamente.');
  }
}

function getStatusText(status) {
  const statusMap = {
    pendente: 'Pendente',
    confirmada: 'Confirmada',
    recusada: 'Recusada',
    cancelada: 'Cancelada'
  };
  return statusMap[status] || status;
}

checkAuth();
