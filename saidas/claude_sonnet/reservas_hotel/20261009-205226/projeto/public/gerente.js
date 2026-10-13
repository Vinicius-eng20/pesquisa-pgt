let currentUser = null;
let editingRoomId = null;

async function checkAuth() {
  try {
    const response = await fetch('/api/me');
    if (!response.ok) {
      window.location.href = '/login';
      return;
    }
    const user = await response.json();
    if (user.tipo !== 'gerente') {
      window.location.href = '/hospede';
      return;
    }
    currentUser = user;
    document.getElementById('userName').textContent = `Olá, ${user.nome}`;
    loadRooms();
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
    
    if (tabName === 'quartos') {
      loadRooms();
    } else if (tabName === 'reservas') {
      loadReservations();
    }
  });
});

const modal = document.getElementById('roomModal');
const closeBtn = document.querySelector('.close');
const cancelBtn = document.getElementById('cancelBtn');

document.getElementById('addRoomBtn').addEventListener('click', () => {
  editingRoomId = null;
  document.getElementById('modalTitle').textContent = 'Adicionar Quarto';
  document.getElementById('roomForm').reset();
  document.getElementById('roomId').value = '';
  modal.classList.add('show');
});

closeBtn.addEventListener('click', () => {
  modal.classList.remove('show');
});

cancelBtn.addEventListener('click', () => {
  modal.classList.remove('show');
});

window.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.classList.remove('show');
  }
});

document.getElementById('roomForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const roomId = document.getElementById('roomId').value;
  const numero = document.getElementById('numero').value;
  const tipo = document.getElementById('tipo').value;
  const capacidade = document.getElementById('capacidade').value;
  const precoPorNoite = document.getElementById('precoPorNoite').value;
  const descricao = document.getElementById('descricao').value;
  const comodidadesStr = document.getElementById('comodidades').value;
  const comodidades = comodidadesStr ? comodidadesStr.split(',').map(c => c.trim()).filter(c => c) : [];
  
  const errorDiv = document.getElementById('errorMessage');
  const successDiv = document.getElementById('successMessage');
  
  errorDiv.classList.remove('show');
  successDiv.classList.remove('show');
  
  try {
    const url = roomId ? `/api/rooms/${roomId}` : '/api/rooms';
    const method = roomId ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        numero,
        tipo,
        capacidade,
        precoPorNoite,
        descricao,
        comodidades
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      successDiv.textContent = roomId ? 'Quarto atualizado com sucesso!' : 'Quarto cadastrado com sucesso!';
      successDiv.classList.add('show');
      modal.classList.remove('show');
      await loadRooms();
      
      setTimeout(() => {
        successDiv.classList.remove('show');
      }, 3000);
    } else {
      errorDiv.textContent = data.error;
      errorDiv.classList.add('show');
    }
  } catch (error) {
    errorDiv.textContent = 'Erro ao salvar quarto. Tente novamente.';
    errorDiv.classList.add('show');
  }
});

