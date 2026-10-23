// Estado da aplicação
let token = localStorage.getItem('token');
let usuario = JSON.parse(localStorage.getItem('usuario') || 'null');

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    if (token && usuario) {
        mostrarTelaPrincipal();
    } else {
        mostrarTelaAuth();
    }
});

// ===== AUTENTICAÇÃO =====

function mostrarLogin() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('registro-form').classList.add('hidden');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function mostrarRegistro() {
    document.getElementById('registro-form').classList.remove('hidden');
    document.getElementById('login-form').classList.add('hidden');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

async function fazerLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    const erroEl = document.getElementById('login-erro');

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });

        const data = await response.json();

        if (!response.ok) {
            erroEl.textContent = data.erro || 'Erro ao fazer login';
            return;
        }

        token = data.token;
        usuario = data.usuario;
        localStorage.setItem('token', token);
        localStorage.setItem('usuario', JSON.stringify(usuario));

        mostrarTelaPrincipal();
    } catch (erro) {
        erroEl.textContent = 'Erro ao conectar com o servidor';
    }
}

async function fazerRegistro(event) {
    event.preventDefault();
    
    const nome = document.getElementById('registro-nome').value;
    const email = document.getElementById('registro-email').value;
    const senha = document.getElementById('registro-senha').value;
    const erroEl = document.getElementById('registro-erro');

    try {
        const response = await fetch('/api/registrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email, senha })
        });

        const data = await response.json();

        if (!response.ok) {
            erroEl.textContent = data.erro || 'Erro ao criar conta';
            return;
        }

        token = data.token;
        usuario = data.usuario;
        localStorage.setItem('token', token);
        localStorage.setItem('usuario', JSON.stringify(usuario));

        mostrarTelaPrincipal();
    } catch (erro) {
        erroEl.textContent = 'Erro ao conectar com o servidor';
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    token = null;
    usuario = null;
    location.reload();
}

// ===== NAVEGAÇÃO =====

function mostrarTelaAuth() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('main-screen').classList.add('hidden');
}

function mostrarTelaPrincipal() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    
    document.getElementById('user-info').textContent = `Olá, ${usuario.nome}`;
    
    if (usuario.admin) {
        document.getElementById('btn-admin').classList.remove('hidden');
    }
    
    mostrarCursos();
}

function esconderTodasSections() {
    document.getElementById('cursos-section').classList.add('hidden');
    document.getElementById('meus-cursos-section').classList.add('hidden');
    document.getElementById('admin-section').classList.add('hidden');
}

function mostrarCursos() {
    esconderTodasSections();
    document.getElementById('cursos-section').classList.remove('hidden');
    carregarCursos();
}

function mostrarMeusCursos() {
    esconderTodasSections();
    document.getElementById('meus-cursos-section').classList.remove('hidden');
    carregarMeusCursos();
}

function mostrarAdmin() {
    esconderTodasSections();
    document.getElementById('admin-section').classList.remove('hidden');
    mostrarGerenciarCursos();
}

// ===== CURSOS =====

async function carregarCursos() {
    try {
        const response = await fetch('/api/cursos');
        const cursos = await response.json();

        const matriculas = await fetchMinhasMatriculas();
        const cursosMatriculados = matriculas.map(m => m.curso_id);

        const container = document.getElementById('lista-cursos');
        
        if (cursos.length === 0) {
            container.innerHTML = '<p>Nenhum curso disponível no momento.</p>';
            return;
        }

        container.innerHTML = cursos.map(curso => {
            const jaMatriculado = cursosMatriculados.includes(curso.id);
            
            return `
                <div class="curso-card">
                    <h3>${curso.titulo}</h3>
                    <p>${curso.descricao || 'Sem descrição'}</p>
                    <p class="instrutor">Instrutor: ${curso.instrutor || 'Não informado'}</p>
                    <p class="duracao">Duração: ${curso.duracao || 'Não informada'}</p>
                    <button 
                        onclick="matricular(${curso.id})" 
                        ${jaMatriculado ? 'disabled' : ''}
                    >
                        ${jaMatriculado ? 'Matriculado' : 'Matricular'}
                    </button>
                </div>
            `;
        }).join('');
    } catch (erro) {
        console.error('Erro ao carregar cursos:', erro);
    }
}

async function matricular(cursoId) {
    try {
        const response = await fetch('/api/matriculas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ curso_id: cursoId })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.erro || 'Erro ao realizar matrícula');
            return;
        }

        alert('Matrícula realizada com sucesso!');
        carregarCursos();
    } catch (erro) {
        alert('Erro ao conectar com o servidor');
    }
}

// ===== MEUS CURSOS =====

