let cursosData = [];
let matriculasData = [];
let editandoCursoId = null;

async function verificarAuth() {
  try {
    const response = await fetch('/api/usuario-atual');
    if (!response.ok) {
      window.location.href = '/login';
      return;
    }
    const data = await response.json();
    document.getElementById('nomeUsuario').textContent = data.usuario.nome;
    
    if (data.usuario.tipo !== 'admin') {
      window.location.href = '/aluno';
    }
  } catch (erro) {
    window.location.href = '/login';
  }
}

async function carregarCursos() {
  try {
    const response = await fetch('/api/cursos');
    if (!response.ok) throw new Error('Erro ao carregar cursos');
    
    cursosData = await response.json();
    renderizarCursos();
  } catch (erro) {
    mostrarMensagem('Erro ao carregar cursos', 'erro');
  }
}

async function carregarMatriculas() {
  try {
    const response = await fetch('/api/admin/matriculas');
    if (!response.ok) throw new Error('Erro ao carregar matrículas');
    
    matriculasData = await response.json();
    renderizarMatriculas();
  } catch (erro) {
    mostrarMensagem('Erro ao carregar matrículas', 'erro');
  }
}

function renderizarCursos() {
  const lista = document.getElementById('listaCursos');
  
  if (cursosData.length === 0) {
    lista.innerHTML = '<p class="text-muted">Nenhum curso cadastrado.</p>';
    return;
  }

  lista.innerHTML = cursosData.map(curso => `
    <div class="curso-card">
      <h3>${curso.titulo}</h3>
      <p>${curso.descricao}</p>
      <div class="curso-info">
        <span class="badge">👨‍🏫 ${curso.instrutor}</span>
        <span class="badge">⏱️ ${curso.duracao}</span>
        <span class="badge">📊 ${curso.nivel}</span>
      </div>
      <div class="curso-actions">
        <button class="btn btn-primary" onclick="editarCurso(${curso.id})">Editar</button>
        <button class="btn btn-danger" onclick="removerCurso(${curso.id})">Remover</button>
      </div>
    </div>
  `).join('');
}

function renderizarMatriculas() {
  const container = document.getElementById('listaMatriculas');
  
  if (matriculasData.length === 0) {
    container.innerHTML = '<p class="text-muted">Nenhuma matrícula registrada.</p>';
    return;
  }

  container.innerHTML = `
    <div class="matriculas-table">
      <table>
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Email</th>
            <th>Curso</th>
            <th>Data Matrícula</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${matriculasData.map(m => `
            <tr>
              <td>${m.usuario_nome}</td>
              <td>${m.usuario_email}</td>
              <td>${m.curso_titulo}</td>
              <td>${new Date(m.data_matricula).toLocaleDateString('pt-BR')}</td>
              <td>
                <button class="btn btn-danger btn-small" onclick="cancelarMatricula(${m.matricula_id})">
                  Cancelar
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function mostrarFormulario() {
  document.getElementById('formCurso').style.display = 'block';
  document.getElementById('formTitulo').textContent = editandoCursoId ? 'Editar Curso' : 'Novo Curso';
}

function esconderFormulario() {
  document.getElementById('formCurso').style.display = 'none';
  document.getElementById('cursoForm').reset();
  document.getElementById('cursoId').value = '';
  editandoCursoId = null;
}

function editarCurso(id) {
  const curso = cursosData.find(c => c.id === id);
  if (!curso) return;

  editandoCursoId = id;
  document.getElementById('cursoId').value = id;
  document.getElementById('titulo').value = curso.titulo;
  document.getElementById('descricao').value = curso.descricao;
  document.getElementById('instrutor').value = curso.instrutor;
  document.getElementById('duracao').value = curso.duracao;
  document.getElementById('nivel').value = curso.nivel;

  mostrarFormulario();
  document.getElementById('formCurso').scrollIntoView({ behavior: 'smooth' });
}

async function removerCurso(id) {
  if (!confirm('Tem certeza que deseja remover este curso? Todas as matrículas serão canceladas.')) return;

  try {
    const response = await fetch(`/api/cursos/${id}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      mostrarMensagem('Curso removido com sucesso!', 'sucesso');
      await carregarCursos();
      await carregarMatriculas();
    } else {
      const data = await response.json();
      mostrarMensagem(data.erro, 'erro');
    }
  } catch (erro) {
    mostrarMensagem('Erro ao remover curso', 'erro');
  }
}

async function cancelarMatricula(matriculaId) {
  if (!confirm('Tem certeza que deseja cancelar esta matrícula?')) return;

  try {
    const response = await fetch(`/api/matriculas/${matriculaId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      mostrarMensagem('Matrícula cancelada com sucesso!', 'sucesso');
      await carregarMatriculas();
      await carregarCursos();
    } else {
      const data = await response.json();
      mostrarMensagem(data.erro, 'erro');
    }
  } catch (erro) {
    mostrarMensagem('Erro ao cancelar matrícula', 'erro');
  }
}

function mostrarMensagem(texto, tipo) {
  const mensagem = document.getElementById('mensagem');
  mensagem.className = `mensagem ${tipo}`;
  mensagem.textContent = texto;
  
  setTimeout(() => {
    mensagem.className = 'mensagem';
  }, 5000);
}

document.getElementById('btnNovoCurso').addEventListener('click', () => {
  esconderFormulario();
  editandoCursoId = null;
  mostrarFormulario();
});

document.getElementById('btnCancelar').addEventListener('click', () => {
  esconderFormulario();
});

document.getElementById('cursoForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const dados = {
    titulo: document.getElementById('titulo').value,
    descricao: document.getElementById('descricao').value,
    instrutor: document.getElementById('instrutor').value,
    duracao: document.getElementById('duracao').value,
    nivel: document.getElementById('nivel').value
  };

  try {
    const url = editandoCursoId ? `/api/cursos/${editandoCursoId}` : '/api/cursos';
    const method = editandoCursoId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    const data = await response.json();

    if (response.ok) {
      mostrarMensagem(
        editandoCursoId ? 'Curso atualizado com sucesso!' : 'Curso criado com sucesso!',
        'sucesso'
      );
      esconderFormulario();
      await carregarCursos();
    } else {
      mostrarMensagem(data.erro, 'erro');
    }
  } catch (erro) {
    mostrarMensagem('Erro ao salvar curso', 'erro');
  }
});

document.getElementById('btnLogout').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/';
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    btn.classList.add('active');
    document.getElementById(`${tab}Tab`).classList.add('active');
  });
});

verificarAuth();
carregarCursos();
carregarMatriculas();
