document.addEventListener('DOMContentLoaded', () => {
  const authSection = document.getElementById('auth-section');
  const mainSection = document.getElementById('main-section');
  const participantView = document.getElementById('participant-view');
  const organizerView = document.getElementById('organizer-view');

  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const name = localStorage.getItem('name');

  // Se já estiver logado, mostra a tela principal
  if (token) {
    showMainSection(role, name);
  }

  // --- LÓGICA DE AUTENTICAÇÃO ---
  const showLoginBtn = document.getElementById('show-login-btn');
  const showRegisterBtn = document.getElementById('show-register-btn');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  showLoginBtn.addEventListener('click', () => {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    showLoginBtn.classList.add('active');
    showRegisterBtn.classList.remove('active');
  });

  showRegisterBtn.addEventListener('click', () => {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    showLoginBtn.classList.remove('active');
    showRegisterBtn.classList.add('active');
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userData = {
      name: document.getElementById('register-name').value,
      email: document.getElementById('register-email').value,
      password: document.getElementById('register-password').value,
      role: document.getElementById('register-role').value
    };
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await res.json();
      alert(data.message);
      if (res.ok) {
        registerForm.reset();
        showLoginBtn.click(); // Volta para a tela de login
      }
    } catch (error) {
      alert('Erro ao cadastrar.');
    }
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const credentials = {
      email: document.getElementById('login-email').value,
      password: document.getElementById('login-password').value
    };
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('role', data.role);
        localStorage.setItem('name', data.name);
        showMainSection(data.role, data.name);
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Erro ao fazer login.');
    }
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.clear();
    window.location.reload();
  });

  function showMainSection(userRole, userName) {
    authSection.style.display = 'none';
    mainSection.style.display = 'block';
    document.getElementById('welcome-message').textContent = `Olá, ${userName}!`;

    if (userRole === 'participante') {
      participantView.style.display = 'block';
      loadAvailableEvents();
      loadMyRegistrations();
    } else if (userRole === 'organizador') {
      organizerView.style.display = 'block';
      loadAdminEvents();
    }
  }

  // --- LÓGICA DAS ABAS ---
  document.querySelectorAll('.tab-link').forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
      document.querySelectorAll('.tab-link').forEach(link => link.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      button.classList.add('active');
    });
  });

  // --- FUNÇÕES DO PARTICIPANTE ---
  async function loadAvailableEvents() {
    const res = await fetch('/api/events', { headers: { 'Authorization': `Bearer ${token}` } });
    const events = await res.json();
    const list = document.getElementById('events-list');
    list.innerHTML = '';
    if (events.length === 0) {
      list.innerHTML = '<p>Nenhum evento disponível no momento.</p>';
      return;
    }
    events.forEach(event => {
      const card = document.createElement('div');
      card.className = 'event-card';
      card.innerHTML = `
        <h4>${event.title}</h4>
        <p><strong>Data:</strong> ${new Date(event.date).toLocaleString('pt-BR')}</p>
        <p><strong>Local:</strong> ${event.location}</p>
        <p>${event.description}</p>
        <button class="subscribe" data-event-id="${event.id}">Inscrever-se</button>
      `;
      list.appendChild(card);
    });
  }

  async function loadMyRegistrations() {
    const res = await fetch('/api/my-registrations', { headers: { 'Authorization': `Bearer ${token}` } });
    const registrations = await res.json();
    const list = document.getElementById('my-registrations-list');
    list.innerHTML = '';
    if (registrations.length === 0) {
      list.innerHTML = '<p>Você ainda não se inscreveu em nenhum evento.</p>';
      return;
    }
    registrations.forEach(reg => {
      const card = document.createElement('div');
      card.className = 'event-card';
      const statusText = reg.status === 'presente' ? '<span style="color: green;">Presença Confirmada</span>' : 'Inscrito';
      const eventStatus = reg.event_status === 'cancelado' ? '<p class="status-cancelado">Este evento foi cancelado.</p>' : '';
      card.innerHTML = `
        <h4>${reg.title}</h4>
        <p><strong>Data:</strong> ${new Date(reg.date).toLocaleString('pt-BR')}</p>
        <p><strong>Status:</strong> ${statusText}</p>
        ${eventStatus}
        <button class="cancel" data-reg-id="${reg.registration_id}">Cancelar Inscrição</button>
      `;
      list.appendChild(card);
    });
  }

  document.getElementById('events-list').addEventListener('click', async (e) => {
    if (e.target.classList.contains('subscribe')) {
      const eventId = e.target.getAttribute('data-event-id');
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ eventId })
      });
      const data = await res.json();
      alert(data.message);
      if (res.ok) {
        loadMyRegistrations(); // Atualiza a lista de "Minhas Inscrições"
      }
    }
  });

  document.getElementById('my-registrations-list').addEventListener('click', async (e) => {
    if (e.target.classList.contains('cancel')) {
      const regId = e.target.getAttribute('data-reg-id');
      if (confirm('Tem certeza que deseja cancelar esta inscrição?')) {
        const res = await fetch(`/api/registrations/${regId}/cancel`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        alert(data.message);
        if (res.ok) {
          loadMyRegistrations();
        }
      }
    }
  });

  // --- FUNÇÕES DO ORGANIZADOR ---
  const eventForm = document.getElementById('event-form');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');

  async function loadAdminEvents() {
    const res = await fetch('/api/admin/events', { headers: { 'Authorization': `Bearer ${token}` } });
    const events = await res.json();
    const list = document.getElementById('admin-events-list');
    list.innerHTML = '';
    events.forEach(event => {
      const card = document.createElement('div');
      card.className = 'event-card';
      const status = event.status === 'cancelado' ? '<p class="status-cancelado">CANCELADO</p>' : '';
      card.innerHTML = `
        <h4>${event.title}</h4>
        <p><strong>Data:</strong> ${new Date(event.date).toLocaleString('pt-BR')}</p>
        ${status}
        <button class="edit" data-event='${JSON.stringify(event)}'>Editar</button>
        <button class="cancel" data-event-id="${event.id}" ${event.status === 'cancelado' ? 'disabled' : ''}>Cancelar Evento</button>
        <button class="details" data-event-id="${event.id}" data-event-title="${event.title}">Ver Inscrições</button>
      `;
      list.appendChild(card);
    });
  }

  eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const eventId = document.getElementById('event-id').value;
    const eventData = {
      title: document.getElementById('event-title').value,
      description: document.getElementById('event-description').value,
      date: document.getElementById('event-date').value,
      location: document.getElementById('event-location').value
    };

    const url = eventId ? `/api/events/${eventId}` : '/api/events';
    const method = eventId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(eventData)
    });
    const data = await res.json();
    alert(data.message);
    if (res.ok) {
      resetEventForm();
      loadAdminEvents();
      // Muda para a aba de gerenciar para ver o resultado
      document.querySelector('[data-tab="manage-events"]').click();
    }
  });

  document.getElementById('admin-events-list').addEventListener('click', async (e) => {
    if (e.target.classList.contains('edit')) {
      const event = JSON.parse(e.target.getAttribute('data-event'));
      document.getElementById('form-title').textContent = 'Editar Evento';
      document.getElementById('event-id').value = event.id;
      document.getElementById('event-title').value = event.title;
      document.getElementById('event-description').value = event.description;
      document.getElementById('event-date').value = event.date;
      document.getElementById('event-location').value = event.location;
      cancelEditBtn.style.display = 'inline-block';
      document.querySelector('[data-tab="create-event"]').click();
    }

    if (e.target.classList.contains('cancel')) {
      const eventId = e.target.getAttribute('data-event-id');
      if (confirm('Tem certeza que deseja cancelar este evento?')) {
        const res = await fetch(`/api/events/${eventId}/cancel`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        alert(data.message);
        if (res.ok) loadAdminEvents();
      }
    }

    if (e.target.classList.contains('details')) {
      const eventId = e.target.getAttribute('data-event-id');
      const eventTitle = e.target.getAttribute('data-event-title');
      openRegistrationsModal(eventId, eventTitle);
    }
  });

  cancelEditBtn.addEventListener('click', resetEventForm);

  function resetEventForm() {
    eventForm.reset();
    document.getElementById('event-id').value = '';
    document.getElementById('form-title').textContent = 'Criar Novo Evento';
    cancelEditBtn.style.display = 'none';
  }

  // --- LÓGICA DO MODAL DE INSCRIÇÕES ---
  const modal = document.getElementById('registrations-modal');
  const closeBtn = document.querySelector('.close-btn');

  async function openRegistrationsModal(eventId, eventTitle) {
    document.getElementById('modal-event-title').textContent = `Inscrições para: ${eventTitle}`;
    const res = await fetch(`/api/events/${eventId}/registrations`, { headers: { 'Authorization': `Bearer ${token}` } });
    const registrations = await res.json();
    const tableBody = document.querySelector('#registrations-table tbody');
    tableBody.innerHTML = '';
    if (registrations.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="4">Nenhuma inscrição para este evento.</td></tr>';
    } else {
      registrations.forEach(reg => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${reg.name}</td>
          <td>${reg.email}</td>
          <td>${reg.status}</td>
          <td>
            ${reg.status === 'inscrito' ? `<button class="confirm-presence" data-reg-id="${reg.id}">Confirmar Presença</button>` : ''}
          </td>
        `;
        tableBody.appendChild(row);
      });
    }
    modal.style.display = 'block';
  }

  closeBtn.onclick = () => { modal.style.display = 'none'; }
  window.onclick = (event) => {
    if (event.target == modal) {
      modal.style.display = 'none';
    }
  }

  document.getElementById('registrations-table').addEventListener('click', async (e) => {
    if (e.target.classList.contains('confirm-presence')) {
      const regId = e.target.getAttribute('data-reg-id');
      const res = await fetch(`/api/registrations/${regId}/confirm`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      alert(data.message);
      if (res.ok) {
        // Atualiza o modal sem fechá-lo
        const row = e.target.closest('tr');
        row.cells[2].textContent = 'presente';
        e.target.remove();
      }
    }
  });
});
