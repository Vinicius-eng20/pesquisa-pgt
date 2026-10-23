const express = require('express');
const path = require('path');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const cookieParser = require('cookie-parser');
const db = require('./src/db');
const authRoutes = require('./src/routes/auth');
const eventRoutes = require('./src/routes/events');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializa o banco de dados com dados de exemplo se estiver vazio
db.init();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Sessões persistidas em disco (não desloga ao reiniciar o servidor)
app.use(
  session({
    store: new FileStore({
      path: path.join(__dirname, 'data', 'sessions'),
      ttl: 86400 * 30, // 30 dias de sessão
      retries: 0
    }),
    secret: 'portal-eventos-chave-secreta-segura-2025',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 dias
      httpOnly: true,
      sameSite: 'lax'
    }
  })
);

// Arquivos estáticos da interface web
app.use(express.static(path.join(__dirname, 'public')));

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);

// Rota fallback para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`Portal de Eventos rodando em: http://localhost:${PORT}`);
  console.log(`Acesse de qualquer navegador no seu computador ou rede.`);
  console.log(`====================================================`);
});
