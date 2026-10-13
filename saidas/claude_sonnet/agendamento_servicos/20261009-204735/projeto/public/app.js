// Estado da aplicação
let usuarioAtual = null;
let servicos = [];
let horarios = [];
let agendamentos = [];

// Utilitários
function mostrarErro(mensagem, elementoId = 'auth-erro') {
  const elemento = document.getElementById(elementoId);
  if (elemento) {
    elemento.textContent = mensagem;
    elemento.classList.add('show');
    setTimeout(() => elemento.classList.remove('show'), 5000);
  }
}

function mostrarModal(mensagem) {
  const modal = document.getElementById('modal');
  const modalMessage = document.getElementById('modal-message');
  modalMessage.textContent = mensagem;
  modal.classList.add('show');
}

function fecharModal() {
  document.getElementById('modal').classList.remove('show');
}

function formatarData(data) {
  const d = new Date(data + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}

function formatarPreco(preco) {
  return parseFloat(preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getDiaSemanaTexto(dia) {
  const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return dias[dia];
}

// API calls
async function fazerRequisicao(url, opcoes = {}) {
  try {
    const resposta = await fetch(url, {
      ...opcoes,
      headers: {
        'Content-Type': 'application/json',
        ...opcoes.headers,
      },
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.erro || 'Erro na requisição');
    }

    return dados;
  } catch (erro) {
    console.error('Erro:', erro);
    throw erro;
  }
}

// Autenticação
async function verificarAutenticacao() {
  try {
    const dados = await fazerRequisicao('/api/usuario-atual');
    
    if (dados.autenticado) {
      usuarioAtual = dados.usuario;
      mostrarTelaCorreta();
    } else {
      mostrarTela('auth-screen');
    }
  } catch (erro) {
    mostrarTela('auth-screen');
  }
}

function mostrarTela(telaId) {
  document.querySelectorAll('.screen').forEach(tela => {
    tela.style.display = 'none';
  });
  document.getElementById(telaId).style.display = 'block';
}

function mostrarTelaCorreta() {
  if (!usuarioAtual) {
    mostrarTela('auth-screen');
    return;
  }

  if (usuarioAtual.tipo === 'admin') {
    document.getElementById('admin-nome').textContent = usuarioAtual.nome;
    mostrarTela('admin-screen');
    carregarDadosAdmin();
  } else {
    document.getElementById('user-nome').textContent = usuarioAtual.nome;
    mostrarTela('cliente-screen');
    carregarDadosCliente();
  }
}

// Eventos de autenticação
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const dados = Object.fromEntries(formData);

  try {
    const resposta = await fazerRequisicao('/api/login', {
      method: 'POST',
      body: JSON.stringify(dados),
    });

    usuarioAtual = resposta.usuario;
    mostrarTelaCorreta();
  } catch (erro) {
    mostrarErro(erro.message);
  }
});

document.getElementById('registro-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const dados = Object.fromEntries(formData);

  try {
    const resposta = await fazerRequisicao('/api/registrar', {
      method: 'POST',
      body: JSON.stringify(dados),
    });

    usuarioAtual = resposta.usuario;
    mostrarTelaCorreta();
  } catch (erro) {
    mostrarErro(erro.message);
  }
});

// Tabs de autenticação
document.querySelectorAll('.auth-container .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    
    document.querySelectorAll('.auth-container .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    document.getElementById('login-form').style.display = tabName === 'login' ? 'block' : 'none';
    document.getElementById('registro-form').style.display = tabName === 'registro' ? 'block' : 'none';
  });
});

// Logout
document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('admin-logout-btn').addEventListener('click', logout);

async function logout() {
  try {
    await fazerRequisicao('/api/logout', { method: 'POST' });
    usuarioAtual = null;
    mostrarTela('auth-screen');
  } catch (erro) {
    console.error('Erro ao fazer logout:', erro);
  }
}

// Tabs gerais
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('tab')) {
    const container = e.target.closest('.container') || e.target.closest('.auth-container');
    if (!container) return;

    const tabName = e.target.dataset.tab;
    
    container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');

    container.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = 'none';
    });

    const targetContent = document.getElementById(tabName);
    if (targetContent) {
      targetContent.style.display = 'block';
    }
  }
});

// Modal
document.getElementById('modal-ok').addEventListener('click', fecharModal);

// === CLIENTE ===

async function carregarDadosCliente() {
  await carregarServicos();
  await carregarAgendamentosCliente();
  configurarDataMinima();
}

