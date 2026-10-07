let usuarioLogado = null;
let cursoEditandoId = null;

// Verifica se já está logado ao carregar a página
document.addEventListener('DOMContentLoaded', async () => {
    const res = await fetch('/api/perfil');
    if (res.ok) {
        usuarioLogado = await res.json();
        mostrarDashboard();
    }
});

// --- AUTENTICAÇÃO ---

function alternarAuth(tela) {
    document.getElementById('auth-mensagem').innerText = '';
    if (tela === 'login') {
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('registrar-form').style.display = 'none';
    } else {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('registrar-form').style.display = 'block';
    }
}

async function fazerLogin() {
    const username = document.getElementById('login-user').value;
    const senha = document.getElementById('login-pass').value;

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, senha })
    });
    const data = await res.json();

    if (data.sucesso) {
        usuarioLogado = data;
        mostrarDashboard();
    } else {
        document.getElementById('auth-mensagem').innerText = data.erro;
    }
}

async function fazerRegistro() {
    const username = document.getElementById('reg-user').value;
    const senha = document.getElementById('reg-pass').value;

    const res = await fetch('/api/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, senha })
    });
    const data = await res.json();

    if (data.sucesso) {
        alert('Conta criada! Faça login para continuar.');
        alternarAuth('login');
    } else {
        document.getElementById('auth-mensagem').innerText = data.erro;
    }
}

async function fazerLogout() {
    await fetch('/api/logout', { method: 'POST' });
    location.reload();
}

// --- DASHBOARD ---

function mostrarDashboard() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('boas-vindas').innerText = `Olá, ${usuarioLogado.username}!`;

    if (usuarioLogado.tipo === 'admin') {
        document.getElementById('admin-area').style.display = 'block';
        carregarCursosAdmin();
    } else {
        document.getElementById('aluno-area').style.display = 'block';
        carregarCatalogoAluno();
    }
}

// --- ÁREA DO ALUNO ---

function alternarAbaAluno(aba) {
    document.querySelectorAll('#aluno-area .tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('aluno-catalogo').style.display = aba === 'catalogo' ? 'block' : 'none';
    document.getElementById('aluno-meus-cursos').style.display = aba === 'meus-cursos' ? 'block' : 'none';

    if (aba === 'catalogo') carregarCatalogoAluno();
    if (aba === 'meus-cursos') carregarMeusCursos();
}

async function carregarCatalogoAluno() {
    const res = await fetch('/api/cursos');
    const cursos = await res.json();
    const container = document.getElementById('lista-cursos-aluno');
    container.innerHTML = '';

    if (cursos.length === 0) {
        container.innerHTML = '<p>Nenhum curso disponível no momento.</p>';
        return;
    }

    cursos.forEach(curso => {
        container.innerHTML += `
            <div class="card-curso">
                <h4>${curso.titulo}</h4>
                <p>${curso.descricao}</p>
                <small>Instrutor: ${curso.instrutor}</small>
                <button onclick="matricular(${curso.id})">Matricular-se</button>
            </div>
        `;
    });
}

async function matricular(curso_id) {
    const res = await fetch('/api/matriculas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curso_id })
    });
    const data = await res.json();
    
    if (data.sucesso) {
        alert('Matrícula realizada com sucesso!');
        alternarAbaAluno('meus-cursos'); // Joga o aluno para a aba de meus cursos
        document.querySelectorAll('#aluno-area .tab-btn')[1].classList.add('active');
        document.querySelectorAll('#aluno-area .tab-btn')[0].classList.remove('active');
    } else {
        alert(data.erro);
    }
}

async function carregarMeusCursos() {
    const res = await fetch('/api/meus-cursos');
    const cursos = await res.json();
    const container = document.getElementById('lista-meus-cursos');
    container.innerHTML = '';

    if (cursos.length === 0) {
        container.innerHTML = '<p>Você ainda não está matriculado em nenhum curso.</p>';
        return;
    }

    cursos.forEach(curso => {
        const dataMatricula = new Date(curso.data_matricula).toLocaleDateString();
        container.innerHTML += `
            <div class="card-curso" style="border-left: 5px solid #2ecc71;">
                <h4>${curso.titulo}</h4>
                <p>${curso.descricao}</p>
                <small>Instrutor: ${curso.instrutor} | Matriculado em: ${dataMatricula}</small>
                <button class="btn-danger" onclick="cancelarMinhaMatricula(${curso.id})">Cancelar Matrícula</button>
            </div>
        `;
    });
}

