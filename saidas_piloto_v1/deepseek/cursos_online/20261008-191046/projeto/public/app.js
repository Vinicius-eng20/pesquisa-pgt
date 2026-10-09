let usuario = null;

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erro || 'Erro');
  return data;
}

function el(id) { return document.getElementById(id); }

function show(view) {
  ['authView', 'alunoView', 'adminView'].forEach(v => el(v).classList.add('hidden'));
  el(view).classList.remove('hidden');
}

function setMsg(text, type) {
  const m = el('authMsg');
  m.textContent = text || '';
  m.className = 'msg ' + (type || '');
}

async function init() {
  try {
    const data = await api('/api/eu');
    usuario = data.usuario;
  } catch { usuario = null; }
  renderHeader();
  if (!usuario) {
    show('authView');
  } else if (usuario.tipo === 'admin') {
    show('adminView');
    carregarCursosAdmin();
  } else {
    show('alunoView');
    carregarCursosDisponiveis();
  }
}

function renderHeader() {
  const area = el('userArea');
  if (!usuario) {
    area.innerHTML = '';
    return;
  }
  area.innerHTML = `
    <span>Olá, <strong>${usuario.nome}</strong> ${usuario.tipo === 'admin' ? '(Admin)' : ''}</span>
    <button class="btn-secondary btn-small" onclick="logout()">Sair</button>
  `;
}

async function logout() {
  await api('/api/logout', { method: 'POST' });
  usuario = null;
  renderHeader();
  show('authView');
}

// Tabs auth
document.querySelectorAll('.tab[data-tab]').forEach(t => {
  t.onclick = () => {
    document.querySelectorAll('.tab[data-tab]').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const tab = t.dataset.tab;
    el('loginForm').classList.toggle('hidden', tab !== 'login');
    el('registerForm').classList.toggle('hidden', tab !== 'register');
    setMsg('');
  };
});

el('loginForm').onsubmit = async (e) => {
  e.preventDefault();
  setMsg('');
  try {
    const data = await api('/api/login', {
      method: 'POST',
      body: { email: el('loginEmail').value, senha: el('loginSenha').value }
    });
    usuario = data.usuario;
    el('loginForm').reset();
    init();
  } catch (err) {
    setMsg(err.message, 'error');
  }
};

el('registerForm').onsubmit = async (e) => {
  e.preventDefault();
  setMsg('');
  try {
    const data = await api('/api/registrar', {
      method: 'POST',
      body: {
        nome: el('regNome').value,
        email: el('regEmail').value,
        senha: el('regSenha').value
      }
    });
    usuario = data.usuario;
    el('registerForm').reset();
    init();
  } catch (err) {
    setMsg(err.message, 'error');
  }
};

// Tabs aluno
document.querySelectorAll('.tab[data-atab]').forEach(t => {
  t.onclick = () => {
    document.querySelectorAll('.tab[data-atab]').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const tab = t.dataset.atab;
    el('cursosDisponiveis').classList.toggle('hidden', tab !== 'disponiveis');
    el('cursosMatriculados').classList.toggle('hidden', tab !== 'matriculados');
    if (tab === 'matriculados') carregarMinhasMatriculas();
    else carregarCursosDisponiveis();
  };
});

// Tabs admin
document.querySelectorAll('.tab[data-admin]').forEach(t => {
  t.onclick = () => {
    document.querySelectorAll('.tab[data-admin]').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const tab = t.dataset.admin;
    el('adminCursos').classList.toggle('hidden', tab !== 'cursos');
    el('adminMatriculas').classList.toggle('hidden', tab !== 'matriculas');
    if (tab === 'matriculas') carregarMatriculasAdmin();
    else carregarCursosAdmin();
  };
});

async function carregarCursosDisponiveis() {
  const cursos = await api('/api/cursos');
  const el2 = el('cursosDisponiveis');
  if (!cursos.length) {
    el2.innerHTML = '<div class="empty">Nenhum curso disponível no momento.</div>';
    return;
  }
  el2.innerHTML = cursos.map(c => `
    <div class="card">
      <h3>${escapeHtml(c.titulo)}</h3>
      <p>${escapeHtml(c.descricao)}</p>
      <div class="meta">
        <span>👨‍🏫 ${escapeHtml(c.instrutor)}</span>
        <span>⏱ ${c.carga_horaria}h</span>
      </div>
      <div class="preco">${c.preco > 0 ? 'R$ ' + c.preco.toFixed(2) : 'Gratuito'}</div>
      <div class="actions">
        <button onclick="matricular(${c.id})">Matricular-se</button>
      </div>
    </div>
  `).join('');
}

async function matricular(cursoId) {
  try {
    await api('/api/matriculas', { method: 'POST', body: { curso_id: cursoId } });
    alert('Matrícula realizada com sucesso!');
  } catch (err) {
    alert(err.message);
  }
}

