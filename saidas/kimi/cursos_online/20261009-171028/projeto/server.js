require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do banco de dados
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Middleware de autenticação
const autenticar = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ erro: 'Token não fornecido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (erro) {
    return res.status(401).json({ erro: 'Token inválido' });
  }
};

// Middleware para verificar se é admin
const verificarAdmin = (req, res, next) => {
  if (!req.usuario.admin) {
    return res.status(403).json({ erro: 'Acesso negado. Apenas administradores.' });
  }
  next();
};

// ===== ROTAS DE AUTENTICAÇÃO =====

// Registrar usuário
app.post('/api/registrar', async (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
  }

  try {
    // Verificar se email já existe
    const emailExiste = await pool.query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email]
    );

    if (emailExiste.rows.length > 0) {
      return res.status(400).json({ erro: 'Email já cadastrado' });
    }

    // Verificar se é o primeiro usuário (será admin)
    const totalUsuarios = await pool.query('SELECT COUNT(*) FROM usuarios');
    const isPrimeiroUsuario = parseInt(totalUsuarios.rows[0].count) === 0;

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // Inserir usuário
    const resultado = await pool.query(
      'INSERT INTO usuarios (nome, email, senha, admin) VALUES ($1, $2, $3, $4) RETURNING id, nome, email, admin',
      [nome, email, senhaHash, isPrimeiroUsuario]
    );

    const usuario = resultado.rows[0];

    // Gerar token
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, admin: usuario.admin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      mensagem: 'Usuário criado com sucesso',
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        admin: usuario.admin
      }
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar usuário' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
  }

  try {
    const resultado = await pool.query(
      'SELECT id, nome, email, senha, admin FROM usuarios WHERE email = $1',
      [email]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    const usuario = resultado.rows[0];

    // Verificar senha
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    // Gerar token
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, admin: usuario.admin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      mensagem: 'Login realizado com sucesso',
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        admin: usuario.admin
      }
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao fazer login' });
  }
});

// ===== ROTAS DE CURSOS =====

// Listar todos os cursos (público)
app.get('/api/cursos', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT * FROM cursos ORDER BY criado_em DESC'
    );
    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar cursos' });
  }
});

// Buscar curso específico
app.get('/api/cursos/:id', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT * FROM cursos WHERE id = $1',
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Curso não encontrado' });
    }

    res.json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar curso' });
  }
});

// Criar curso (admin)
app.post('/api/cursos', autenticar, verificarAdmin, async (req, res) => {
  const { titulo, descricao, instrutor, duracao } = req.body;

  if (!titulo) {
    return res.status(400).json({ erro: 'Título é obrigatório' });
  }

  try {
    const resultado = await pool.query(
      'INSERT INTO cursos (titulo, descricao, instrutor, duracao) VALUES ($1, $2, $3, $4) RETURNING *',
      [titulo, descricao, instrutor, duracao]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar curso' });
  }
});

// Atualizar curso (admin)
app.put('/api/cursos/:id', autenticar, verificarAdmin, async (req, res) => {
  const { titulo, descricao, instrutor, duracao } = req.body;

  try {
    const resultado = await pool.query(
      'UPDATE cursos SET titulo = $1, descricao = $2, instrutor = $3, duracao = $4, atualizado_em = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [titulo, descricao, instrutor, duracao, req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Curso não encontrado' });
    }

    res.json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar curso' });
  }
});

// Deletar curso (admin)
app.delete('/api/cursos/:id', autenticar, verificarAdmin, async (req, res) => {
  try {
    const resultado = await pool.query(
      'DELETE FROM cursos WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Curso não encontrado' });
    }

    res.json({ mensagem: 'Curso deletado com sucesso' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao deletar curso' });
  }
});

// ===== ROTAS DE MATRÍCULAS =====

// Matricular em um curso (aluno autenticado)
app.post('/api/matriculas', autenticar, async (req, res) => {
  const { curso_id } = req.body;
  const usuario_id = req.usuario.id;

  if (!curso_id) {
    return res.status(400).json({ erro: 'ID do curso é obrigatório' });
  }

  try {
    // Verificar se curso existe
    const cursoExiste = await pool.query(
      'SELECT id FROM cursos WHERE id = $1',
      [curso_id]
    );

    if (cursoExiste.rows.length === 0) {
      return res.status(404).json({ erro: 'Curso não encontrado' });
    }

    // Verificar se já está matriculado
    const jaMatriculado = await pool.query(
      'SELECT id FROM matriculas WHERE usuario_id = $1 AND curso_id = $2',
      [usuario_id, curso_id]
    );

    if (jaMatriculado.rows.length > 0) {
      return res.status(400).json({ erro: 'Você já está matriculado neste curso' });
    }

    // Criar matrícula
    const resultado = await pool.query(
      'INSERT INTO matriculas (usuario_id, curso_id) VALUES ($1, $2) RETURNING *',
      [usuario_id, curso_id]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao realizar matrícula' });
  }
});

// Listar matrículas do usuário logado
app.get('/api/minhas-matriculas', autenticar, async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT m.id, m.data_matricula, c.id as curso_id, c.titulo, c.descricao, c.instrutor, c.duracao
       FROM matriculas m
       JOIN cursos c ON m.curso_id = c.id
       WHERE m.usuario_id = $1
       ORDER BY m.data_matricula DESC`,
      [req.usuario.id]
    );

    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar matrículas' });
  }
});

// Listar todas as matrículas (admin)
app.get('/api/matriculas', autenticar, verificarAdmin, async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT m.id, m.data_matricula, 
              u.id as usuario_id, u.nome as usuario_nome, u.email as usuario_email,
              c.id as curso_id, c.titulo as curso_titulo
       FROM matriculas m
       JOIN usuarios u ON m.usuario_id = u.id
       JOIN cursos c ON m.curso_id = c.id
       ORDER BY m.data_matricula DESC`
    );

    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar matrículas' });
  }
});

// Cancelar matrícula (admin)
app.delete('/api/matriculas/:id', autenticar, verificarAdmin, async (req, res) => {
  try {
    const resultado = await pool.query(
      'DELETE FROM matriculas WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Matrícula não encontrada' });
    }

    res.json({ mensagem: 'Matrícula cancelada com sucesso' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao cancelar matrícula' });
  }
});

// Servir o frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
