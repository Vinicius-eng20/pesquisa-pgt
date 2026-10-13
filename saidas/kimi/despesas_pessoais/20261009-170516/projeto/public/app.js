let token = localStorage.getItem('token');
let usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
let despesas = [];
let categorias = [];
let despesaEditando = null;

// === INICIALIZAÇÃO ===
window.onload = () => {
    if (token && usuario) {
        mostrarDashboard();
    }
    
    // Definir mês atual nos filtros
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('filtro-mes').value = mesAtual;
    document.getElementById('relatorio-mes').value = mesAtual;
    document.getElementById('admin-mes').value = mesAtual;
};

// === AUTENTICAÇÃO ===
function mostrarLogin() {
    document.getElementById('login-form').style.display = 'flex';
    document.getElementById('registro-form').style.display = 'none';
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function mostrarRegistro() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('registro-form').style.display = 'flex';
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            token = data.token;
            usuario = data.usuario;
            localStorage.setItem('token', token);
            localStorage.setItem('usuario', JSON.stringify(usuario));
            mostrarDashboard();
        } else {
            alert(data.erro || 'Erro ao fazer login');
        }
    } catch (erro) {
        alert('Erro ao conectar com o servidor');
    }
});

document.getElementById('registro-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nome = document.getElementById('reg-nome').value;
    const email = document.getElementById('reg-email').value;
    const senha = document.getElementById('reg-senha').value;
    const isAdmin = document.getElementById('reg-admin').checked;
    
    try {
        const res = await fetch('/api/registrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email, senha, isAdmin })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            alert('Conta criada com sucesso! Faça login.');
            mostrarLogin();
            document.getElementById('registro-form').reset();
        } else {
            alert(data.erro || 'Erro ao registrar');
        }
    } catch (erro) {
        alert('Erro ao conectar com o servidor');
    }
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    location.reload();
}

// === DASHBOARD ===
function mostrarDashboard() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('user-nome').textContent = `👤 ${usuario.nome}`;
    
    if (usuario.isAdmin) {
        document.getElementById('admin-tab').style.display = 'block';
    }
    
    carregarCategorias();
    carregarDespesas();
}

function mostrarAba(aba) {
    // Esconder todas as abas
    document.querySelectorAll('.aba-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.menu-tab').forEach(el => el.classList.remove('active'));
    
    // Mostrar aba selecionada
    document.getElementById(`aba-${aba}`).style.display = 'block';
    event.target.classList.add('active');
    
    // Carregar dados específicos
    if (aba === 'relatorio') {
        gerarRelatorio();
    } else if (aba === 'admin') {
        carregarUsuarios();
        carregarEstatisticas();
    }
}

