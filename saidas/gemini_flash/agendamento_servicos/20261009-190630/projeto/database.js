const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'agendamentos.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados SQLite:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite local.');
  }
});

function initDatabase() {
  db.serialize(() => {
    // Tabela de Usuários
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'client',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de Serviços
    db.run(`
      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        duration_minutes INTEGER NOT NULL DEFAULT 30,
        price REAL NOT NULL DEFAULT 0.00,
        active INTEGER NOT NULL DEFAULT 1
      )
    `);

    // Tabela de Horários de Funcionamento (dias da semana: 0 = Domingo, 1 = Segunda, etc.)
    db.run(`
      CREATE TABLE IF NOT EXISTS business_hours (
        day_of_week INTEGER PRIMARY KEY,
        day_name TEXT NOT NULL,
        is_open INTEGER NOT NULL DEFAULT 1,
        start_time TEXT NOT NULL DEFAULT '08:00',
        end_time TEXT NOT NULL DEFAULT '18:00',
        slot_interval INTEGER NOT NULL DEFAULT 30
      )
    `);

    // Tabela de Agendamentos
    db.run(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        service_id INTEGER NOT NULL,
        appointment_date TEXT NOT NULL,
        appointment_time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pendente',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES users (id),
        FOREIGN KEY (service_id) REFERENCES services (id)
      )
    `);

    // Criar Administrador padrão se não existir nenhum
    db.get(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`, (err, row) => {
      if (!row) {
        const adminPassword = bcrypt.hashSync('admin123', 10);
        db.run(
          `INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
          ['Responsável (Admin)', 'admin@negocio.com', '11999999999', adminPassword, 'admin'],
          (insertErr) => {
            if (!insertErr) {
              console.log('Conta de administrador criada: admin@negocio.com / senha: admin123');
            }
          }
        );
      }
    });

    // Inserir dias padrão se a tabela de horários estiver vazia
    db.get(`SELECT COUNT(*) as count FROM business_hours`, (err, row) => {
      if (row && row.count === 0) {
        const days = [
          { id: 0, name: 'Domingo', open: 0, start: '08:00', end: '12:00' },
          { id: 1, name: 'Segunda-feira', open: 1, start: '08:00', end: '18:00' },
          { id: 2, name: 'Terça-feira', open: 1, start: '08:00', end: '18:00' },
          { id: 3, name: 'Quarta-feira', open: 1, start: '08:00', end: '18:00' },
          { id: 4, name: 'Quinta-feira', open: 1, start: '08:00', end: '18:00' },
          { id: 5, name: 'Sexta-feira', open: 1, start: '08:00', end: '18:00' },
          { id: 6, name: 'Sábado', open: 1, start: '08:00', end: '14:00' }
        ];

        const stmt = db.prepare(
          `INSERT INTO business_hours (day_of_week, day_name, is_open, start_time, end_time, slot_interval) VALUES (?, ?, ?, ?, ?, 30)`
        );
        days.forEach(d => {
          stmt.run(d.id, d.name, d.open, d.start, d.end);
        });
        stmt.finalize();
      }
    });

    // Inserir serviços iniciais de exemplo se a tabela estiver vazia
    db.get(`SELECT COUNT(*) as count FROM services`, (err, row) => {
      if (row && row.count === 0) {
        const stmt = db.prepare(
          `INSERT INTO services (name, description, duration_minutes, price, active) VALUES (?, ?, ?, ?, 1)`
        );
        stmt.run('Atendimento Básico', 'Serviço rápido e prático para o dia a dia.', 30, 50.00);
        stmt.run('Atendimento Completo', 'Experiência personalizada completa com atenção aos detalhes.', 60, 90.00);
        stmt.run('Consultoria Especializada', 'Diagnóstico e orientações sob medida para sua necessidade.', 45, 120.00);
        stmt.finalize();
      }
    });
  });
}

initDatabase();

module.exports = db;
