let currentUser = null;
let quartoSelecionado = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    // Definir data mínima como hoje
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('checkin-date').min = hoje;
    document.getElementById('checkout-date').min = hoje;
});

// Autenticação
async function checkAuth() {
    try {
        const response = await fetch('/api/usuario');
        if (response.ok) {
            const data = await response.json();
            currentUser = data.usuario;
            showMainScreen();
        }
    } catch (error) {
        console.log('Não autenticado');
    }
}

async function handleLogin(e) {
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
            currentUser = data.usuario;
            showToast('Login realizado com sucesso!', 'success');
            showMainScreen();
        } else {
            showToast(data.error || 'Erro ao fazer login', 'error');
        }
    } catch (error) {
        showToast('Erro de conexão', 'error');
    }
}

async function handleRegistro(e) {
    e.preventDefault();
    
    const nome = document.getElementById('reg-nome').value;
    const email = document.getElementById('reg-email').value;
    const senha = document.getElementById('reg-senha').value;
    
    try {
        const response = await fetch('/api/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email, senha })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.usuario;
            showToast('Conta criada com sucesso!', 'success');
            showMainScreen();
        } else {
            showToast(data.error || 'Erro ao criar conta', 'error');
        }
    } catch (error) {
        showToast('Erro de conexão', 'error');
    }
}

async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        document.getElementById('main-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
        showToast('Logout realizado', 'success');
    } catch (error) {
        showToast('Erro ao sair', 'error');
    }
}

// Navegação
function showTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    if (tab === 'login') {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('registro-form').classList.add('hidden');
    } else {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('registro-form').classList.remove('hidden');
    }
}

function showMainScreen() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    document.getElementById('user-name').textContent = currentUser.nome;
    
    if (currentUser.tipo === 'gerente') {
        document.getElementById('gerente-area').classList.remove('hidden');
        document.getElementById('hospede-area').classList.add('hidden');
        carregarTodasReservas();
        carregarQuartos();
    } else {
        document.getElementById('hospede-area').classList.remove('hidden');
        document.getElementById('gerente-area').classList.add('hidden');
    }
}