function configurarDataMinima() {
  const inputData = document.getElementById('input-data');
  const hoje = new Date();
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  inputData.min = amanha.toISOString().split('T')[0];
}

async function carregarServicos() {
  try {
    servicos = await fazerRequisicao('/api/servicos');
    renderizarServicos();
  } catch (erro) {
    console.error('Erro ao carregar serviços:', erro);
  }
}

function renderizarServicos() {
  const select = document.getElementById('select-servico');
  select.innerHTML = '<option value="">Selecione um serviço</option>';
  
  servicos.forEach(servico => {
    const option = document.createElement('option');
    option.value = servico.id;
    option.textContent = `${servico.nome} - ${formatarPreco(servico.preco)}`;
    select.appendChild(option);
  });
}

document.getElementById('select-servico').addEventListener('change', (e) => {
  const servicoId = e.target.value;
  const infoServico = document.getElementById('info-servico');
  
  if (!servicoId) {
    infoServico.innerHTML = '';
    return;
  }

  const servico = servicos.find(s => s.id == servicoId);
  if (servico) {
    infoServico.innerHTML = `
      <strong>${servico.nome}</strong><br>
      ${servico.descricao ? servico.descricao + '<br>' : ''}
      Duração: ${servico.duracao} minutos<br>
      Valor: ${formatarPreco(servico.preco)}
    `;
  }
});

document.getElementById('input-data').addEventListener('change', async (e) => {
  const data = e.target.value;
  const servicoId = document.getElementById('select-servico').value;
  const selectHorario = document.getElementById('select-horario');

  if (!data || !servicoId) {
    selectHorario.innerHTML = '<option value="">Selecione um serviço e uma data</option>';
    return;
  }

  try {
    const horariosLivres = await fazerRequisicao(`/api/horarios-livres/${data}/${servicoId}`);
    
    selectHorario.innerHTML = '<option value="">Selecione um horário</option>';
    
    if (horariosLivres.length === 0) {
      selectHorario.innerHTML = '<option value="">Nenhum horário disponível</option>';
      return;
    }

    horariosLivres.forEach(horario => {
      const option = document.createElement('option');
      option.value = horario;
      option.textContent = horario;
      selectHorario.appendChild(option);
    });
  } catch (erro) {
    console.error('Erro ao carregar horários:', erro);
    selectHorario.innerHTML = '<option value="">Erro ao carregar horários</option>';
  }
});

document.getElementById('form-novo-agendamento').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const dados = Object.fromEntries(formData);

  try {
    await fazerRequisicao('/api/agendamentos', {
      method: 'POST',
      body: JSON.stringify(dados),
    });

    mostrarModal('Agendamento realizado com sucesso!');
    e.target.reset();
    document.getElementById('info-servico').innerHTML = '';
    await carregarAgendamentosCliente();
  } catch (erro) {
    mostrarModal('Erro ao realizar agendamento: ' + erro.message);
  }
});

async function carregarAgendamentosCliente() {
  try {
    agendamentos = await fazerRequisicao('/api/agendamentos');
    renderizarAgendamentosCliente();
  } catch (erro) {
    console.error('Erro ao carregar agendamentos:', erro);
  }
}

function renderizarAgendamentosCliente() {
  const container = document.getElementById('lista-agendamentos-cliente');
  
  if (agendamentos.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><p>Você ainda não tem agendamentos</p></div>';
    return;
  }

  container.innerHTML = agendamentos.map(agendamento => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${agendamento.servico_nome}</div>
        <span class="status-badge status-${agendamento.status}">${agendamento.status.toUpperCase()}</span>
      </div>
      <div class="card-body">
        <div class="card-info">
          <div class="card-info-row">
            <span class="card-info-label">Data:</span>
            <span>${formatarData(agendamento.data)}</span>
          </div>
          <div class="card-info-row">
            <span class="card-info-label">Horário:</span>
            <span>${agendamento.hora}</span>
          </div>
          <div class="card-info-row">
            <span class="card-info-label">Valor:</span>
            <span>${formatarPreco(agendamento.servico_preco)}</span>
          </div>
          ${agendamento.observacoes ? `
            <div class="card-info-row">
              <span class="card-info-label">Observações:</span>
              <span>${agendamento.observacoes}</span>
            </div>
          ` : ''}
        </div>
      </div>
      ${agendamento.status === 'pendente' || agendamento.status === 'confirmado' ? `
        <div class="card-actions">
          <button class="btn btn-danger btn-small" onclick="cancelarAgendamento(${agendamento.id})">
            Cancelar Agendamento
          </button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

async function cancelarAgendamento(id) {
  if (!confirm('Tem certeza que deseja cancelar este agendamento?')) {
    return;
  }

  try {
    await fazerRequisicao(`/api/agendamentos/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'cancelado' }),
    });

    mostrarModal('Agendamento cancelado com sucesso');
    await carregarAgendamentosCliente();
  } catch (erro) {
    mostrarModal('Erro ao cancelar agendamento: ' + erro.message);
  }
}

