// ===== ESTADO GLOBAL =====
let token = localStorage.getItem('token');
let usuario = JSON.parse(localStorage.getItem('usuario') || 'null');

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
  preencherAnos();
  preencherAnosAdmin();

  if (token && usuario) {
    if (usuario.tipo === 'admin') {
      mostrarTelaAdmin();
    } else {
      mostrarTelaUsuario();
    }
  }
});

function preencherAnos() {
  const select = document.getElementById('filtro-ano');
  const anoAtual = new Date().getFullYear();
  for (let a = anoAtual; a >= anoAtual - 5; a--) {
    select.innerHTML += `<option value="${a}">${a}</option>`;
  }
  document.getElementById('filtro-mes').value = new Date().getMonth() + 1;
  document.getElementById('desp-data').valueAsDate = new Date();
}

function preencherAnosAdmin() {
  const select = document.getElementById('admin-filtro-ano');
  const anoAtual = new Date().getFullYear();
  for (let a = anoAtual; a >= anoAtual - 5; a--) {
    select.innerHTML += `<option value="${a}">${a}</option>`;
  }
  document.getElementById('admin-filtro-mes').value = new Date().getMonth() + 1;
}

// ===== HELPERS =====
function headers() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataStr) {
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

// ===== AUTENTICAÇÃO =====
function mostrarTab(tab) {
  document.getElementById('form-login').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('form-cadastro').style.display = tab === 'cadastro' ? 'block' : 'none';
  document.getElementById('tab-login').className = tab === 'login' ? 'tab-btn ativo' : 'tab-btn';
  document.getElementById('tab-cadastro').className = tab === 'cadastro' ? 'tab-btn ativo' : 'tab-btn';
}

async function fazerLogin() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const erroEl = document.getElementById('login-erro');
  erroEl.textContent = '';

  if (!email || !senha) {
    erroEl.textContent = 'Preencha email e senha';
    return;
  }

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    const data = await res.json();

    if (!res.ok) {
      erroEl.textContent = data.erro;
      return;
    }

    salvarSessao(data);
  } catch (e) {
    erroEl.textContent = 'Erro de conexão. Tente novamente.';
  }
}

async function fazerCadastro() {
  const nome = document.getElementById('cad-nome').value.trim();
  const email = document.getElementById('cad-email').value.trim();
  const senha = document.getElementById('cad-senha').value;
  const erroEl = document.getElementById('cad-erro');
  erroEl.textContent = '';

  if (!nome || !email || !senha) {
    erroEl.textContent = 'Preencha todos os campos';
    return;
  }

  try {
    const res = await fetch('/api/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha })
    });
    const data = await res.json();

    if (!res.ok) {
      erroEl.textContent = data.erro;
      return;
    }

    salvarSessao(data);
  } catch (e) {
    erroEl.textContent = 'Erro de conexão. Tente novamente.';
  }
}

function salvarSessao(data) {
  token = data.token;
  usuario = data.usuario;
  localStorage.setItem('token', token);
  localStorage.setItem('usuario', JSON.stringify(usuario));

  if (usuario.tipo === 'admin') {
    mostrarTelaAdmin();
  } else {
    mostrarTelaUsuario();
  }
}

function sair() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  token = null;
  usuario = null;
  document.getElementById('tela-auth').style.display = 'flex';
  document.getElementById('tela-usuario').style.display = 'none';
  document.getElementById('tela-admin').style.display = 'none';
}

// ===== TELA DO USUÁRIO =====
function mostrarTelaUsuario() {
  document.getElementById('tela-auth').style.display = 'none';
  document.getElementById('tela-usuario').style.display = 'block';
  document.getElementById('tela-admin').style.display = 'none';
  document.getElementById('nav-usuario-nome').textContent = usuario.nome;
  carregarDados();
}

async function carregarDados() {
  const mes = document.getElementById('filtro-mes').value;
  const ano = document.getElementById('filtro-ano').value;

  await carregarCategorias();
  await carregarResumo(mes, ano);
  await carregarDespesas(mes, ano);
}

async function carregarCategorias() {
  try {
    const res = await fetch('/api/categorias', { headers: headers() });
    const categorias = await res.json();
    const select = document.getElementById('desp-categoria');
    select.innerHTML = categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
  } catch (e) {
    console.error('Erro ao carregar categorias:', e);
  }
}

