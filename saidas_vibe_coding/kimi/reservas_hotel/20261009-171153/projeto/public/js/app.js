// Estado global da aplicação
const App = {
    currentUser: null,
    token: localStorage.getItem('token'),
    apiUrl: '/api',

    init() {
        if (this.token) {
            this.validateToken();
        } else {
            this.showLogin();
        }
        this.setupNavigation();
    },

    async validateToken() {
        try {
            const response = await this.apiCall('/auth/validate', 'GET');
            if (response.user) {
                this.currentUser = response.user;
                this.showDashboard();
            } else {
                this.logout();
            }
        } catch (error) {
            this.logout();
        }
    },

    setupNavigation() {
        document.getElementById('nav-menu').addEventListener('click', (e) => {
            if (e.target.dataset.action) {
                e.preventDefault();
                this.handleNavigation(e.target.dataset.action);
            }
        });
    },

    handleNavigation(action) {
        switch(action) {
            case 'logout':
                this.logout();
                break;
            case 'rooms':
                this.showRooms();
                break;
            case 'my-reservations':
                this.showMyReservations();
                break;
            case 'all-reservations':
                this.showAllReservations();
                break;
            case 'manage-rooms':
                this.showManageRooms();
                break;
        }
    },

    renderNavbar() {
        const nav = document.getElementById('nav-menu');
        if (!this.currentUser) {
            nav.innerHTML = '';
            return;
        }

        let html = `<span class="user-info">Olá, ${this.currentUser.name}</span>`;
        
        if (this.currentUser.role === 'guest') {
            html += `
                <button data-action="rooms">Quartos</button>
                <button data-action="my-reservations">Minhas Reservas</button>
            `;
        } else if (this.currentUser.role === 'manager') {
            html += `
                <button data-action="manage-rooms">Gerenciar Quartos</button>
                <button data-action="all-reservations">Todas Reservas</button>
            `;
        }
        
        html += `<button data-action="logout">Sair</button>`;
        nav.innerHTML = html;
    },

    async apiCall(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (this.token) {
            options.headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(this.apiUrl + endpoint, options);
        return await response.json();
    },

    showLogin() {
        document.getElementById('main-content').innerHTML = `
            <div class="form-container">
                <h2 class="text-center mb-20">Login</h2>
                <div id="alert-container"></div>
                <form id="login-form">
                    <div class="form-group">
                        <label>Email:</label>
                        <input type="email" id="email" required>
                    </div>
                    <div class="form-group">
                        <label>Senha:</label>
                        <input type="password" id="password" required>
                    </div>
                    <button type="submit" class="btn btn-primary">Entrar</button>
                </form>
                <p class="text-center mt-20">
                    Não tem conta? <a href="#" onclick="App.showRegister()">Cadastre-se</a>
                </p>
            </div>
        `;

        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const response = await this.apiCall('/auth/login', 'POST', { email, password });
                
                if (response.token) {
                    this.token = response.token;
                    this.currentUser = response.user;
                    localStorage.setItem('token', this.token);
                    this.showDashboard();
                } else {
                    this.showAlert(response.error || 'Erro ao fazer login', 'error');
                }
            } catch (error) {
                this.showAlert('Erro ao conectar com o servidor', 'error');
            }
        });
    },

    showRegister() {
        document.getElementById('main-content').innerHTML = `
            <div class="form-container">
                <h2 class="text-center mb-20">Cadastro de Hóspede</h2>
                <div id="alert-container"></div>
                <form id="register-form">
                    <div class="form-group">
                        <label>Nome completo:</label>
                        <input type="text" id="name" required>
                    </div>
                    <div class="form-group">
                        <label>Email:</label>
                        <input type="email" id="email" required>
                    </div>
                    <div class="form-group">
                        <label>Senha (mínimo 6 caracteres):</label>
                        <input type="password" id="password" required minlength="6">
                    </div>
                    <button type="submit" class="btn btn-primary">Cadastrar</button>
                </form>
                <p class="text-center mt-20">
                    Já tem conta? <a href="#" onclick="App.showLogin()">Faça login</a>
                </p>
            </div>
        `;

        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const response = await this.apiCall('/auth/register', 'POST', { name, email, password });
                
                if (response.token) {
                    this.token = response.token;
                    this.currentUser = response.user;
                    localStorage.setItem('token', this.token);
                    this.showDashboard();
                } else {
                    this.showAlert(response.error || 'Erro ao cadastrar', 'error');
                }
            } catch (error) {
                this.showAlert('Erro ao conectar com o servidor', 'error');
            }
        });
    },

    showDashboard() {
        this.renderNavbar();
        if (this.currentUser.role === 'guest') {
            this.showRooms();
        } else {
            this.showManageRooms();
        }
    },

    async showRooms() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <h2>Buscar Quartos Disponíveis</h2>
            <div id="alert-container"></div>
            <div class="search-form">
                <form id="search-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Check-in:</label>
                            <input type="date" id="check-in" required>
                        </div>
                        <div class="form-group">
                            <label>Check-out:</label>
                            <input type="date" id="check-out" required>
                        </div>
                        <button type="submit" class="btn btn-primary">Buscar</button>
                    </div>
                </form>
            </div>
            <div id="rooms-container"></div>
        `;

        // Definir datas mínimas
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('check-in').min = today;
        document.getElementById('check-out').min = today;

        document.getElementById('search-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const checkIn = document.getElementById('check-in').value;
            const checkOut = document.getElementById('check-out').value;
            await this.loadRooms(checkIn, checkOut);
        });

        // Carregar todos os quartos inicialmente
        await this.loadRooms();
    },

    async loadRooms(checkIn = null, checkOut = null) {
        try {
            let url = '/rooms';
            if (checkIn && checkOut) {
                url += `?checkIn=${checkIn}&checkOut=${checkOut}`;
            }

            const rooms = await this.apiCall(url);
            const container = document.getElementById('rooms-container');

            if (rooms.length === 0) {
                container.innerHTML = '<p class="alert alert-error">Nenhum quarto disponível nas datas selecionadas.</p>';
                return;
            }

            container.innerHTML = `
                <div class="rooms-grid">
                    ${rooms.map(room => `
                        <div class="room-card">
                            <img src="${room.image_url || 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=400'}" 
                                 alt="${room.name}" class="room-image">
                            <div class="room-info">
                                <h3 class="room-name">${room.name}</h3>
                                <p>${room.description || 'Quarto confortável e aconchegante.'}</p>
                                <p><strong>Capacidade:</strong> ${room.capacity} pessoas</p>
                                ${room.amenities ? `<p><strong>Comodidades:</strong> ${room.amenities}</p>` : ''}
                                <div class="room-price">R$ ${parseFloat(room.price_per_night).toFixed(2)} / noite</div>
                                ${checkIn && checkOut ? `
                                    <button class="btn btn-primary" onclick="App.showReservationForm(${room.id}, '${checkIn}', '${checkOut}', ${room.price_per_night})">
                                        Reservar
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            this.showAlert('Erro ao carregar quartos', 'error');
        }
    },

    showReservationForm(roomId, checkIn, checkOut, pricePerNight) {
        const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
        const totalPrice = nights * pricePerNight;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Confirmar Reserva</h3>
                    <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <div id="modal-alert"></div>
                <form id="reservation-form">
                    <p><strong>Check-in:</strong> ${new Date(checkIn).toLocaleDateString('pt-BR')}</p>
                    <p><strong>Check-out:</strong> ${new Date(checkOut).toLocaleDateString('pt-BR')}</p>
                    <p><strong>Número de noites:</strong> ${nights}</p>
                    <p><strong>Valor total:</strong> R$ ${totalPrice.toFixed(2)}</p>
                    <div class="form-group">
                        <label>Observações (opcional):</label>
                        <textarea id="notes" placeholder="Alguma solicitação especial?"></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">Confirmar Reserva</button>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('reservation-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const notes = document.getElementById('notes').value;

            try {
                const response = await this.apiCall('/reservations', 'POST', {
                    room_id: roomId,
                    check_in: checkIn,
                    check_out: checkOut,
                    notes
                });

                if (response.reservationId) {
                    modal.remove();
                    this.showAlert('Reserva criada com sucesso! Aguardando confirmação do gerente.', 'success');
                    this.showRooms();
                } else {
                    document.getElementById('modal-alert').innerHTML = 
                        `<div class="alert alert-error">${response.error || 'Erro ao criar reserva'}</div>`;
                }
            } catch (error) {
                document.getElementById('modal-alert').innerHTML = 
                    '<div class="alert alert-error">Erro ao conectar com o servidor</div>';
            }
        });
    },

    async showMyReservations() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <h2>Minhas Reservas</h2>
            <div id="alert-container"></div>
            <div id="reservations-container"></div>
        `;

        try {
            const reservations = await this.apiCall('/reservations/my-reservations');
            const container = document.getElementById('reservations-container');

            if (reservations.length === 0) {
                container.innerHTML = '<p class="alert alert-error">Você ainda não tem reservas.</p>';
                return;
            }

            container.innerHTML = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Quarto</th>
                                <th>Check-in</th>
                                <th>Check-out</th>
                                <th>Valor Total</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reservations.map(res => `
                                <tr>
                                    <td>${res.room_name}</td>
                                    <td>${new Date(res.check_in).toLocaleDateString('pt-BR')}</td>
                                    <td>${new Date(res.check_out).toLocaleDateString('pt-BR')}</td>
                                    <td>R$ ${parseFloat(res.total_price).toFixed(2)}</td>
                                    <td><span class="badge badge-${res.status}">${this.getStatusText(res.status)}</span></td>
                                    <td>
                                        ${res.status === 'pending' || res.status === 'confirmed' ? 
                                            `<button class="btn btn-danger btn-sm" onclick="App.cancelReservation(${res.id})">Cancelar</button>` : 
                                            ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            this.showAlert('Erro ao carregar reservas', 'error');
        }
    },

    async cancelReservation(id) {
        if (!confirm('Tem certeza que deseja cancelar esta reserva?')) return;

        try {
            const response = await this.apiCall(`/reservations/${id}/cancel`, 'PUT');
            this.showAlert(response.message || 'Reserva cancelada', 'success');
            this.showMyReservations();
        } catch (error) {
            this.showAlert('Erro ao cancelar reserva', 'error');
        }
    },

    async showAllReservations() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <h2>Todas as Reservas</h2>
            <div id="alert-container"></div>
            <div class="tabs">
                <button class="tab-btn active" onclick="App.filterReservations('')">Todas</button>
                <button class="tab-btn" onclick="App.filterReservations('pending')">Pendentes</button>
                <button class="tab-btn" onclick="App.filterReservations('confirmed')">Confirmadas</button>
                <button class="tab-btn" onclick="App.filterReservations('cancelled')">Canceladas</button>
            </div>
            <div id="reservations-container"></div>
        `;

        await this.filterReservations('');
    },

    async filterReservations(status) {
        // Atualizar tabs ativas
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');

        try {
            const url = status ? `/reservations/all?status=${status}` : '/reservations/all';
            const reservations = await this.apiCall(url);
            const container = document.getElementById('reservations-container');

            if (reservations.length === 0) {
                container.innerHTML = '<p class="alert alert-error">Nenhuma reserva encontrada.</p>';
                return;
            }

            container.innerHTML = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Hóspede</th>
                                <th>Quarto</th>
                                <th>Check-in</th>
                                <th>Check-out</th>
                                <th>Valor</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reservations.map(res => `
                                <tr>
                                    <td>${res.guest_name}<br><small>${res.guest_email}</small></td>
                                    <td>${res.room_name}</td>
                                    <td>${new Date(res.check_in).toLocaleDateString('pt-BR')}</td>
                                    <td>${new Date(res.check_out).toLocaleDateString('pt-BR')}</td>
                                    <td>R$ ${parseFloat(res.total_price).toFixed(2)}</td>
                                    <td><span class="badge badge-${res.status}">${this.getStatusText(res.status)}</span></td>
                                    <td>
                                        ${res.status === 'pending' ? `
                                            <button class="btn btn-success btn-sm" onclick="App.confirmReservation(${res.id})">Confirmar</button>
                                            <button class="btn btn-danger btn-sm" onclick="App.rejectReservation(${res.id})">Recusar</button>
                                        ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            this.showAlert('Erro ao carregar reservas', 'error');
        }
    },

    async confirmReservation(id) {
        if (!confirm('Confirmar esta reserva?')) return;

        try {
            const response = await this.apiCall(`/reservations/${id}/confirm`, 'PUT');
            this.showAlert(response.message || 'Reserva confirmada', 'success');
            this.showAllReservations();
        } catch (error) {
            this.showAlert('Erro ao confirmar reserva', 'error');
        }
    },

    async rejectReservation(id) {
        if (!confirm('Recusar esta reserva?')) return;

        try {
            const response = await this.apiCall(`/reservations/${id}/reject`, 'PUT');
            this.showAlert(response.message || 'Reserva recusada', 'success');
            this.showAllReservations();
        } catch (error) {
            this.showAlert('Erro ao recusar reserva', 'error');
        }
    },

    async showManageRooms() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <h2>Gerenciar Quartos</h2>
            <div id="alert-container"></div>
            <button class="btn btn-primary mb-20" onclick="App.showRoomForm()">+ Adicionar Quarto</button>
            <div id="rooms-container"></div>
        `;

        await this.loadManageRooms();
    },

    async loadManageRooms() {
        try {
            const rooms = await this.apiCall('/rooms');
            const container = document.getElementById('rooms-container');

            container.innerHTML = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Preço/Noite</th>
                                <th>Capacidade</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rooms.map(room => `
                                <tr>
                                    <td>${room.name}</td>
                                    <td>R$ ${parseFloat(room.price_per_night).toFixed(2)}</td>
                                    <td>${room.capacity} pessoas</td>
                                    <td>${room.active ? 'Ativo' : 'Inativo'}</td>
                                    <td>
                                        <button class="btn btn-primary btn-sm" onclick="App.showRoomForm(${room.id})">Editar</button>
                                        <button class="btn btn-danger btn-sm" onclick="App.deleteRoom(${room.id})">Remover</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            this.showAlert('Erro ao carregar quartos', 'error');
        }
    },

    async showRoomForm(roomId = null) {
        let room = null;
        if (roomId) {
            room = await this.apiCall(`/rooms/${roomId}`);
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${roomId ? 'Editar' : 'Adicionar'} Quarto</h3>
                    <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <div id="modal-alert"></div>
                <form id="room-form">
                    <div class="form-group">
                        <label>Nome do quarto:</label>
                        <input type="text" id="room-name" value="${room?.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Descrição:</label>
                        <textarea id="room-description">${room?.description || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Preço por noite (R$):</label>
                        <input type="number" step="0.01" id="room-price" value="${room?.price_per_night || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Capacidade (pessoas):</label>
                        <input type="number" id="room-capacity" value="${room?.capacity || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Comodidades:</label>
                        <input type="text" id="room-amenities" value="${room?.amenities || ''}" placeholder="Wi-Fi, TV, Ar-condicionado...">
                    </div>
                    <div class="form-group">
                        <label>URL da imagem:</label>
                        <input type="url" id="room-image" value="${room?.image_url || ''}" placeholder="https://...">
                    </div>
                    <button type="submit" class="btn btn-primary">Salvar</button>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('room-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const data = {
                name: document.getElementById('room-name').value,
                description: document.getElementById('room-description').value,
                price_per_night: parseFloat(document.getElementById('room-price').value),
                capacity: parseInt(document.getElementById('room-capacity').value),
                amenities: document.getElementById('room-amenities').value,
                image_url: document.getElementById('room-image').value
            };

            try {
                const url = roomId ? `/rooms/${roomId}` : '/rooms';
                const method = roomId ? 'PUT' : 'POST';
                const response = await this.apiCall(url, method, data);

                if (response.message) {
                    modal.remove();
                    this.showAlert(response.message, 'success');
                    this.loadManageRooms();
                } else {
                    document.getElementById('modal-alert').innerHTML = 
                        `<div class="alert alert-error">${response.error || 'Erro ao salvar quarto'}</div>`;
                }
            } catch (error) {
                document.getElementById('modal-alert').innerHTML = 
                    '<div class="alert alert-error">Erro ao conectar com o servidor</div>';
            }
        });
    },

    async deleteRoom(id) {
        if (!confirm('Tem certeza que deseja remover este quarto?')) return;

        try {
            const response = await this.apiCall(`/rooms/${id}`, 'DELETE');
            this.showAlert(response.message || 'Quarto removido', 'success');
            this.loadManageRooms();
        } catch (error) {
            this.showAlert('Erro ao remover quarto', 'error');
        }
    },

    getStatusText(status) {
        const texts = {
            'pending': 'Pendente',
            'confirmed': 'Confirmada',
            'cancelled': 'Cancelada',
            'rejected': 'Recusada'
        };
        return texts[status] || status;
    },

    showAlert(message, type) {
        const container = document.getElementById('alert-container');
        container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
        setTimeout(() => container.innerHTML = '', 5000);
    },

    logout() {
        localStorage.removeItem('token');
        this.token = null;
        this.currentUser = null;
        this.showLogin();
    }
};

// Inicializar aplicação
App.init();
