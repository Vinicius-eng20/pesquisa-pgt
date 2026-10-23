// Estado da aplicação
let currentUser = null;
let currentView = 'events';
let allEvents = [];
let myRegistrations = [];
let allRegistrations = [];

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupEventListeners();
});

// Verificar autenticação
async function checkAuth() {
  try {
    const response = await fetch('/api/me');
    if (response.ok) {
      currentUser = await response.json();
      showMainScreen();
    } else {
      showAuthScreen();
    }
  } catch (error) {
    showAuthScreen();
  }
}

// Mostrar telas
function showAuthScreen() {
  document.getElementById('auth-screen').classList.add('active');
  document.getElementById('main-screen').classList.remove('active');
}

function showMainScreen() {
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('main-screen').classList.add('active');
  
  document.getElementById('user-name').textContent = currentUser.name;
  
  if (currentUser.role === 'organizador') {
    document.body.classList.add('organizador');
  } else {
    document.body.classList.remove('organizador');
  }
  
  loadCurrentView();
}

// Event Listeners
function setupEventListeners() {
  // Tabs de autenticação
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`${tab}-form`).classList.add('active');
    });
  });
  
  // Formulário de login
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        currentUser = data.user;
        showToast('Login realizado com sucesso!', 'success');
        showMainScreen();
      } else {
        showToast(data.error || 'Erro ao fazer login', 'error');
      }
    } catch (error) {
      showToast('Erro ao fazer login', 'error');
    }
  });
  
  // Formulário de registro
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const role = document.getElementById('register-role').value;
    
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showToast('Conta criada com sucesso! Faça login.', 'success');
        document.querySelector('[data-tab="login"]').click();
        document.getElementById('login-email').value = email;
      } else {
        showToast(data.error || 'Erro ao criar conta', 'error');
      }
    } catch (error) {
      showToast('Erro ao criar conta', 'error');
    }
  });
  
  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      currentUser = null;
      showToast('Logout realizado com sucesso!', 'success');
      showAuthScreen();
    } catch (error) {
      showToast('Erro ao fazer logout', 'error');
    }
  });
  
  // Menu lateral
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
      item.classList.add('active');
      currentView = view;
      loadCurrentView();
    });
  });
  
  // Formulário de criar evento
  document.getElementById('create-event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const eventData = {
      title: document.getElementById('event-title').value,
      description: document.getElementById('event-description').value,
      date: document.getElementById('event-date').value,
      location: document.getElementById('event-location').value,
      maxParticipants: document.getElementById('event-max').value
    };
    
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showToast('Evento criado com sucesso!', 'success');
        document.getElementById('create-event-form').reset();
        currentView = 'manage-events';
        document.querySelector('[data-view="manage-events"]').click();
      } else {
        showToast(data.error || 'Erro ao criar evento', 'error');
      }
    } catch (error) {
      showToast('Erro ao criar evento', 'error');
    }
  });
  
  // Formulário de editar evento
  document.getElementById('edit-event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const eventId = document.getElementById('edit-event-id').value;
    const eventData = {
      title: document.getElementById('edit-event-title').value,
      description: document.getElementById('edit-event-description').value,
      date: document.getElementById('edit-event-date').value,
      location: document.getElementById('edit-event-location').value,
      maxParticipants: document.getElementById('edit-event-max').value
    };
    
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showToast('Evento atualizado com sucesso!', 'success');
        closeModal();
        loadCurrentView();
      } else {
        showToast(data.error || 'Erro ao atualizar evento', 'error');
      }
    } catch (error) {
      showToast('Erro ao atualizar evento', 'error');
    }
  });
  
  // Fechar modal
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });
  
  document.getElementById('edit-modal').addEventListener('click', (e) => {
    if (e.target.id === 'edit-modal') {
      closeModal();
    }
  });
}

// Carregar view atual
async function loadCurrentView() {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`${currentView}-view`).classList.add('active');
  
  switch (currentView) {
    case 'events':
      await loadEvents();
      break;
    case 'my-registrations':
      await loadMyRegistrations();
      break;
    case 'manage-events':
      await loadManageEvents();
      break;
    case 'all-registrations':
      await loadAllRegistrations();
      break;
  }
}