async function loadRooms() {
  const roomsList = document.getElementById('roomsList');
  
  try {
    const response = await fetch('/api/rooms');
    const rooms = await response.json();
    
    if (rooms.length === 0) {
      roomsList.innerHTML = '<div class="empty-state"><h3>Nenhum quarto cadastrado</h3><p>Clique em "Novo Quarto" para adicionar</p></div>';
      return;
    }
    
    roomsList.innerHTML = rooms.map(room => `
      <div class="room-card">
        <div class="room-header">
          <div class="room-title">
            <h3>Quarto ${room.numero}</h3>
            <span class="room-type">${room.tipo}</span>
          </div>
          <div class="room-price">R$ ${room.precoPorNoite.toFixed(2)}<small>/noite</small></div>
        </div>
        
        <div class="room-info">
          <div class="info-item">
            <strong>👥 Capacidade:</strong> ${room.capacidade} pessoa${room.capacidade > 1 ? 's' : ''}
          </div>
        </div>
        
        ${room.descricao ? `<p class="room-description">${room.descricao}</p>` : ''}
        
        ${room.comodidades && room.comodidades.length > 0 ? `
          <div class="room-amenities">
            ${room.comodidades.map(c => `<span class="amenity-tag">${c}</span>`).join('')}
          </div>
        ` : ''}
        
        <div class="room-actions">
          <button class="btn btn-warning" onclick="editRoom(${room.id})">Editar</button>
          <button class="btn btn-danger" onclick="deleteRoom(${room.id})">Remover</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    roomsList.innerHTML = '<div class="empty-state"><h3>Erro ao carregar quartos</h3></div>';
  }
}

async function editRoom(roomId) {
  try {
    const response = await fetch('/api/rooms');
    const rooms = await response.json();
    const room = rooms.find(r => r.id === roomId);
    
    if (!room) {
      alert('Quarto não encontrado');
      return;
    }
    
    editingRoomId = roomId;
    document.getElementById('modalTitle').textContent = 'Editar Quarto';
    document.getElementById('roomId').value = room.id;
    document.getElementById('numero').value = room.numero;
    document.getElementById('tipo').value = room.tipo;
    document.getElementById('capacidade').value = room.capacidade;
    document.getElementById('precoPorNoite').value = room.precoPorNoite;
    document.getElementById('descricao').value = room.descricao || '';
    document.getElementById('comodidades').value = room.comodidades ? room.comodidades.join(', ') : '';
    
    modal.classList.add('show');
  } catch (error) {
    alert('Erro ao carregar dados do quarto');
  }
}

async function deleteRoom(roomId) {
  if (!confirm('Tem certeza que deseja remover este quarto?')) {
    return;
  }
  
  const errorDiv = document.getElementById('errorMessage');
  const successDiv = document.getElementById('successMessage');
  
  errorDiv.classList.remove('show');
  successDiv.classList.remove('show');
  
  try {
    const response = await fetch(`/api/rooms/${roomId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      successDiv.textContent = 'Quarto removido com sucesso!';
      successDiv.classList.add('show');
      await loadRooms();
      
      setTimeout(() => {
        successDiv.classList.remove('show');
      }, 3000);
    } else {
      const data = await response.json();
      errorDiv.textContent = data.error;
      errorDiv.classList.add('show');
    }
  } catch (error) {
    errorDiv.textContent = 'Erro ao remover quarto. Tente novamente.';
    errorDiv.classList.add('show');
  }
}

document.getElementById('statusFilter').addEventListener('change', loadReservations);

async function loadReservations() {
  const reservationsList = document.getElementById('reservationsList');
  const statusFilter = document.getElementById('statusFilter').value;
  
  try {
    const response = await fetch('/api/reservations');
    let reservations = await response.json();
    
    if (statusFilter) {
      reservations = reservations.filter(r => r.status === statusFilter);
    }
    
    reservations.sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));
    
    if (reservations.length === 0) {
      reservationsList.innerHTML = '<div class="empty-state"><h3>Nenhuma reserva encontrada</h3></div>';
      return;
    }
    
    reservationsList.innerHTML = reservations.map(reservation => {
      const dataInicio = new Date(reservation.dataInicio).toLocaleDateString('pt-BR');
      const dataFim = new Date(reservation.dataFim).toLocaleDateString('pt-BR');
      const dataCriacao = new Date(reservation.dataCriacao).toLocaleDateString('pt-BR');
      
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
              <strong>👤 Hóspede:</strong> ${reservation.hospede.nome}
            </div>
            <div class="info-item">
              <strong>📧 Email:</strong> ${reservation.hospede.email}
            </div>
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
              <strong>📆 Solicitado em:</strong> ${dataCriacao}
            </div>
          </div>
          
          <div class="reservation-actions">
            ${reservation.status === 'pendente' ? `
              <button class="btn btn-success" onclick="updateReservationStatus(${reservation.id}, 'confirmada')">Confirmar</button>
              <button class="btn btn-danger" onclick="updateReservationStatus(${reservation.id}, 'recusada')">Recusar</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    reservationsList.innerHTML = '<div class="empty-state"><h3>Erro ao carregar reservas</h3></div>';
  }
}

async function updateReservationStatus(reservationId, status) {
  const confirmMsg = status === 'confirmada' ? 'Confirmar esta reserva?' : 'Recusar esta reserva?';
  
  if (!confirm(confirmMsg)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/reservations/${reservationId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    
    if (response.ok) {
      await loadReservations();
    } else {
      const data = await response.json();
      alert(data.error || 'Erro ao atualizar reserva');
    }
  } catch (error) {
    alert('Erro ao atualizar reserva. Tente novamente.');
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