async function fetchMinhasMatriculas() {
    try {
        const response = await fetch('/api/minhas-matriculas', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await response.json();
    } catch (erro) {
        console.error('Erro ao buscar matrículas:', erro);
        return [];
    }
}

async function carregarMeusCursos() {
    const matriculas = await fetchMinhasMatriculas();
    const container = document.getElementById('lista-meus-cursos');
    
    if (matriculas.length === 0) {
        container.innerHTML = '<p>Você ainda não está matriculado em nenhum curso.</p>';
        return;
    }

    container.innerHTML = matriculas.map(mat => `
        <div class="curso-card">
            <h3>${mat.titulo}</h3>
            <p>${mat.descricao || 'Sem descrição'}</p>
            <p class="instrutor">Instrutor: ${mat.instrutor || 'Não informado'}</p>
            <p class="duracao">Duração: ${mat.duracao || 'Não informada'}</p>
            <p style="margin-top: 10px; color: #999; font-size: 14px;">
                Matriculado em: ${new Date(mat.data_matricula).toLocaleDateString('pt-BR')}
            </p>
        </div>
    `).join('');
}

// ===== ADMIN - CURSOS =====

function mostrarGerenciarCursos() {
    document.getElementById('gerenciar-cursos').classList.remove('hidden');
    document.getElementById('todas-matriculas').classList.add('hidden');
    document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    carregarCursosAdmin();
}

async function carregarCursosAdmin() {
    try {
        const response = await fetch('/api/cursos');
        const cursos = await response.json();
        
        const container = document.getElementById('lista-cursos-admin');
        
        if (cursos.length === 0) {
            container.innerHTML = '<p>Nenhum curso cadastrado.</p>';
            return;
        }

        container.innerHTML = cursos.map(curso => `
            <div class="admin-item">
                <div class="admin-item-info">
                    <h4>${curso.titulo}</h4>
                    <p>${curso.descricao || 'Sem descrição'}</p>
                    <p><strong>Instrutor:</strong> ${curso.instrutor || 'Não informado'} | 
                       <strong>Duração:</strong> ${curso.duracao || 'Não informada'}</p>
                </div>
                <div class="admin-item-actions">
                    <button class="btn-edit" onclick="editarCurso(${curso.id})">Editar</button>
                    <button class="btn-delete" onclick="deletarCurso(${curso.id})">Remover</button>
                </div>
            </div>
        `).join('');
    } catch (erro) {
        console.error('Erro ao carregar cursos:', erro);
    }
}

function mostrarFormCurso(curso = null) {
    const modal = document.getElementById('form-curso');
    const titulo = document.getElementById('form-curso-titulo');
    
    if (curso) {
        titulo.textContent = 'Editar Curso';
        document.getElementById('curso-id').value = curso.id;
        document.getElementById('curso-titulo').value = curso.titulo;
        document.getElementById('curso-descricao').value = curso.descricao || '';
        document.getElementById('curso-instrutor').value = curso.instrutor || '';
        document.getElementById('curso-duracao').value = curso.duracao || '';
    } else {
        titulo.textContent = 'Novo Curso';
        document.getElementById('curso-id').value = '';
        document.getElementById('curso-titulo').value = '';
        document.getElementById('curso-descricao').value = '';
        document.getElementById('curso-instrutor').value = '';
        document.getElementById('curso-duracao').value = '';
    }
    
    modal.classList.remove('hidden');
}

function fecharFormCurso() {
    document.getElementById('form-curso').classList.add('hidden');
}

async function editarCurso(id) {
    try {
        const response = await fetch(`/api/cursos/${id}`);
        const curso = await response.json();
        mostrarFormCurso(curso);
    } catch (erro) {
        alert('Erro ao carregar curso');
    }
}

async function salvarCurso(event) {
    event.preventDefault();
    
    const id = document.getElementById('curso-id').value;
    const dados = {
        titulo: document.getElementById('curso-titulo').value,
        descricao: document.getElementById('curso-descricao').value,
        instrutor: document.getElementById('curso-instrutor').value,
        duracao: document.getElementById('curso-duracao').value
    };

    try {
        const url = id ? `/api/cursos/${id}` : '/api/cursos';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(dados)
        });

        if (!response.ok) {
            const data = await response.json();
            alert(data.erro || 'Erro ao salvar curso');
            return;
        }

        alert(id ? 'Curso atualizado com sucesso!' : 'Curso criado com sucesso!');
        fecharFormCurso();
        carregarCursosAdmin();
    } catch (erro) {
        alert('Erro ao conectar com o servidor');
    }
}

async function deletarCurso(id) {
    if (!confirm('Tem certeza que deseja remover este curso? Todas as matrículas serão canceladas.')) {
        return;
    }

    try {
        const response = await fetch(`/api/cursos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const data = await response.json();
            alert(data.erro || 'Erro ao remover curso');
            return;
        }

        alert('Curso removido com sucesso!');
        carregarCursosAdmin();
    } catch (erro) {
        alert('Erro ao conectar com o servidor');
    }
}

// ===== ADMIN - MATRÍCULAS =====

function mostrarTodasMatriculas() {
    document.getElementById('todas-matriculas').classList.remove('hidden');
    document.getElementById('gerenciar-cursos').classList.add('hidden');
    document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    carregarTodasMatriculas();
}

async function carregarTodasMatriculas() {
    try {
        const response = await fetch('/api/matriculas', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const matriculas = await response.json();
        
        const container = document.getElementById('lista-matriculas-admin');
        
        if (matriculas.length === 0) {
            container.innerHTML = '<p>Nenhuma matrícula registrada.</p>';
            return;
        }

        container.innerHTML = matriculas.map(mat => `
            <div class="admin-item">
                <div class="admin-item-info">
                    <h4>${mat.curso_titulo}</h4>
                    <p><strong>Aluno:</strong> ${mat.usuario_nome} (${mat.usuario_email})</p>
                    <p><strong>Data da matrícula:</strong> ${new Date(mat.data_matricula).toLocaleString('pt-BR')}</p>
                </div>
                <div class="admin-item-actions">
                    <button class="btn-cancel" onclick="cancelarMatricula(${mat.id})">Cancelar Matrícula</button>
                </div>
            </div>
        `).join('');
    } catch (erro) {
        console.error('Erro ao carregar matrículas:', erro);
    }
}

async function cancelarMatricula(id) {
    if (!confirm('Tem certeza que deseja cancelar esta matrícula?')) {
        return;
    }

    try {
        const response = await fetch(`/api/matriculas/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const data = await response.json();
            alert(data.erro || 'Erro ao cancelar matrícula');
            return;
        }

        alert('Matrícula cancelada com sucesso!');
        carregarTodasMatriculas();
    } catch (erro) {
        alert('Erro ao conectar com o servidor');
    }
}
