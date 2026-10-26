from flask import Flask, jsonify, request, abort
import sqlite3, os, re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "hotel.db")
app = Flask(__name__, static_folder="static")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def query(sql, args=()):
    conn = get_db()
    try:
        cur = conn.execute(sql, args)
        conn.commit()
        return cur
    finally:
        conn.close()


def query_all(sql, args=()):
    conn = get_db()
    try:
        cur = conn.execute(sql, args)
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def seed():
    db = get_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'guest'
        );
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            capacity INTEGER NOT NULL,
            available INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            checkin TEXT NOT NULL,
            checkout TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (room_id) REFERENCES rooms(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    """)
    db.commit()
    db.close()


def init_db():
    global DB_PATH
    if os.environ.get("FLASK_APP") and os.path.exists(DB_PATH):
        return
    db = get_db()
    try:
        n = db.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
    except Exception:
        db.executescript("""
            CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
            password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'guest');
            CREATE TABLE rooms (id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL, type TEXT NOT NULL, description TEXT,
            price REAL NOT NULL, capacity INTEGER NOT NULL,
            available INTEGER NOT NULL DEFAULT 1);
            CREATE TABLE bookings (id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
            checkin TEXT NOT NULL, checkout TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL DEFAULT (datetime('now')));
        """)
        db.commit()
        n = 0
    if n == 0:
        db.execute("INSERT INTO users (username,name,password,role) VALUES (?,?,?,?)",
                   ("gerente", "Gerente do Hotel", "123456", "manager"))
        db.execute("INSERT INTO users (username,name,password,role) VALUES (?,?,?,?)",
                   ("hospede", "Maria Silva", "123456", "guest"))
        rooms = [
            ("Quarto 101", "Simples", "Leito de casal, TV e ar-condicionado.", 220.0, 2),
            ("Quarto 102", "Simples", "Leito de casal, TV e ar-condicionado.", 220.0, 2),
            ("Suíte 201", "Suíte", "Suíte com sofá-cama e vista para a cidade.", 480.0, 2),
            ("Suíte 202", "Suíte", "Suíte com terraço privativo.", 520.0, 3),
            ("Apartamento 301", "Apartamento", "Apartamento com cozinha, 2 quartos.", 750.0, 4),
        ]
        for r in rooms:
            db.execute("INSERT INTO rooms (name,type,description,price,capacity,available) "
                       "VALUES (?,?,?,?,?,1)", r)
        db.commit()
    db.close()


def overlaps(cid, cdoi):
    return not (cdoi <= cid or cid <= cdoi)


def is_taken(room_id, checkin, checkout, exclude_booking_id=None):
    sql = "SELECT id FROM bookings WHERE room_id=? AND status IN ('pending','confirmed')"
    args = [room_id]
    if exclude_booking_id is not None:
        sql += " AND id<>?"
        args.append(exclude_booking_id)
    sql += " AND ?<checkout AND ?>=checkin"
    rows = query_all(sql, args + [checkin, checkout])
    return len(rows) > 0


def conflicts_room(room_id, checkin, checkout):
    rows = query_all("SELECT * FROM rooms WHERE id=?", (room_id,))
    if not rows:
        return False
    return is_taken(room_id, checkin, checkout)


def normalize_dates(din, dout):
    din = (din or "").strip()
    dout = (dout or "").strip()
    return din, dout


def login_payload(user):
    return {"id": user["id"], "username": user["username"], "name": user["name"],
            "role": user["role"]}


def is_manager(u):
    return u and u["role"] == "manager"


def require_manager():
    u = request.get_json().get("user")
    if not is_manager(u):
        abort(403)
    return u


@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.post("/api/register")
def register():
    d = request.get_json() or {}
    username = (d.get("username") or "").strip()
    name = (d.get("name") or "").strip()
    password = (d.get("password") or "")
    if not username or not name or not password:
        return jsonify({"ok": False, "error": "Preencha todos os campos."}), 400
    if len(password) < 4:
        return jsonify({"ok": False, "error": "A senha precisa ter pelo menos 4 caracteres."}), 400
    try:
        cur = query("INSERT INTO users (username,name,password,role) VALUES (?,?,?,'guest')",
                    (username.lower(), name, password))
    except Exception:
        return jsonify({"ok": False, "error": "Este nome de usuário já existe. Escolha outro."}), 400
    row = query_all("SELECT * FROM users WHERE id=?", (cur.lastrowid,))[0]
    return jsonify({"ok": True, "user": login_payload(row)})


@app.post("/api/login")
def login():
    d = request.get_json() or {}
    u = query_all("SELECT * FROM users WHERE lower(username)=lower(?)",
                  ((d.get("username") or "").strip(),))[0:1]
    if not u:
        return jsonify({"ok": False, "error": "Usuário não encontrado. Cadastre-se primeiro."}), 400
    user = u[0]
    if user["password"] != (d.get("password") or ""):
        return jsonify({"ok": False, "error": "Senha incorreta."}), 400
    return jsonify({"ok": True, "user": login_payload(user)})


@app.get("/api/rooms")
def list_rooms():
    d = request.get_json(silent=True) or {}
    checkin = (d.get("checkin") or "").strip()
    checkout = (d.get("checkout") or "").strip()
    user = d.get("user")
    rooms = query_all("SELECT * FROM rooms ORDER BY id")
    for r in rooms:
        if r["available"]:
            if checkin and checkout:
                r["available_selected"] = not is_taken(r["id"], checkin, checkout)
            else:
                r["available_selected"] = True
    if is_manager(user):
        for r in rooms:
            r["status"] = "pendente"
        pending = query_all(
            "SELECT b.room_id AS room_id, COUNT(*) AS c FROM bookings b "
            "WHERE b.status='pending' GROUP BY b.room_id")
        for p in pending:
            for r in rooms:
                if r["id"] == p["room_id"]:
                    r["status"] = "pendente"
    return jsonify({"ok": True, "rooms": rooms})


@app.post("/api/rooms")
def create_room():
    require_manager()
    d = request.get_json() or {}
    name = (d.get("name") or "").strip()
    rtype = (d.get("type") or "").strip()
    price = d.get("price")
    capacity = d.get("capacity")
    description = (d.get("description") or "").strip()
    available = 1 if d.get("available", True) else 0
    if not name or not rtype:
        return jsonify({"ok": False, "error": "Nome e tipo são obrigatórios."}), 400
    try:
        price = float(price)
        capacity = int(capacity)
    except Exception:
        return jsonify({"ok": False, "error": "Preço e ocupação precisam ser numéricos."}), 400
    cur = query("INSERT INTO rooms (name,type,description,price,capacity,available) "
                "VALUES (?,?,?,?,?,?)", (name, rtype, description, price, capacity, available))
    row = query_all("SELECT * FROM rooms WHERE id=?", (cur.lastrowid,))[0]
    return jsonify({"ok": True, "room": row})


@app.put("/api/rooms/<int:rid>")
def update_room(rid):
    u = require_manager()
    d = request.get_json() or {}
    rows = query_all("SELECT * FROM rooms WHERE id=?", (rid,))
    if not rows:
        abort(404)
    cur = rows[0]
    name = (d.get("name", cur["name"]) or "").strip()
    rtype = (d.get("type", cur["type"]) or "").strip()
    description = (d.get("description", cur["description"]) or "").strip()
    price = d.get("price", cur["price"])
    capacity = d.get("capacity", cur["capacity"])
    available = 1 if d.get("available", bool(cur["available"])) else 0
    try:
        price = float(price)
        capacity = int(capacity)
    except Exception:
        return jsonify({"ok": False, "error": "Preço e ocupação precisam ser numéricos."}), 400
    if not name or not rtype:
        return jsonify({"ok": False, "error": "Nome e tipo são obrigatórios."}), 400
    try:
        query("UPDATE rooms SET name=?, type=?, description=?, price=?, capacity=?, available=? WHERE id=?",
              (name, rtype, description, price, capacity, available, rid))
    except Exception:
        return jsonify({"ok": False, "error": "Não foi possível salvar o quarto."}), 400
    row = query_all("SELECT * FROM rooms WHERE id=?", (rid,))[0]
    return jsonify({"ok": True, "room": row})


@app.delete("/api/rooms/<int:rid>")
def delete_room(rid):
    u = require_manager()
    rows = query_all("SELECT * FROM rooms WHERE id=?", (rid,))
    if not rows:
        abort(404)
    if conflicts_room(rid, "2000-01-01", "3000-01-01"):
        return jsonify({"ok": False,
                        "error": "Este quarto tem reservas. Cancele/remova as reservas antes de excluir."}), 400
    query("DELETE FROM rooms WHERE id=?", (rid,))
    return jsonify({"ok": True})


@app.get("/api/bookings")
def list_bookings():
    d = request.get_json(silent=True) or {}
    user = d.get("user")
    if is_manager(user):
        rows = query_all(
            "SELECT b.*, r.name AS room_name, u.name AS guest_name, u.username AS guest_username "
            "FROM bookings b JOIN rooms r ON r.id=b.room_id JOIN users u ON u.id=b.user_id "
            "ORDER BY b.checkin DESC, b.created_at DESC")
        return jsonify({"ok": True, "bookings": rows})
    if user and user.get("id"):
        rows = query_all(
            "SELECT b.*, r.name AS room_name, u.name AS guest_name "
            "FROM bookings b JOIN rooms r ON r.id=b.room_id JOIN users u ON u.id=b.user_id "
            "WHERE b.user_id=? ORDER BY b.checkin DESC, b.created_at DESC", (user["id"],))
        return jsonify({"ok": True, "bookings": rows})
    return jsonify({"ok": False, "error": "Não autenticado."}), 400


@app.post("/api/bookings")
def create_booking():
    d = request.get_json() or {}
    user = d.get("user")
    if not user:
        return jsonify({"ok": False, "error": "Não autenticado."}), 401
    room_id = d.get("room_id")
    checkin, checkout = normalize_dates(d.get("checkin"), d.get("checkout"))
    if not checkin or not checkout:
        return jsonify({"ok": False, "error": "Escolha as datas de entrada e saída."}), 400
    if checkin >= checkout:
        return jsonify({"ok": False, "error": "A data de saída deve ser depois da entrada."}), 400
    rooms = query_all("SELECT * FROM rooms WHERE id=?", (room_id,))
    if not rooms:
        return jsonify({"ok": False, "error": "Quarto não encontrado."}), 404
    if is_taken(room_id, checkin, checkout):
        return jsonify({"ok": False,
                        "error": "Este quarto já está reservado para essas datas."}), 400
    try:
        cur = query("INSERT INTO bookings (room_id,user_id,checkin,checkout,status) "
                    "VALUES (?,?,?,'pending',?)",
                    (room_id, user["id"], checkin, checkout))
    except Exception:
        return jsonify({"ok": False, "error": "Não foi possível criar a reserva."}), 400
    row = query_all("SELECT b.*, r.name AS room_name, u.name AS guest_name "
                    "FROM bookings b JOIN rooms r ON r.id=b.room_id JOIN users u ON u.id=b.user_id "
                    "WHERE b.id=?", (cur.lastrowid,))[0]
    return jsonify({"ok": True, "booking": row})


@app.post("/api/bookings/<int:bid>/status")
def set_status(bid):
    u = require_manager()
    d = request.get_json() or {}
    status = d.get("status")
    if status not in ("confirmed", "rejected", "pending"):
        return jsonify({"ok": False, "error": "Status inválido."}), 400
    rows = query_all("SELECT * FROM bookings WHERE id=?", (bid,))
    if not rows:
        abort(404)
    b = rows[0]
    if status == "confirmed" and b["status"] not in ("confirmed", "pending"):
        if conflicts_room(b["room_id"], b["checkin"], b["checkout"], exclude_booking_id=bid):
            return jsonify({"ok": False,
                            "error": "Há outra reserva para este quarto nessas datas. Recuse a outra antes."}), 400
    query("UPDATE bookings SET status=? WHERE id=?", (status, bid))
    row = query_all("SELECT b.*, r.name AS room_name, u.name AS guest_name "
                    "FROM bookings b JOIN rooms r ON r.id=b.room_id JOIN users u ON u.id=b.user_id "
                    "WHERE b.id=?", (bid,))[0]
    return jsonify({"ok": True, "booking": row})


@app.delete("/api/bookings/<int:bid>")
def cancel_booking(bid):
    d = request.get_json(silent=True) or {}
    user = d.get("user")
    if not user:
        return jsonify({"ok": False, "error": "Não autenticado."}), 401
    rows = query_all("SELECT * FROM bookings WHERE id=?", (bid,))
    if not rows:
        abort(404)
    b = rows[0]
    if user["role"] != "manager" and b["user_id"] != user["id"]:
        abort(403)
    query("UPDATE bookings SET status='cancelled' WHERE id=?", (bid,))
    row = query_all("SELECT b.*, r.name AS room_name, u.name AS guest_name "
                    "FROM bookings b JOIN rooms r ON r.id=b.room_id JOIN users u ON u.id=b.user_id "
                    "WHERE b.id=?", (bid,))[0]
    return jsonify({"ok": True, "booking": row})


init_db()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
