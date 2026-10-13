const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: 'segredo-super-seguro-agendamento-123456',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 dias de sessão ativa
      httpOnly: true
    }
  })
);

// Middleware para verificar autenticação
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Você precisa entrar na sua conta.' });
  }
  next();
}

// Middleware para verificar se é Admin/Responsável
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito ao responsável.' });
  }
  next();
}

// ================= ROTAS DE AUTENTICAÇÃO =================

// Obter dados da sessão atual
app.get('/api/auth/me', (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.json({ authenticated: false, user: null });
  }
});

// Cadastro de novos clientes
app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !phone || !password) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }

  const cleanEmail = email.toLowerCase().trim();

  db.get(`SELECT id FROM users WHERE email = ?`, [cleanEmail], (err, existing) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor.' });
    if (existing) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    db.run(
      `INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'client')`,
      [name.trim(), cleanEmail, phone.trim(), passwordHash],
      function (insertErr) {
        if (insertErr) {
          return res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
        }

        const newUser = {
          id: this.lastID,
          name: name.trim(),
          email: cleanEmail,
          phone: phone.trim(),
          role: 'client'
        };

        req.session.user = newUser;
        res.status(201).json({ success: true, user: newUser });
      }
    );
  });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  const cleanEmail = email.toLowerCase().trim();

  db.get(`SELECT * FROM users WHERE email = ?`, [cleanEmail], (err, user) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor.' });
    if (!user) {
      return res.status(400).json({ error: 'E-mail ou senha incorretos.' });
    }

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: 'E-mail ou senha incorretos.' });
    }

    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role
    };

    req.session.user = sessionUser;
    res.json({ success: true, user: sessionUser });
  });
});

// Sair da conta (Logout)
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
  });
});

// ================= ROTAS DE SERVIÇOS =================

// Listar serviços ativos (para clientes e público)
app.get('/api/services', (req, res) => {
  const query = req.session.user && req.session.user.role === 'admin'
    ? `SELECT * FROM services ORDER BY active DESC, name ASC`
    : `SELECT * FROM services WHERE active = 1 ORDER BY name ASC`;

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar serviços.' });
    res.json(rows);
  });
});

// Criar serviço (Admin)
app.post('/api/services', requireAdmin, (req, res) => {
  const { name, description, duration_minutes, price } = req.body;

  if (!name || !duration_minutes || price === undefined) {
    return res.status(400).json({ error: 'Nome, duração e valor são obrigatórios.' });
  }

  db.run(
    `INSERT INTO services (name, description, duration_minutes, price, active) VALUES (?, ?, ?, ?, 1)`,
    [name.trim(), description || '', parseInt(duration_minutes, 10), parseFloat(price)],
    function (err) {
      if (err) return res.status(500).json({ error: 'Erro ao salvar serviço.' });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Editar serviço (Admin)
app.put('/api/services/:id', requireAdmin, (req, res) => {
  const { name, description, duration_minutes, price, active } = req.body;
  const { id } = req.params;

  db.run(
    `UPDATE services SET name = ?, description = ?, duration_minutes = ?, price = ?, active = ? WHERE id = ?`,
    [name.trim(), description || '', parseInt(duration_minutes, 10), parseFloat(price), active ? 1 : 0, id],
    function (err) {
      if (err) return res.status(500).json({ error: 'Erro ao atualizar serviço.' });
      res.json({ success: true });
    }
  );
});

// Excluir serviço (Admin)
app.delete('/api/services/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM services WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao remover serviço.' });
    res.json({ success: true });
  });
});

// ================= HORÁRIOS DE ATENDIMENTO =================