// Carregar eventos disponíveis
async function loadEvents() {
  try {
    const response = await fetch('/api/events');
    allEvents = await response.json();
    
    const container = document.getElementById('events-list');
    
    if (allEvents.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📅</div>
          <h3>Nenhum evento disponível</h3>
          <p>Não há eventos cadastrados no momento.</p>
        </div>
      `;
      return;
    }
    
    // Carregar inscrições para verificar se já está inscrito
    const regResponse = await fetch('/api/registrations/my');
    const myRegs = await regResponse.json();
    const registeredEventIds = myRegs.map(r => r.eventId);
    
    container.innerHTML = allEvents.map(event => {
      const eventDate = new Date(event.date);
      const isRegistered = registeredEventIds.includes(event.id);
      
      // Contar inscrições ativas
      return `
        <div class="event-card">
          <h3>${event.title}</h3>
          <p>${event.description}</p>
          <div class="event-info">
            <div class="event-info-item">
              📅 ${eventDate.toLocaleDateString('pt-BR')} às ${eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div class="event-info-item">
              📍 ${event.location}
            </div>
            <div class="event-info-item">
              👥 ${event.maxParticipants} vagas
            </div>
          </div>
          <div class="event-actions">
            ${isRegistered 
              ? '<button class="btn btn-secondary" disabled>Já inscrito</button>'
              : `<button class="btn btn-primary" onclick="registerForEvent(${event.id})">Inscrever-se</button>`
            }
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    showToast('Erro ao carregar eventos', 'error');
  }
}

// Inscrever-se em evento
async function registerForEvent(eventId) {
  try {
    const response = await fetch('/api/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showToast('Inscrição realizada com sucesso!', 'success');
      loadEvents();
    } else {
      showToast(data.error || 'Erro ao fazer inscrição', 'error');
    }
  } catch (error) {
    showToast('Erro ao fazer inscrição', 'error');
  }
}

// Carregar minhas inscrições
async function loadMyRegistrations() {
  try {
    const response = await fetch('/api/registrations/my');
    myRegistrations = await response.json();
    
    const container = document.getElementById('my-registrations-list');
    
    if (myRegistrations.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <h3>Nenhuma inscrição</h3>
          <p>Você ainda não se inscreveu em nenhum evento.</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = myRegistrations.map(reg => {
      const event = reg.event;
      const eventDate = new Date(event.date);
      
      return `
        <div class="registration-card">
          <div class="registration-header">
            <h3>${event.title}</h3>
            <span class="registration-badge ${reg.status}">${reg.status}</span>
          </div>
          <div class="registration-info">
            <div class="registration-info-item">
              <strong>Data e Hora</strong>
              ${eventDate.toLocaleDateString('pt-BR')} às ${eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div class="registration-info-item">
              <strong>Local</strong>
              ${event.location}
            </div>
            <div class="registration-info-item">
              <strong>Presença</strong>
              ${reg.presence ? '✅ Confirmada' : '⏳ Pendente'}
            </div>
          </div>
          <p>${event.description}</p>
          <div class="registration-actions">
            <button class="btn btn-danger" onclick="cancelRegistration(${reg.id})">Cancelar Inscrição</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    showToast('Erro ao carregar inscrições', 'error');
  }
}

// Cancelar inscrição
async function cancelRegistration(registrationId) {
  if (!confirm('Tem certeza que deseja cancelar esta inscrição?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/registrations/${registrationId}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showToast('Inscrição cancelada com sucesso!', 'success');
      loadMyRegistrations();
    } else {
      showToast(data.error || 'Erro ao cancelar inscrição', 'error');
    }
  } catch (error) {
    showToast('Erro ao cancelar inscrição', 'error');
  }
}

// Carregar eventos para gerenciar (organizador)
async function loadManageEvents() {
  try {
    const response = await fetch('/api/events');
    const allEventsData = await response.json();
    
    // Filtrar apenas eventos do organizador atual
    const myEvents = allEventsData.filter(e => e.organizerId === currentUser.id);
    
    const container = document.getElementById('manage-events-list');
    
    if (myEvents.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚙️</div>
          <h3>Nenhum evento criado</h3>
          <p>Você ainda não criou nenhum evento.</p>
        </div>
      `;
      return;
    }
    
    // Carregar todas as inscrições para contar
    const regResponse = await fetch('/api/registrations/all');
    const allRegs = await regResponse.json();
    
    container.innerHTML = myEvents.map(event => {
      const eventDate = new Date(event.date);
      const eventRegs = allRegs.filter(r => r.eventId === event.id);
      const confirmedCount = eventRegs.filter(r => r.presence).length;
      
      return `
        <div class="event-card">
          <span class="event-status ${event.status}">${event.status}</span>
          <h3>${event.title}</h3>
          <p>${event.description}</p>
          <div class="event-info">
            <div class="event-info-item">
              📅 ${eventDate.toLocaleDateString('pt-BR')} às ${eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div class="event-info-item">
              📍 ${event.location}
            </div>
            <div class="event-info-item">
              👥 ${eventRegs.length}/${event.maxParticipants} inscritos
            </div>
            <div class="event-info-item">
              ✅ ${confirmedCount} presenças confirmadas
            </div>
          </div>
          <div class="event-actions">
            ${event.status === 'ativo' ? `
              <button class="btn btn-primary" onclick="editEvent(${event.id})">Editar</button>
              <button class="btn btn-danger" onclick="cancelEvent(${event.id})">Cancelar Evento</button>
            ` : '<button class="btn btn-secondary" disabled>Evento Cancelado</button>'}
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    showToast('Erro ao carregar eventos', 'error');
  }
}

// Editar evento
async function editEvent(eventId) {
  try {
    const response = await fetch(`/api/events/${eventId}`);
    const event = await response.json();
    
    document.getElementById('edit-event-id').value = event.id;
    document.getElementById('edit-event-title').value = event.title;
    document.getElementById('edit-event-description').value = event.description;
    
    // Formatar data para datetime-local
    const eventDate = new Date(event.date);
    const dateString = eventDate.toISOString().slice(0, 16);
    document.getElementById('edit-event-date').value = dateString;
    
    document.getElementById('edit-event-location').value = event.location;
    document.getElementById('edit-event-max').value = event.maxParticipants;
    
    document.getElementById('edit-modal').classList.add('active');
  } catch (error) {
    showToast('Erro ao carregar evento', 'error');
  }
}

// Cancelar evento
async function cancelEvent(eventId) {
  if (!confirm('Tem certeza que deseja cancelar este evento? Todos os inscritos serão notificados.')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/events/${eventId}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showToast('Evento cancelado com sucesso!', 'success');
      loadManageEvents();
    } else {
      showToast(data.error || 'Erro ao cancelar evento', 'error');
    }
  } catch (error) {
    showToast('Erro ao cancelar evento', 'error');
  }
}

// Carregar todas as inscrições (organizador)
async function loadAllRegistrations() {
  try {
    const response = await fetch('/api/registrations/all');
    allRegistrations = await response.json();
    
    const container = document.getElementById('all-registrations-list');
    
    if (allRegistrations.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">👥</div>
          <h3>Nenhuma inscrição</h3>
          <p>Ainda não há inscrições em eventos.</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = allRegistrations.map(reg => {
      const event = reg.event;
      const user = reg.user;
      const eventDate = new Date(event.date);
      
      return `
        <div class="registration-card">
          <div class="registration-header">
            <div>
              <h3>${event.title}</h3>
              <p style="margin-top: 4px; color: #666;">Participante: ${user.name} (${user.email})</p>
            </div>
            <span class="registration-badge ${reg.presence ? 'presente' : 'inscrito'}">
              ${reg.presence ? 'Presente' : 'Inscrito'}
            </span>
          </div>
          <div class="registration-info">
            <div class="registration-info-item">
              <strong>Data e Hora</strong>
              ${eventDate.toLocaleDateString('pt-BR')} às ${eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div class="registration-info-item">
              <strong>Local</strong>
              ${event.location}
            </div>
            <div class="registration-info-item">
              <strong>Inscrição</strong>
              ${new Date(reg.createdAt).toLocaleDateString('pt-BR')}
            </div>
          </div>
          ${event.organizerId === currentUser.id ? `
            <div class="registration-actions">
              <button class="btn ${reg.presence ? 'btn-secondary' : 'btn-success'}" 
                      onclick="togglePresence(${reg.id}, ${!reg.presence})">
                ${reg.presence ? 'Remover Presença' : 'Confirmar Presença'}
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  } catch (error) {
    showToast('Erro ao carregar inscrições', 'error');
  }
}

// Confirmar/remover presença
async function togglePresence(registrationId, presence) {
  try {
    const response = await fetch(`/api/registrations/${registrationId}/presence`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presence })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showToast(presence ? 'Presença confirmada!' : 'Presença removida!', 'success');
      loadAllRegistrations();
    } else {
      showToast(data.error || 'Erro ao atualizar presença', 'error');
    }
  } catch (error) {
    showToast('Erro ao atualizar presença', 'error');
  }
}

// Fechar modal
function closeModal() {
  document.getElementById('edit-modal').classList.remove('active');
}

// Toast de notificação
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
