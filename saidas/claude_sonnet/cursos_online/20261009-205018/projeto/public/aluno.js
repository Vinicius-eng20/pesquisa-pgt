let cursosData = [];
let matriculasData = [];

async function verificarAuth() {
  try {
    const response = await fetch('/api/usuario-atual');
    if (!response.ok) {
      window.location.href = '/login';
      return;
    }
    const data = await response.json();
    document.getElementById('nomeUsuario').textContent = data.usuario.nome;
    
    if (data.usuario.tipo !== 'aluno') {
      window.location.href = '/admin';
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
    const response = await fetch('/api/minhas-matriculas');
    if (!response.ok) throw new Error('Erro ao carregar matrículas');
    
    matriculasData = await response.json();
    renderizarMatriculas();
  } catch (erro) {
    mostrarMensagem('Erro ao carregar suas matrículas', 'erro');
  }
}

function renderizarCursos() {
  const lista = document.getElementById('listaCursos');
  
  if (cursosData.length === 0) {
    lista.innerHTML = '<p class="text-muted">Nenhum curso disponível no momento.</p>';
    return;
  }

  lista.innerHTML = cursosData.map(curso => `
    <div class="curso-card">
      ${curso.matriculado ? '<span class="badge-matriculado">✓ Matriculado</span>' : ''}
      <h3>${curso.titulo}</h3>
      <p>${curso.descricao}</p>
      <div class="curso-info">
        <span class="badge">👨‍🏫 ${curso.instrutor}</span>
        <span class="badge">⏱️ ${curso.duracao}</span>
        <span class="badge">📊 ${curso.nivel}</span>
      </div>
      <div class="curso-actions">
        ${!curso.matriculado ? 
          `<button class="btn btn-success" onclick="matricular(${curso.id})">Matricular-se</button>` :
          `<button class="btn btn-secondary" disabled>Já Matriculado</button>`
        }
      </div>
    </div>
  `).join('');
}

function renderizarMatriculas() {
  const lista = document.getElementById('listaMatriculas');
  
  if (matriculasData.length === 0) {
    lista.innerHTML = '<p class="text-muted">Você ainda não está matriculado em nenhum curso.</p>';
    return;
  }

  lista.innerHTML = matriculasData.map(m => `
    <div class="curso-card">
      <h3>${m.titulo}</h3>
      <p>${m.descricao}</p>
      <div class="curso-info">
        <span class="badge">👨‍🏫 ${m.instrutor}</span>
        <span class="badge">⏱️ ${m.duracao}</span>
        <span class="badge">📊 ${m.nivel}</span>
        <span class="badge">📅 Matrícula: ${new Date(m.data_matricula).toLocaleDateString('pt-BR')}</span>
      </div>
      <div class="curso-actions">
        <button class="btn btn-danger" onclick="cancelarMatricula(${m.matricula_id})">Cancelar Matrícula</button>
      </div>
    </div>
  `).join('');
}

async function matricular(cursoId) {
  try {
    const response = await fetch('/api/matriculas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ curso_id: cursoId })
    });

    const data = await response.json();

    if (response.ok) {
      mostrarMensagem('Matrícula realizada com sucesso!', 'sucesso');
      await carregarCursos();
      await carregarMatriculas();
    } else {
      mostrarMensagem(data.erro, 'erro');
    }
  } catch (erro) {
    mostrarMensagem('Erro ao realizar matrícula', 'erro');
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
      await carregarCursos();
      await carregarMatriculas();
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
