let usuario = null;
let token = null;
let paginaAtual = 'login';

// Inicializar
window.onload = () => {
  token = localStorage.getItem('token');
  const usuarioSalvo = localStorage.getItem('usuario');
  
  if (token && usuarioSalvo) {
    usuario = JSON.parse(usuarioSalvo);
    paginaAtual = usuario.tipo === 'admin' ? 'admin-agendamentos' : 'servicos';
  }
  
  renderizar();
};

function renderizar() {
  const app = document.getElementById('app');
  
  if (!usuario) {
    if (paginaAtual === 'registro') {
      app.innerHTML = renderizarRegistro();
    } else {
      app.innerHTML = renderizarLogin();
    }
  } else if (usuario.tipo === 'admin') {
    app.innerHTML = renderizarAdmin();
  } else {
    app.innerHTML = renderizarCliente();
  }
  
  anexarEventos();
}

// ========== AUTENTICAÇÃO ==========

function renderizarLogin() {
  return `
    <div class="auth-container">
      <div class="card">
        <h2>Entrar</h2>
        <div id="mensagem"></div>
        <form id="form-login">
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="email" required>
          </div>
          <div class="form-group">
            <label>Senha</label>
            <input type="password" id="senha" required>
          </div>
          <button type="submit" style="width: 100%">Entrar</button>
        </form>
        <div class="auth-links">
          <a onclick="mostrarRegistro()">Não tem conta? Cadastre-se</a>
        </div>
      </div>
    </div>
  `;
}

function renderizarRegistro() {
  return `
    <div class="auth-container">
      <div class="card">
        <h2>Criar Conta</h2>
        <div id="mensagem"></div>
        <form id="form-registro">
          <div class="form-group">
            <label>Nome</label>
            <input type="text" id="nome" required>
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="email" required>
          </div>
          <div class="form-group">
            <label>Senha</label>
            <input type="password" id="senha" required minlength="6">
          </div>
          <button type="submit" style="width: 100%">Cadastrar</button>
        </form>
        <div class="auth-links">
          <a onclick="mostrarLogin()">Já tem conta? Entre aqui</a>
        </div>
      </div>
    </div>
  `;
}

function mostrarLogin() {
  paginaAtual = 'login';
  renderizar();
}

function mostrarRegistro() {
  paginaAtual = 'registro';
  renderizar();
}

async function fazerLogin(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const senha = document.getElementById('senha').value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });

    const dados = await res.json();

    if (!res.ok) {
      mostrarMensagem(dados.erro, 'erro');
      return;
    }

    token = dados.token;
    usuario = dados.usuario;
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(usuario));
    
    paginaAtual = usuario.tipo === 'admin' ? 'admin-agendamentos' : 'servicos';
    renderizar();
  } catch (err) {
    mostrarMensagem('Erro ao fazer login', 'erro');
  }
}

async function fazerRegistro(e) {
  e.preventDefault();
  const nome = document.getElementById('nome').value;
  const email = document.getElementById('email').value;
  const senha = document.getElementById('senha').value;

  try {
    const res = await fetch('/api/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha })
    });

    const dados = await res.json();

    if (!res.ok) {
      mostrarMensagem(dados.erro, 'erro');
      return;
    }

    mostrarMensagem('Conta criada! Faça login.', 'sucesso');
    setTimeout(() => mostrarLogin(), 2000);
  } catch (err) {
    mostrarMensagem('Erro ao criar conta', 'erro');
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  usuario = null;
  token = null;
  paginaAtual = 'login';
  renderizar();
}

// ========== CLIENTE ==========

function renderizarCliente() {
  return `
    <header>
      <div class="container">
        <h1>Sistema de Agendamento</h1>
        <div>
          <span style="margin-right: 15px">Olá, ${usuario.nome}</span>
          <button class="logout-btn" onclick="logout()">Sair</button>
        </div>
      </div>
    </header>
    <nav>
      <div class="container">
        <button class="${paginaAtual === 'servicos' ? 'active' : ''}" onclick="mudarPagina('servicos')">Serviços</button>
        <button class="${paginaAtual === 'meus-agendamentos' ? 'active' : ''}" onclick="mudarPagina('meus-agendamentos')">Meus Agendamentos</button>
      </div>
    </nav>
    <div class="container" id="conteudo"></div>
  `;
}