// === ADMIN ===

async function carregarDadosAdmin() {
  await carregarServicosAdmin();
  await carregarHorariosAdmin();
  await carregarAgendamentosAdmin();
}

// Serviços Admin
async function carregarServicosAdmin() {
  try {
    servicos = await fazerRequisicao('/api/servicos');
    renderizarServicosAdmin();
  } catch (erro) {
    console.error('Erro ao carregar serviços:', erro);
  }
}

function renderizarServicosAdmin() {
  const container = document.getElementById('lista-servicos');
  
  if (servicos.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Nenhum serviço cadastrado</p></div>';
    return;
  }

  container.innerHTML = servicos.map(servico => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${servico.nome}</div>
        <span class="status-badge ${servico.ativo ? 'status-confirmado' : 'status-cancelado'}">
          ${servico.ativo ? 'ATIVO' : 'INATIVO'}
        </span>
      </div>
      <div class="card-body">
        ${servico.descricao ? `<p>${servico.descricao}</p>` : ''}
        <div class="card-info">
          <div class="card-info-row">
            <span class="card-info-label">Duração:</span>
            <span>${servico.duracao} minutos</span>
          </div>
          <div class="card-info-row">
            <span class="card-info-label">Preço:</span>
            <span>${formatarPreco(servico.preco)}</span>
          </div>
        </div>
      </div>
      <div class="card-actions">
        <button class="btn btn-primary btn-small" onclick="editarServico(${servico.id})">
          Editar
        </button>
        ${servico.ativo ? `
          <button class="btn btn-danger btn-small" onclick="deletarServico(${servico.id})">
            Desativar
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

document.getElementById('btn-novo-servico').addEventListener('click', () => {
  document.getElementById('form-servico').reset();
  document.getElementById('form-servico-container').style.display = 'block';
});

document.getElementById('btn-cancelar-servico').addEventListener('click', () => {
  document.getElementById('form-servico-container').style.display = 'none';
  document.getElementById('form-servico').reset();
});

document.getElementById('form-servico').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const dados = Object.fromEntries(formData);
  
  const id = dados.id;
  delete dados.id;

  try {
    if (id) {
      dados.ativo = 1;
      await fazerRequisicao(`/api/servicos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(dados),
      });
      mostrarModal('Serviço atualizado com sucesso');
    } else {
      await fazerRequisicao('/api/servicos', {
        method: 'POST',
        body: JSON.stringify(dados),
      });
      mostrarModal('Serviço criado com sucesso');
    }

    document.getElementById('form-servico-container').style.display = 'none';
    e.target.reset();
    await carregarServicosAdmin();
  } catch (erro) {
    mostrarModal('Erro ao salvar serviço: ' + erro.message);
  }
});

function editarServico(id) {
  const servico = servicos.find(s => s.id === id);
  if (!servico) return;

  const form = document.getElementById('form-servico');
  form.elements['id'].value = servico.id;
  form.elements['nome'].value = servico.nome;
  form.elements['descricao'].value = servico.descricao;
  form.elements['duracao'].value = servico.duracao;
  form.elements['preco'].value = servico.preco;

  document.getElementById('form-servico-container').style.display = 'block';
  form.scrollIntoView({ behavior: 'smooth' });
}

async function deletarServico(id) {
  if (!confirm('Tem certeza que deseja desativar este serviço?')) {
    return;
  }

  try {
    await fazerRequisicao(`/api/servicos/${id}`, {
      method: 'DELETE',
    });
    mostrarModal('Serviço desativado com sucesso');
    await carregarServicosAdmin();
  } catch (erro) {
    mostrarModal('Erro ao desativar serviço: ' + erro.message);
  }
}

// Horários Admin
async function carregarHorariosAdmin() {
  try {
    horarios = await fazerRequisicao('/api/horarios-disponiveis');
    renderizarHorariosAdmin();
  } catch (erro) {
    console.error('Erro ao carregar horários:', erro);
  }
}

