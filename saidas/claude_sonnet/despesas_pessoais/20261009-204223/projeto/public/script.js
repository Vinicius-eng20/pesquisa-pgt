let usuarioAtual = null;

function mostrarMensagem(texto, tipo = 'sucesso') {
    const mensagem = document.getElementById('mensagem');
    mensagem.textContent = texto;
    mensagem.className = `mensagem ${tipo}`;
    
    setTimeout(() => mensagem.classList.add('mostrar'), 100);
    
    setTimeout(() => {
        mensagem.classList.remove('mostrar');
    }, 3000);
}

async function verificarAutenticacao() {
    try {
        const response = await fetch('/api/usuario-atual');
        if (response.ok) {
            usuarioAtual = await response.json();
            if (usuarioAtual.tipo === 'admin') {
                mostrarTelaAdmin();
            } else {
                mostrarTelaUsuario();
            }
        } else {
            mostrarTelaLogin();
        }
    } catch (erro) {
        mostrarTelaLogin();
    }
}

function mostrarTelaLogin() {
    document.querySelectorAll('.tela').forEach(t => t.style.display = 'none');
    document.getElementById('tela-login').style.display = 'flex';
}

function mostrarTelaRegistro() {
    document.querySelectorAll('.tela').forEach(t => t.style.display = 'none');
    document.getElementById('tela-registro').style.display = 'flex';
}

function mostrarTelaUsuario() {
    document.querySelectorAll('.tela').forEach(t => t.style.display = 'none');
    document.getElementById('tela-usuario').style.display = 'block';
    document.getElementById('nome-usuario').textContent = usuarioAtual.nome;
    
    inicializarFiltroData();
    carregarCategorias();
    carregarDespesas();
}

function mostrarTelaAdmin() {
    document.querySelectorAll('.tela').forEach(t => t.style.display = 'none');
    document.getElementById('tela-admin').style.display = 'block';
    document.getElementById('nome-admin').textContent = usuarioAtual.nome;
    
    carregarCategoriasAdmin();
    carregarUsuariosAdmin();
    carregarRelatorios();
}

function inicializarFiltroData() {
    const hoje = new Date();
    const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
    const anoAtual = hoje.getFullYear();
    
    document.getElementById('filtro-mes').value = mesAtual;
    
    const selectAno = document.getElementById('filtro-ano');
    selectAno.innerHTML = '';
    for (let ano = anoAtual; ano >= anoAtual - 5; ano--) {
        const option = document.createElement('option');
        option.value = ano;
        option.textContent = ano;
        selectAno.appendChild(option);
    }
    selectAno.value = anoAtual;
    
    const inputData = document.getElementById('despesa-data');
    inputData.value = hoje.toISOString().split('T')[0];
}

document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            usuarioAtual = data.usuario;
            mostrarMensagem('Login realizado com sucesso!');
            setTimeout(() => {
                if (usuarioAtual.tipo === 'admin') {
                    mostrarTelaAdmin();
                } else {
                    mostrarTelaUsuario();
                }
            }, 500);
        } else {
            mostrarMensagem(data.erro, 'erro');
        }
    } catch (erro) {
        mostrarMensagem('Erro ao fazer login', 'erro');
    }
});

document.getElementById('form-registro').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nome = document.getElementById('registro-nome').value;
    const email = document.getElementById('registro-email').value;
    const senha = document.getElementById('registro-senha').value;
    
    try {
        const response = await fetch('/api/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email, senha })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            mostrarMensagem('Conta criada com sucesso! Faça login.');
            setTimeout(() => mostrarTelaLogin(), 1500);
        } else {
            mostrarMensagem(data.erro, 'erro');
        }
    } catch (erro) {
        mostrarMensagem('Erro ao criar conta', 'erro');
    }
});

document.getElementById('link-registro').addEventListener('click', (e) => {
    e.preventDefault();
    mostrarTelaRegistro();
});

document.getElementById('link-login').addEventListener('click', (e) => {
    e.preventDefault();
    mostrarTelaLogin();
});

document.getElementById('btn-logout').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    usuarioAtual = null;
    mostrarTelaLogin();
    mostrarMensagem('Logout realizado com sucesso!');
});

document.getElementById('btn-logout-admin').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    usuarioAtual = null;
    mostrarTelaLogin();
    mostrarMensagem('Logout realizado com sucesso!');
});