async function renderizarServicos() {
  const res = await fetch('/api/servicos', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const servicos = await res.json();

  const html = `
    <h2 style="margin-bottom: 20px">Serviços Disponíveis</h2>
    <div class="grid">
      ${servicos.map(s => `
        <div class="servico-card">
          <h3>${s.nome}</h3>
          <p class="servico-info">${s.descricao || ''}</p>
          <p class="servico-info">Duração: ${s.duracao} minutos</p>
          <p class="servico-preco">R$ ${s.preco.toFixed(2)}</p>
          <button onclick="agendarServico(${s.id})" style="width: 100%">Agendar</button>
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('conteudo').innerHTML = html;
}

async function renderizarMeusAgendamentos() {
  const res = await fetch('/api/agendamentos/meus', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const agendamentos = await res.json();

  const html = `
    <h2 style="margin-bottom: 20px">Meus Agendamentos</h2>
    ${agendamentos.length === 0 ? '<div class="card"><p>Você ainda não tem agendamentos.</p></div>' : ''}
    ${agendamentos.map(a => `
      <div class="agendamento-item">
        <div class="agendamento-info">
          <h3>${a.servico_nome}</h3>
          <p><strong>Data:</strong> ${formatarData(a.data)} às ${a.hora}</p>
          <p><strong>Duração:</strong> ${a.duracao} minutos</p>
          <p><strong>Valor:</strong> R$ ${a.preco.toFixed(2)}</p>
          ${a.observacoes ? `<p><strong>Observações:</strong> ${a.observacoes}</p>` : ''}
        </div>
        <div>
          <span class="status status-${a.status}">${a.status.toUpperCase()}</span>
          ${a.status !== 'cancelado' ? `
            <button class="btn-danger" onclick="cancelarAgendamento(${a.id})" style="margin-top: 10px">Cancelar</button>
          ` : ''}
        </div>
      </div>
    `).join('')}
  `;

  document.getElementById('conteudo').innerHTML = html;
}

async function agendarServico(servicoId) {
  const hoje = new Date().toISOString().split('T')[0];
  
  document.getElementById('conteudo').innerHTML = `
    <div class="card">
      <h2 style="margin-bottom: 20px">Agendar Serviço</h2>
      <div id="mensagem"></div>
      <div class="form-group">
        <label>Selecione a data</label>
        <input type="date" id="data-agendamento" min="${hoje}" value="${hoje}">
      </div>
      <div id="horarios-container"></div>
      <div id="form-agendamento" style="display: none">
        <div class="form-group">
          <label>Observações (opcional)</label>
          <textarea id="observacoes" rows="3"></textarea>
        </div>
        <button onclick="confirmarAgendamento(${servicoId})" style="width: 100%">Confirmar Agendamento</button>
      </div>
      <button class="btn-secondary" onclick="mudarPagina('servicos')" style="margin-top: 10px">Voltar</button>
    </div>
  `;

  document.getElementById('data-agendamento').addEventListener('change', (e) => {
    carregarHorariosDisponiveis(e.target.value);
  });

  carregarHorariosDisponiveis(hoje);
}

async function carregarHorariosDisponiveis(data) {
  const res = await fetch(`/api/horarios/${data}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const horarios = await res.json();

  const container = document.getElementById('horarios-container');
  
  if (horarios.length === 0) {
    container.innerHTML = '<p style="margin: 20px 0">Nenhum horário disponível nesta data.</p>';
    return;
  }

  container.innerHTML = `
    <label style="margin-top: 20px; display: block">Selecione o horário</label>
    <div class="horarios-grid">
      ${horarios.map(h => `
        <div class="horario-btn ${h.disponivel ? '' : 'disabled'}" 
             ${h.disponivel ? `onclick="selecionarHorario('${h.hora}')"` : ''}>
          ${h.hora}
        </div>
      `).join('')}
    </div>
  `;
}

let horarioSelecionado = null;

function selecionarHorario(hora) {
  horarioSelecionado = hora;
  document.querySelectorAll('.horario-btn').forEach(btn => {
    btn.classList.remove('selected');
    if (btn.textContent.trim() === hora) {
      btn.classList.add('selected');
    }
  });
  document.getElementById('form-agendamento').style.display = 'block';
}

async function confirmarAgendamento(servicoId) {
  const data = document.getElementById('data-agendamento').value;
  const observacoes = document.getElementById('observacoes').value;

  if (!horarioSelecionado) {
    mostrarMensagem('Selecione um horário', 'erro');
    return;
  }

  try {
    const res = await fetch('/api/agendamentos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        servico_id: servicoId,
        data: data,
        hora: horarioSelecionado,
        observacoes
      })
    });

    const dados = await res.json();

    if (!res.ok) {
      mostrarMensagem(dados.erro, 'erro');
      return;
    }

    mostrarMensagem('Agendamento realizado com sucesso!', 'sucesso');
    setTimeout(() => mudarPagina('meus-agendamentos'), 2000);
  } catch (err) {
    mostrarMensagem('Erro ao agendar', 'erro');
  }
}

async function cancelarAgendamento(id) {
  if (!confirm('Deseja realmente cancelar este agendamento?')) return;

  try {
    const res = await fetch(`/api/agendamentos/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      const dados = await res.json();
      alert(dados.erro);
      return;
    }

    mudarPagina('meus-agendamentos');
  } catch (err) {
    alert('Erro ao cancelar agendamento');
  }
}

// ========== ADMIN ==========

function renderizarAdmin() {
  return `
    <header>
      <div class="container">
        <h1>Painel Administrativo</h1>
        <div>
          <span style="margin-right: 15px">Olá, ${usuario.nome}</span>
          <button class="logout-btn" onclick="logout()">Sair</button>
        </div>
      </div>
    </header>
    <nav>
      <div class="container">
        <button class="${paginaAtual === 'admin-agendamentos' ? 'active' : ''}" onclick="mudarPagina('admin-agendamentos')">Agendamentos</button>
        <button class="${paginaAtual === 'admin-servicos' ? 'active' : ''}" onclick="mudarPagina('admin-servicos')">Serviços</button>
        <button class="${paginaAtual === 'admin-horarios' ? 'active' : ''}" onclick="mudarPagina('admin-horarios')">Horários</button>
      </div>
    </nav>
    <div class="container" id="conteudo"></div>
  `;
}

async function renderizarAdminAgendamentos() {
  const res = await fetch('/api/agendamentos/todos', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const agendamentos = await res.json();

  const html = `
    <h2 style="margin-bottom: 20px">Todos os Agendamentos</h2>
    ${agendamentos.length === 0 ? '<div class="card"><p>Nenhum agendamento ainda.</p></div>' : ''}
    ${agendamentos.map(a => `
      <div class="agendamento-item">
        <div class="agendamento-info">
          <h3>${a.servico_nome}</h3>
          <p><strong>Cliente:</strong> ${a.cliente_nome} (${a.cliente_email})</p>
          <p><strong>Data:</strong> ${formatarData(a.data)} às ${a.hora}</p>
          <p><strong>Duração:</strong> ${a.duracao} minutos | <strong>Valor:</strong> R$ ${a.preco.toFixed(2)}</p>
          ${a.observacoes ? `<p><strong>Observações:</strong> ${a.observacoes}</p>` : ''}
        </div>
        <div>
          <span class="status status-${a.status}">${a.status.toUpperCase()}</span>
          <div style="margin-top: 10px; display: flex; gap: 5px; flex-wrap: wrap">
            ${a.status === 'pendente' ? `
              <button class="btn-success" onclick="alterarStatus(${a.id}, 'confirmado')">Confirmar</button>
              <button class="btn-danger" onclick="alterarStatus(${a.id}, 'cancelado')">Recusar</button>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('')}
  `;

  document.getElementById('conteudo').innerHTML = html;
}

async function alterarStatus(id, status) {
  try {
    const res = await fetch(`/api/agendamentos/${id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });

    if (!res.ok) {
      alert('Erro ao alterar status');
      return;
    }

    mudarPagina('admin-agendamentos');
  } catch (err) {
    alert('Erro ao alterar status');
  }
}

async function renderizarAdminServicos() {
  const res = await fetch('/api/servicos/todos', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const servicos = await res.json();

  const html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px">
      <h2>Serviços</h2>
      <button onclick="mostrarFormServico()">Novo Serviço</button>
    </div>
    <div id="modal-servico" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="modal-titulo">Novo Serviço</h3>
          <button class="modal-close" onclick="fecharModal('modal-servico')">&times;</button>
        </div>
        <form id="form-servico">
          <input type="hidden" id="servico-id">
          <div class="form-group">
            <label>Nome</label>
            <input type="text" id="servico-nome" required>
          </div>
          <div class="form-group">
            <label>Descrição</label>
            <textarea id="servico-descricao" rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>Duração (minutos)</label>
            <input type="number" id="servico-duracao" required min="1">
          </div>
          <div class="form-group">
            <label>Preço (R$)</label>
            <input type="number" id="servico-preco" required min="0" step="0.01">
          </div>
          <button type="submit" style="width: 100%">Salvar</button>
        </form>
      </div>
    </div>
    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Duração</th>
            <th>Preço</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${servicos.map(s => `
            <tr>
              <td>${s.nome}</td>
              <td>${s.duracao} min</td>
              <td>R$ ${s.preco.toFixed(2)}</td>
              <td>${s.ativo ? 'Ativo' : 'Inativo'}</td>
              <td>
                <button onclick="editarServico(${s.id})" style="padding: 6px 12px; margin-right: 5px">Editar</button>
                ${s.ativo ? `
                  <button class="btn-danger" onclick="desativarServico(${s.id})" style="padding: 6px 12px">Desativar</button>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('conteudo').innerHTML = html;

  document.getElementById('form-servico').addEventListener('submit', salvarServico);
}

function mostrarFormServico() {
  document.getElementById('modal-titulo').textContent = 'Novo Serviço';
  document.getElementById('form-servico').reset();
  document.getElementById('servico-id').value = '';
  document.getElementById('modal-servico').classList.add('active');
}

async function editarServico(id) {
  const res = await fetch('/api/servicos/todos', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const servicos = await res.json();
  const servico = servicos.find(s => s.id === id);

  document.getElementById('modal-titulo').textContent = 'Editar Serviço';
  document.getElementById('servico-id').value = servico.id;
  document.getElementById('servico-nome').value = servico.nome;
  document.getElementById('servico-descricao').value = servico.descricao || '';
  document.getElementById('servico-duracao').value = servico.duracao;
  document.getElementById('servico-preco').value = servico.preco;
  document.getElementById('modal-servico').classList.add('active');
}

async function salvarServico(e) {
  e.preventDefault();

  const id = document.getElementById('servico-id').value;
  const dados = {
    nome: document.getElementById('servico-nome').value,
    descricao: document.getElementById('servico-descricao').value,
    duracao: parseInt(document.getElementById('servico-duracao').value),
    preco: parseFloat(document.getElementById('servico-preco').value)
  };

  try {
    const url = id ? `/api/servicos/${id}` : '/api/servicos';
    const metodo = id ? 'PUT' : 'POST';

    if (id) dados.ativo = 1;

    const res = await fetch(url, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(dados)
    });

    if (!res.ok) {
      alert('Erro ao salvar serviço');
      return;
    }

    fecharModal('modal-servico');
    mudarPagina('admin-servicos');
  } catch (err) {
    alert('Erro ao salvar serviço');
  }
}

async function desativarServico(id) {
  if (!confirm('Deseja realmente desativar este serviço?')) return;

  try {
    const res = await fetch(`/api/servicos/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      alert('Erro ao desativar serviço');
      return;
    }

    mudarPagina('admin-servicos');
  } catch (err) {
    alert('Erro ao desativar serviço');
  }
}

async function renderizarAdminHorarios() {
  const hoje = new Date().toISOString().split('T')[0];

  const html = `
    <h2 style="margin-bottom: 20px">Gerenciar Horários Disponíveis</h2>
    <div class="card">
      <h3 style="margin-bottom: 15px">Adicionar Horário</h3>
      <form id="form-horario">
        <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 15px">
          <div class="form-group" style="margin: 0">
            <label>Data</label>
            <input type="date" id="horario-data" min="${hoje}" value="${hoje}" required>
          </div>
          <div class="form-group" style="margin: 0">
            <label>Hora</label>
            <input type="time" id="horario-hora" required>
          </div>
          <div class="form-group" style="margin: 0; display: flex; align-items: flex-end">
            <button type="submit">Adicionar</button>
          </div>
        </div>
      </form>
    </div>
    <div class="card">
      <h3 style="margin-bottom: 15px">Horários Cadastrados</h3>
      <div class="form-group">
        <label>Selecione a data para visualizar</label>
        <input type="date" id="visualizar-data" value="${hoje}">
      </div>
      <div id="horarios-lista"></div>
    </div>
  `;

  document.getElementById('conteudo').innerHTML = html;

  document.getElementById('form-horario').addEventListener('submit', adicionarHorario);
  document.getElementById('visualizar-data').addEventListener('change', (e) => {
    carregarHorariosAdmin(e.target.value);
  });

  carregarHorariosAdmin(hoje);
}

async function adicionarHorario(e) {
  e.preventDefault();

  const data = document.getElementById('horario-data').value;
  const hora = document.getElementById('horario-hora').value;

  try {
    const res = await fetch('/api/horarios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ data, hora })
    });

    if (!res.ok) {
      alert('Erro ao adicionar horário');
      return;
    }

    document.getElementById('form-horario').reset();
    carregarHorariosAdmin(data);
  } catch (err) {
    alert('Erro ao adicionar horário');
  }
}

async function carregarHorariosAdmin(data) {
  const res = await fetch(`/api/horarios/${data}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const horarios = await res.json();

  const container = document.getElementById('horarios-lista');

  if (horarios.length === 0) {
    container.innerHTML = '<p style="margin-top: 20px">Nenhum horário cadastrado nesta data.</p>';
    return;
  }

  container.innerHTML = `
    <table style="margin-top: 20px">
      <thead>
        <tr>
          <th>Hora</th>
          <th>Status</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${horarios.map(h => `
          <tr>
            <td>${h.hora}</td>
            <td>${h.disponivel ? 'Disponível' : 'Ocupado'}</td>
            <td>
              <button class="btn-danger" onclick="removerHorario(${h.id}, '${data}')" style="padding: 6px 12px">Remover</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function removerHorario(id, data) {
  if (!confirm('Deseja realmente remover este horário?')) return;

  try {
    const res = await fetch(`/api/horarios/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      alert('Erro ao remover horário');
      return;
    }

    carregarHorariosAdmin(data);
  } catch (err) {
    alert('Erro ao remover horário');
  }
}

// ========== UTILITÁRIOS ==========

function mudarPagina(pagina) {
  paginaAtual = pagina;
  renderizar();

  if (pagina === 'servicos') renderizarServicos();
  else if (pagina === 'meus-agendamentos') renderizarMeusAgendamentos();
  else if (pagina === 'admin-agendamentos') renderizarAdminAgendamentos();
  else if (pagina === 'admin-servicos') renderizarAdminServicos();
  else if (pagina === 'admin-horarios') renderizarAdminHorarios();
}

function anexarEventos() {
  const formLogin = document.getElementById('form-login');
  const formRegistro = document.getElementById('form-registro');

  if (formLogin) formLogin.addEventListener('submit', fazerLogin);
  if (formRegistro) formRegistro.addEventListener('submit', fazerRegistro);
}

function mostrarMensagem(texto, tipo) {
  const div = document.getElementById('mensagem');
  if (div) {
    div.innerHTML = `<div class="${tipo}">${texto}</div>`;
    setTimeout(() => div.innerHTML = '', 5000);
  }
}

function fecharModal(id) {
  document.getElementById(id).classList.remove('active');
}

function formatarData(data) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}
