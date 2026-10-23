const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const REGISTRATIONS_FILE = path.join(DATA_DIR, 'registrations.json');

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJSON(file, fallback = []) {
  try {
    if (!fs.existsSync(file)) {
      return fallback;
    }
    const content = fs.readFileSync(file, 'utf-8');
    return JSON.parse(content || '[]');
  } catch (err) {
    console.error(`Erro ao ler ${file}:`, err);
    return fallback;
  }
}

function writeJSON(file, data) {
  try {
    ensureDirSync(path.dirname(file));
    const tempFile = `${file}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, file);
  } catch (err) {
    console.error(`Erro ao escrever em ${file}:`, err);
  }
}

const db = {
  init() {
    ensureDirSync(DATA_DIR);
    ensureDirSync(path.join(DATA_DIR, 'sessions'));

    const users = readJSON(USERS_FILE, []);
    const events = readJSON(EVENTS_FILE, []);
    const registrations = readJSON(REGISTRATIONS_FILE, []);

    // Criar contas padrão caso o banco esteja novo
    if (users.length === 0) {
      const salt = bcrypt.genSaltSync(10);
      const defaultUsers = [
        {
          id: 'user_organizador_padrao',
          nome: 'Carlos Organizador',
          email: 'organizador@portal.com',
          senhaHash: bcrypt.hashSync('senha123', salt),
          tipo: 'organizador',
          criadoEm: new Date().toISOString()
        },
        {
          id: 'user_participante_padrao',
          nome: 'Ana Participante',
          email: 'participante@portal.com',
          senhaHash: bcrypt.hashSync('senha123', salt),
          tipo: 'participante',
          criadoEm: new Date().toISOString()
        }
      ];
      writeJSON(USERS_FILE, defaultUsers);

      // Eventos iniciais de exemplo
      if (events.length === 0) {
        const defaultEvents = [
          {
            id: 'evt_1',
            titulo: 'Conferência de Inovação & Tecnologia 2025',
            descricao: 'Um dia imersivo com palestras sobre o futuro digital, inteligência artificial e novos modelos de negócios.',
            categoria: 'Tecnologia',
            data: '2025-06-15T09:00',
            local: 'Auditório Central de Convenções ou Transmissão Online',
            vagas: 150,
            status: 'ativo', // ativo, cancelado
            criadoPor: 'user_organizador_padrao',
            criadoEm: new Date().toISOString()
          },
          {
            id: 'evt_2',
            titulo: 'Workshop Prático: Gestão e Produtividade',
            descricao: 'Treinamento focado em técnicas práticas de liderança, comunicação assertiva e rotinas produtivas.',
            categoria: 'Carreira',
            data: '2025-07-20T14:30',
            local: 'Sala 4B - Centro Empresarial Paulista',
            vagas: 40,
            status: 'ativo',
            criadoPor: 'user_organizador_padrao',
            criadoEm: new Date().toISOString()
          },
          {
            id: 'evt_3',
            titulo: 'Festival Gastronômico da Cidade',
            descricao: 'Encontro com chefs locais, degustações e música ao vivo para toda a comunidade.',
            categoria: 'Cultura & Lazer',
            data: '2025-08-05T18:00',
            local: 'Praça das Flores - Setor Histórico',
            vagas: 200,
            status: 'ativo',
            criadoPor: 'user_organizador_padrao',
            criadoEm: new Date().toISOString()
          }
        ];
        writeJSON(EVENTS_FILE, defaultEvents);

        // Inscrição inicial de exemplo
        const defaultRegistrations = [
          {
            id: 'reg_1',
            eventoId: 'evt_1',
            usuarioId: 'user_participante_padrao',
            presencaConfirmada: false,
            inscritoEm: new Date().toISOString()
          }
        ];
        writeJSON(REGISTRATIONS_FILE, defaultRegistrations);
      }
    }
  },

  getUsers() {
    return readJSON(USERS_FILE, []);
  },

  saveUsers(users) {
    writeJSON(USERS_FILE, users);
  },

  getEvents() {
    return readJSON(EVENTS_FILE, []);
  },

  saveEvents(events) {
    writeJSON(EVENTS_FILE, events);
  },

  getRegistrations() {
    return readJSON(REGISTRATIONS_FILE, []);
  },

  saveRegistrations(registrations) {
    writeJSON(REGISTRATIONS_FILE, registrations);
  }
};

module.exports = db;