async function cancelarMinhaMatricula(curso_id) {
    if(confirm('Tem certeza que deseja cancelar a matrícula neste curso?')) {
        await fetch(`/api/matriculas/${curso_id}`, { method: 'DELETE' });
        carregarMeusCursos();
    }
}

// --- ÁREA DO ADMIN ---

function alternarAbaAdmin(aba) {
    document.querySelectorAll('#admin-area .tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('admin-cursos').style.display = aba === 'cursos' ? 'block' : 'none';
    document.getElementById('admin-matriculas').style.display = aba === 'matriculas' ? 'block' : 'none';

    if (aba === 'cursos') carregarCursosAdmin();
    if (aba === 'matriculas') carregarMatriculasAdmin();
}

async function salvarCurso() {
    const titulo = document.getElementById('curso-titulo').value;
    const descricao = document.getElementById('curso-descricao').value;
    const instrutor = document.getElementById('curso-instrutor').value;

    if (!titulo || !descricao || !instrutor) return alert('Preencha todos os campos do curso.');

    const metodo = cursoEditandoId ? 'PUT' : 'POST';
    const url = cursoEditandoId ? `/api/admin/cursos/${cursoEditandoId}` : '/api/admin/cursos';

    const res = await fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, descricao, instrutor })
    });

    if (res.ok) {
        cancelarEdicao();
        carregarCursosAdmin();
    }
}

async function carregarCursosAdmin() {
    const res = await fetch('/api/cursos');
    const cursos = await res.json();
    const tbody = document.getElementById('tabela-cursos-admin');
    tbody.innerHTML = '';

    cursos.forEach(curso => {
        tbody.innerHTML += `
            <tr>
                <td>${curso.titulo}</td>
                <td>${curso.instrutor}</td>
                <td>
                    <button onclick="prepararEdicao(${curso.id}, '${curso.titulo}', '${curso.instrutor}', \`${curso.descricao}\`)">Editar</button>
                    <button class="btn-danger" onclick="removerCurso(${curso.id})">Remover</button>
                </td>
            </tr>
        `;
    });
}

function prepararEdicao(id, titulo, instrutor, descricao) {
    cursoEditandoId = id;
    document.getElementById('curso-titulo').value = titulo;
    document.getElementById('curso-instrutor').value = instrutor;
    document.getElementById('curso-descricao').value = descricao;
    
    document.getElementById('btn-salvar-curso').innerText = 'Salvar Edição';
    document.getElementById('btn-cancelar-edicao').style.display = 'inline-block';
}

function cancelarEdicao() {
    cursoEditandoId = null;
    document.getElementById('curso-titulo').value = '';
    document.getElementById('curso-instrutor').value = '';
    document.getElementById('curso-descricao').value = '';
    document.getElementById('btn-salvar-curso').innerText = 'Adicionar Curso';
    document.getElementById('btn-cancelar-edicao').style.display = 'none';
}

async function removerCurso(id) {
    if(confirm('ATENÇÃO: Isso removerá o curso e todas as matrículas atreladas a ele. Deseja continuar?')) {
        await fetch(`/api/admin/cursos/${id}`, { method: 'DELETE' });
        carregarCursosAdmin();
    }
}

async function carregarMatriculasAdmin() {
    const res = await fetch('/api/admin/matriculas');
    const matriculas = await res.json();
    const tbody = document.getElementById('tabela-matriculas-admin');
    tbody.innerHTML = '';

    if (matriculas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">Nenhuma matrícula encontrada no sistema.</td></tr>';
        return;
    }

    matriculas.forEach(m => {
        const dataFormatada = new Date(m.data_matricula).toLocaleString();
        tbody.innerHTML += `
            <tr>
                <td>${m.aluno}</td>
                <td>${m.curso}</td>
                <td>${dataFormatada}</td>
                <td>
                    <button class="btn-danger" onclick="adminCancelarMatricula(${m.matricula_id})">Cancelar Matrícula</button>
                </td>
            </tr>
        `;
    });
}

async function adminCancelarMatricula(id) {
    if(confirm('Tem certeza que deseja cancelar esta matrícula?')) {
        await fetch(`/api/admin/matriculas/${id}`, { method: 'DELETE' });
        carregarMatriculasAdmin();
    }
}