// === CATEGORIAS ===
async function carregarCategorias() {
    try {
        const res = await fetch('/api/categorias', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        categorias = await res.json();
        
        // Preencher select de categorias
        const select = document.getElementById('desp-categoria');
        select.innerHTML = '<option value="">Selecione uma categoria</option>';
        categorias.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${cat.nome}</option>`;
        });
        
        // Listar categorias (admin)
        if (usuario.isAdmin) {
            listarCategorias();
        }
    } catch (erro) {
        console.error('Erro ao carregar categorias:', erro);
    }
}

function listarCategorias() {
    const lista = document.getElementById('lista-categorias');
    lista.innerHTML = '';
    
    categorias.forEach(cat => {
        lista.innerHTML += `
            <div class="categoria-item">
                <div class="categoria-cor" style="background: ${cat.cor}"></div>
                <strong>${cat.nome}</strong>
            </div>
        `;
    });
}

document.getElementById('form-categoria')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nome = document.getElementById('cat-nome').value;
    const cor = document.getElementById('cat-cor').value;
    
    try {
        const res = await fetch('/api/categorias', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ nome, cor })
        });
        
        if (res.ok) {
            alert('Categoria criada com sucesso!');
            document.getElementById('form-categoria').reset();
            carregarCategorias();
        } else {
            const data = await res.json();
            alert(data.erro || 'Erro ao criar categoria');
        }
    } catch (erro) {
        alert('Erro ao conectar com o servidor');
    }
});

// === DESPESAS ===
document.getElementById('form-despesa').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const descricao = document.getElementById('desp-descricao').value;
    const valor = parseFloat(document.getElementById('desp-valor').value);
    const categoria_id = document.getElementById('desp-categoria').value;
    const data = document.getElementById('desp-data').value;
    
    const despesa = { descricao, valor, categoria_id, data };
    
    try {
        const url = despesaEditando ? `/api/despesas/${despesaEditando}` : '/api/despesas';
        const method = despesaEditando ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(despesa)
        });
        
        if (res.ok) {
            alert(despesaEditando ? 'Despesa atualizada!' : 'Despesa adicionada!');
            document.getElementById('form-despesa').reset();
            despesaEditando = null;
            carregarDespesas();
        } else {
            const erro = await res.json();
            alert(erro.erro || 'Erro ao salvar despesa');
        }
    } catch (erro) {
        alert('Erro ao conectar com o servidor');
    }
});

async function carregarDespesas() {
    try {
        const res = await fetch('/api/despesas', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        despesas = await res.json();
        exibirDespesas(despesas);
    } catch (erro) {
        console.error('Erro ao carregar despesas:', erro);
    }
}

function exibirDespesas(lista) {
    const container = document.getElementById('lista-despesas');
    
    if (lista.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhuma despesa encontrada</div>';
        return;
    }
    
    container.innerHTML = lista.map(d => `
        <div class="despesa-item">
            <div class="despesa-info">
                <div class="despesa-descricao">${d.descricao}</div>
                <span class="despesa-categoria" style="background: ${d.categoria_cor}">
                    ${d.categoria_nome}
                </span>
                <small style="margin-left: 10px; color: #999;">${formatarData(d.data)}</small>
            </div>
            <div class="despesa-valor">R$ ${d.valor.toFixed(2)}</div>
            <div class="despesa-acoes">
                <button class="btn-edit" onclick="editarDespesa(${d.id})">Editar</button>
                <button class="btn-delete" onclick="deletarDespesa(${d.id})">Excluir</button>
            </div>
        </div>
    `).join('');
}

function filtrarDespesas() {
    const mesAno = document.getElementById('filtro-mes').value;
    if (!mesAno) {
        exibirDespesas(despesas);
        return;
    }
    
    const [ano, mes] = mesAno.split('-');
    const filtradas = despesas.filter(d => {
        const dataDespesa = new Date(d.data);
        return dataDespesa.getMonth() + 1 == mes && dataDespesa.getFullYear() == ano;
    });
    
    exibirDespesas(filtradas);
}

function limparFiltro() {
    document.getElementById('filtro-mes').value = '';
    exibirDespesas(despesas);
}

function editarDespesa(id) {
    const despesa = despesas.find(d => d.id === id);
    if (!despesa) return;
    
    document.getElementById('desp-descricao').value = despesa.descricao;
    document.getElementById('desp-valor').value = despesa.valor;
    document.getElementById('desp-categoria').value = despesa.categoria_id;
    document.getElementById('desp-data').value = despesa.data;
    
    despesaEditando = id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deletarDespesa(id) {
    if (!confirm('Deseja realmente excluir esta despesa?')) return;
    
    try {
        const res = await fetch(`/api/despesas/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            alert('Despesa excluída!');
            carregarDespesas();
        } else {
            alert('Erro ao excluir despesa');
        }
    } catch (erro) {
        alert('Erro ao conectar com o servidor');
    }
}

