let user = null;

function showMsg(msg) {
  document.getElementById('auth-msg').innerText = msg;
}

function register() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  fetch('/api/register', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ username, password })
  }).then(r => r.json()).then(data => {
    if (data.error) showMsg(data.error);
    else showMsg('Cadastro realizado! Faça login.');
  });
}

function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  fetch('/api/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ username, password })
  }).then(r => r.json()).then(data => {
    if (data.error) showMsg(data.error);
    else {
      showMsg('');
      checkLogin();
    }
  });
}

function logout() {
  fetch('/api/logout', { method: 'POST' }).then(() => location.reload());
}

function checkLogin() {
  fetch('/api/me').then(r => r.json()).then(data => {
    if (!data.user) return;
    user = data.user;
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('main-section').style.display = '';
    document.getElementById('welcome').innerText = `Olá, ${user.username}${user.is_admin ? ' (admin)' : ''}!`;
    if (user.is_admin) {
      document.getElementById('admin-section').style.display = '';
      loadAdmin();
    } else {
      document.getElementById('client-section').style.display = '';
      loadClient();
    }
  });
}

function loadClient() {
  // Serviços
  fetch('/api/services').then(r => r.json()).then(services => {
    const div = document.getElementById('services-list');
    div.innerHTML = '';
    services.forEach(s => {
      const el = document.createElement('div');
      el.className = 'service';
      el.innerHTML = `<b>${s.name}</b> - ${s.description} (${s.duration} min)
        <button onclick="showSlots(${s.id}, '${s.name}')">Ver horários</button>
        <div id="slots-${s.id}"></div>`;
      div.appendChild(el);
    });
  });
  // Meus agendamentos
  fetch('/api/my-appointments').then(r => r.json()).then(appts => {
    const div = document.getElementById('my-appointments');
    div.innerHTML = '';
    appts.forEach(a => {
      const el = document.createElement('div');
      el.className = 'appointment';
      el.innerHTML = `<b>${a.service}</b> - ${a.datetime} - Status: ${a.status}
        <button onclick="cancelAppointment(${a.id})">Cancelar</button>`;
      div.appendChild(el);
    });
  });
}

function showSlots(serviceId, serviceName) {
  fetch(`/api/services/${serviceId}/slots`).then(r => r.json()).then(slots => {
    const div = document.getElementById(`slots-${serviceId}`);
    div.innerHTML = '';
    if (slots.length === 0) div.innerHTML = '<i>Nenhum horário disponível</i>';
    slots.forEach(s => {
      const el = document.createElement('div');
      el.className = 'slot';
      el.innerHTML = `${s.datetime}
        <button onclick="bookSlot(${s.id})">Agendar</button>`;
      div.appendChild(el);
    });
  });
}

function bookSlot(slotId) {
  fetch('/api/appointments', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ slot_id: slotId })
  }).then(r => r.json()).then(data => {
    if (data.error) alert(data.error);
    else {
      alert('Agendamento realizado!');
      loadClient();
    }
  });
}

function cancelAppointment(id) {
  fetch('/api/cancel-appointment', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ id })
  }).then(r => r.json()).then(data => {
    if (data.error) alert(data.error);
    else {
      alert('Agendamento cancelado!');
      loadClient();
    }
  });
}

// ADMIN
function loadAdmin() {
  // Serviços
  fetch('/api/services').then(r => r.json()).then(services => {
    const div = document.getElementById('admin-services');
    div.innerHTML = '';
    const select = document.getElementById('slot-service');
    select.innerHTML = '';
    services.forEach(s => {
      const el = document.createElement('div');
      el.className = 'service';
      el.innerHTML = `<b>${s.name}</b> - ${s.description} (${s.duration} min)
        <button onclick="editService(${s.id}, '${s.name}', '${s.description}', ${s.duration})">Editar</button>
        <button onclick="deleteService(${s.id})">Excluir</button>`;
      div.appendChild(el);
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.innerText = s.name;
      select.appendChild(opt);
    });
  });
  // Horários
  fetch('/api/services').then(r => r.json()).then(services => {
    const div = document.getElementById('admin-slots');
    div.innerHTML = '';
    services.forEach(s => {
      fetch(`/api/services/${s.id}/slots`).then(r => r.json()).then(slots => {
        slots.forEach(sl => {
          const el = document.createElement('div');
          el.className = 'slot';
          el.innerHTML = `<b>${s.name}</b> - ${sl.datetime} - ${sl.available ? 'Disponível' : 'Ocupado'}
            <button onclick="editSlot(${sl.id}, '${sl.datetime}', ${sl.available})">Editar</button>
            <button onclick="deleteSlot(${sl.id})">Excluir</button>`;
          div.appendChild(el);
        });
      });
    });
  });
  // Todos agendamentos
  fetch('/api/all-appointments').then(r => r.json()).then(appts => {
    const div = document.getElementById('all-appointments');
    div.innerHTML = '';
    appts.forEach(a => {
      const el = document.createElement('div');
      el.className = 'appointment';
      el.innerHTML = `<b>${a.service}</b> - ${a.datetime} - Cliente: ${a.username} - Status: ${a.status}
        <button onclick="setStatus(${a.id}, 'confirmado')">Confirmar</button>
        <button onclick="setStatus(${a.id}, 'recusado')">Recusar</button>`;
      div.appendChild(el);
    });
  });
}

function addService() {
  const name = document.getElementById('service-name').value;
  const description = document.getElementById('service-desc').value;
  const duration = document.getElementById('service-duration').value;
  fetch('/api/services', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ name, description, duration })
  }).then(r => r.json()).then(data => {
    if (data.error) alert(data.error);
    else loadAdmin();
  });
}

function editService(id, name, description, duration) {
  const newName = prompt('Nome:', name);
  const newDesc = prompt('Descrição:', description);
  const newDuration = prompt('Duração (min):', duration);
  fetch(`/api/services/${id}`, {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ name: newName, description: newDesc, duration: newDuration })
  }).then(r => r.json()).then(data => {
    if (data.error) alert(data.error);
    else loadAdmin();
  });
}

function deleteService(id) {
  if (!confirm('Excluir serviço?')) return;
  fetch(`/api/services/${id}`, { method: 'DELETE' }).then(() => loadAdmin());
}

function addSlot() {
  const service_id = document.getElementById('slot-service').value;
  const datetime = document.getElementById('slot-datetime').value.replace('T', ' ');
  fetch('/api/slots', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ service_id, datetime })
  }).then(r => r.json()).then(data => {
    if (data.error) alert(data.error);
    else loadAdmin();
  });
}

function editSlot(id, datetime, available) {
  const newDatetime = prompt('Data e hora (AAAA-MM-DD HH:MM):', datetime);
  const newAvailable = prompt('Disponível? (1=sim, 0=não):', available);
  fetch(`/api/slots/${id}`, {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ datetime: newDatetime, available: newAvailable })
  }).then(r => r.json()).then(data => {
    if (data.error) alert(data.error);
    else loadAdmin();
  });
}

function deleteSlot(id) {
  if (!confirm('Excluir horário?')) return;
  fetch(`/api/slots/${id}`, { method: 'DELETE' }).then(() => loadAdmin());
}

function setStatus(id, status) {
  fetch('/api/appointment-status', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ id, status })
  }).then(r => r.json()).then(() => loadAdmin());
}

window.onload = checkLogin;
