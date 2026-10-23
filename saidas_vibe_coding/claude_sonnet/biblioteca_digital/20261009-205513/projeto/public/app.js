let usuarioAtual = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  verificarAutenticacao();
  setupEventListeners();
});

function setupEventListeners() {
  // Login
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await fazerLogin();
  });

  // Registro
  document.getElementById('registrar-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await fazerRegistro();
  });

  // Busca no acervo
  document.getElementById('busca-acervo').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      buscarAcervo();
    }
  });

  // Form de item
  document.getElementById('item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await salvarItem();
  });
}

async function verificarAutenticacao() {
  try {
    const response = await fetch('/api/usuario-atual');
    if (response.ok) {
      usuarioAtual = await response.json();
      mostrarTelaPrincipal();
    } else {
      mostrarTelaLogin();
    }
  } catch (erro) {
    mostrarTelaLogin();
  }
}

function mostrarTelaLogin() {
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('main-screen').classList.remove('active');
}

function mostrarTelaPrincipal() {
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('main-screen').classList.add('active');
  
  document.getElementById('usuario-nome').textContent = `Olá, ${usuarioAtual.nome}`;

  // Mostrar/ocultar tabs baseado no tipo de usuário
  if (usuarioAtual.tipo === 'bibliotecario') {
    document.getElementById('tab-gerenciar').style.display = 'block';
    document.getElementById('tab-todos-emprestimos').style.display = 'block';
    document.getElementById('tab-usuarios').style.display = 'block';
  } else {
    document.getElementById('tab-gerenciar').style.display = 'none';
    document.getElementById('tab-todos-emprestimos').style.display = 'none';
    document.getElementById('tab-usuarios').style.display = 'none';
  }

  // Mostrar alerta se bloqueado
  if (usuarioAtual.bloqueado) {
    document.getElementById('alerta-bloqueado').style.display = 'block';
  } else {
    document.getElementById('alerta-bloqueado').style.display = 'none';
  }

  carregarAcervo();
}

// Autenticação
async function fazerLogin() {
  const email = document.getElementById('login-email').value;
  const senha = document.getElementById('login-senha').value;

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });

    if (response.ok) {
      usuarioAtual = await response.json();
      mostrarTelaPrincipal();
    } else {
      const erro = await response.json();
      mostrarErro('login-erro', erro.erro || 'Erro ao fazer login');
    }
  } catch (erro) {
    mostrarErro('login-erro', 'Erro ao conectar com o servidor');
  }
}

async function fazerRegistro() {
  const nome = document.getElementById('registrar-nome').value;
  const email = document.getElementById('registrar-email').value;
  const senha = document.getElementById('registrar-senha').value;

  try {
    const response = await fetch('/api/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha })
    });

    if (response.ok) {
      usuarioAtual = await response.json();
      mostrarTelaPrincipal();
    } else {
      const erro = await response.json();
      mostrarErro('registrar-erro', erro.erro || 'Erro ao registrar');
    }
  } catch (erro) {
    mostrarErro('registrar-erro', 'Erro ao conectar com o servidor');
  }
}

async function sair() {
  try {
    await fetch('/api/logout', { method: 'POST' });
    usuarioAtual = null;
    mostrarTelaLogin();
    limparFormularios();
  } catch (erro) {
    console.error('Erro ao sair:', erro);
  }
}

// Navegação
function mostrarAba(aba) {
  // Tabs de autenticação
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  
  event.target.classList.add('active');
  document.getElementById(`${aba}-form`).classList.add('active');
  
  limparErros();
}

function mostrarSecao(secao) {
  // Tabs principais
  document.querySelectorAll('.tab-main').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.secao').forEach(s => s.classList.remove('active'));
  
  event.target.classList.add('active');
  document.getElementById(`secao-${secao}`).classList.add('active');
  
  // Carregar dados da seção
  if (secao === 'acervo') {
    carregarAcervo();
  } else if (secao === 'meus-emprestimos') {
    carregarMeusEmprestimos();
  } else if (secao === 'gerenciar-acervo') {
    carregarGerenciarAcervo();
  } else if (secao === 'todos-emprestimos') {
    carregarTodosEmprestimos();
  } else if (secao === 'usuarios') {
    carregarUsuarios();
  }
}

