let currentUser = null;
let allCourses = [];
let myEnrollments = [];
let allAdminEnrollments = [];

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Controle de Autenticação
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    currentUser = data.user;
    updateNavbar();
    loadCatalog();
  } catch (err) {
    currentUser = null;
    updateNavbar();
    loadCatalog();
  }
}

function updateNavbar() {
  const authArea = document.getElementById('authArea');
  const navMeusCursos = document.getElementById('navMeusCursos');
  const navAdmin = document.getElementById('navAdmin');

  if (currentUser) {
    const roleBadge = currentUser.role === 'admin' 
      ? '<span class="user-badge badge-admin">Admin</span>' 
      : '<span class="user-badge badge-student">Aluno</span>';

    authArea.innerHTML = `
      <div class="user-profile">
        <span class="user-name">${escapeHtml(currentUser.name)} ${roleBadge}</span>
        <button class="btn btn-secondary btn-sm" onclick="handleLogout()">Sair</button>
      </div>
    `;

    if (currentUser.role === 'admin') {
      navAdmin.classList.remove('hidden');
      navMeusCursos.classList.remove('hidden');
    } else {
      navAdmin.classList.add('hidden');
      navMeusCursos.classList.remove('hidden');
    }
  } else {
    authArea.innerHTML = `
      <button class="btn btn-secondary" onclick="openModal('modalLogin')">Entrar</button>
      <button class="btn btn-primary" onclick="openModal('modalRegister')">Criar Conta</button>
    `;
    navMeusCursos.classList.add('hidden');
    navAdmin.classList.add('hidden');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao realizar login.', 'error');
      return;
    }

    currentUser = data.user;
    closeModal('modalLogin');
    document.getElementById('formLogin').reset();
    showToast(`Bem-vindo(a), ${currentUser.name}!`, 'success');
    updateNavbar();
    loadCatalog();

    if (currentUser.role === 'admin') {
      navigate('admin');
    } else {
      navigate('catalogo');
    }
  } catch (err) {
    showToast('Falha na comunicação com o servidor.', 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao criar conta.', 'error');
      return;
    }

    currentUser = data.user;
    closeModal('modalRegister');
    document.getElementById('formRegister').reset();
    showToast('Conta criada com sucesso!', 'success');
    updateNavbar();
    loadCatalog();
    navigate('catalogo');
  } catch (err) {
    showToast('Falha na comunicação com o servidor.', 'error');
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    updateNavbar();
    showToast('Você saiu da sua conta.', 'info');
    navigate('catalogo');
    loadCatalog();
  } catch (err) {
    showToast('Erro ao sair.', 'error');
  }
}

// Navegação entre abas principais
function navigate(viewName) {
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  if (viewName === 'catalogo') {
    document.getElementById('sectionCatalogo').classList.add('active');
    document.getElementById('navCatalogo').classList.add('active');
    loadCatalog();
  } else if (viewName === 'meus-cursos') {
    if (!currentUser) {
      openModal('modalLogin');
      return;
    }
    document.getElementById('sectionMeusCursos').classList.add('active');
    document.getElementById('navMeusCursos').classList.add('active');
    loadMyCourses();
  } else if (viewName === 'admin') {
    if (!currentUser || currentUser.role !== 'admin') {
      showToast('Acesso exclusivo para administradores.', 'error');
      navigate('catalogo');
      return;
    }
    document.getElementById('sectionAdmin').classList.add('active');
    document.getElementById('navAdmin').classList.add('active');
    loadAdminData();
  }
}

// CATÁLOGO DE CURSOS
async function loadCatalog() {
  try {
    const res = await fetch('/api/courses');
    allCourses = await res.json();
    renderCatalog();
  } catch (err) {
    showToast('Erro ao carregar cursos do servidor.', 'error');
  }
}

