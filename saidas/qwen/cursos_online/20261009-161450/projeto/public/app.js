const API = '/api';
let state = {
  token: localStorage.getItem('token') || null,
  user: null,
  mode: 'courses',
  myEnrolledCourseIds: []
};

// ---------- API ----------
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['X-Session-Token'] = state.token;
  const res = await fetch(API + path, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* sem corpo */ }
  if (!res.ok) {
    if (res.status === 401 && state.user) {
      logoutLocal();
      showAuth();
    }
    throw new Error(data.error || 'Erro ao comunicar com o servidor.');
  }
  return data;
}

// ---------- Helpers de UI ----------
function el(id) { return document.getElementById(id); }

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setAuthMsg(text, isErr = true) {
  const m = el('authMsg');
  m.textContent = text || '';
  m.style.color = isErr ? 'var(--danger)' : 'var(--ok)';
}

// ---------- Navegação ----------
function buildNav() {
  const nav = el('nav');
  nav.innerHTML = '';
  const items = [
    { id: 'courses', label: 'Cursos' }
  ];
  if (state.user.role === 'student') {
    items.push({ id: 'mycourses', label: 'Meus cursos' });
  }
  if (state.user.role === 'admin') {
    items.push({ id: 'enrollments', label: 'Matrículas' });
  }
  items.forEach(it => {
    const b = document.createElement('button');
    b.textContent = it.label;
    b.dataset.mode = it.id;
    if (state.mode === it.id) b.classList.add('active');
    b.onclick = () => { state.mode = it.id; buildNav(); render(); };
    nav.appendChild(b);
  });
}

// ---------- Visões ----------
function showAuth() {
  el('topbar').style.display = 'none';
  el('homeView').style.display = 'none';
  el('authView').style.display = 'flex';
}

function showHome() {
  el('authView').style.display = 'none';
  el('topbar').style.display = 'flex';
  el('homeView').style.display = 'block';
  el('userName').textContent = state.user.name;
  el('newCourseBtn').style.display = state.user.role === 'admin' ? 'inline-block' : 'none';
  buildNav();
  render();
}

function render() {
  if (!state.user) return;
  const titles = {
    courses: ['Cursos disponíveis', 'Escolha um curso e se matricule.'],
    mycourses: ['Meus cursos', 'Cursos em que você está matriculado.'],
    enrollments: ['Todas as matrículas', 'Matrículas de todos os alunos.']
  };
  const t = titles[state.mode] || titles.courses;
  el('pageTitle').textContent = t[0];
  el('pageSub').textContent = t[1];

  if (state.mode === 'courses') return renderCourses();
  if (state.mode === 'mycourses') return renderMyCourses();
  if (state.mode === 'enrollments') return renderAllEnrollments();
}

async function loadMyEnrollments() {
  if (state.user.role !== 'student') { state.myEnrolledCourseIds = []; return; }
  try {
    const data = await api('/enrollments/my');
    state.myEnrolledCourseIds = data.enrollments.map(e => e.courseId);
  } catch (e) { state.myEnrolledCourseIds = []; }
}

