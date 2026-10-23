const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'loja.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'customer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      icon TEXT DEFAULT 'bi-tag'
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 10,
      description TEXT,
      image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories (id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
      UNIQUE(user_id, product_id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total REAL NOT NULL,
      status TEXT DEFAULT 'Pendente',
      shipping_address TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
    )
  `);

  await seedInitialData();
}

async function seedInitialData() {
  const adminCheck = await get(`SELECT id FROM users WHERE email = 'admin@shopping.com'`);
  if (!adminCheck) {
    const adminHash = bcrypt.hashSync('admin123', 10);
    await run(
      `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
      ['Gerente SuperShop', 'admin@shopping.com', adminHash, 'admin']
    );

    const clientHash = bcrypt.hashSync('cliente123', 10);
    await run(
      `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
      ['Cliente Exemplo', 'cliente@shopping.com', clientHash, 'customer']
    );
  }

  const categoryCount = await get(`SELECT COUNT(*) as count FROM categories`);
  if (categoryCount.count === 0) {
    const defaultCategories = [
      ['Eletrônicos & Informática', 'eletronicos', 'fa-solid fa-laptop'],
      ['Moda & Vestuário', 'moda', 'fa-solid fa-shirt'],
      ['Casa & Eletrodomésticos', 'casa', 'fa-solid fa-couch'],
      ['Esportes & Aventura', 'esportes', 'fa-solid fa-futbol'],
      ['Beleza & Cuidados', 'beleza', 'fa-solid fa-spa'],
      ['Brinquedos & Games', 'games', 'fa-solid fa-gamepad']
    ];

    for (const cat of defaultCategories) {
      await run(`INSERT INTO categories (name, slug, icon) VALUES (?, ?, ?)`, cat);
    }
  }

  const productCount = await get(`SELECT COUNT(*) as count FROM products`);
  if (productCount.count === 0) {
    const sampleProducts = [
      {
        name: 'Smart TV 55" 4K UHD Cristal',
        category_id: 1,
        price: 2499.00,
        stock: 14,
        description: 'Televisor inteligente com comandos de voz, HDR dinâmico e aplicativos integrados para streaming.',
        image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=700&q=80'
      },
      {
        name: 'Notebook Ultra Slim 16GB SSD 512GB',
        category_id: 1,
        price: 3890.00,
        stock: 8,
        description: 'Alta produtividade com processador veloz, tela IPS antirreflexo e bateria de até 12 horas.',
        image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=700&q=80'
      },
      {
        name: 'Fone de Ouvido Sem Fio Noise Cancelling',
        category_id: 1,
        price: 349.90,
        stock: 25,
        description: 'Cancelamento ativo de ruído para ouvir suas músicas com fidelidade sonora e graves envolventes.',
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=80'
      },
      {
        name: 'Jaqueta Corta-Vento Streetwear Unissex',
        category_id: 2,
        price: 189.90,
        stock: 30,
        description: 'Tecido impermeável, acabamento reforçado e estilo moderno para todas as estações do ano.',
        image: 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=700&q=80'
      },
      {
        name: 'Tênis Running Air Pro Confort',
        category_id: 2,
        price: 279.00,
        stock: 18,
        description: 'Amortecimento com tecnologia de ar pressurizado, ideal para corridas, caminhadas e uso diário.',
        image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80'
      },
      {
        name: 'Fritadeira Air Fryer Digital 5 Litros',
        category_id: 3,
        price: 399.00,
        stock: 12,
        description: 'Cozinhe alimentos crocantes e saudáveis sem usar óleo. Painel tátil com 8 funções pré-definidas.',
        image: 'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?auto=format&fit=crop&w=700&q=80'
      },
      {
        name: 'Cafeteira Expresso Automática com Moedor',
        category_id: 3,
        price: 850.00,
        stock: 7,
        description: 'Moagem na hora dos grãos com controle de intensidade e bico de vapor para leite cremoso.',
        image: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=700&q=80'
      },
      {
        name: 'Bicicleta Mountain Bike Aro 29 Alumínio',
        category_id: 4,
        price: 1450.00,
        stock: 6,
        description: 'Quadro em liga de alumínio leve, câmbio de 21 marchas e freios a disco de alta precisão.',
        image: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=700&q=80'
      },
      {
        name: 'Kit Perfume Masculino Amadeirado 100ml',
        category_id: 5,
        price: 219.90,
        stock: 22,
        description: 'Fragrância marcante com notas amadeiradas nobres, excelente fixação por até 24 horas.',
        image: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=700&q=80'
      },
      {
        name: 'Console Portátil Retrô HD 10.000 Jogos',
        category_id: 6,
        price: 199.00,
        stock: 35,
        description: 'Relembre clássicos dos consoles antigos com bateria recarregável e conexão para TV.',
        image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=700&q=80'
      }
    ];

    for (const p of sampleProducts) {
      await run(
        `INSERT INTO products (name, category_id, price, stock, description, image) VALUES (?, ?, ?, ?, ?, ?)`,
        [p.name, p.category_id, p.price, p.stock, p.description, p.image]
      );
    }
  }
}

module.exports = {
  db,
  run,
  get,
  all,
  initDatabase
};