function renderizarHorariosAdmin() {
  const container = document.getElementById('lista-horarios');
  
  if (horarios.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Nenhum horário cadastrado</p></div>';
    return;
  }

  container.innerHTML = horarios.map(horario => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${getDiaSemanaTexto(horario.dia_semana)}</div>
      </div>
      <div class="card-body">
        <div class="card-info">
          <div class="card-info-row">
            <span class="card-info-label">Horário:</span>
            <span>${horario.hora_inicio} às ${horario.hora_fim}</span>
          </div>
        </div>
      </div>
      <div class="card-actions">
        <button class="btn btn-danger btn-small" onclick="deletarHorario(${horario.id})">
          Remover
        </button>
      </div>
    </div>
  `).join('');
}

document.getElementById('btn-novo-horario').addEventListener('click', () => {
  document.getElementById('form-horario').reset();
  document.getElementById('form-horario-container').style.display = 'block';
});

document.getElementById('btn-cancelar-horario').addEventListener('click', () => {
  document.getElementById('form-horario-container').style.display = 'none';
  document.getElementById('form-horario').reset();
});

document.getElementById('form-horario').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const dados = Object.fromEntries(formData);

  try {
    await fazerRequisicao('/api/horarios-disponiveis', {
      method: 'POST',
      body: JSON.stringify(dados),
    });

    mostrarModal('Horário criado com sucesso');
    document.getElementById('form-horario-container').style.display = 'none';
    e.target.reset();
    await carregarHorariosAdmin();
  } catch (erro) {
    mostrarModal('Erro ao criar horário: ' + erro.message);
  }
});

async function deletarHorario(id) {
  if (!confirm('Tem certeza que deseja remover este horário?')) {
    return;
  }

  try {
    await fazerRequisicao(`/api/horarios-disponiveis/${id}`, {
      method: 'DELETE',
    });
    mostrarModal('Horário removido com sucesso');
    await carregarHorariosAdmin();
  } catch (erro) {
    mostrarModal('Erro ao remover horário: ' + erro.message);
  }
}

// Agendamentos Admin
async function carregarAgendamentosAdmin() {
  try {
    agendamentos = await fazerRequisicao('/api/agendamentos');
    renderizarAgendamentosAdmin();
  } catch (erro) {
    console.error('Erro ao carregar agendamentos:', erro);
  }
}

function renderizarAgendamentosAdmin() {
  const container = document.getElementById('lista-agendamentos-admin');
  
  if (agendamentos.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Nenhum agendamento registrado</p></div>';
    return;
  }

  container.innerHTML = agendamentos.map(agendamento => `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">${agendamento.servico_nome}</div>
          <small>${agendamento.cliente_nome} (${agendamento.cliente_email})</small>
        </div>
        <span class="status-badge status-${agendamento.status}">${agendamento.status.toUpperCase()}</span>
      </div>
      <div class="card-body">
        <div class="card-info">
          <div class="card-info-row">
            <span class="card-info-label">Data:</span>
            <span>${formatarData(agendamento.data)}</span>
          </div>
          <div class="card-info-row">
            <span class="card-info-label">Horário:</span>
            <span>${agendamento.hora}</span>
          </div>
          ${agendamento.observacoes ? `
            <div class="card-info-row">
              <span class="card-info-label">Observações:</span>
              <span>${agendamento.observacoes}</span>
            </div>
          ` : ''}
        </div>
      </div>
      ${agendamento.status === 'pendente' ? `
        <div class="card-actions">
          <button class="btn btn-success btn-small" onclick="confirmarAgendamento(${agendamento.id})">
            Confirmar
          </button>
          <button class="btn btn-danger btn-small" onclick="recusarAgendamento(${agendamento.id})">
            Recusar
          </button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

async function confirmarAgendamento(id) {
  try {
    await fazerRequisicao(`/api/agendamentos/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'confirmado' }),
    });

    mostrarModal('Agendamento confirmado com sucesso');
    await carregarAgendamentosAdmin();
  } catch (erro) {
    mostrarModal('Erro ao confirmar agendamento: ' + erro.message);
  }
}

async function recusarAgendamento(id) {
  if (!confirm('Tem certeza que deseja recusar este agendamento?')) {
    return;
  }

  try {
    await fazerRequisicao(`/api/agendamentos/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'recusado' }),
    });

    mostrarModal('Agendamento recusado');
    await carregarAgendamentosAdmin();
  } catch (erro) {
    mostrarModal('Erro ao recusar agendamento: ' + erro.message);
  }
}

// Inicialização
verificarAutenticacao();