// === RELATÓRIO ===
async function gerarRelatorio() {
    const mesAno = document.getElementById('relatorio-mes').value;
    if (!mesAno) return;
    
    const [ano, mes] = mesAno.split('-');
    
    try {
        const res = await fetch(`/api/despesas?mes=${mes}&ano=${ano}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const despesasMes = await res.json();
        
        // Agrupar por categoria
        const porCategoria = {};
        let total = 0;
        
        despesasMes.forEach(d => {
            if (!porCategoria[d.categoria_nome]) {
                porCategoria[d.categoria_nome] = {
                    total: 0,
                    cor: d.categoria_cor,
                    quantidade: 0
                };
            }
            porCategoria[d.categoria_nome].total += d.valor;
            porCategoria[d.categoria_nome].quantidade++;
            total += d.valor;
        });
        
        // Exibir relatório
        const content = document.getElementById('relatorio-content');
        let html = '';
        
        for (const [categoria, dados] of Object.entries(porCategoria)) {
            html += `
                <div class="relatorio-categoria" style="border-left-color: ${dados.cor}">
                    <div>
                        <strong>${categoria}</strong>
                        <small style="display: block; color: #999;">${dados.quantidade} despesa(s)</small>
                    </div>
                    <strong style="color: #ff6b6b;">R$ ${dados.total.toFixed(2)}</strong>
                </div>
            `;
        }
        
        html += `
            <div class="relatorio-total">
                <p>Total Gasto no Mês</p>
                <h2>R$ ${total.toFixed(2)}</h2>
            </div>
        `;
        
        content.innerHTML = html;
    } catch (erro) {
        console.error('Erro ao gerar relatório:', erro);
    }
}

// === ADMIN ===
async function carregarUsuarios() {
    try {
        const res = await fetch('/api/admin/usuarios', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const usuarios = await res.json();
        
        const lista = document.getElementById('lista-usuarios');
        lista.innerHTML = usuarios.map(u => `
            <div class="usuario-item">
                <div>
                    <strong>${u.nome}</strong>
                    <small style="display: block; color: #999;">${u.email}</small>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span class="usuario-status ${u.ativo ? 'status-ativo' : 'status-inativo'}">
                        ${u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                    ${!u.isAdmin ? `<button class="btn-secondary" onclick="toggleUsuario(${u.id})">
                        ${u.ativo ? 'Desativar' : 'Ativar'}
                    </button>` : '<span style="color: #667eea; font-weight: 600;">Admin</span>'}
                </div>
            </div>
        `).join('');
    } catch (erro) {
        console.error('Erro ao carregar usuários:', erro);
    }
}

async function toggleUsuario(id) {
    try {
        const res = await fetch(`/api/admin/usuarios/${id}/toggle`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            alert('Status do usuário atualizado!');
            carregarUsuarios();
        } else {
            alert('Erro ao atualizar usuário');
        }
    } catch (erro) {
        alert('Erro ao conectar com o servidor');
    }
}

async function carregarEstatisticas() {
    const mesAno = document.getElementById('admin-mes').value;
    let url = '/api/admin/estatisticas';
    
    if (mesAno) {
        const [ano, mes] = mesAno.split('-');
        url += `?mes=${mes}&ano=${ano}`;
    }
    
    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const stats = await res.json();
        
        const content = document.getElementById('estatisticas');
        let total = 0;
        
        let html = stats.map(s => {
            total += s.total_gasto;
            return `
                <div class="estatistica-item">
                    <div>
                        <strong>${s.nome}</strong>
                        <small style="display: block; color: #999;">${s.total_despesas} despesa(s)</small>
                    </div>
                    <strong style="color: #ff6b6b;">R$ ${s.total_gasto.toFixed(2)}</strong>
                </div>
            `;
        }).join('');
        
        html += `
            <div class="relatorio-total">
                <p>Total Geral</p>
                <h2>R$ ${total.toFixed(2)}</h2>
            </div>
        `;
        
        content.innerHTML = html;
    } catch (erro) {
        console.error('Erro ao carregar estatísticas:', erro);
    }
}

// === UTILITÁRIOS ===
function formatarData(data) {
    const d = new Date(data + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
}
