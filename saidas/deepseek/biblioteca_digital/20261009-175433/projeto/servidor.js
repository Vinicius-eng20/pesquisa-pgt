const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORTA = process.env.PORT || 3000;
const ARQUIVO_DADOS = path.join(__dirname, 'dados.json');

app.use(express.json());
app.use(cookieParser());

// ------- Persistência -------
function dadosIniciais() {
  const senha = (s) => bcrypt.hashSync(s, 8);
  return {
    usuarios: [
      { id: 1, nome: 'Bibliotecário', usuario: 'admin', senha: senha('admin123'), papel: 'bibliotecario' },
      { id: 2, nome: 'João Silva', usuario: 'joao', senha: senha('joao123'), papel: 'leitor' },
      { id: 3, nome: 'Maria Souza', usuario: 'maria', senha: senha('maria123'), papel: 'leitor' }
    ],
    itens: [
      { id: 1, titulo: 'Dom Casmurro', autor: 'Machado de Assis', categoria: 'Livro', ano: 1899, disponivel: true },
      { id: 2, titulo: 'O Cortiço', autor: 'Aluísio Azevedo', categoria: 'Livro', ano: 1890, disponivel: true },
      { id: 3, titulo: 'Revista Superinteressante', autor: 'Editora Abril', categoria: 'Revista', ano: 2023, disponivel: true },
      { id: 4, titulo: 'A Origem das Espécies', autor: 'Charles Darwin', categoria: 'Livro', ano: 1859, disponivel: true }
    ],
    emprestimos: [],
    sessoes: {},
    proximoIdUsuario: 4,
    proximoIdItem: 5,
    proximoIdEmprestimo: 1
  };
}

function carregarDados() {
  if (!fs.existsSync(ARQUIVO_DADOS)) {
    const d = dadosIniciais();
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(d, null, 2));
    return d;
  }
  try {
    return JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
  } catch (e) {
    const d = dadosIniciais();
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(d, null, 2));
    return d;
  }
}

function salvarDados(d) {
  fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(d, null, 2));
}

// ------- Autenticação -------
function usuarioLogado(req, dados) {
  const token = req.cookies['sessao'];
  if (!token) return null;
  const id = dados.sessoes[token];
  if (!id) return null;
  return dados.usuarios.find(u => u.id === id) || null;
}

function exigirLogin(req, res, next) {
  const dados = carregarDados();
  const u = usuarioLogado(req, dados);
  if (!u) return res.status(401).json({ erro: 'Não autenticado' });
  req.dados = dados;
  req.usuario = u;
  next();
}

function exigirBibliotecario(req, res, next) {
  if (req.usuario.papel !== 'bibliotecario') {
    return res.status(403).json({ erro: 'Apenas bibliotecário pode fazer isso' });
  }
  next();
}

// ------- Rotas de autenticação -------
app.post('/api/login', (req, res) => {
  const { usuario, senha } = req.body;
  const dados = carregarDados();
  const u = dados.usuarios.find(x => x.usuario === usuario);
  if (!u || !bcrypt.compareSync(senha, u.senha)) {
    return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  dados.sessoes[token] = u.id;
  salvarDados(dados);
  res.cookie('sessao', token, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 30 });
  res.json({ id: u.id, nome: u.nome, usuario: u.usuario, papel: u.papel });
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies['sessao'];
  if (token) {
    const dados = carregarDados();
    delete dados.sessoes[token];
    salvarDados(dados);
  }
  res.clearCookie('sessao');
  res.json({ ok: true });
});

app.get('/api/eu', exigirLogin, (req, res) => {
  res.json({ id: req.usuario.id, nome: req.usuario.nome, usuario: req.usuario.usuario, papel: req.usuario.papel });
});

app.post('/api/registrar', (req, res) => {
  const { nome, usuario, senha } = req.body;
  if (!nome || !usuario || !senha) return res.status(400).json({ erro: 'Preencha todos os campos' });
  const dados = carregarDados();
  if (dados.usuarios.find(u => u.usuario === usuario)) {
    return res.status(400).json({ erro: 'Usuário já existe' });
  }
  const novo = {
    id: dados.proximoIdUsuario++,
    nome,
    usuario,
    senha: bcrypt.hashSync(senha, 8),
    papel: 'leitor'
  };
  dados.usuarios.push(novo);
  salvarDados(dados);
  res.json({ ok: true });
});

// ------- Rotas de itens -------
app.get('/api/itens', exigirLogin, (req, res) => {
  const busca = (req.query.busca || '').toString().toLowerCase();
  let lista = req.dados.itens;
  if (busca) {
    lista = lista.filter(i =>
      i.titulo.toLowerCase().includes(busca) ||
      i.autor.toLowerCase().includes(busca) ||
      i.categoria.toLowerCase().includes(busca)
    );
  }
  res.json(lista);
});

app.post('/api/itens', exigirLogin, exigirBibliotecario, (req, res) => {
  const { titulo, autor, categoria, ano } = req.body;
  if (!titulo || !autor || !categoria) return res.status(400).json({ erro: 'Preencha os campos' });
  const item = {
    id: req.dados.proximoIdItem++,
    titulo,
    autor,
    categoria,
    ano: parseInt(ano) || null,
    disponivel: true
  };
  req.dados.itens.push(item);
  salvarDados(req.dados);
  res.json(item);
});