// ---------- Cursos disponíveis ----------
async function renderCourses() {
  const box = el('homeContent');
  box.innerHTML = '<p class="empty">Carregando cursos…</p>';
  let courses = [];
  try {
    const data = await api('/courses');
    courses = data.courses;
  } catch (e) {
    box.innerHTML = '<div class="empty"><h3>Erro</h3><p>' + esc(e.message) + '</p></div>';
    return;
  }
  await loadMyEnrollments();

  if (!courses.length) {
    box.innerHTML = '<div class="empty"><h3>Nenhum curso ainda</h3><p>Em breve novos cursos estarão disponíveis.</p></div>';
    return;
  }

  box.innerHTML = '<div class="grid">' + courses.map(c => {
    const isAdmin = state.user.role === 'admin';
    const isEnrolled = state.myEnrolledCourseIds.includes(c.id);
    let foot = '';
    if (isAdmin) {
      foot = `<div class="card-actions">
        <button class="btn btn-ghost btn-sm" data-edit="${c.id}">Editar</button>
        <button class="btn btn-danger btn-sm" data-del="${c.id}">Remover</button>
      </div>`;
    } else if (isEnrolled) {
      foot = '<span class="enrolled-badge">✓ Matriculado</span>';
    } else {
      foot = `<button class="btn btn-enroll" data-enroll="${c.id}">Matricular-se</button>`;
    }
    return `<div class="course-card">
      <h3>${esc(c.name)}</h3>
      <div class="course-desc">${esc(c.description) || '<span style="opacity:.6">Sem descrição.</span>'}</div>
      <div class="course-meta">
        ${c.duration ? `<span>⏱ ${esc(c.duration)}</span>` : ''}
        ${c.price ? `<span>💰 ${esc(c.price)}</span>` : ''}
        <span>👥 ${c.enrolledCount} matriculado(s)</span>
      </div>
      <div class="course-foot">${foot}</div>
    </div>`;
  }).join('') + '</div>';

  bindCourseEvents(box);
}

function bindCourseEvents(box) {
  box.querySelectorAll('[data-enroll]').forEach(b => {
    b.onclick = async () => {
      b.disabled = true;
      try {
        await api('/enrollments', { method: 'POST', body: { courseId: b.dataset.enroll } });
        state.myEnrolledCourseIds.push(b.dataset.enroll);
        renderCourses();
      } catch (e) {
        alert(e.message);
        b.disabled = false;
      }
    };
  });
  box.querySelectorAll('[data-edit]').forEach(b => {
    b.onclick = () => openCourseModal(b.dataset.edit);
  });
  box.querySelectorAll('[data-del]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Remover este curso? Todas as matrículas dele também serão removidas.')) return;
      try {
        await api('/courses/' + b.dataset.del, { method: 'DELETE' });
        renderCourses();
      } catch (e) { alert(e.message); }
    };
  });
}

// ---------- Meus cursos ----------
async function renderMyCourses() {
  const box = el('homeContent');
  box.innerHTML = '<p class="empty">Carregando…</p>';
  let list = [];
  try {
    const data = await api('/enrollments/my');
    list = data.enrollments;
  } catch (e) {
    box.innerHTML = '<div class="empty"><h3>Erro</h3><p>' + esc(e.message) + '</p></div>';
    return;
  }
  if (!list.length) {
    box.innerHTML = '<div class="empty"><h3>Você não está matriculado em nenhum curso</h3><p>Vá em "Cursos" para se matricular.</p></div>';
    return;
  }
  box.innerHTML = '<div class="grid">' + list.map(e => {
    const d = new Date(e.enrolledAt).toLocaleDateString('pt-BR');
    return `<div class="course-card">
      <h3>${esc(e.courseName)}</h3>
      <div class="course-desc">Matriculado em ${d}.</div>
      <div class="course-foot">
        <span class="enrolled-badge">✓ Matriculado</span>
        <button class="btn btn-danger btn-sm" data-cancel="${e.id}">Cancelar matrícula</button>
      </div>
    </div>`;
  }).join('') + '</div>';
  box.querySelectorAll('[data-cancel]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Deseja cancelar esta matrícula?')) return;
      try {
        await api('/enrollments/' + b.dataset.cancel, { method: 'DELETE' });
        renderMyCourses();
      } catch (e) { alert(e.message); }
    };
  });
}

