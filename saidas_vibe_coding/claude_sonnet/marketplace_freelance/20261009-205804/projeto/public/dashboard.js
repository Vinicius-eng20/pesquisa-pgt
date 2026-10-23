let currentUser = null;
let allServices = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadUserData();
  showTab('services');
});

async function checkAuth() {
  try {
    const response = await fetch('/api/me');
    if (!response.ok) {
      window.location.href = '/';
      return;
    }
    currentUser = await response.json();
    document.getElementById('userName').textContent = currentUser.name;
  } catch (error) {
    window.location.href = '/';
  }
}

async function loadUserData() {
  await loadServices();
  await loadMyServices();
  await loadContracts();
}

async function loadServices() {
  try {
    const response = await fetch('/api/services');
    allServices = await response.json();
    filterServices();
  } catch (error) {
    console.error('Erro ao carregar serviços:', error);
  }
}

function filterServices() {
  const category = document.getElementById('categoryFilter').value;
  let filtered = allServices.filter(s => s.status === 'approved');
  
  if (category) {
    filtered = filtered.filter(s => s.category === category);
  }

  const container = document.getElementById('servicesList');
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <h3>Nenhum serviço encontrado</h3>
        <p>Não há serviços disponíveis nesta categoria no momento.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(service => `
    <div class="service-card">
      <div class="service-header">
        <div>
          <div class="service-title">${service.title}</div>
          <div class="service-category">${getCategoryName(service.category)}</div>
        </div>
      </div>
      <div class="service-provider">Por: ${service.userName}</div>
      <div class="service-description">${service.description}</div>
      <div class="service-footer">
        <div class="service-price">R$ ${service.price.toFixed(2)}</div>
      </div>
      ${service.userId !== currentUser.id ? `
        <div class="service-actions">
          <button class="btn btn-primary btn-small" onclick="hireService(${service.id})">
            Contratar Serviço
          </button>
        </div>
      ` : '<p style="margin-top: 15px; color: #999; font-size: 14px;">Este é seu serviço</p>'}
    </div>
  `).join('');
}

async function loadMyServices() {
  try {
    const response = await fetch('/api/services/my');
    const services = await response.json();
    
    const container = document.getElementById('myServicesList');
    
    if (services.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <h3>Nenhum serviço publicado</h3>
          <p>Você ainda não publicou nenhum serviço. Clique em "Publicar Serviço" para começar!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = services.map(service => `
      <div class="service-card">
        <div class="service-header">
          <div>
            <div class="service-title">${service.title}</div>
            <div class="service-category">${getCategoryName(service.category)}</div>
          </div>
          <span class="service-status status-${service.status}">
            ${service.status === 'pending' ? 'Aguardando Aprovação' : 'Aprovado'}
          </span>
        </div>
        <div class="service-description">${service.description}</div>
        <div class="service-footer">
          <div class="service-price">R$ ${service.price.toFixed(2)}</div>
        </div>
        <div class="service-actions">
          <button class="btn btn-danger btn-small" onclick="deleteService(${service.id})">
            Excluir
          </button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Erro ao carregar meus serviços:', error);
  }
}

async function loadContracts() {
  try {
    const response = await fetch('/api/contracts');
    const contracts = await response.json();
    
    window.allContracts = contracts;
    displayContracts(contracts);
  } catch (error) {
    console.error('Erro ao carregar contratos:', error);
  }
}

function filterContracts(type) {
  const buttons = document.querySelectorAll('.contracts-filter .filter-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');

  let filtered = window.allContracts;
  
  if (type === 'client') {
    filtered = filtered.filter(c => c.clientId === currentUser.id);
  } else if (type === 'provider') {
    filtered = filtered.filter(c => c.providerId === currentUser.id);
  }

  displayContracts(filtered);
}

function displayContracts(contracts) {
  const container = document.getElementById('contractsList');
  
  if (contracts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>Nenhum contrato encontrado</h3>
        <p>Você ainda não tem contratos ativos.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = contracts.map(contract => {
    const isClient = contract.clientId === currentUser.id;
    return `
      <div class="contract-card">
        <div class="contract-header">
          <div class="contract-title">${contract.serviceTitle}</div>
        </div>
        <div class="contract-info">
          <div class="contract-info-item">
            <div class="contract-info-label">Tipo</div>
            <div class="contract-info-value">${isClient ? '👤 Cliente' : '⚙️ Prestador'}</div>
          </div>
          <div class="contract-info-item">
            <div class="contract-info-label">${isClient ? 'Prestador' : 'Cliente'}</div>
            <div class="contract-info-value">${isClient ? contract.providerName : contract.clientName}</div>
          </div>
          <div class="contract-info-item">
            <div class="contract-info-label">Valor</div>
            <div class="contract-info-value">R$ ${contract.price.toFixed(2)}</div>
          </div>
          <div class="contract-info-item">
            <div class="contract-info-label">Data</div>
            <div class="contract-info-value">${new Date(contract.createdAt).toLocaleDateString('pt-BR')}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

document.getElementById('publishForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const title = document.getElementById('serviceTitle').value;
  const description = document.getElementById('serviceDescription').value;
  const price = document.getElementById('servicePrice').value;
  const category = document.getElementById('serviceCategory').value;

  try {
    const response = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, price, category })
    });

    const data = await response.json();

    if (response.ok) {
      showModal('Sucesso', 'Serviço publicado! Aguarde a aprovação do administrador.');
      document.getElementById('publishForm').reset();
      await loadMyServices();
    } else {
      showModal('Erro', data.error);
    }
  } catch (error) {
    showModal('Erro', 'Erro ao publicar serviço. Tente novamente.');
  }
});

async function hireService(serviceId) {
  if (!confirm('Deseja realmente contratar este serviço?')) {
    return;
  }

  try {
    const response = await fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId })
    });

    const data = await response.json();

    if (response.ok) {
      showModal('Sucesso', 'Serviço contratado com sucesso!');
      await loadContracts();
      showTab('contracts');
    } else {
      showModal('Erro', data.error);
    }
  } catch (error) {
    showModal('Erro', 'Erro ao contratar serviço. Tente novamente.');
  }
}

async function deleteService(serviceId) {
  if (!confirm('Deseja realmente excluir este serviço?')) {
    return;
  }

  try {
    const response = await fetch(`/api/services/${serviceId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      showModal('Sucesso', 'Serviço excluído com sucesso!');
      await loadMyServices();
    } else {
      const data = await response.json();
      showModal('Erro', data.error);
    }
  } catch (error) {
    showModal('Erro', 'Erro ao excluir serviço. Tente novamente.');
  }
}

function showTab(tabName) {
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  event?.target?.classList.add('active');
  document.getElementById(tabName + 'Tab').classList.add('active');
}

function showModal(title, message) {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modalBody');
  
  modalBody.innerHTML = `
    <h2>${title}</h2>
    <p style="margin-top: 15px; color: #666;">${message}</p>
    <button class="btn btn-primary" onclick="closeModal()" style="margin-top: 20px; width: 100%;">
      OK
    </button>
  `;
  
  modal.classList.add('show');
}

function closeModal() {
  document.getElementById('modal').classList.remove('show');
}

function getCategoryName(category) {
  const categories = {
    design: 'Design',
    programacao: 'Programação',
    marketing: 'Marketing',
    redacao: 'Redação',
    traducao: 'Tradução',
    consultoria: 'Consultoria',
    outros: 'Outros'
  };
  return categories[category] || category;
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
  } catch (error) {
    window.location.href = '/';
  }
}