// Acervo
async function carregarAcervo() {
  const container = document.getElementById('lista-acervo');
  container.innerHTML = '<div class="loading">Carregando acervo...</div>';

  try {
    const busca = document.getElementById('busca-acervo').value;
    const url = busca ? `/api/itens?busca=${encodeURIComponent(busca)}` : '/api/itens';
    const response = await fetch(url);
    const itens = await response.json();

    if (itens.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📚</div>
          <div class="empty-state-text">Nenhum item encontrado</div>
        </div>
      `;
      return;
    }

    container.innerHTML = itens.map(item => `
      <div class="card">
        <div class="card-title">${item.titulo}</div>
        <div class="card-info">👤 ${item.autor}</div>
        <div class="card-info">📖 ${item.tipo}</div>
        ${item.ano ? `<div class="card-info">📅 ${item.ano}</div>` : ''}
        ${item.isbn ? `<div class="card-info">🔢 ${item.isbn}</div>` : ''}
        ${item.descricao ? `<div class="card-info" style="margin-top: 10px;">${item.descricao}</div>` : ''}
        <div class="card-info" style="margin-top: 10px;">
          <strong>Disponíveis:</strong> ${item.quantidade_disponivel} de ${item.quantidade_total}
        </div>
        <span class="card-badge ${item.quantidade_disponivel > 0 ? 'badge-disponivel' : 'badge-indisponivel'}">
          ${item.quantidade_disponivel > 0 ? 'Disponível' : 'Indisponível'}
        </span>
        ${item.quantidade_disponivel > 0 && !usuarioAtual.bloqueado ? `
          <div class="card-actions">
            <button class="btn btn-primary" onclick="emprestarItem(${item.id})">
              Emprestar
            </button>
          </div>
        ` : ''}
      </div>
    `).join('');
  } catch (erro) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-text">Erro ao carregar acervo</div>
      </div>
    `;
  }
}

function buscarAcervo() {
  carregarAcervo();
}

async function emprestarItem(itemId) {
  if (!confirm('Deseja emprestar este item?')) return;

  try {
    const response = await fetch('/api/emprestimos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId })
    });

    if (response.ok) {
      alert('Item emprestado com sucesso!');
      carregarAcervo();
    } else {
      const erro = await response.json();
      alert(erro.erro || 'Erro ao emprestar item');
    }
  } catch (erro) {
    alert('Erro ao conectar com o servidor');
  }
}

