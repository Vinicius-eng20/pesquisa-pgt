const bcrypt = require('bcryptjs');
const db = require('../src/db');

const organizerEmail = 'organizador@eventos.local';
const existingOrganizer = db.prepare('SELECT id FROM users WHERE email = ?').get(organizerEmail);

if (!existingOrganizer) {
  const passwordHash = bcrypt.hashSync('admin123', 12);
  db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, 'organizer')
  `).run('Organizador', organizerEmail, passwordHash);

  console.log('Conta do organizador criada:');
  console.log('E-mail: organizador@eventos.local');
  console.log('Senha: admin123');
} else {
  console.log('Conta do organizador já existe.');
}

const countEvents = db.prepare('SELECT COUNT(*) AS total FROM events').get().total;

if (countEvents === 0) {
  const organizer = db.prepare('SELECT id FROM users WHERE email = ?').get(organizerEmail);

  db.prepare(`
    INSERT INTO events (title, description, location, event_date, capacity, status, created_by)
    VALUES (?, ?, ?, ?, ?, 'ativo', ?)
  `).run(
    'Encontro de Boas-vindas',
    'Evento inicial para conhecer o portal, os participantes e a programação.',
    'Auditório Principal',
    '2026-01-15T19:00',
    100,
    organizer.id
  );

  db.prepare(`
    INSERT INTO events (title, description, location, event_date, capacity, status, created_by)
    VALUES (?, ?, ?, ?, ?, 'ativo', ?)
  `).run(
    'Oficina Prática',
    'Oficina com atividades práticas e espaço para perguntas.',
    'Sala 2',
    '2026-02-10T14:00',
    30,
    organizer.id
  );

  console.log('Eventos de exemplo criados.');
}

console.log('Banco de dados pronto.');
