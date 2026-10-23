import os
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify, render_template, session
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'restaurante-chave-secreta-segura-2025')
DB_PATH = os.path.join(os.path.dirname(__file__), 'restaurante.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'cliente',
            phone TEXT,
            address TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS dishes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            image_url TEXT,
            is_available INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (category_id) REFERENCES categories (id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            delivery_address TEXT NOT NULL,
            payment_method TEXT NOT NULL,
            notes TEXT,
            total_price REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'recebido',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            dish_id INTEGER,
            dish_name TEXT NOT NULL,
            unit_price REAL NOT NULL,
            quantity INTEGER NOT NULL,
            subtotal REAL NOT NULL,
            notes TEXT,
            FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
        )
    ''')

    # Criação do usuário Gerente padrão se não existir
    cursor.execute("SELECT id FROM users WHERE email = ?", ('gerente@restaurante.com',))
    if not cursor.fetchone():
        cursor.execute('''
            INSERT INTO users (name, email, password_hash, role, phone, address)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            'Gerente do Restaurante',
            'gerente@restaurante.com',
            generate_password_hash('admin123'),
            'gerente',
            '(11) 98888-7777',
            'Restaurante Central'
        ))

    # Categorias padrão
    categories_default = ['Hambúrgueres', 'Pizzas', 'Bebidas', 'Sobremesas']
    for cat in categories_default:
        cursor.execute("INSERT OR IGNORE INTO categories (name) VALUES (?)", (cat,))

    # Pratos padrão se o cardápio estiver vazio
    cursor.execute("SELECT COUNT(*) as count FROM dishes")
    if cursor.fetchone()['count'] == 0:
        cursor.execute("SELECT id, name FROM categories")
        cat_map = {row['name']: row['id'] for row in cursor.fetchall()}

        sample_dishes = [
            (cat_map.get('Hambúrgueres'), 'Burger Clássico Artesanal', 'Pão brioche, blend 180g bovino, queijo cheddar derretido, alface, tomate e maionese da casa.', 34.90, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop'),
            (cat_map.get('Hambúrgueres'), 'Bacon Smash Burger', 'Dois blends smash 90g crocantes, dobro de queijo, fatias crocantes de bacon e molho especial.', 38.50, 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop'),
            (cat_map.get('Pizzas'), 'Pizza Margherita Especial', 'Molho de tomate pelado italiano, muçarela de búfala, manjericão fresco e azeite extravirgem (8 fatias).', 59.90, 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600&auto=format&fit=crop'),
            (cat_map.get('Pizzas'), 'Pizza Calabresa Gourmet', 'Calabresa artesanal defumada fatiada fininha, cebola roxa, azeitonas pretas e muçarela.', 54.90, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop'),
            (cat_map.get('Bebidas'), 'Suco Natural de Laranja 500ml', 'Laranja fresca espremida na hora, 100% puro e sem adição de conservantes.', 12.00, 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600&auto=format&fit=crop'),
            (cat_map.get('Bebidas'), 'Refrigerante Lata 350ml', 'Coca-cola, Guaraná Antarctica ou Água Tônica bem gelada.', 7.50, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop'),
            (cat_map.get('Sobremesas'), 'Pudim de Leite Condensado', 'Pudim aveludado sem furinhos com calda generosa de caramelo dourado.', 16.00, 'https://images.unsplash.com/photo-1541784091332-9b27a3c30ea5?w=600&auto=format&fit=crop'),
            (cat_map.get('Sobremesas'), 'Brownie com Sorvete', 'Brownie de chocolate meio amargo servido com bola de sorvete de baunilha e calda morna.', 22.90, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop')
        ]

        for d in sample_dishes:
            if d[0]:
                cursor.execute('''
                    INSERT INTO dishes (category_id, name, description, price, image_url, is_available)
                    VALUES (?, ?, ?, ?, ?, 1)
                ''', d)

    conn.commit()
    conn.close()

init_db()

def current_user():
    user_id = session.get('user_id')
    if not user_id:
        return None
    conn = get_db()
    user = conn.execute("SELECT id, name, email, role, phone, address FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(user) if user else None

@app.route('/')
def index():
    return render_template('index.html')

# ==================== ROTAS DE AUTENTICAÇÃO ====================

@app.route('/api/me')
def api_me():
    user = current_user()
    return jsonify({'user': user})

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    phone = data.get('phone', '').strip()
    address = data.get('address', '').strip()

    if not name or not email or not password:
        return jsonify({'error': 'Nome, e-mail e senha são obrigatórios.'}), 400

    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        return jsonify({'error': 'Este e-mail já está cadastrado.'}), 400

    hashed = generate_password_hash(password)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO users (name, email, password_hash, role, phone, address)
        VALUES (?, ?, ?, 'cliente', ?, ?)
    ''', (name, email, hashed, phone, address))
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()

    session['user_id'] = user_id
    return jsonify({
        'success': True,
        'user': {
            'id': user_id,
            'name': name,
            'email': email,
            'role': 'cliente',
            'phone': phone,
            'address': address
        }
    })

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Preencha e-mail e senha.'}), 400

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'E-mail ou senha incorretos.'}), 401

    session['user_id'] = user['id']
    return jsonify({
        'success': True,
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'role': user['role'],
            'phone': user['phone'],
            'address': user['address']
        }
    })

@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'success': True})

# ==================== ROTAS DO CARDÁPIO ====================

@app.route('/api/menu')
def api_menu():
    conn = get_db()
    categories = [dict(c) for c in conn.execute("SELECT * FROM categories ORDER BY id ASC").fetchall()]
    
    # Gerente vê todos os itens (inclusive desativados), clientes veem apenas os disponíveis
    user = current_user()
    if user and user['role'] == 'gerente':
        dishes_raw = conn.execute('''
            SELECT d.*, c.name as category_name
            FROM dishes d
            JOIN categories c ON d.category_id = c.id
            ORDER BY d.category_id ASC, d.id ASC
        ''').fetchall()
    else:
        dishes_raw = conn.execute('''
            SELECT d.*, c.name as category_name
            FROM dishes d
            JOIN categories c ON d.category_id = c.id
            WHERE d.is_available = 1
            ORDER BY d.category_id ASC, d.id ASC
        ''').fetchall()

    dishes = [dict(d) for d in dishes_raw]
    conn.close()

    return jsonify({'categories': categories, 'dishes': dishes})

# ==================== ROTAS DE GERÊNCIA DO CARDÁPIO ====================

@app.route('/api/admin/dish', methods=['POST'])
def api_admin_add_dish():
    user = current_user()
    if not user or user['role'] != 'gerente':
        return jsonify({'error': 'Acesso negado.'}), 403

    data = request.get_json() or {}
    name = data.get('name', '').strip()
    category_id = data.get('category_id')
    price = data.get('price')
    description = data.get('description', '').strip()
    image_url = data.get('image_url', '').strip()
    is_available = 1 if data.get('is_available', True) else 0

    if not name or not category_id or price is None:
        return jsonify({'error': 'Nome, categoria e preço são obrigatórios.'}), 400

    try:
        price = float(price)
    except ValueError:
        return jsonify({'error': 'Preço inválido.'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO dishes (category_id, name, description, price, image_url, is_available)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (category_id, name, description, price, image_url, is_available))
    conn.commit()
    dish_id = cursor.lastrowid
    conn.close()

    return jsonify({'success': True, 'id': dish_id})

@app.route('/api/admin/dish/<int:dish_id>', methods=['PUT'])
def api_admin_edit_dish(dish_id):
    user = current_user()
    if not user or user['role'] != 'gerente':
        return jsonify({'error': 'Acesso negado.'}), 403

    data = request.get_json() or {}
    name = data.get('name', '').strip()
    category_id = data.get('category_id')
    price = data.get('price')
    description = data.get('description', '').strip()
    image_url = data.get('image_url', '').strip()
    is_available = 1 if data.get('is_available') else 0

    if not name or not category_id or price is None:
        return jsonify({'error': 'Nome, categoria e preço são obrigatórios.'}), 400

    try:
        price = float(price)
    except ValueError:
        return jsonify({'error': 'Preço inválido.'}), 400

    conn = get_db()
    conn.execute('''
        UPDATE dishes
        SET category_id = ?, name = ?, description = ?, price = ?, image_url = ?, is_available = ?
        WHERE id = ?
    ''', (category_id, name, description, price, image_url, is_available, dish_id))
    conn.commit()
    conn.close()

    return jsonify({'success': True})

@app.route('/api/admin/dish/<int:dish_id>', methods=['DELETE'])
def api_admin_delete_dish(dish_id):
    user = current_user()
    if not user or user['role'] != 'gerente':
        return jsonify({'error': 'Acesso negado.'}), 403

    conn = get_db()
    conn.execute("DELETE FROM dishes WHERE id = ?", (dish_id,))
    conn.commit()
    conn.close()

    return jsonify({'success': True})

# ==================== ROTAS DE PEDIDOS (CLIENTE) ====================

@app.route('/api/orders', methods=['POST'])
def api_create_order():
    user = current_user()
    if not user:
        return jsonify({'error': 'Faça login para realizar um pedido.'}), 401

    data = request.get_json() or {}
    items = data.get('items', [])
    delivery_address = data.get('delivery_address', '').strip()
    customer_phone = data.get('customer_phone', '').strip()
    payment_method = data.get('payment_method', 'PIX').strip()
    notes = data.get('notes', '').strip()

    if not items:
        return jsonify({'error': 'O carrinho está vazio.'}), 400
    if not delivery_address:
        return jsonify({'error': 'Endereço de entrega é obrigatório.'}), 400
    if not customer_phone:
        return jsonify({'error': 'Telefone para contato é obrigatório.'}), 400

    conn = get_db()
    cursor = conn.cursor()

    # Calcular total e validar itens
    total_price = 0.0
    validated_items = []

    for item in items:
        dish_id = item.get('dish_id')
        qty = int(item.get('quantity', 1))
        if qty <= 0:
            continue
        
        dish = conn.execute("SELECT * FROM dishes WHERE id = ?", (dish_id,)).fetchone()
        if not dish:
            continue
        
        subtotal = round(dish['price'] * qty, 2)
        total_price += subtotal
        validated_items.append({
            'dish_id': dish['id'],
            'dish_name': dish['name'],
            'unit_price': dish['price'],
            'quantity': qty,
            'subtotal': subtotal,
            'notes': item.get('notes', '')
        })

    if not validated_items:
        conn.close()
        return jsonify({'error': 'Nenhum prato válido no carrinho.'}), 400

    total_price = round(total_price, 2)

    # Inserir pedido
    cursor.execute('''
        INSERT INTO orders (user_id, customer_name, customer_phone, delivery_address, payment_method, notes, total_price, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'recebido')
    ''', (user['id'], user['name'], customer_phone, delivery_address, payment_method, notes, total_price))
    order_id = cursor.lastrowid

    # Inserir itens
    for it in validated_items:
        cursor.execute('''
            INSERT INTO order_items (order_id, dish_id, dish_name, unit_price, quantity, subtotal, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (order_id, it['dish_id'], it['dish_name'], it['unit_price'], it['quantity'], it['subtotal'], it['notes']))

    conn.commit()
    conn.close()

    return jsonify({'success': True, 'order_id': order_id})

@app.route('/api/my-orders')
def api_my_orders():
    user = current_user()
    if not user:
        return jsonify({'error': 'Não autenticado.'}), 401

    conn = get_db()
    orders_raw = conn.execute('''
        SELECT * FROM orders
        WHERE user_id = ?
        ORDER BY id DESC
    ''', (user['id'],)).fetchall()

    orders = []
    for o in orders_raw:
        o_dict = dict(o)
        items_raw = conn.execute('''
            SELECT * FROM order_items WHERE order_id = ?
        ''', (o['id'],)).fetchall()
        o_dict['items'] = [dict(it) for it in items_raw]
        orders.append(o_dict)

    conn.close()
    return jsonify({'orders': orders})

# ==================== ROTAS DE PEDIDOS (GERENTE) ====================

@app.route('/api/admin/orders')
def api_admin_orders():
    user = current_user()
    if not user or user['role'] != 'gerente':
        return jsonify({'error': 'Acesso negado.'}), 403

    conn = get_db()
    orders_raw = conn.execute('''
        SELECT * FROM orders
        ORDER BY id DESC
    ''').fetchall()

    orders = []
    for o in orders_raw:
        o_dict = dict(o)
        items_raw = conn.execute('''
            SELECT * FROM order_items WHERE order_id = ?
        ''', (o['id'],)).fetchall()
        o_dict['items'] = [dict(it) for it in items_raw]
        orders.append(o_dict)

    conn.close()
    return jsonify({'orders': orders})

@app.route('/api/admin/orders/<int:order_id>/status', methods=['PATCH'])
def api_admin_update_order_status(order_id):
    user = current_user()
    if not user or user['role'] != 'gerente':
        return jsonify({'error': 'Acesso negado.'}), 403

    data = request.get_json() or {}
    new_status = data.get('status', '').strip().lower()

    valid_statuses = ['recebido', 'preparando', 'saiu_entrega', 'entregue', 'cancelado']
    if new_status not in valid_statuses:
        return jsonify({'error': 'Status inválido.'}), 400

    conn = get_db()
    conn.execute("UPDATE orders SET status = ? WHERE id = ?", (new_status, order_id))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'new_status': new_status})

if __name__ == '__main__':
    print("=" * 60)
    print("🍽️  SISTEMA DE PEDIDOS PARA RESTAURANTE INICIADO!")
    print("👉 Acesse no computador: http://localhost:5000")
    print("👉 Conta Gerente: gerente@restaurante.com | Senha: admin123")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)
