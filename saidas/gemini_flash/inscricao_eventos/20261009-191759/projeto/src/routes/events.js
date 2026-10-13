const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// Middleware para verificar se está autenticado
function autenticado(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Faça login para continuar.' });
  }
  const users = db.getUsers();
  const user = users.find(u => u.id === req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Sessão inválida.' });
  }
  req.user = user;
  next();
}

// Middleware para verificar se é organizador
function apenasOrganizador(req, res, next) {
  if (req.user.tipo !== 'organizador') {
    return res.status(403).json({ error: 'Acesso permitido apenas para organizadores.' });
  }
  next();
}

// 1. Listar todos os eventos disponíveis com status da inscrição do usuário atual
router.get('/', (req, res) => {
  const events = db.getEvents();
  const registrations = db.getRegistrations();
  const userId = req.session ? req.session.userId : null;

  // Monta lista de eventos com contagem de vagas ocupadas
  const eventosCompletos = events.map(evt => {
    const inscricoesEvento = registrations.filter(r => r.eventoId === evt.id);
    const estaInscrito = userId ? inscricoesEvento.some(r => r.usuarioId === userId) : false;
    const minhaInscricao = userId ? inscricoesEvento.find(r => r.usuarioId === userId) : null;

    return {
      ...evt,
      totalInscritos: inscricoesEvento.length,
      vagasRestantes: Math.max(0, (parseInt(evt.vagas, 10) || 0) - inscricoesEvento.length),
      estaInscrito,
      presencaConfirmada: minhaInscricao ? minhaInscricao.presencaConfirmada : false
    };
  });

  // Ordena por data
  eventosCompletos.sort((a, b) => new Date(a.data) - new Date(b.data));

  res.json({ eventos: eventosCompletos });
});

// 2. Criar novo evento (Apenas organizador)
router.post('/', autenticado, apenasOrganizador, (req, res) => {
  const { titulo, descricao, categoria, data, local, vagas } = req.body;

  if (!titulo || !data || !local || !vagas) {
    return res.status(400).json({ error: 'Título, data, local e total de vagas são obrigatórios.' });
  }

  const events = db.getEvents();

  const novoEvento = {
    id: 'evt_' + uuidv4(),
    titulo: titulo.trim(),
    descricao: (descricao || '').trim(),
    categoria: (categoria || 'Geral').trim(),
    data: data,
    local: local.trim(),
    vagas: parseInt(vagas, 10) || 50,
    status: 'ativo',
    criadoPor: req.user.id,
    criadoEm: new Date().toISOString()
  };

  events.push(novoEvento);
  db.saveEvents(events);

  res.status(201).json({ mensagem: 'Evento criado com sucesso!', evento: novoEvento });
});

// 3. Editar evento existente (Apenas organizador)
router.put('/:id', autenticado, apenasOrganizador, (req, res) => {
  const { id } = req.params;
  const { titulo, descricao, categoria, data, local, vagas, status } = req.body;

  const events = db.getEvents();
  const index = events.findIndex(e => e.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Evento não encontrado.' });
  }

  const eventoAtual = events[index];

  events[index] = {
    ...eventoAtual,
    titulo: titulo ? titulo.trim() : eventoAtual.titulo,
    descricao: descricao !== undefined ? descricao.trim() : eventoAtual.descricao,
    categoria: categoria ? categoria.trim() : eventoAtual.categoria,
    data: data || eventoAtual.data,
    local: local ? local.trim() : eventoAtual.local,
    vagas: vagas ? parseInt(vagas, 10) : eventoAtual.vagas,
    status: status || eventoAtual.status,
    atualizadoEm: new Date().toISOString()
  };

  db.saveEvents(events);
  res.json({ mensagem: 'Evento atualizado com sucesso!', evento: events[index] });
});

// 4. Cancelar / Alternar status do evento (Apenas organizador)
router.patch('/:id/toggle-status', autenticado, apenasOrganizador, (req, res) => {
  const { id } = req.params;
  const events = db.getEvents();
  const evento = events.find(e => e.id === id);

  if (!evento) {
    return res.status(404).json({ error: 'Evento não encontrado.' });
  }

  evento.status = evento.status === 'cancelado' ? 'ativo' : 'cancelado';
  evento.atualizadoEm = new Date().toISOString();

  db.saveEvents(events);
  res.json({ mensagem: `Evento ${evento.status === 'cancelado' ? 'cancelado' : 'reativado'} com sucesso!`, status: evento.status });
});

