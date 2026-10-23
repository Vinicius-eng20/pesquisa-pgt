let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadAdminData();
  showTab('pendingServices');
});

async function checkAuth() {
  try {
    const response = await fetch('/api/me');
    if (!response.ok) {
      window.location.href = '/';
      return;
    }
    currentUser = await response.json();
    
    if (currentUser.role !== 'admin') {
      window.location.href = '/dashboard';
      return;
    }
    
    document.getElementById('userName').textContent = currentUser.name;
  } catch (error) {
    window.location.href = '/';
  }
}

async function loadAdminData() {
  await loadPendingServices();
  await loadAllServices();
  await loadUsers();
  await loadAllContracts();
}

async function loadPendingServices() {
  try {
    const response = await fetch('/api/services');
    const services = await response.json();
    const pending = services.filter(s => s.status === 'pending');
    
    const container = document.getElementById('pendingServicesList');
    
    if (pending.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <h3>Nenhum serviço pendente</h3>
          <p>Não há serviços aguardando aprovação no momento.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = pending.map(service => `
      <div class="service-card">
        <div class="service-header">
          <div>
            <div class="service-title">${service.title}</div>
            <div class="service-category">${getCategoryName(service.category)}</div>
          </div>
          <span class="service-status status-pending">Pendente</span>
        </div>
        <div class="service-provider">Por: ${service.userName}</div>
        <div class="service-description">${service.description}</div>
        <div class="service-footer">
          <div class="service-price">R$ ${service.price.toFixed(2)}</div>
        </div>
        <div class="service-actions">
          <button class="btn btn-success btn-small" onclick="approveService(${service.id})">
            Aprovar
          </button>
          <button class="btn btn-danger btn-small" onclick="deleteServiceAdmin(${service.id})">
            Remover
          </button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Erro ao carregar serviços pendentes:', error);
  }
}

async function loadAllServices() {
  try {
    const response = await fetch('/api/services');
    let services = await response.json();
    
    const statusFilter = document.getElementById('statusFilter')?.value;
    if (statusFilter) {
      services = services.filter(s => s.status === statusFilter);
    }
    
    const container = document.getElementById('allServicesList');
    
    if (services.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <h3>Nenhum serviço encontrado</h3>
          <p>Não há serviços cadastrados no sistema.</p>
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
            ${service.status === 'pending' ? 'Pendente' : 'Aprovado'}
          </span>
        </div>
        <div class="service-provider">Por: ${service.userName}</div>
        <div class="service-description">${service.description}</div>
        <div class="service-footer">
          <div class="service-price">R$ ${service.price.toFixed(2)}</div>
        </div>
        <div class="service-actions">
          ${service.status === 'pending' ? `
            <button class="btn btn-success btn-small" onclick="approveService(${service.id})">
              Aprovar
            </button>
          ` : ''}
          <button class="btn btn-danger btn-small" onclick="deleteServiceAdmin(${service.id})">
            Remover
          </button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Erro ao carregar todos os serviços:', error);
  }
}

async function loadUsers() {
  try {
    const response = await fetch('/api/admin/users');
    const users = await response.json();
    
    const container = document.getElementById('usersList');
    
    container.innerHTML = users.map(user => `
      <div class="user-card">
        <div class="user-name">${user.name}</div>
        <div class="user-email">${user.email}</div>
        <div>
          <span class="user-role">${user.role === 'admin' ? 'Administrador' : 'Usuário'}</span>
          ${user.suspended ? '<span class="user-suspended">Suspensa</span>' : ''}
        </div>
        <div style="margin-top: 10px; font-size: 12px; color: #999;">
          Cadastro: ${new Date(user.createdAt).toLocaleDateString('pt-BR')}
        </div>
        ${user.role !== 'admin' ? `
          <div class="user-actions">
            <button class="btn ${user.suspended ? 'btn-success' : 'btn-danger'} btn-small" 
                    onclick="toggleSuspendUser(${user.id}, ${user.suspended})">
              ${user.suspended ? 'Reativar' : 'Suspender'}
            </button>
          </div>
        ` : ''}
      </div>
    `).join('');
  } catch (error) {
    console.error('Erro ao carregar usuários:', error);
  }
}

async function loadAllContracts() {
  try {
    const response = await fetch('/api/contracts');
    const contracts = await response.json();
    
    const container = document.getElementById('allContractsList');
    
    if (contracts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <h3>Nenhum contrato encontrado</h3>
          <p>Não há contratos registrados no sistema.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = contracts.map(contract => `
      <div class="contract-card">
        <div class="contract-header">
          <div class="contract-title">${contract.serviceTitle}</div>
        </div>
        <div class="contract-info">
          <div class="contract-info-item">
            <div class="contract-info-label">Cliente</div>
            <div class="contract-info-value">${contract.clientName}</div>
          </div>
          <div class="contract-info-item">
            <div class="contract-info-label">Prestador</div>
            <div class="contract-info-value">${contract.providerName}</div>
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
    `).join('');
  } catch (error) {
    console.error('Erro ao carregar contratos:', error);
  }
}

async function approveService(serviceId) {
  try {
    const response = await fetch(`/api/services/${serviceId}/approve`, {
      method: 'PATCH'
    });

    if (response.ok) {
      showModal('Sucesso', 'Serviço aprovado com sucesso!');
      await loadPendingServices();
      await loadAllServices();
    } else {
      const data = await response.json();
      showModal('Erro', data.error);
    }
  } catch (error) {
    showModal('Erro', 'Erro ao aprovar serviço. Tente novamente.');
  }
}

async function deleteServiceAdmin(serviceId) {
  if (!confirm('Deseja realmente remover este serviço?')) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/services/${serviceId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      showModal('Sucesso', 'Serviço removido com sucesso!');
      await loadPendingServices();
      await loadAllServices();
    } else {
      const data = await response.json();
      showModal('Erro', data.error);
    }
  } catch (error) {
    showModal('Erro', 'Erro ao remover serviço. Tente novamente.');
  }
}

async function toggleSuspendUser(userId, isSuspended) {
  const action = isSuspended ? 'reativar' : 'suspender';
  if (!confirm(`Deseja realmente ${action} esta conta?`)) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/users/${userId}/suspend`, {
      method: 'PATCH'
    });

    if (response.ok) {
      showModal('Sucesso', `Conta ${isSuspended ? 'reativada' : 'suspensa'} com sucesso!`);
      await loadUsers();
    } else {
      const data = await response.json();
      showModal('Erro', data.error);
    }
  } catch (error) {
    showModal('Erro', 'Erro ao modificar conta. Tente novamente.');
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

function goToDashboard() {
  window.location.href = '/dashboard';
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
  } catch (error) {
    window.location.href = '/';
  }
}