// Listar configuração de horários de funcionamento
app.get('/api/business-hours', (req, res) => {
  db.all(`SELECT * FROM business_hours ORDER BY day_of_week ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar horários.' });
    res.json(rows);
  });
});

// Atualizar configuração de horários (Admin)
app.put('/api/business-hours', requireAdmin, (req, res) => {
  const { schedule } = req.body; // array de { day_of_week, is_open, start_time, end_time, slot_interval }

  if (!Array.isArray(schedule)) {
    return res.status(400).json({ error: 'Dados inválidos.' });
  }

  db.serialize(() => {
    const stmt = db.prepare(
      `UPDATE business_hours SET is_open = ?, start_time = ?, end_time = ?, slot_interval = ? WHERE day_of_week = ?`
    );

    schedule.forEach(day => {
      stmt.run(
        day.is_open ? 1 : 0,
        day.start_time,
        day.end_time,
        parseInt(day.slot_interval, 10) || 30,
        day.day_of_week
      );
    });

    stmt.finalize((err) => {
      if (err) return res.status(500).json({ error: 'Erro ao salvar horários.' });
      res.json({ success: true });
    });
  });
});

// Consultar horários livres para uma data específica
app.get('/api/available-slots', (req, res) => {
  const { date, service_id } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Data não informada.' });
  }

  // Descobrir o dia da semana da data escolhida (YYYY-MM-DD)
  const parts = date.split('-');
  const targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
  const dayOfWeek = targetDate.getDay();

  // Buscar horário de funcionamento desse dia
  db.get(`SELECT * FROM business_hours WHERE day_of_week = ?`, [dayOfWeek], (err, dayConfig) => {
    if (err) return res.status(500).json({ error: 'Erro ao consultar expediente.' });

    if (!dayConfig || dayConfig.is_open === 0) {
      return res.json({ slots: [], message: 'O negócio não abre neste dia da semana.' });
    }

    // Buscar agendamentos existentes neste dia que não foram recusados ou cancelados
    db.all(
      `SELECT appointment_time FROM appointments 
       WHERE appointment_date = ? AND status IN ('pendente', 'confirmado')`,
      [date],
      (errAppointments, bookedRows) => {
        if (errAppointments) {
          return res.status(500).json({ error: 'Erro ao verificar agendamentos existentes.' });
        }

        const bookedTimes = new Set(bookedRows.map(r => r.appointment_time));

        // Gerar todos os slots baseados no intervalo
        const slots = [];
        const [startHour, startMin] = dayConfig.start_time.split(':').map(Number);
        const [endHour, endMin] = dayConfig.end_time.split(':').map(Number);
        const interval = dayConfig.slot_interval || 30;

        let currentMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        // Se a data for hoje, não mostrar horários passados
        const now = new Date();
        const isToday =
          now.getFullYear() === targetDate.getFullYear() &&
          now.getMonth() === targetDate.getMonth() &&
          now.getDate() === targetDate.getDate();
        const currentNowMinutes = now.getHours() * 60 + now.getMinutes();

        while (currentMinutes + interval <= endMinutes) {
          const h = Math.floor(currentMinutes / 60);
          const m = currentMinutes % 60;
          const timeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

          const isPast = isToday && currentMinutes <= currentNowMinutes;

          if (!bookedTimes.has(timeString) && !isPast) {
            slots.push(timeString);
          }

          currentMinutes += interval;
        }

        res.json({ slots, message: slots.length === 0 ? 'Nenhum horário livre restante neste dia.' : null });
      }
    );
  });
});

// ================= ROTAS DE AGENDAMENTOS =================

// Criar novo agendamento (Cliente)
app.post('/api/appointments', requireAuth, (req, res) => {
  const { service_id, appointment_date, appointment_time, notes } = req.body;
  const client_id = req.session.user.id;

  if (!service_id || !appointment_date || !appointment_time) {
    return res.status(400).json({ error: 'Preencha serviço, data e horário.' });
  }

  // Verificar se o horário já não foi pego no mesmo milésimo de segundo
  db.get(
    `SELECT id FROM appointments 
     WHERE appointment_date = ? AND appointment_time = ? AND status IN ('pendente', 'confirmado')`,
    [appointment_date, appointment_time],
    (err, conflict) => {
      if (err) return res.status(500).json({ error: 'Erro no servidor.' });
      if (conflict) {
        return res.status(400).json({ error: 'Desculpe, este horário acabou de ser reservado. Por favor, selecione outro.' });
      }

      db.run(
        `INSERT INTO appointments (client_id, service_id, appointment_date, appointment_time, status, notes) 
         VALUES (?, ?, ?, ?, 'pendente', ?)`,
        [client_id, service_id, appointment_date, appointment_time, notes || ''],
        function (insertErr) {
          if (insertErr) {
            return res.status(500).json({ error: 'Não foi possível salvar o agendamento.' });
          }
          res.json({ success: true, appointment_id: this.lastID });
        }
      );
    }
  );
});

// Listar agendamentos do cliente logado
app.get('/api/appointments/my', requireAuth, (req, res) => {
  const client_id = req.session.user.id;

  const query = `
    SELECT 
      a.id, a.appointment_date, a.appointment_time, a.status, a.notes, a.created_at,
      s.name as service_name, s.duration_minutes, s.price
    FROM appointments a
    JOIN services s ON a.service_id = s.id
    WHERE a.client_id = ?
    ORDER BY a.appointment_date DESC, a.appointment_time DESC
  `;

  db.all(query, [client_id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao carregar agendamentos.' });
    res.json(rows);
  });
});

// Cancelar agendamento (Cliente ou Admin)
app.patch('/api/appointments/:id/cancel', requireAuth, (req, res) => {
  const { id } = req.params;
  const user = req.session.user;

  // Se for cliente, só pode cancelar se for o próprio dono
  const checkQuery = user.role === 'admin'
    ? `SELECT id FROM appointments WHERE id = ?`
    : `SELECT id FROM appointments WHERE id = ? AND client_id = ?`;

  const params = user.role === 'admin' ? [id] : [id, user.id];

  db.get(checkQuery, params, (err, row) => {
    if (err || !row) {
      return res.status(404).json({ error: 'Agendamento não encontrado ou não permitido.' });
    }

    db.run(`UPDATE appointments SET status = 'cancelado' WHERE id = ?`, [id], function (upErr) {
      if (upErr) return res.status(500).json({ error: 'Erro ao cancelar agendamento.' });
      res.json({ success: true });
    });
  });
});

// Listar TODOS os agendamentos (Apenas Responsável / Admin)
app.get('/api/admin/appointments', requireAdmin, (req, res) => {
  const { status, date } = req.query;

  let query = `
    SELECT 
      a.id, a.appointment_date, a.appointment_time, a.status, a.notes, a.created_at,
      s.name as service_name, s.duration_minutes, s.price,
      u.name as client_name, u.phone as client_phone, u.email as client_email
    FROM appointments a
    JOIN services s ON a.service_id = s.id
    JOIN users u ON a.client_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'todos') {
    query += ` AND a.status = ?`;
    params.push(status);
  }

  if (date) {
    query += ` AND a.appointment_date = ?`;
    params.push(date);
  }

  query += ` ORDER BY a.appointment_date ASC, a.appointment_time ASC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao carregar agendamentos do sistema.' });
    res.json(rows);
  });
});

// Atualizar status do agendamento: 'confirmado', 'recusado' (Admin)
app.patch('/api/admin/appointments/:id/status', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['confirmado', 'recusado', 'concluido', 'pendente'].includes(status)) {
    return res.status(400).json({ error: 'Status informado é inválido.' });
  }

  db.run(`UPDATE appointments SET status = ? WHERE id = ?`, [status, id], function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao atualizar status.' });
    res.json({ success: true });
  });
});

// Resumo/Estatísticas do Painel do Admin
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const query = `
    SELECT 
      SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) as pendentes,
      SUM(CASE WHEN status = 'confirmado' THEN 1 ELSE 0 END) as confirmados,
      SUM(CASE WHEN appointment_date = ? AND status IN ('pendente', 'confirmado') THEN 1 ELSE 0 END) as hoje,
      COUNT(*) as total
    FROM appointments
  `;

  db.get(query, [today], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar métricas.' });
    res.json(row || { pendentes: 0, confirmados: 0, hoje: 0, total: 0 });
  });
});

// Retornar a página web principal para qualquer outra rota não encontrada
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`Sistema de Agendamento iniciado com sucesso!`);
  console.log(`Acesse no navegador: http://localhost:${PORT}`);
  console.log(`Conta de Admin padrão: admin@negocio.com / Senha: admin123`);
  console.log(`=======================================================`);
});