app.put('/api/itens/:id', exigirLogin, exigirBibliotecario, (req, res) => {
  const id = parseInt(req.params.id);
  const item = req.dados.itens.find(i => i.id === id);
  if (!item) return res.status(404).json({ erro: 'Item não encontrado' });
  const { titulo, autor, categoria, ano } = req.body;
  if (titulo !== undefined) item.titulo = titulo;
  if (autor !== undefined) item.autor = autor;
  if (categoria !== undefined) item.categoria = categoria;
  if (ano !== undefined) item.ano = parseInt(ano) || null;
  salvarDados(req.dados);
  res.json(item);
});

app.delete('/api/itens/:id', exigirLogin, exigirBibliotecario, (req, res) => {
  const id = parseInt(req.params.id);
  const emprestado = req.dados.emprestimos.find(e => e.itemId === id && !e.devolvido);
  if (emprestado) return res.status(400).json({ erro: 'Item está emprestado no momento' });
  const idx = req.dados.itens.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ erro: 'Item não encontrado' });
  req.dados.itens.splice(idx, 1);
  salvarDados(req.dados);
  res.json({ ok: true });
});

// ------- Empréstimos -------
const DIAS_PRAZO = 14;

app.post('/api/emprestimos', exigirLogin, (req, res) => {
  if (req.usuario.papel !== 'leitor') return res.status(403).json({ erro: 'Apenas leitores podem pegar emprestado' });
  const { itemId } = req.body;
  const item = req.dados.itens.find(i => i.id === parseInt(itemId));
  if (!item) return res.status(404).json({ erro: 'Item não encontrado' });
  if (!item.disponivel) return res.status(400).json({ erro: 'Item indisponível' });

  // Bloquear se houver atraso
  const hoje = new Date();
  const atrasos = req.dados.emprestimos.filter(e =>
    e.usuarioId === req.usuario.id && !e.devolvido && new Date(e.prazo) < hoje
  );
  if (atrasos.length > 0) {
    return res.status(403).json({ erro: 'Você tem empréstimos em atraso. Devolva-os antes de pegar novos.' });
  }

  const empr = {
    id: req.dados.proximoIdEmprestimo++,
    usuarioId: req.usuario.id,
    usuarioNome: req.usuario.nome,
    itemId: item.id,
    itemTitulo: item.titulo,
    dataEmprestimo: hoje.toISOString(),
    prazo: new Date(hoje.getTime() + DIAS_PRAZO * 86400000).toISOString(),
    devolvido: false,
    dataDevolucao: null
  };
  item.disponivel = false;
  req.dados.emprestimos.push(empr);
  salvarDados(req.dados);
  res.json(empr);
});

app.post('/api/emprestimos/:id/devolver', exigirLogin, (req, res) => {
  const id = parseInt(req.params.id);
  const empr = req.dados.emprestimos.find(e => e.id === id);
  if (!empr) return res.status(404).json({ erro: 'Empréstimo não encontrado' });
  if (req.usuario.papel !== 'bibliotecario' && empr.usuarioId !== req.usuario.id) {
    return res.status(403).json({ erro: 'Sem permissão' });
  }
  if (empr.devolvido) return res.status(400).json({ erro: 'Já devolvido' });
  empr.devolvido = true;
  empr.dataDevolucao = new Date().toISOString();
  const item = req.dados.itens.find(i => i.id === empr.itemId);
  if (item) item.disponivel = true;
  salvarDados(req.dados);
  res.json(empr);
});

app.get('/api/meus-emprestimos', exigirLogin, (req, res) => {
  const lista = req.dados.emprestimos
    .filter(e => e.usuarioId === req.usuario.id)
    .sort((a, b) => new Date(b.dataEmprestimo) - new Date(a.dataEmprestimo));
  res.json(lista);
});

app.get('/api/emprestimos', exigirLogin, exigirBibliotecario, (req, res) => {
  const lista = req.dados.emprestimos
    .slice()
    .sort((a, b) => new Date(b.dataEmprestimo) - new Date(a.dataEmprestimo));
  res.json(lista);
});

app.get('/api/leitores', exigirLogin, exigirBibliotecario, (req, res) => {
  const hoje = new Date();
  const leitores = req.dados.usuarios
    .filter(u => u.papel === 'leitor')
    .map(u => {
      const atrasados = req.dados.emprestimos.filter(e =>
        e.usuarioId === u.id && !e.devolvido && new Date(e.prazo) < hoje
      ).length;
      const ativos = req.dados.emprestimos.filter(e =>
        e.usuarioId === u.id && !e.devolvido
      ).length;
      return { id: u.id, nome: u.nome, usuario: u.usuario, ativos, atrasados };
    });
  res.json(leitores);
});

// ------- Página principal -------
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORTA, () => {
  console.log('Biblioteca Digital rodando em http://localhost:' + PORTA);
});

---