// ---------- Todas as matrículas (admin) ----------
async function renderAllEnrollments() {
  const box = el('homeContent');
  box.innerHTML = '<p class="empty">Carregando…</p>';
  let list = [];
  try {
    const data = await api('/enrollments/all');
    list = data.enrollments;
  } catch (e) {
    box.innerHTML = '<div class="empty"><h3>Erro</h3><p>' + esc(e.message) + '</p></div>';
    return;
  }
  if (!list.length) {
    box.innerHTML = '<div class="empty"><h3>Nenhuma matrícula</h3><p>Nenhum aluno se matriculou ainda.</p></div>';
    return;
  }
  const rows = list.map(e => {
    const d = new Date(e.enrolledAt).toLocaleString('pt-BR');
    return `<tr>
      <td>${esc(e.studentName)}<br><small style="color:var(--muted)">${esc(e.studentEmail)}</small></td>
      <td>${esc(e.courseName)}</td>
      <td>${d}</td>
      <td><button class="btn btn-danger btn-sm" data-cancel="${e.id}">Cancelar</button></td>
    </tr>`;
  }).join('');
  box.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Aluno</th><th>Curso</th><th>Data</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
  box.querySelectorAll('[data-cancel]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Cancelar esta matrícula?')) return;
      try {
        await api('/enrollments/' + b.dataset.cancel, { method: 'DELETE' });
        renderAllEnrollments();
      } catch (e) { alert(e.message); }
    };
  });
}

// ---------- Modal de curso ----------
function openCourseModal(courseId) {
  let course = null;
  if (courseId) {
    api('/courses').then(d => {
      course = d.courses.find(c => c.id === courseId);
      if (!course) return;
      el('courseModalTitle').textContent = 'Editar curso';
      el('courseId').value = course.id;
      el('courseName').value = course.name;
      el('courseDesc').value = course.description || '';
      el('courseDuration').value = course.duration || '';
      el('coursePrice').value = course.price || '';
      el('courseModal').style.display = 'flex';
    });
  } else {
    el('courseModalTitle').textContent = 'Novo curso';
    el('courseForm').reset();
    el('courseId').value = '';
    el('courseModal').style.display = 'flex';
  }
}
function closeCourseModal() { el('courseModal').style.display = 'none'; }

// ---------- Auth ----------
let authMode = 'login';

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === mode));
  el('regNameWrap').style.display = mode === 'register' ? 'block' : 'none';
  el('authSubmit').textContent = mode === 'register' ? 'Criar conta' : 'Entrar';
  setAuthMsg('');
}

async function handleAuth(e) {
  e.preventDefault();
  const name = el('name').value.trim();
  const email = el('email').value.trim();
  const password = el('password').value;
  setAuthMsg('');
  const btn = el('authSubmit');
  btn.disabled = true;
  try {
    const payload = { email, password };
    if (authMode === 'register') payload.name = name;
    const data = await api('/auth/' + authMode, { method: 'POST', body: payload });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('token', data.token);
    state.mode = state.user.role === 'admin' ? 'courses' : 'courses';
    showHome();
  } catch (err) {
    setAuthMsg(err.message);
  } finally {
    btn.disabled = false;
  }
}

function logoutLocal() {
  localStorage.removeItem('token');
  state.token = null;
  state.user = null;
}

async function handleLogout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch (e) {}
  logoutLocal();
  showAuth();
}

// ---------- Inicialização ----------
async function init() {
  document.querySelectorAll('.tab').forEach(t => {
    t.onclick = () => setAuthMode(t.dataset.tab);
  });
  el('authForm').onsubmit = handleAuth;
  el('logoutBtn').onclick = handleLogout;
  el('newCourseBtn').onclick = () => openCourseModal(null);
  el('courseCancel').onclick = closeCourseModal;
  el('courseModal').onclick = (e) => { if (e.target === el('courseModal')) closeCourseModal(); };
  el('courseForm').onsubmit = async (e) => {
    e.preventDefault();
    const id = el('courseId').value;
    const body = {
      name: el('courseName').value,
      description: el('courseDesc').value,
      duration: el('courseDuration').value,
      price: el('coursePrice').value
    };
    try {
      if (id) await api('/courses/' + id, { method: 'PUT', body });
      else await api('/courses', { method: 'POST', body });
      closeCourseModal();
      renderCourses();
    } catch (err) { alert(err.message); }
  };

  // Tentar restaurar sessão
  if (state.token) {
    try {
      const data = await api('/auth/me');
      state.user = data.user;
      showHome();
      return;
    } catch (e) {
      logoutLocal();
    }
  }
  showAuth();
}

init();