function renderCatalog() {
  const container = document.getElementById('catalogGrid');
  if (!allCourses || allCourses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Nenhum curso disponível no momento.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = allCourses.map(course => {
    let actionButton = '';

    if (course.isEnrolled) {
      actionButton = `
        <button class="btn btn-success btn-sm" onclick="openClassroom('${course.id}')">
          ✓ Matriculado (Acessar)
        </button>
      `;
    } else {
      actionButton = `
        <button class="btn btn-primary btn-sm" onclick="enrollCourse('${course.id}')">
          Fazer Matrícula
        </button>
      `;
    }

    return `
      <div class="course-card">
        <div>
          <div class="course-tags">
            <span class="badge">${escapeHtml(course.category || 'Geral')}</span>
            <span class="badge badge-outline">${escapeHtml(course.duration || 'Auto-instrucional')}</span>
          </div>
          <h3 class="course-title">${escapeHtml(course.title)}</h3>
          <p class="course-instructor">Instrutor: <b>${escapeHtml(course.instructor)}</b></p>
          <p class="course-description">${escapeHtml(course.description)}</p>
        </div>
        <div class="course-footer">
          <span class="course-stats">👥 ${course.totalStudents || 0} matriculados</span>
          ${actionButton}
        </div>
      </div>
    `;
  }).join('');
}

// MATRÍCULA DO ALUNO
async function enrollCourse(courseId) {
  if (!currentUser) {
    showToast('Faça login ou crie uma conta para se matricular.', 'info');
    openModal('modalLogin');
    return;
  }

  try {
    const res = await fetch(`/api/enroll/${courseId}`, { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao realizar matrícula.', 'error');
      return;
    }

    showToast(data.message || 'Matrícula efetuada com sucesso!', 'success');
    loadCatalog();
  } catch (err) {
    showToast('Erro ao realizar matrícula.', 'error');
  }
}

// MEUS CURSOS (ALUNO)
async function loadMyCourses() {
  try {
    const res = await fetch('/api/my-enrollments');
    myEnrollments = await res.json();
    renderMyCourses();
  } catch (err) {
    showToast('Erro ao buscar seus cursos.', 'error');
  }
}

function renderMyCourses() {
  const container = document.getElementById('myCoursesGrid');
  if (!myEnrollments || myEnrollments.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Você ainda não está matriculado em nenhum curso.</p>
        <button class="btn btn-primary" onclick="navigate('catalogo')">Ver Catálogo de Cursos</button>
      </div>
    `;
    return;
  }

  container.innerHTML = myEnrollments.map(item => {
    const course = item.course;
    const dateFormatted = new Date(item.enrolledAt).toLocaleDateString('pt-BR');

    return `
      <div class="course-card">
        <div>
          <div class="course-tags">
            <span class="badge">${escapeHtml(course.category || 'Geral')}</span>
            <span class="badge badge-outline">${escapeHtml(course.duration || '')}</span>
          </div>
          <h3 class="course-title">${escapeHtml(course.title)}</h3>
          <p class="course-instructor">Instrutor: <b>${escapeHtml(course.instructor)}</b></p>
          <p class="course-description">${escapeHtml(course.description)}</p>
        </div>
        <div class="course-footer">
          <span class="course-stats">Matriculado em: ${dateFormatted}</span>
          <button class="btn btn-success btn-sm" onclick="openClassroom('${course.id}')">
            Acessar Aulas
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// SALA DE AULA / VISUALIZAR CURSO
function openClassroom(courseId) {
  let course = allCourses.find(c => c.id === courseId);
  if (!course) {
    const found = myEnrollments.find(e => e.course.id === courseId);
    if (found) course = found.course;
  }
  if (!course) return;

  document.getElementById('classroomTitle').textContent = course.title;
  document.getElementById('classroomCategory').textContent = course.category || 'Geral';
  document.getElementById('classroomDuration').textContent = course.duration || 'Flexível';
  document.getElementById('classroomInstructor').textContent = `Instrutor: ${course.instructor}`;
  document.getElementById('classroomDescription').textContent = course.description;
  document.getElementById('classroomContent').textContent = course.content || 'Conteúdo em desenvolvimento pelo instrutor.';

  openModal('modalClassroom');
}

// PAINEL ADMINISTRATIVO
function switchAdminTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));

  if (tabName === 'cursos') {
    document.getElementById('tabBtnCursos').classList.add('active');
    document.getElementById('adminTabCursos').classList.add('active');
  } else {
    document.getElementById('tabBtnMatriculas').classList.add('active');
    document.getElementById('adminTabMatriculas').classList.add('active');
  }
}

async function loadAdminData() {
  await Promise.all([loadAdminCourses(), loadAdminEnrollments()]);
}

async function loadAdminCourses() {
  try {
    const res = await fetch('/api/courses');
    allCourses = await res.json();
    renderAdminCourses();
  } catch (err) {
    showToast('Erro ao carregar cursos para administração.', 'error');
  }
}

function renderAdminCourses() {
  const tbody = document.getElementById('adminCoursesTableBody');
  if (!allCourses || allCourses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem;">Nenhum curso cadastrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = allCourses.map(course => {
    return `
      <tr>
        <td><b>${escapeHtml(course.title)}</b></td>
        <td><span class="badge">${escapeHtml(course.category || 'Geral')}</span></td>
        <td>${escapeHtml(course.instructor)}</td>
        <td>${escapeHtml(course.duration || 'N/A')}</td>
        <td>${course.totalStudents || 0} alunos</td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-secondary btn-sm" onclick="openCourseModal('${course.id}')">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="handleDeleteCourse('${course.id}', '${escapeHtml(course.title)}')">Excluir</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadAdminEnrollments() {
  try {
    const res = await fetch('/api/admin/enrollments');
    allAdminEnrollments = await res.json();
    renderAdminEnrollments();
  } catch (err) {
    showToast('Erro ao carregar matrículas.', 'error');
  }
}

function renderAdminEnrollments() {
  const tbody = document.getElementById('adminEnrollmentsTableBody');
  if (!allAdminEnrollments || allAdminEnrollments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem;">Nenhuma matrícula realizada ainda.</td></tr>`;
    return;
  }

  tbody.innerHTML = allAdminEnrollments.map(enr => {
    const dateFormatted = new Date(enr.enrolledAt).toLocaleDateString('pt-BR') + ' ' +
                          new Date(enr.enrolledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const statusBadge = enr.status === 'ativa'
      ? '<span class="status-badge status-ativa">Ativa</span>'
      : '<span class="status-badge status-cancelada">Cancelada</span>';

    const actionButton = enr.status === 'ativa'
      ? `<button class="btn btn-danger btn-sm" onclick="handleCancelEnrollment('${enr.id}', '${escapeHtml(enr.student.name)}', '${escapeHtml(enr.course.title)}')">Cancelar Matrícula</button>`
      : `<span style="font-size: 0.85rem; color: #94a3b8;">Cancelada</span>`;

    return `
      <tr>
        <td><b>${escapeHtml(enr.student.name)}</b></td>
        <td>${escapeHtml(enr.student.email)}</td>
        <td>${escapeHtml(enr.course.title)}</td>
        <td>${dateFormatted}</td>
        <td>${statusBadge}</td>
        <td>${actionButton}</td>
      </tr>
    `;
  }).join('');
}

// CRIAR / EDITAR CURSO (ADMIN)
function openCourseModal(courseId = null) {
  document.getElementById('formCourse').reset();
  const modalTitle = document.getElementById('modalCourseTitle');
  const editIdField = document.getElementById('courseEditId');

  if (courseId) {
    const course = allCourses.find(c => c.id === courseId);
    if (!course) return;
    modalTitle.textContent = 'Editar Curso';
    editIdField.value = course.id;
    document.getElementById('courseTitle').value = course.title;
    document.getElementById('courseCategory').value = course.category || '';
    document.getElementById('courseDuration').value = course.duration || '';
    document.getElementById('courseInstructor').value = course.instructor;
    document.getElementById('courseDescription').value = course.description;
    document.getElementById('courseContent').value = course.content || '';
  } else {
    modalTitle.textContent = 'Cadastrar Novo Curso';
    editIdField.value = '';
  }

  openModal('modalCourse');
}

async function handleSaveCourse(e) {
  e.preventDefault();
  const id = document.getElementById('courseEditId').value;
  const title = document.getElementById('courseTitle').value;
  const category = document.getElementById('courseCategory').value;
  const duration = document.getElementById('courseDuration').value;
  const instructor = document.getElementById('courseInstructor').value;
  const description = document.getElementById('courseDescription').value;
  const content = document.getElementById('courseContent').value;

  const bodyData = { title, category, duration, instructor, description, content };

  try {
    let res;
    if (id) {
      // Atualizar curso existente
      res = await fetch(`/api/courses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
    } else {
      // Criar novo curso
      res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
    }

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Erro ao salvar curso.', 'error');
      return;
    }

    showToast(id ? 'Curso atualizado com sucesso!' : 'Curso cadastrado com sucesso!', 'success');
    closeModal('modalCourse');
    loadAdminCourses();
  } catch (err) {
    showToast('Falha ao comunicar com o servidor.', 'error');
  }
}

// EXCLUIR CURSO (ADMIN)
async function handleDeleteCourse(courseId, courseTitle) {
  const confirmDelete = confirm(`Tem certeza que deseja remover o curso "${courseTitle}"?\nTodas as matrículas vinculadas a ele também serão removidas.`);
  if (!confirmDelete) return;

  try {
    const res = await fetch(`/api/courses/${courseId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Erro ao excluir o curso.', 'error');
      return;
    }

    showToast('Curso removido com sucesso!', 'success');
    loadAdminData();
  } catch (err) {
    showToast('Erro ao remover o curso.', 'error');
  }
}

// CANCELAR MATRÍCULA (ADMIN)
async function handleCancelEnrollment(enrollmentId, studentName, courseTitle) {
  const confirmCancel = confirm(`Deseja cancelar a matrícula de "${studentName}" no curso "${courseTitle}"?`);
  if (!confirmCancel) return;

  try {
    const res = await fetch(`/api/admin/enrollments/${enrollmentId}/cancel`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Erro ao cancelar matrícula.', 'error');
      return;
    }

    showToast('Matrícula cancelada com sucesso.', 'success');
    loadAdminEnrollments();
  } catch (err) {
    showToast('Erro ao cancelar matrícula.', 'error');
  }
}

// UTILITÁRIOS DE MODAL
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

function switchModal(fromId, toId) {
  closeModal(fromId);
  openModal(toId);
}

// Fechar modais ao clicar fora
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});

// Prevenir injeção de HTML
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