async function carregarCategorias() {
    try {
        const response = await fetch('/api/categorias');
        const categorias = await response.json();
        
        const select = document.getElementById('despesa-categoria');
        select.innerHTML = '<option value="">Selecione a categoria</option>';
        
        categorias.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.nome;
            select.appendChild(option);
        });
    } catch (erro) {
        mostrarMensagem('Erro ao carregar categorias', 'erro');
    }
}

document.getElementById('form-despesa').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const despesa = {
        descricao: document.getElementById('despesa-descricao').value,
        valor: document.getElementById('despesa-valor').value,
        categoria_id: document.getElementById('despesa-categoria').value,
        data: document.getElementById('despesa-data').value
    };
    
    try {
        const response = await fetch('/api/despesas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(despesa)
        });
        
        if (response.ok) {
            mostrarMensagem('Despesa registrada com sucesso!');
            e.target.reset();
            document.getElementById('despesa-data').value = new Date().toISOString().split('T')[0];
            carregarDespesas();
        } else {
            const data = await response.json();
            mostrarMensagem(data.erro, 'erro');
        }
    } catch (erro) {
        mostrarMensagem('Erro ao registrar despesa', 'erro');
    }
});

async function carregarDespesas() {
    const mes = document.getElementById('filtro-mes').value;
    const ano = document.getElementById('filtro-ano').value;
    
    try {
        const [despesasResponse, totalResponse] = await Promise.all([
            fetch(`/api/despesas?mes=${mes}&ano=${ano}`),
            fetch(`/api/despesas/total-mes?mes=${mes}&ano=${ano}`)
        ]);
        
        const despesas = await despesasResponse.json();
        const { total } = await totalResponse.json();
        
        document.getElementById('valor-total-mes').textContent = 
            `R$ ${Number(total).toFixed(2).replace('.', ',')}`;
        
        const lista = document.getElementById('lista-despesas');
        
        if (despesas.length === 0) {
            lista.innerHTML = '<div class="lista-vazia">Nenhuma despesa registrada neste período</div>';
            return;
        }
        
        lista.innerHTML = despesas.map(d => `
            <div class="despesa-item">
                <div class="despesa-info">
                    <div class="despesa-descricao">${d.descricao}</div>
                    <div class="despesa-detalhes">
                        <span class="despesa-categoria">${d.categoria_nome}</span>
                        <span>${new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span class="despesa-valor">R$ ${Number(d.valor).toFixed(2).replace('.', ',')}</span>
                    <button class="btn-danger" onclick="excluirDespesa(${d.id})">Excluir</button>
                </div>
            </div>
        `).join('');
    } catch (erro) {
        mostrarMensagem('Erro ao carregar despesas', 'erro');
    }
}

async function excluirDespesa(id) {
    if (!confirm('Tem certeza que deseja excluir esta despesa?')) return;
    
    try {
        const response = await fetch(`/api/despesas/${id}`, { method: 'DELETE' });
        
        if (response.ok) {
            mostrarMensagem('Despesa excluída com sucesso!');
            carregarDespesas();
        } else {
            const data = await response.json();
            mostrarMensagem(data.erro, 'erro');
        }
    } catch (erro) {
        mostrarMensagem('Erro ao excluir despesa', 'erro');
    }
}

document.getElementById('filtro-mes').addEventListener('change', carregarDespesas);
document.getElementById('filtro-ano').addEventListener('change', carregarDespesas);

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
});

document.getElementById('form-categoria').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nome = document.getElementById('categoria-nome').value;
    
    try {
        const response = await fetch('/api/admin/categorias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome })
        });
        
        if (response.ok) {
            mostrarMensagem('Categoria criada com sucesso!');
            e.target.reset();
            carregarCategoriasAdmin();
        } else {
            const data = await response.json();
            mostrarMensagem(data.erro, 'erro');
        }
    } catch (erro) {
        mostrarMensagem('Erro ao criar categoria', 'erro');
    }
});

async function carregarCategoriasAdmin() {
    try {
        const response = await fetch('/api/admin/categorias');
        const categorias = await response.json();
        
        const lista = document.getElementById('lista-categorias');
        
        lista.innerHTML = categorias.map(c => `
            <div class="categoria-item ${c.ativo ? '' : 'inativo'}">
                <div>
                    <strong>${c.nome}</strong>
                    <span class="status-badge ${c.ativo ? '' : 'inativo'}">
                        ${c.ativo ? 'Ativa' : 'Desativada'}
                    </span>
                </div>
                <div>
                    ${c.ativo 
                        ? `<button class="btn-danger" onclick="alterarStatusCategoria(${c.id}, false)">Desativar</button>`
                        : `<button class="btn-success" onclick="alterarStatusCategoria(${c.id}, true)">Ativar</button>`
                    }
                </div>
            </div>
        `).join('');
    } catch (erro) {
        mostrarMensagem('Erro ao carregar categorias', 'erro');
    }
}