async function carregarResumo(mes, ano) {
  try {
    const res = await fetch(`/api/resumo?mes=${mes}&ano=${ano}`, { headers: headers() });
    const data = await res.json();

    document.getElementById('total-gasto').textContent = formatarMoeda(data.total);

    const container = document.getElementById('por-categoria');
    if (data.porCategoria.length === 0) {
      container.innerHTML = '<span style="opacity:0.7">Nenhum gasto neste mês</span>';
    } else {
      container.innerHTML = data.porCategoria.map(c =>
        `<span class="cat-badge">${c.nome}: <strong>${formatarMoeda(c.total)}</strong></span>`
      ).join('');
    }
  } catch (e) {
    console.error('Erro ao carregar resumo:', e);
  }
}

async function carregarDespesas(mes, ano) {
  try {
    const res = await fetch(`/api/despesas?mes=${mes}&ano=${ano}`, { headers: headers() });
    const despesas = await res.json();

    const container = document.getElementById('lista-despesas');
    if (despesas.length === 0) {
      container.innerHTML = '<div class="vazio">Nenhuma despesa registrada neste mês 📝</div>';
      return;
    }

    container.innerHTML = despesas.map(d => `
      <div class="despesa-item">
        <div class="despesa-info">
          <div class="despesa-desc">${d.descricao}</div>
          <div class="despesa-meta">${d.categoria_nome} • ${formatarData(d.data)}</div>
        </div>
        <span class="despesa-valor">${formatarMoeda(d.valor)}</span>
        <button class="btn btn-excluir" onclick="excluirDespesa(${d.id})">✕</button>
      </div>
    `).join('');
  } catch (e) {
    console.error('Erro ao carregar despesas:', e);
  }
}

async function adicionarDespesa() {
  const descricao = document.getElementById('desp-descricao').value.trim();
  const valor = parseFloat(document.getElementById('desp-valor').value);
  const categoria_id = document.getElementById('desp-categoria').value;
  const data = document.getElementById('desp-data').value;
  const erroEl = document.getElementById('desp-erro');
  erroEl.textContent = '';

  if (!descricao || !valor || !categoria_id || !data) {
    erroEl.textContent = 'Preencha todos os campos';
    return;
  }

  try {
    const res = await fetch('/api/despesas', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ descricao, valor, categoria_id: parseInt(categoria_id), data })
    });
    const result = await res.json();

    if (!res.ok) {
      erroEl.textContent = result.erro;
      return;
    }

    document.getElementById('desp-descricao').value = '';
    document.getElementById('desp-valor').value = '';
    carregarDados();
  } catch (e) {
    erroEl.textContent = 'Erro ao salvar. Tente novamente.';
  }
}

async function excluirDespesa(id) {
  if (!confirm('Deseja excluir esta despesa?')) return;

  try {
    await fetch(`/api/despesas/${id}`, { method: 'DELETE', headers: headers() });
    carregarDados();
  } catch (e) {
    alert('Erro ao excluir despesa');
  }
}

// ===== TELA DO ADMIN =====
function mostrarTelaAdmin() {
  document.getElementById('tela-auth').style.display = 'none';
  document.getElementById('tela-usuario').style.display = 'none';
  document.getElementById('tela-admin').style.display = 'block';
  document.getElementById('nav-admin-nome').textContent = usuario.nome;
  carregarRelatorio();
}

function mostrarAdminTab(tab, btn) {
  document.querySelectorAll('.admin-secao').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.admin-tabs .tab-btn').forEach(b => b.classList.remove('ativo'));
  document.getElementById('admin-' + tab).style.display = 'block';
  btn.classList.add('ativo');

  if (tab === 'categorias') carregarCategoriasAdmin();
  if (tab === 'usuarios') carregarUsuarios();
  if (tab === 'relatorio') carregarRelatorio();
}

