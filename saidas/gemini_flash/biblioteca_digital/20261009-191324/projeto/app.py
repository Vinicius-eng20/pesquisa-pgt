import sqlite3
import os
from datetime import datetime, timedelta, date
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, session, flash, g
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'biblioteca-chave-secreta-segura-2025')
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'biblioteca.db')


def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(exception):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    with app.app_context():
        db = get_db()
        db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'reader',
                is_blocked INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                category TEXT NOT NULL,
                isbn TEXT,
                description TEXT,
                total_copies INTEGER NOT NULL DEFAULT 1,
                available_copies INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS loans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                book_id INTEGER NOT NULL,
                loan_date DATE NOT NULL,
                due_date DATE NOT NULL,
                return_date DATE,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (book_id) REFERENCES books (id)
            );
        """)

        # Criar conta padrão de Bibliotecário caso não exista
        cur = db.execute("SELECT id FROM users WHERE email = ?", ('admin@biblioteca.com',))
        if not cur.fetchone():
            admin_pwd = generate_password_hash('admin123')
            db.execute(
                "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
                ('Bibliotecário Chefe', 'admin@biblioteca.com', admin_pwd, 'librarian')
            )

        # Criar leitor modelo
        cur = db.execute("SELECT id FROM users WHERE email = ?", ('leitor@biblioteca.com',))
        if not cur.fetchone():
            reader_pwd = generate_password_hash('leitor123')
            db.execute(
                "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
                ('Ana Silva', 'leitor@biblioteca.com', reader_pwd, 'reader')
            )

        # Inserir acervo inicial de exemplo caso vazio
        cur = db.execute("SELECT COUNT(*) as count FROM books")
        if cur.fetchone()['count'] == 0:
            livros_iniciais = [
                ('Dom Casmurro', 'Machado de Assis', 'Literatura Brasileira', '9788520938676', 'A história de Bentinho e Capitu e os mistérios do ciúme e da traição.', 3, 3),
                ('1984', 'George Orwell', 'Ficção Científica', '9788535914849', 'Um clássico distópico sobre vigilância governamental e totalitarismo.', 4, 4),
                ('O Pequeno Príncipe', 'Antoine de Saint-Exupéry', 'Infantil / Fábula', '9788522031443', 'As aventuras poéticas de um jovem príncipe que viaja pelo universo.', 5, 5),
                ('Algoritmos: Teoria e Prática', 'Thomas H. Cormen', 'Tecnologia', '9788535236996', 'Guia abrangente e fundamental para o estudo de algoritmos de computação.', 2, 2),
                ('A Hora da Estrela', 'Clarice Lispector', 'Literatura Brasileira', '9788520920589', 'A tocante trajetória da jovem alagoana Macabéa no Rio de Janeiro.', 3, 3)
            ]
            db.executemany(
                "INSERT INTO books (title, author, category, isbn, description, total_copies, available_copies) VALUES (?, ?, ?, ?, ?, ?, ?)",
                livros_iniciais
            )

        db.commit()


# Decoradores de permissão
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Faça login para acessar esta página.', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function


def librarian_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Faça login para acessar esta página.', 'warning')
            return redirect(url_for('login'))
        if session.get('role') != 'librarian':
            flash('Acesso restrito ao bibliotecário.', 'danger')
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function


@app.context_processor
def inject_today():
    return {'today': date.today().strftime('%Y-%m-%d')}


# Rotas Públicas e Catálogo
@app.route('/')
def index():
    query = request.args.get('q', '').strip()
    category = request.args.get('category', '').strip()
    available_only = request.args.get('available') == '1'

    db = get_db()
    sql = "SELECT * FROM books WHERE 1=1"
    params = []

    if query:
        sql += " AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?)"
        wildcard = f"%{query}%"
        params.extend([wildcard, wildcard, wildcard])

    if category:
        sql += " AND category = ?"
        params.append(category)

    if available_only:
        sql += " AND available_copies > 0"

    sql += " ORDER BY title ASC"
    books = db.execute(sql, params).fetchall()

    categories_raw = db.execute("SELECT DISTINCT category FROM books ORDER BY category ASC").fetchall()
    categories = [r['category'] for r in categories_raw]

    return render_template('index.html', books=books, query=query, selected_category=category, available_only=available_only, categories=categories)


@app.route('/livro/<int:book_id>')
def book_detail(book_id):
    db = get_db()
    book = db.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
    if not book:
        flash('Livro não encontrado.', 'danger')
        return redirect(url_for('index'))

    # Checar se o usuário atual já está com este livro emprestado
    user_active_loan = None
    if 'user_id' in session:
        user_active_loan = db.execute(
            "SELECT * FROM loans WHERE book_id = ? AND user_id = ? AND status = 'active'",
            (book_id, session['user_id'])
        ).fetchone()

    return render_template('book_detail.html', book=book, user_active_loan=user_active_loan)


# Autenticação
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')

        db = get_db()
        user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['user_name'] = user['name']
            session['user_email'] = user['email']
            session['role'] = user['role']
            session['is_blocked'] = bool(user['is_blocked'])

            flash(f'Bem-vindo(a), {user["name"]}!', 'success')
            if user['role'] == 'librarian':
                return redirect(url_for('librarian_loans'))
            return redirect(url_for('index'))
        else:
            flash('E-mail ou senha incorretos.', 'danger')

    return render_template('login.html')


@app.route('/cadastro', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')

        if not name or not email or not password:
            flash('Por favor, preencha todos os campos.', 'danger')
            return render_template('register.html')

        if password != confirm_password:
            flash('As senhas digitadas não coincidem.', 'danger')
            return render_template('register.html')

        if len(password) < 6:
            flash('A senha deve ter no mínimo 6 caracteres.', 'danger')
            return render_template('register.html')

        db = get_db()
        existing = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if existing:
            flash('Este e-mail já está cadastrado. Tente fazer login.', 'warning')
            return render_template('register.html')

        pwd_hash = generate_password_hash(password)
        db.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'reader')",
            (name, email, pwd_hash)
        )
        db.commit()

        flash('Cadastro realizado com sucesso! Faça seu login.', 'success')
        return redirect(url_for('login'))

    return render_template('register.html')


@app.route('/logout')
def logout():
    session.clear()
    flash('Você saiu do sistema.', 'info')
    return redirect(url_for('index'))


# Ações do Leitor
@app.route('/emprestar/<int:book_id>', methods=['POST'])
@login_required
def borrow_book(book_id):
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id = ?", (session['user_id'],)).fetchone()

    # Checagem de bloqueio do leitor
    if user['is_blocked']:
        flash('Seu cadastro está bloqueado para novos empréstimos. Entre em contato com a biblioteca.', 'danger')
        return redirect(url_for('book_detail', book_id=book_id))

    # Checar se já tem livro em atraso
    today_str = date.today().strftime('%Y-%m-%d')
    overdue = db.execute(
        "SELECT id FROM loans WHERE user_id = ? AND status = 'active' AND due_date < ?",
        (user['id'], today_str)
    ).fetchone()
    if overdue:
        flash('Você possui empréstimos em atraso pendentes. Regularize-os antes de pegar novos livros.', 'danger')
        return redirect(url_for('my_loans'))

    # Checar disponibilidade do livro
    book = db.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
    if not book:
        flash('Livro não encontrado.', 'danger')
        return redirect(url_for('index'))

    if book['available_copies'] <= 0:
        flash('Desculpe, todos os exemplares deste livro já estão emprestados.', 'warning')
        return redirect(url_for('book_detail', book_id=book_id))

    # Checar se usuário já está com exemplar ativo deste livro
    active_loan = db.execute(
        "SELECT id FROM loans WHERE user_id = ? AND book_id = ? AND status = 'active'",
        (user['id'], book_id)
    ).fetchone()
    if active_loan:
        flash('Você já está com um exemplar deste livro emprestado.', 'warning')
        return redirect(url_for('book_detail', book_id=book_id))

    # Realizar empréstimo: 14 dias de prazo
    loan_date = date.today()
    due_date = loan_date + timedelta(days=14)

    db.execute(
        "INSERT INTO loans (user_id, book_id, loan_date, due_date, status) VALUES (?, ?, ?, ?, 'active')",
        (user['id'], book_id, loan_date.strftime('%Y-%m-%d'), due_date.strftime('%Y-%m-%d'))
    )
    db.execute("UPDATE books SET available_copies = available_copies - 1 WHERE id = ?", (book_id,))
    db.commit()

    flash(f'Empréstimo de "{book["title"]}" confirmado! Devolva até {due_date.strftime("%d/%m/%Y")}.', 'success')
    return redirect(url_for('my_loans'))


@app.route('/devolver/<int:loan_id>', methods=['POST'])
@login_required
def return_book(loan_id):
    db = get_db()
    loan = db.execute("SELECT * FROM loans WHERE id = ?", (loan_id,)).fetchone()

    if not loan or loan['status'] != 'active':
        flash('Empréstimo não encontrado ou já devolvido.', 'warning')
        return redirect(url_for('my_loans'))

    # Apenas o próprio leitor ou um bibliotecário pode devolver
    if session.get('role') != 'librarian' and loan['user_id'] != session['user_id']:
        flash('Você não tem permissão para devolver este empréstimo.', 'danger')
        return redirect(url_for('my_loans'))

    today_str = date.today().strftime('%Y-%m-%d')
    db.execute(
        "UPDATE loans SET status = 'returned', return_date = ? WHERE id = ?",
        (today_str, loan_id)
    )
    db.execute("UPDATE books SET available_copies = available_copies + 1 WHERE id = ?", (loan['book_id'],))
    db.commit()

    flash('Item devolvido com sucesso à biblioteca!', 'success')
    if session.get('role') == 'librarian':
        return redirect(request.referrer or url_for('librarian_loans'))
    return redirect(url_for('my_loans'))


@app.route('/meus-emprestimos')
@login_required
def my_loans():
    db = get_db()
    user_id = session['user_id']
    loans = db.execute("""
        SELECT l.*, b.title, b.author, b.category
        FROM loans l
        JOIN books b ON l.book_id = b.id
        WHERE l.user_id = ?
        ORDER BY CASE WHEN l.status = 'active' THEN 0 ELSE 1 END, l.loan_date DESC
    """, (user_id,)).fetchall()

    user = db.execute("SELECT is_blocked FROM users WHERE id = ?", (user_id,)).fetchone()

    return render_template('my_loans.html', loans=loans, is_blocked=bool(user['is_blocked']))


# Painel do Bibliotecário
@app.route('/admin/livros')
@librarian_required
def librarian_books():
    query = request.args.get('q', '').strip()
    db = get_db()

    if query:
        sql = "SELECT * FROM books WHERE title LIKE ? OR author LIKE ? OR isbn LIKE ? ORDER BY id DESC"
        wildcard = f"%{query}%"
        books = db.execute(sql, (wildcard, wildcard, wildcard)).fetchall()
    else:
        books = db.execute("SELECT * FROM books ORDER BY id DESC").fetchall()

    return render_template('librarian/books.html', books=books, query=query)


@app.route('/admin/livros/novo', methods=['GET', 'POST'])
@librarian_required
def librarian_add_book():
    if request.method == 'POST':
        title = request.form.get('title', '').strip()
        author = request.form.get('author', '').strip()
        category = request.form.get('category', '').strip()
        isbn = request.form.get('isbn', '').strip()
        description = request.form.get('description', '').strip()
        try:
            total_copies = int(request.form.get('total_copies', 1))
            if total_copies < 1:
                total_copies = 1
        except ValueError:
            total_copies = 1

        if not title or not author:
            flash('Título e Autor são obrigatórios.', 'danger')
            return render_template('librarian/book_form.html', action='novo', book=None)

        db = get_db()
        db.execute(
            "INSERT INTO books (title, author, category, isbn, description, total_copies, available_copies) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (title, author, category or 'Geral', isbn, description, total_copies, total_copies)
        )
        db.commit()
        flash(f'Livro "{title}" cadastrado com sucesso!', 'success')
        return redirect(url_for('librarian_books'))

    return render_template('librarian/book_form.html', action='novo', book=None)


@app.route('/admin/livros/<int:book_id>/editar', methods=['GET', 'POST'])
@librarian_required
def librarian_edit_book(book_id):
    db = get_db()
    book = db.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
    if not book:
        flash('Livro não encontrado.', 'danger')
        return redirect(url_for('librarian_books'))

    if request.method == 'POST':
        title = request.form.get('title', '').strip()
        author = request.form.get('author', '').strip()
        category = request.form.get('category', '').strip()
        isbn = request.form.get('isbn', '').strip()
        description = request.form.get('description', '').strip()
        try:
            new_total = int(request.form.get('total_copies', 1))
            if new_total < 1:
                new_total = 1
        except ValueError:
            new_total = 1

        # Quantos estão emprestados no momento
        borrowed_count = book['total_copies'] - book['available_copies']
        if new_total < borrowed_count:
            flash(f'Não é possível reduzir para {new_total} cópias pois existem {borrowed_count} emprestadas atualmente.', 'danger')
            return render_template('librarian/book_form.html', action='editar', book=book)

        new_available = new_total - borrowed_count

        db.execute("""
            UPDATE books
            SET title = ?, author = ?, category = ?, isbn = ?, description = ?, total_copies = ?, available_copies = ?
            WHERE id = ?
        """, (title, author, category or 'Geral', isbn, description, new_total, new_available, book_id))
        db.commit()

        flash(f'Livro "{title}" atualizado com sucesso!', 'success')
        return redirect(url_for('librarian_books'))

    return render_template('librarian/book_form.html', action='editar', book=book)


@app.route('/admin/livros/<int:book_id>/remover', methods=['POST'])
@librarian_required
def librarian_delete_book(book_id):
    db = get_db()
    active_loans = db.execute(
        "SELECT COUNT(*) as count FROM loans WHERE book_id = ? AND status = 'active'",
        (book_id,)
    ).fetchone()['count']

    if active_loans > 0:
        flash('Não é possível excluir o livro: existem exemplares emprestados que ainda não foram devolvidos.', 'danger')
        return redirect(url_for('librarian_books'))

    db.execute("DELETE FROM loans WHERE book_id = ?", (book_id,))
    db.execute("DELETE FROM books WHERE id = ?", (book_id,))
    db.commit()

    flash('Livro removido do acervo.', 'success')
    return redirect(url_for('librarian_books'))


@app.route('/admin/emprestimos')
@librarian_required
def librarian_loans():
    filter_status = request.args.get('status', 'all')
    search = request.args.get('q', '').strip()
    today_str = date.today().strftime('%Y-%m-%d')

    db = get_db()
    sql = """
        SELECT l.*, b.title as book_title, u.name as user_name, u.email as user_email, u.is_blocked
        FROM loans l
        JOIN books b ON l.book_id = b.id
        JOIN users u ON l.user_id = u.id
        WHERE 1=1
    """
    params = []

    if search:
        sql += " AND (b.title LIKE ? OR u.name LIKE ? OR u.email LIKE ?)"
        wild = f"%{search}%"
        params.extend([wild, wild, wild])

    if filter_status == 'active':
        sql += " AND l.status = 'active' AND l.due_date >= ?"
        params.append(today_str)
    elif filter_status == 'overdue':
        sql += " AND l.status = 'active' AND l.due_date < ?"
        params.append(today_str)
    elif filter_status == 'returned':
        sql += " AND l.status = 'returned'"

    sql += " ORDER BY l.id DESC"
    loans = db.execute(sql, params).fetchall()

    return render_template('librarian/loans.html', loans=loans, filter_status=filter_status, search=search)


@app.route('/admin/leitores')
@librarian_required
def librarian_readers():
    db = get_db()
    today_str = date.today().strftime('%Y-%m-%d')

    # Obter leitores com contagem de empréstimos ativos e atrasados
    readers = db.execute("""
        SELECT u.*,
            (SELECT COUNT(*) FROM loans WHERE user_id = u.id AND status = 'active') as active_loans_count,
            (SELECT COUNT(*) FROM loans WHERE user_id = u.id AND status = 'active' AND due_date < ?) as overdue_loans_count
        FROM users u
        WHERE u.role = 'reader'
        ORDER BY overdue_loans_count DESC, u.name ASC
    """, (today_str,)).fetchall()

    return render_template('librarian/readers.html', readers=readers)


@app.route('/admin/leitores/<int:user_id>/alternar-bloqueio', methods=['POST'])
@librarian_required
def toggle_user_block(user_id):
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id = ? AND role = 'reader'", (user_id,)).fetchone()
    if not user:
        flash('Leitor não encontrado.', 'danger')
        return redirect(url_for('librarian_readers'))

    new_status = 0 if user['is_blocked'] else 1
    db.execute("UPDATE users SET is_blocked = ? WHERE id = ?", (new_status, user_id))
    db.commit()

    status_txt = "bloqueado para novos empréstimos" if new_status == 1 else "desbloqueado com sucesso"
    flash(f'O leitor {user["name"]} foi {status_txt}.', 'success')
    return redirect(url_for('librarian_readers'))


# Inicialização automática do banco de dados na inicialização
init_db()

if __name__ == '__main__':
    # host='0.0.0.0' permite que outros computadores ou celulares na mesma rede Wi-Fi acessem
    app.run(host='0.0.0.0', port=5000, debug=True)