// Meus Empréstimos
async function carregarMeusEmprestimos() {
  const container = document.getElementById('lista-meus-emprestimos');
  container.innerHTML = '<div class="loading">Carregando empréstimos...</div>';

  try {
    const response = await fetch('/api/emprestimos/meus');
    const emprestimos = await response.json();

    if (emprestimos.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">Você não possui empréstimos</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="emprestimos-list">
        ${emprestimos.map(emp => `
          <div class="emprestimo-item ${emp.status}">
            <div class="emprestimo-header">
              <div>
                <div class="emprestimo-title">${emp.titulo}</div>
                <div class="emprestimo-info">👤 ${emp.autor} • 📖 ${emp.tipo}</div>
              </div>
              <span class="card-badge badge-${emp.status}">
                ${emp.status === 'ativo' ? 'Em andamento' : 
                  emp.status === 'atrasado' ? 'Atrasado' : 'Devolvido'}
              </span>
            </div>
            <div class="emprestimo-info">
              📅 Emprestado em: ${formatarData(emp.data_emprestimo)}
            </div>
            <div class="emprestimo-info">
              📅 Devolução prevista: ${formatarData(emp.data_devolucao_prevista)}
            </div>
            ${emp.data_devolucao_real ? `
              <div class="emprestimo-info">
                ✅ Devolvido em: ${formatarData(emp.data_devolucao_real)}
              </div>
            ` : ''}
            ${emp.status !== 'devolvido' ? `
              <div class="emprestimo-actions">
                <button class="btn btn-success" onclick="devolverItem(${emp.id})">
                  Devolver
                </button>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  } catch (erro) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-text">Erro ao carregar empréstimos</div>
      </div>
    `;
  }
}

async function devolverItem(emprestimoId) {
  if (!confirm('Deseja devolver este item?')) return;

  try {
    const response = await fetch(`/api/emprestimos/${emprestimoId}/devolver`, {
      method: 'POST'
    });

    if (response.ok) {
      alert('Item devolvido com sucesso!');
      carregarMeusEmprestimos();
      carregarAcervo();
    } else {
      const erro = await response.json();
      alert(erro.erro || 'Erro ao devolver item');
    }
  } catch (erro) {
    alert('Erro ao conectar com o servidor');
  }
}

// Gerenciar Acervo (Bibliotecário)
async function carregarGerenciarAcervo() {
  const container = document.getElementById('lista-gerenciar-acervo');
  container.innerHTML = '<div class="loading">Carregando acervo...</div>';

  try {
    const response = await fetch('/api/itens');
    const itens = await response.json();

    if (itens.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📚</div>
          <div class="empty-state-text">Nenhum item cadastrado</div>
        </div>
      `;
      return;
    }

    container.innerHTML = itens.map(item => `
      <div class="card">
        <div class="card-title">${item.titulo}</div>
        <div class="card-info">👤 ${item.autor}</div>
        <div class="card-info">📖 ${item.tipo}</div>
        ${item.ano ? `<div class="card-info">📅 ${item.ano}</div>` : ''}
        ${item.isbn ? `<div class="card-info">🔢 ${item.isbn}</div>` : ''}
        <div class="card-info" style="margin-top: 10px;">
          <strong>Total:</strong> ${item.quantidade_total} • 
          <strong>Disponíveis:</strong> ${item.quantidade_disponivel}
        </div>
        <div class="card-actions">
          <button class="btn btn-primary" onclick="editarItem(${item.id})">
            Editar
          </button>
          <button class="btn btn-danger" onclick="removerItem(${item.id})">
            Remover
          </button>
        </div>
      </div>
    `).join('');
  } catch (erro) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-text">Erro ao carregar acervo</div>
      </div>
    `;
  }
}

function mostrarFormNovoItem() {
  document.getElementById('form-item-titulo').textContent = 'Novo Item';
  document.getElementById('item-form').reset();
  document.getElementById('item-id').value = '';
  document.getElementById('form-item').style.display = 'block';
  document.getElementById('item-erro').classList.remove('show');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function editarItem(itemId) {
  try {
    const response = await fetch(`/api/itens/${itemId}`);
    const item = await response.json();

    document.getElementById('form-item-titulo').textContent = 'Editar Item';
    document.getElementById('item-id').value = item.id;
    document.getElementById('item-titulo').value = item.titulo;
    document.getElementById('item-autor').value = item.autor;
    document.getElementById('item-tipo').value = item.tipo;
    document.getElementById('item-ano').value = item.ano || '';
    document.getElementById('item-isbn').value = item.isbn || '';
    document.getElementById('item-descricao').value = item.descricao || '';
    document.getElementById('item-quantidade').value = item.quantidade_total;
    
    document.getElementById('form-item').style.display = 'block';
    document.getElementById('item-erro').classList.remove('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (erro) {
    alert('Erro ao carregar item');
  }
}

async function salvarItem() {
  const itemId = document.getElementById('item-id').value;
  const dados = {
    titulo: document.getElementById('item-titulo').value,
    autor: document.getElementById('item-autor').value,
    tipo: document.getElementById('item-tipo').value,
    ano: document.getElementById('item-ano').value || null,
    isbn: document.getElementById('item-isbn').value || null,
    descricao: document.getElementById('item-descricao').value || null,
    quantidade_total: parseInt(document.getElementById('item-quantidade').value)
  };

  try {
    const url = itemId ? `/api/itens/${itemId}` : '/api/itens';
    const method = itemId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    if (response.ok) {
      alert('Item salvo com sucesso!');
      cancelarFormItem();
      carregarGerenciarAcervo();
    } else {
      const erro = await response.json();
      mostrarErro('item-erro', erro.erro || 'Erro ao salvar item');
    }
  } catch (erro) {
    mostrarErro('item-erro', 'Erro ao conectar com o servidor');
  }
}

function cancelarFormItem() {
  document.getElementById('form-item').style.display = 'none';
  document.getElementById('item-form').reset();
  document.getElementById('item-erro').classList.remove('show');
}

async function removerItem(itemId) {
  if (!confirm('Deseja realmente remover este item? Esta ação não pode ser desfeita.')) return;

  try {
    const response = await fetch(`/api/itens/${itemId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      alert('Item removido com sucesso!');
      carregarGerenciarAcervo();
    } else {
      const erro = await response.json();
      alert(erro.erro || 'Erro ao remover item');
    }
  } catch (erro) {
    alert('Erro ao conectar com o servidor');
  }
}