async function alterarStatusCategoria(id, ativar) {
    const acao = ativar ? 'ativar' : 'desativar';
    
    try {
        const response = await fetch(`/api/admin/categorias/${id}/${acao}`, {
            method: 'PUT'
        });
        
        if (response.ok) {
            mostrarMensagem(`Categoria ${ativar ? 'ativada' : 'desativada'} com sucesso!`);
            carregarCategoriasAdmin();
        } else {
            const data = await response.json();
            mostrarMensagem(data.erro, 'erro');
        }
    } catch (erro) {
        mostrarMensagem('Erro ao alterar categoria', 'erro');
    }
}

async function carregarUsuariosAdmin() {
    try {
        const response = await fetch('/api/admin/usuarios');
        const usuarios = await response.json();
        
        const lista = document.getElementById('lista-usuarios-admin');
        
        if (usuarios.length === 0) {
            lista.innerHTML = '<div class="lista-vazia">Nenhum usuário cadastrado</div>';
            return;
        }
        
        lista.innerHTML = usuarios.map(u => `
            <div class="usuario-item ${u.ativo ? '' : 'inativo'}">
                <div>
                    <div style="font-weight: 600; margin-bottom: 5px;">${u.nome}</div>
                    <div style="color: #666; font-size: 14px;">${u.email}</div>
                    <span class="status-badge ${u.ativo ? '' : 'inativo'}">
                        ${u.ativo ? 'Ativo' : 'Desativado'}
                    </span>
                </div>
                <div>
                    ${u.ativo 
                        ? `<button class="btn-danger" onclick="alterarStatusUsuario(${u.id}, false)">Desativar</button>`
                        : `<button class="btn-success" onclick="alterarStatusUsuario(${u.id}, true)">Ativar</button>`
                    }
                </div>
            </div>
        `).join('');
    } catch (erro) {
        mostrarMensagem('Erro ao carregar usuários', 'erro');
    }
}

async function alterarStatusUsuario(id, ativar) {
    const acao = ativar ? 'ativar' : 'desativar';
    
    try {
        const response = await fetch(`/api/admin/usuarios/${id}/${acao}`, {
            method: 'PUT'
        });
        
        if (response.ok) {
            mostrarMensagem(`Usuário ${ativar ? 'ativado' : 'desativado'} com sucesso!`);
            carregarUsuariosAdmin();
        } else {
            const data = await response.json();
            mostrarMensagem(data.erro, 'erro');
        }
    } catch (erro) {
        mostrarMensagem('Erro ao alterar usuário', 'erro');
    }
}

async function carregarRelatorios() {
    try {
        const [totalResponse, usuariosResponse] = await Promise.all([
            fetch('/api/admin/total-geral'),
            fetch('/api/admin/usuarios-com-gastos')
        ]);
        
        const { total } = await totalResponse.json();
        const usuarios = await usuariosResponse.json();
        
        document.getElementById('total-geral').textContent = 
            `R$ ${Number(total).toFixed(2).replace('.', ',')}`;
        
        const lista = document.getElementById('gastos-usuarios');
        
        if (usuarios.length === 0) {
            lista.innerHTML = '<div class="lista-vazia">Nenhum usuário com gastos registrados</div>';
            return;
        }
        
        lista.innerHTML = usuarios.map(u => `
            <div class="usuario-gastos-item">
                <div class="usuario-gastos-nome">${u.nome}</div>
                <div class="usuario-gastos-detalhes">
                    <div>
                        <span style="color: #999;">Email:</span> ${u.email}<br>
                        <span style="color: #999;">Total de despesas:</span> ${u.total_despesas}
                    </div>
                    <div class="usuario-gastos-total">
                        R$ ${Number(u.total_gastos).toFixed(2).replace('.', ',')}
                    </div>
                </div>
            </div>
        `).join('');
    } catch (erro) {
        mostrarMensagem('Erro ao carregar relatórios', 'erro');
    }
}

verificarAutenticacao();