// --- Relatório ---
async function carregarRelatorio() {
  const mes = document.getElementById('admin-filtro-mes').value;
  const ano = document.getElementById('admin-filtro-ano').value;

  try {
    const res = await fetch(`/api/admin/relatorio?mes=${mes}&ano=${ano}`, { headers: headers() });
    const data = await res.json();

    document.getElementById('admin-total-geral').textContent = formatarMoeda(data.totalGeral);

    // Por usuário
    const userContainer = document.getElementById('admin-por-usuario');
    if (data.porUsuario.length === 0) {
      userContainer.innerHTML = '<div class="vazio">Nenhum usuário cadastrado</div>';
    } else {
      userContainer.innerHTML = data.porUsuario.map(u => `
        <div class="relatorio-item">
          <div>
            <div class="relatorio-nome">${u.nome}</div>
            <div class="relatorio-email">${u.email}</div>
          </div>
          <div>
            <span class="relatorio-valor">${formatarMoeda(u.total)}</span>
            <span class="relatorio-qtd">(${u.qtd_despesas} despesas)</span>
          </div>
        </div>
      `).join('');
    }

    // Por categoria
    const catContainer = document.getElementById('admin-por-categoria');
    if (data.porCategoria.length === 0) {
      catContainer.innerHTML = '<div class="vazio">Nenhum gasto neste mês</div>';
    } else {
      catContainer.innerHTML = data.porCategoria.map(c => `
        <div class="relatorio-item">
          <span class="relatorio-nome">${c.nome}</span>
          <span class="relatorio-valor">${formatarMoeda(c.total)}</span>
        </div>
      `).join('');
    }
  } catch (e) {
    console.error('Erro ao carregar relatório:', e);
  }
}

// --- Categorias ---
async function carregarCategoriasAdmin() {
  try {
    const res = await fetch('/api/categorias', { headers: headers() });
    const categorias = await res.json();

    const container = document.getElementById('lista-categorias');
    if (categorias.length === 0) {
      container.innerHTML = '<div class="vazio">Nenhuma categoria cadastrada</div>';
      return;
    }

    container.innerHTML = categorias.map(c => `
      <div class="categoria-item">
        <span>🏷️ ${c.nome}</span>
        <button class="btn btn-excluir" onclick="excluirCategoria(${c.id})">Excluir</button>
      </div>
    `).join('');
  } catch (e) {
    console.error('Erro ao carregar categorias:', e);
  }
}

async function adicionarCategoria() {
  const nome = document.getElementById('nova-categoria').value.trim();
  const erroEl = document.getElementById('cat-erro');
  erroEl.textContent = '';

  if (!nome) {
    erroEl.textContent = 'Informe o nome da categoria';
    return;
  }

  try {
    const res = await fetch('/api/categorias', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ nome })
    });
    const data = await res.json();

    if (!res.ok) {
      erroEl.textContent = data.erro;
      return;
    }

    document.getElementById('nova-categoria').value = '';
    carregarCategoriasAdmin();
  } catch (e) {
    erroEl.textContent = 'Erro ao adicionar categoria';
  }
}

async function excluirCategoria(id) {
  if (!confirm('Deseja excluir esta categoria?')) return;

  try {
    const res = await fetch(`/api/categorias/${id}`, { method: 'DELETE', headers: headers() });
    const data = await res.json();

    if (!res.ok) {
      alert(data.erro);
      return;
    }

    carregarCategoriasAdmin();
  } catch (e) {
    alert('Erro ao excluir categoria');
  }
}

// --- Usuários ---
async function carregarUsuarios() {
  try {
    const res = await fetch('/api/admin/usuarios', { headers: headers() });
    const usuarios = await res.json();

    const container = document.getElementById('lista-usuarios');
    container.innerHTML = usuarios.map(u => `
      <div class="usuario-item">
        <div class="usuario-info">
          <div class="usuario-nome">${u.nome} ${u.tipo === 'admin' ? '👑' : ''}</div>
          <div class="usuario-email">${u.email}</div>
        </div>
        <span class="usuario-gasto">Total gasto: ${formatarMoeda(u.total_gasto)}</span>
        <span class="usuario-status ${u.ativo ? 'status-ativo' : 'status-inativo'}">
          ${u.ativo ? '✅ Ativo' : '❌ Inativo'}
        </span>
        ${u.tipo !== 'admin' ? `
          <button class="btn btn-toggle ${u.ativo ? 'btn-desativar' : 'btn-ativar'}"
                  onclick="toggleUsuario(${u.id})">
            ${u.ativo ? 'Desativar' : 'Ativar'}
          </button>
        ` : ''}
      </div>
    `).join('');
  } catch (e) {
    console.error('Erro ao carregar usuários:', e);
  }
}

async function toggleUsuario(id) {
  try {
    const res = await fetch(`/api/admin/usuarios/${id}/toggle`, { method: 'PUT', headers: headers() });
    const data = await res.json();

    if (!res.ok) {
      alert(data.erro);
      return;
    }

    carregarUsuarios();
  } catch (e) {
    alert('Erro ao alterar status do usuário');
  }
}