function showSection(section) {
    document.querySelectorAll('#hospede-area .menu-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    document.getElementById('buscar-section').classList.add('hidden');
    document.getElementById('minhas-reservas-section').classList.add('hidden');
    
    if (section === 'buscar') {
        document.getElementById('buscar-section').classList.remove('hidden');
    } else {
        document.getElementById('minhas-reservas-section').classList.remove('hidden');
        carregarMinhasReservas();
    }
}

function showGerenteSection(section) {
    document.querySelectorAll('#gerente-area .menu-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    document.getElementById('reservas-gerente-section').classList.add('hidden');
    document.getElementById('quartos-gerente-section').classList.add('hidden');
    
    if (section === 'reservas') {
        document.getElementById('reservas-gerente-section').classList.remove('hidden');
        carregarTodasReservas();
    } else {
        document.getElementById('quartos-gerente-section').classList.remove('hidden');
        carregarQuartos();
    }
}

// Funções do Hóspede
async function buscarQuartos() {
    const checkin = document.getElementById('checkin-date').value;
    const checkout = document.getElementById('checkout-date').value;
    
    if (!checkin || !checkout) {
        showToast('Selecione as datas de check-in e check-out', 'error');
        return;
    }
    
    if (checkin >= checkout) {
        showToast('Data de check-out deve ser posterior ao check-in', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/quartos/disponiveis?checkin=${checkin}&checkout=${checkout}`);
        const data = await response.json();
        
        const container = document.getElementById('quartos-result');
        
        if (data.quartos.length === 0) {
            container.innerHTML = '<p class="no-results">Nenhum quarto disponível para estas datas.</p>';
            return;
        }
        
        container.innerHTML = data.quartos.map(quarto => `
            <div class="quarto-card">
                <div class="quarto-header">
                    <span class="quarto-numero">Quarto ${quarto.numero}</span>
                    <span class="quarto-tipo">${quarto.tipo}</span>
                </div>
                <div class="quarto-body">
                    <p class="quarto-descricao">${quarto.descricao || 'Sem descrição'}</p>
                    <div class="quarto-info">
                        <span><i class="fas fa-user"></i> ${quarto.capacidade} pessoas</span>
                    </div>
                    <div class="quarto-preco">
                        R$ ${quarto.preco_diaria.toFixed(2)} <small>/noite</small>
                    </div>
                    <button class="btn-reservar" onclick='abrirModalReserva(${JSON.stringify(quarto)})'>
                        Reservar Agora
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        showToast('Erro ao buscar quartos', 'error');
    }
}

function abrirModalReserva(quarto) {
    const checkin = document.getElementById('checkin-date').value;
    const checkout = document.getElementById('checkout-date').value;
    
    const checkinDate = new Date(checkin);
    const checkoutDate = new Date(checkout);
    const diffTime = Math.abs(checkoutDate - checkinDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const valorTotal = diffDays * quarto.preco_diaria;
    
    quartoSelecionado = {
        ...quarto,
        checkin,
        checkout,
        dias: diffDays,
        valorTotal
    };
    
    document.getElementById('detalhes-reserva').innerHTML = `
        <p><strong>Quarto:</strong> ${quarto.numero} - ${quarto.tipo}</p>
        <p><strong>Check-in:</strong> ${formatarData(checkin)}</p>
        <p><strong>Check-out:</strong> ${formatarData(checkout)}</p>
        <p><strong>Diárias:</strong> ${diffDays}</p>
        <p><strong>Valor Total:</strong> R$ ${valorTotal.toFixed(2)}</p>
    `;
    
    document.getElementById('modal-reserva').classList.remove('hidden');
}

async function confirmarReserva() {
    if (!quartoSelecionado) return;
    
    try {
        const response = await fetch('/api/reservas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quarto_id: quartoSelecionado.id,
                data_checkin: quartoSelecionado.checkin,
                data_checkout: quartoSelecionado.checkout
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Reserva realizada com sucesso! Aguardando confirmação.', 'success');
            fecharModal('modal-reserva');
            document.getElementById('quartos-result').innerHTML = '';
        } else {
            showToast(data.error || 'Erro ao fazer reserva', 'error');
        }
    } catch (error) {
        showToast('Erro de conexão', 'error');
    }
}

async function carregarMinhasReservas() {
    try {
        const response = await fetch('/api/minhas-reservas');
        const data = await response.json();
        
        const container = document.getElementById('lista-reservas');
        
        if (data.reservas.length === 0) {
            container.innerHTML = '<p class="no-results">Você ainda não tem reservas.</p>';
            return;
        }
        
        container.innerHTML = data.reservas.map(reserva => `
            <div class="reserva-card">
                <div class="reserva-info">
                    <h3>Quarto ${reserva.quarto_numero} - ${reserva.quarto_tipo}</h3>
                    <div class="reserva-detalhes">
                        <span><i class="fas fa-calendar"></i> ${formatarData(reserva.data_checkin)} a ${formatarData(reserva.data_checkout)}</span>
                        <span><i class="fas fa-money-bill"></i> R$ ${reserva.valor_total.toFixed(2)}</span>
                    </div>
                </div>
                <div class="reserva-status status-${reserva.status}">
                    ${reserva.status.charAt(0).toUpperCase() + reserva.status.slice(1)}
                </div>
                ${reserva.status === 'pendente' || reserva.status === 'confirmada' ? `
                    <div class="reserva-acoes">
                        <button class="btn-small btn-cancelar" onclick="cancelarReserva(${reserva.id})">
                            Cancelar
                        </button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    } catch (error) {
        showToast('Erro ao carregar reservas', 'error');
    }
}

async function cancelarReserva(id) {
    if (!confirm('Tem certeza que deseja cancelar esta reserva?')) return;
    
    try {
        const response = await fetch(`/api/reservas/${id}`, { method: 'DELETE' });
        
        if (response.ok) {
            showToast('Reserva cancelada com sucesso', 'success');
            carregarMinhasReservas();
        } else {
            showToast('Erro ao cancelar reserva', 'error');
        }
    } catch (error) {
        showToast('Erro de conexão', 'error');
    }
}

// Funções do Gerente
async function carregarTodasReservas() {
    try {
        const response = await fetch('/api/todas-reservas');
        const data = await response.json();
        
        const container = document.getElementById('todas-reservas');
        
        if (data.reservas.length === 0) {
            container.innerHTML = '<p class="no-results">Nenhuma reserva encontrada.</p>';
            return;
        }
        
        container.innerHTML = data.reservas.map(reserva => `
            <div class="reserva-card">
                <div class="reserva-info">
                    <h3>${reserva.hospede_nome} - Quarto ${reserva.quarto_numero}</h3>
                    <div class="reserva-detalhes">
                        <span><i class="fas fa-envelope"></i> ${reserva.hospede_email}</span>
                        <span><i class="fas fa-calendar"></i> ${formatarData(reserva.data_checkin)} a ${formatarData(reserva.data_checkout)}</span>
                        <span><i class="fas fa-money-bill"></i> R$ ${reserva.valor_total.toFixed(2)}</span>
                    </div>
                </div>
                <div class="reserva-status status-${reserva.status}">
                    ${reserva.status.charAt(0).toUpperCase() + reserva.status.slice(1)}
                </div>
                ${reserva.status === 'pendente' ? `
                    <div class="reserva-acoes">
                        <button class="btn-small btn-confirmar" onclick="atualizarStatusReserva(${reserva.id}, 'confirmada')">
                            Confirmar
                        </button>
                        <button class="btn-small btn-recusar" onclick="atualizarStatusReserva(${reserva.id}, 'recusada')">
                            Recusar
                        </button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    } catch (error) {
        showToast('Erro ao carregar reservas', 'error');
    }
}

async function atualizarStatusReserva(id, status) {
    try {
        const response = await fetch(`/api/reservas/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            showToast(`Reserva ${status === 'confirmada' ? 'confirmada' : 'recusada'} com sucesso`, 'success');
            carregarTodasReservas();
        } else {
            showToast('Erro ao atualizar status', 'error');
        }
    } catch (error) {
        showToast('Erro de conexão', 'error');
    }
}

async function carregarQuartos() {
    try {
        const response = await fetch('/api/quartos');
        const data = await response.json();
        
        const container = document.getElementById('lista-quartos');
        
        container.innerHTML = data.quartos.map(quarto => `
            <div class="quarto-admin-card">
                <div class="quarto-admin-info">
                    <h3>Quarto ${quarto.numero} - ${quarto.tipo}</h3>
                    <div class="quarto-admin-detalhes">
                        <span><i class="fas fa-user"></i> ${quarto.capacidade} pessoas</span>
                        <span><i class="fas fa-money-bill"></i> R$ ${quarto.preco_diaria.toFixed(2)}/noite</span>
                        <span class="status-${quarto.ativo ? 'confirmada' : 'cancelada'}">
                            ${quarto.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                    </div>
                    <p style="margin-top: 5px; color: #666; font-size: 14px;">${quarto.descricao || ''}</p>
                </div>
                <div class="quarto-admin-acoes">
                    <button class="btn-editar" onclick='editarQuarto(${JSON.stringify(quarto)})'>
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-excluir" onclick="excluirQuarto(${quarto.id})">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        showToast('Erro ao carregar quartos', 'error');
    }
}

function abrirModalQuarto() {
    document.getElementById('modal-quarto-titulo').textContent = 'Novo Quarto';
    document.getElementById('form-quarto').reset();
    document.getElementById('quarto-id').value = '';
    document.getElementById('modal-quarto').classList.remove('hidden');
}

function editarQuarto(quarto) {
    document.getElementById('modal-quarto-titulo').textContent = 'Editar Quarto';
    document.getElementById('quarto-id').value = quarto.id;
    document.getElementById('quarto-numero').value = quarto.numero;
    document.getElementById('quarto-tipo').value = quarto.tipo;
    document.getElementById('quarto-descricao').value = quarto.descricao;
    document.getElementById('quarto-capacidade').value = quarto.capacidade;
    document.getElementById('quarto-preco').value = quarto.preco_diaria;
    document.getElementById('quarto-ativo').checked = quarto.ativo === 1;
    document.getElementById('modal-quarto').classList.remove('hidden');
}

async function salvarQuarto(e) {
    e.preventDefault();
    
    const id = document.getElementById('quarto-id').value;
    const dados = {
        numero: document.getElementById('quarto-numero').value,
        tipo: document.getElementById('quarto-tipo').value,
        descricao: document.getElementById('quarto-descricao').value,
        capacidade: parseInt(document.getElementById('quarto-capacidade').value),
        preco_diaria: parseFloat(document.getElementById('quarto-preco').value),
        ativo: document.getElementById('quarto-ativo').checked ? 1 : 0
    };
    
    try {
        const url = id ? `/api/quartos/${id}` : '/api/quartos';
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        
        if (response.ok) {
            showToast(`Quarto ${id ? 'atualizado' : 'criado'} com sucesso`, 'success');
            fecharModal('modal-quarto');
            carregarQuartos();
        } else {
            showToast('Erro ao salvar quarto', 'error');
        }
    } catch (error) {
        showToast('Erro de conexão', 'error');
    }
}

async function excluirQuarto(id) {
    if (!confirm('Tem certeza que deseja excluir este quarto?')) return;
    
    try {
        const response = await fetch(`/api/quartos/${id}`, { method: 'DELETE' });
        
        if (response.ok) {
            showToast('Quarto excluído com sucesso', 'success');
            carregarQuartos();
        } else {
            showToast('Erro ao excluir quarto', 'error');
        }
    } catch (error) {
        showToast('Erro de conexão', 'error');
    }
}

// Utilitários
function fecharModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function showToast(mensagem, tipo) {
    const toast = document.getElementById('toast');
    toast.textContent = mensagem;
    toast.className = `toast ${tipo}`;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

function formatarData(data) {
    return new Date(data).toLocaleDateString('pt-BR');
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.add('hidden');
    }
}
