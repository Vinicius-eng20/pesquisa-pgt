const bcrypt = require('bcrypt');
const { db, initializeDatabase } = require('../database');

async function createAdminUser() {
  initializeDatabase();

  const email = 'gerente@hotel.com';
  const password = 'admin123';
  const name = 'Gerente do Hotel';

  try {
    // Verificar se já existe
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    
    if (existing) {
      console.log('Usuário gerente já existe!');
      console.log('Email:', email);
      console.log('Senha: admin123');
      return;
    }

    // Criar usuário gerente
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)');
    stmt.run(email, hashedPassword, name, 'manager');

    console.log('✅ Usuário gerente criado com sucesso!');
    console.log('Email:', email);
    console.log('Senha:', password);
    console.log('\n⚠️  IMPORTANTE: Altere a senha após o primeiro login!');
  } catch (error) {
    console.error('Erro ao criar usuário gerente:', error);
  }
}

createAdminUser();