async function carregarMinhasMatriculas() {
  const lista = await api('/api/minhas-matriculas');
  const el2 = el('cursosMatriculados');
  if (!lista.length) {
    el2.innerHTML = '<div class="empty">Você ainda não está matriculado em nenhum curso.</div>';
    return;
  }
  el2.innerHTML = lista.map(c => `
    <div class="card">
      <h3>${escapeHtml(c.titulo)}</h3>
      <p>${escapeHtml(c.descricao)}</p>
      <div class="meta">
        <span>👨‍🏫 ${escapeHtml(c.instrutor)}</span>
        <span>⏱ ${c.carga_horaria}h</span>
      </div>
      <div class="meta"><span>📅 Matrícula: ${new Date(c.data_matricula).toLocaleDateString('pt-BR')}</span></div>
    </div>
  `).join('');
}

async function carregarCursosAdmin() {
  const cursos = await api('/api/cursos');
  const el2 = el('listaCursosAdmin');
  if (!cursos.length) {
    el2.innerHTML = '<div class="empty">Nenhum curso cadastrado.</div>';
    return;
  }
  el2.innerHTML = cursos.map(c => `
    <div class="card">
      <h3>${escapeHtml(c.titulo)}</h3>
      <p>${escapeHtml(c.descricao)}</p>
      <div class="meta">
        <span>👨‍🏫 ${escapeHtml(c.instrutor)}</span>
        <span>⏱ ${c.carga_horaria}h</span>
        <span>💰 R$ ${c.preco.toFixed(2)}</span>
      </div>
      <div class="admin-actions">
        <button class="btn-small" onclick="editarCurso(${c.id})">Editar</button>
        <button class="btn-danger" onclick="removerCurso(${c.id})">Remover</button>
      </div>
    </div>
  `).join('');
}

async function editarCurso(id) {
  const c = await api('/api/cursos/' + id);
  el('cursoId').value = c.id;
  el('cursoTitulo').value = c.titulo;
  el('cursoDescricao').value = c.descricao;
  el('cursoInstrutor').value = c.instrutor;
  el('cursoCarga').value = c.carga_horaria;
  el('cursoPreco').value = c.preco;
  el('cursoFormTitle').textContent = 'Editar Curso';
  el('cancelCurso').classList.remove('hidden');
  el('cursoForm').scrollIntoView({ behavior: 'smooth' });
}

el('cancelCurso').onclick = () => {
  el('cursoForm').reset();
  el('cursoId').value = '';
  el('cursoFormTitle').textContent = 'Novo Curso';
  el('cancelCurso').classList.add('hidden');
};

el('cursoForm').onsubmit = async (e) => {
  e.preventDefault();
  const id = el('cursoId').value;
  const body = {
    titulo: el('cursoTitulo').value,
    descricao: el('cursoDescricao').value,
    instrutor: el('cursoInstrutor').value,
    carga_horaria: el('cursoCarga').value,
    preco: el('cursoPreco').value
  };
  try {
    if (id) {
      await api('/api/cursos/' + id, { method: 'PUT', body });
    } else {
      await api('/api/cursos', { method: 'POST', body });
    }
    el('cancelCurso').onclick();
    carregarCursosAdmin();
  } catch (err) {
    alert(err.message);
  }
};

async function removerCurso(id) {
  if (!confirm('Remover este curso? Todas as matrículas associadas também serão removidas.')) return;
  await api('/api/cursos/' + id, { method: 'DELETE' });
  carregarCursosAdmin();
}

async function carregarMatriculasAdmin() {
  const lista = await api('/api/admin/matriculas');
  const el2 = el('listaMatriculas');
  if (!lista.length) {
    el2.innerHTML = '<div class="empty">Nenhuma matrícula registrada.</div>';
    return;
  }
  el2.innerHTML = lista.map(m => `
    <div class="card">
      <h3>${escapeHtml(m.curso_titulo)}</h3>
      <p><strong>Aluno:</strong> ${escapeHtml(m.aluno_nome)}</p>
      <p><strong>Email:</strong> ${escapeHtml(m.aluno_email)}</p>
      <div class="meta"><span>📅 ${new Date(m.data_matricula).toLocaleDateString('pt-BR')}</span></div>
      <div class="actions">
        <button class="btn-danger" onclick="cancelarMatricula(${m.matricula_id})">Cancelar Matrícula</button>
      </div>
    </div>
  `).join('');
}

async function cancelarMatricula(id) {
  if (!confirm('Cancelar esta matrícula?')) return;
  await api('/api/admin/matriculas/' + id, { method: 'DELETE' });
  carregarMatriculasAdmin();
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

init();