// Todos os Empréstimos (Bibliotecário)
async function carregarTodosEmprestimos() {
  const container = document.getElementById('lista-todos-emprestimos');
  container.innerHTML = '<div class="loading">Carregando empréstimos...</div>';

  try {
    const response = await fetch('/api/emprestimos/todos');
    const emprestimos = await response.json();

    if (emprestimos.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">Nenhum empréstimo registrado</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="emprestimos-list">
        ${emprestimos.map(emp => `
          <div class="emprestimo-item ${emp.status}">
            <div class="emprestimo-header">
              <div>
                <div class="emprestimo-title">${emp.titulo}</div>
                <div class="emprestimo-info">👤 ${emp.autor} • 📖 ${emp.tipo}</div>
                <div class="emprestimo-info">
                  <strong>Leitor:</strong> ${emp.usuario_nome} (${emp.usuario_email})
                </div>
              </div>
              <span class="card-badge badge-${emp.status}">
                ${emp.status === 'ativo' ? 'Em andamento' : 
                  emp.status === 'atrasado' ? 'Atrasado' : 'Devolvido'}
              </span>
            </div>
            <div class="emprestimo-info">
              📅 Emprestado em: ${formatarData(emp.data_emprestimo)}
            </div>
            <div class="emprestimo-info">
              📅 Devolução prevista: ${formatarData(emp.data_devolucao_prevista)}
            </div>
            ${emp.data_devolucao_real ? `
              <div class="emprestimo-info">
                ✅ Devolvido em: ${formatarData(emp.data_devolucao_real)}
              </div>
            ` : ''}
            ${emp.status !== 'devolvido' ? `
              <div class="emprestimo-actions">
                <button class="btn btn-success" onclick="devolverItemBibliotecario(${emp.id})">
                  Registrar Devolução
                </button>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  } catch (erro) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-text">Erro ao carregar empréstimos</div>
      </div>
    `;
  }
}

async function devolverItemBibliotecario(emprestimoId) {
  if (!confirm('Deseja registrar a devolução deste item?')) return;

  try {
    const response = await fetch(`/api/emprestimos/${emprestimoId}/devolver`, {
      method: 'POST'
    });

    if (response.ok) {
      alert('Devolução registrada com sucesso!');
      carregarTodosEmprestimos();
    } else {
      const erro = await response.json();
      alert(erro.erro || 'Erro ao registrar devolução');
    }
  } catch (erro) {
    alert('Erro ao conectar com o servidor');
  }
}

// Usuários (Bibliotecário)
async function carregarUsuarios() {
  const container = document.getElementById('lista-usuarios');
  container.innerHTML = '<div class="loading">Carregando usuários...</div>';

  try {
    const response = await fetch('/api/usuarios');
    const usuarios = await response.json();

    if (usuarios.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">👥</div>
          <div class="empty-state-text">Nenhum usuário cadastrado</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="usuarios-list">
        ${usuarios.map(usuario => `
          <div class="usuario-item ${usuario.bloqueado ? 'bloqueado' : ''}">
            <div class="usuario-info">
              <div class="usuario-nome">${usuario.nome}</div>
              <div class="usuario-detalhes">📧 ${usuario.email}</div>
              <div class="usuario-detalhes">
                📅 Cadastrado em: ${formatarData(usuario.criado_em)}
              </div>
              ${usuario.emprestimos_atrasados > 0 ? `
                <div class="usuario-detalhes" style="color: #dc3545; font-weight: 600;">
                  ⚠️ ${usuario.emprestimos_atrasados} empréstimo(s) atrasado(s)
                </div>
              ` : ''}
              ${usuario.bloqueado ? `
                <div class="usuario-detalhes" style="color: #dc3545; font-weight: 600;">
                  🚫 Usuário bloqueado
                </div>
              ` : ''}
            </div>
            <div class="usuario-actions">
              ${usuario.bloqueado ? `
                <button class="btn btn-success" onclick="desbloquearUsuario(${usuario.id})">
                  Desbloquear
                </button>
              ` : `
                <button class="btn btn-warning" onclick="bloquearUsuario(${usuario.id})">
                  Bloquear
                </button>
              `}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (erro) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-text">Erro ao carregar usuários</div>
      </div>
    `;
  }
}

async function bloquearUsuario(usuarioId) {
  if (!confirm('Deseja bloquear este usuário? Ele não poderá fazer novos empréstimos.')) return;

  try {
    const response = await fetch(`/api/usuarios/${usuarioId}/bloquear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bloqueado: true })
    });

    if (response.ok) {
      alert('Usuário bloqueado com sucesso!');
      carregarUsuarios();
    } else {
      const erro = await response.json();
      alert(erro.erro || 'Erro ao bloquear usuário');
    }
  } catch (erro) {
    alert('Erro ao conectar com o servidor');
  }
}

async function desbloquearUsuario(usuarioId) {
  if (!confirm('Deseja desbloquear este usuário?')) return;

  try {
    const response = await fetch(`/api/usuarios/${usuarioId}/bloquear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bloqueado: false })
    });

    if (response.ok) {
      alert('Usuário desbloqueado com sucesso!');
      carregarUsuarios();
    } else {
      const erro = await response.json();
      alert(erro.erro || 'Erro ao desbloquear usuário');
    }
  } catch (erro) {
    alert('Erro ao conectar com o servidor');
  }
}

// Utilitários
function formatarData(dataISO) {
  const data = new Date(dataISO);
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function mostrarErro(elementoId, mensagem) {
  const elemento = document.getElementById(elementoId);
  elemento.textContent = mensagem;
  elemento.classList.add('show');
}

function limparErros() {
  document.querySelectorAll('.erro-msg').forEach(el => {
    el.classList.remove('show');
    el.textContent = '';
  });
}

function limparFormularios() {
  document.getElementById('login-form').reset();
  document.getElementById('registrar-form').reset();
  limparErros();
}