// 5. Inscrição do participante no evento
router.post('/:id/inscrever', autenticado, (req, res) => {
  const { id } = req.params;
  const events = db.getEvents();
  const evento = events.find(e => e.id === id);

  if (!evento) {
    return res.status(404).json({ error: 'Evento não encontrado.' });
  }

  if (evento.status === 'cancelado') {
    return res.status(400).json({ error: 'Este evento está cancelado e não aceita inscrições.' });
  }

  const registrations = db.getRegistrations();
  const jaInscrito = registrations.some(r => r.eventoId === id && r.usuarioId === req.user.id);

  if (jaInscrito) {
    return res.status(400).json({ error: 'Você já está inscrito neste evento.' });
  }

  // Verifica lotação
  const totalInscritos = registrations.filter(r => r.eventoId === id).length;
  if (totalInscritos >= parseInt(evento.vagas, 10)) {
    return res.status(400).json({ error: 'Desculpe, as vagas para este evento esgotaram!' });
  }

  const novaInscricao = {
    id: 'reg_' + uuidv4(),
    eventoId: id,
    usuarioId: req.user.id,
    presencaConfirmada: false,
    inscritoEm: new Date().toISOString()
  };

  registrations.push(novaInscricao);
  db.saveRegistrations(registrations);

  res.status(201).json({ mensagem: 'Inscrição confirmada com sucesso!' });
});

// 6. Cancelar inscrição do participante
router.delete('/:id/cancelar-inscricao', autenticado, (req, res) => {
  const { id } = req.params;
  let registrations = db.getRegistrations();

  const inscricao = registrations.find(r => r.eventoId === id && r.usuarioId === req.user.id);
  if (!inscricao) {
    return res.status(404).json({ error: 'Você não possui inscrição ativa neste evento.' });
  }

  registrations = registrations.filter(r => !(r.eventoId === id && r.usuarioId === req.user.id));
  db.saveRegistrations(registrations);

  res.json({ mensagem: 'Sua inscrição foi cancelada com sucesso.' });
});

// 7. Obter "Minhas Inscrições" (para o participante)
router.get('/minhas-inscricoes', autenticado, (req, res) => {
  const events = db.getEvents();
  const registrations = db.getRegistrations();

  const minhasInscricoes = registrations
    .filter(r => r.usuarioId === req.user.id)
    .map(r => {
      const evento = events.find(e => e.id === r.eventoId);
      return {
        inscricaoId: r.id,
        presencaConfirmada: r.presencaConfirmada,
        inscritoEm: r.inscritoEm,
        evento: evento || { titulo: 'Evento Removido', status: 'cancelado' }
      };
    });

  res.json({ inscricoes: minhasInscricoes });
});

// 8. Visualizar todas as inscrições de todos os eventos (Visão geral do Organizador)
router.get('/todas-inscricoes', autenticado, apenasOrganizador, (req, res) => {
  const events = db.getEvents();
  const users = db.getUsers();
  const registrations = db.getRegistrations();

  const listaCompleta = registrations.map(r => {
    const evento = events.find(e => e.id === r.eventoId);
    const participante = users.find(u => u.id === r.usuarioId);

    return {
      inscricaoId: r.id,
      presencaConfirmada: r.presencaConfirmada,
      inscritoEm: r.inscritoEm,
      eventoId: r.eventoId,
      eventoTitulo: evento ? evento.titulo : 'Evento Desconhecido',
      eventoData: evento ? evento.data : '',
      participanteNome: participante ? participante.nome : 'Usuário Desconhecido',
      participanteEmail: participante ? participante.email : '-'
    };
  });

  res.json({ inscricoes: listaCompleta });
});

// 9. Confirmar presença / Check-in de um participante (Apenas organizador)
router.patch('/inscricoes/:inscricaoId/confirmar-presenca', autenticado, apenasOrganizador, (req, res) => {
  const { inscricaoId } = req.params;
  const registrations = db.getRegistrations();
  const inscricao = registrations.find(r => r.id === inscricaoId);

  if (!inscricao) {
    return res.status(404).json({ error: 'Inscrição não encontrada.' });
  }

  // Alterna confirmação de presença (check-in)
  inscricao.presencaConfirmada = !inscricao.presencaConfirmada;
  inscricao.presencaAtualizadaEm = new Date().toISOString();

  db.saveRegistrations(registrations);

  res.json({
    mensagem: inscricao.presencaConfirmada ? 'Presença confirmada com sucesso!' : 'Confirmação de presença desmarcada.',
    presencaConfirmada: inscricao.presencaConfirmada
  });
});

module.exports = router;
