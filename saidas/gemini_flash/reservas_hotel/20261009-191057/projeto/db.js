const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'hotel.json');

function initDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const salt = bcrypt.genSaltSync(10);
    const initialData = {
      users: [
        {
          id: 'usr_admin',
          name: 'Gerente Geral',
          email: 'gerente@hotel.com',
          passwordHash: bcrypt.hashSync('admin123', salt),
          role: 'manager',
          phone: '(11) 99999-0000',
          createdAt: new Date().toISOString()
        },
        {
          id: 'usr_guest',
          name: 'Hóspede Teste',
          email: 'hospede@email.com',
          passwordHash: bcrypt.hashSync('123456', salt),
          role: 'guest',
          phone: '(11) 98888-1111',
          createdAt: new Date().toISOString()
        }
      ],
      rooms: [
        {
          id: 'room_1',
          name: 'Suíte Master Vista Mar',
          category: 'Luxo',
          description: 'Cama King Size, varanda privativa com vista panorâmica do oceano, banheira de hidromassagem e ar-condicionado.',
          pricePerNight: 450,
          capacity: 2,
          imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
          amenities: ['Wi-Fi Grátis', 'Ar-condicionado', 'Hidromassagem', 'Café da manhã incluso', 'Smart TV']
        },
        {
          id: 'room_2',
          name: 'Quarto Família Confort',
          category: 'Família',
          description: 'Espaçoso quarto com 1 cama de casal e 2 de solteiro. Perfeito para viagens familiares confortáveis.',
          pricePerNight: 320,
          capacity: 4,
          imageUrl: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
          amenities: ['Wi-Fi Grátis', 'Ar-condicionado', 'Frigobar', 'Café da manhã incluso', 'Smart TV']
        },
        {
          id: 'room_3',
          name: 'Apartamento Executivo Casal',
          category: 'Standard',
          description: 'Aconchegante, moderno e prático. Mesa de trabalho ergonômica, cama Queen Size e chuveiro a gás.',
          pricePerNight: 210,
          capacity: 2,
          imageUrl: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80',
          amenities: ['Wi-Fi Grátis', 'Ar-condicionado', 'Mesa de Trabalho', 'Smart TV']
        }
      ],
      bookings: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

function readData() {
  initDb();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeData(data) {
  const tempPath = DB_FILE + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, DB_FILE);
}

module.exports = {
  readData,
  writeData,
  initDb
};
