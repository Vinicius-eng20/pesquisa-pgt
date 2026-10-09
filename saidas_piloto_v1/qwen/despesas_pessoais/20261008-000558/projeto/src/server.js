import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cookie } from 'cookie';
import { supabase } from './config.js';
import { hashPassword, verifyPassword } from './hash.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT || 8787;
const COOKIE = 'cd_session';

// ---------- helpers ----------
function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function bad(req, res, status, msg) {
  return json(res, status, { ok: false, error: msg });
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) { reject(new Error('muito grande')); req.destroy(); }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new Error('json inválido')); }
    });
    req.on('error', reject);
  });
}
function sendFile(res, file, type) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end('não encontrado'); return; }
    res.writeHead(200, { 'Content-Type': type });
    res.end(buf);
  });
}
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function getCookieValue(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const jar = cookie.parse(raw);
  return jar[name] || null;
}

function parseToken(tok) {
  if (!tok) return null;
  const [aid, payload] = tok.split('.');
  if (!aid || !payload) return null;
  const exp = Number(payload.split('.')[0]);
  if (!exp || Date.now() > exp) return null;
  return { id: aid, exp };
}

function setCookie(res, token, active) {
  res.setHeader('Set-Cookie', cookie.serialize(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: active ? 60 * 60 * 24 * 30 : 0
  }));
}
function clearCookie(res) {
  res.setHeader('Set-Cookie', cookie.serialize(COOKIE, '', {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: 0
  }));
}
function issueToken(user) {
  const exp = Date.now() + 60 * 60 * 24 * 30; // 30 dias
  const payload = `${exp}.${Math.random().toString(36).slice(2)}`;
  return `${user.id}.${payload}`;
}

// ---------- carga do usuário via token ----------
async function loadUser(req) {
  const token = getCookieValue(req, COOKIE);
  const dec = parseToken(token);
  if (!dec) return null;
  const { data } = await supabase.from('users').select('id,username,email,is_admin,is_active').eq('id', dec.id).maybeSingle();
  if (!data) return null;
  if (data.is_active === false) return { ...data, __inactive: true };
  return data;
}

// ---------- validações ----------
function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function str(s, min = 1, max = 100) {
  const v = String(s || '').trim();
  if (v.length < min || v.length > max) return null;
  return v;
}
function toCents(s) {
  if (s === undefined || s === null) return null;
  let t = String(s).trim().replace(/[R$\s]/g, '');
  if (t === '') return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
function safeDate(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// ---------- rotas ----------
const routes = [];
function route(method, path, handler, opts = {}) { routes.push({ method, path, handler, opts }); }

// --- Auth ---
route('POST', '/api/register', async (req, res) => {
  const b = await readBody(req);
  const username = str(b.username, 2, 32);
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  if (!username) return bad(req, res, 400, 'Informe um usuário válido.');
  if (!isEmail(email)) return bad(req, res, 400, 'Informe um e-mail válido.');
  if (password.length < 6) return bad(req, res, 400, 'A senha precisa de pelo menos 6 caracteres.');

  const { data: dup } = await supabase.from('users').select('id').or(`username.eq.${username},email.eq.${email}`).limit(1);
  if (dup && dup.length) return bad(req, res, 409, 'Já existe conta com esse usuário ou e-mail.');

  const { data, error } = await supabase.from('users')
    .insert({ username, email, password_hash: hashPassword(password), is_admin: false, is_active: true })
    .select().single();
  if (error) return bad(req, res, 500, 'Não foi possível criar a conta.');
  setCookie(res, issueToken(data), true);
  return json(res, 200, { ok: true, user: { id: data.id, username: data.username, is_admin: data.is_admin } });
});

route('POST', '/api/login', async (req, res) => {
  const b = await readBody(req);
  const id = str(b.username || b.email || '', 1, 120);
  const password = String(b.password || '');
  if (!id) return bad(req, res, 400, 'Informe usuário/e-mail e senha.');

  let users = [];
  try {
    users = String(b.username || '').trim()
      ? (await supabase.from('users').select('*').eq('username', String(b.username).trim())).data
      : (await supabase.from('users').select('*').eq('email', String(b.email).trim().toLowerCase())).data;
  } catch { users = []; }

  if (!users.length) return bad(req, res, 401, 'Não encontramos essa conta.');
  const user = users[0];
  if (!verifyPassword(password, user.password_hash)) return bad(req, res, 401, 'Senha incorreta.');
  if (user.is_active === false) return bad(req, res, 403, 'Esta conta está desativada. Fale com o administrador.');
  setCookie(res, issueToken(user), true);
  return json(res, 200, { ok: true, user: { id: user.id, username: user.username, is_admin: user.is_admin } });
});

route('POST', '/api/logout', async (req, res) => {
  clearCookie(res);
  return json(res, 200, { ok: true });
});

route('GET', '/api/me', async (req, res) => {
  const u = await loadUser(req);
  if (!u || u.__inactive) return json(res, 200, { ok: true, user: null });
  return json(res, 200, { ok: true, user: { id: u.id, username: u.username, is_admin: u.is_admin } });
});

// --- Gastos (autenticado) ---
route('GET', '/api/expenses', async (req, res) => {
  const u = await loadUser(req);
  if (!u || u.__inactive) return bad(req, res, 401, 'Faça login.');
  const { data, error } = await supabase.from('expenses')
    .select('id,description,amount_cents,spent_on,category:categories(id,name,color)').eq('user_id', u.id)
    .order('spent_on', { ascending: false }).order('created_at', { ascending: false });
  if (error) return bad(req, res, 500, 'Erro ao carregar gastos.');
  return json(res, 200, { ok: true, expenses: data || [] });
});

route('POST', '/api/expenses', async (req, res) => {
  const u = await loadUser(req);
  if (!u || u.__inactive) return bad(req, res, 401, 'Faça login.');
  const b = await readBody(req);
  const description = str(b.description, 1, 120);
  const cents = toCents(b.amount);
  const date = safeDate(b.spent_on) || new Date().toISOString().slice(0, 10);
  const categoryId = str(b.category_id, 36, 36);
  if (!description) return bad(req, res, 400, 'Escreva uma descrição.');
  if (cents === null) return bad(req, res, 400, 'Informe um valor válido (ex.: 25,90).');
  if (!categoryId) return bad(req, res, 400, 'Escolha uma categoria.');

  const { data: cat } = await supabase.from('categories').select('id,is_active').eq('id', categoryId).maybeSingle();
  if (!cat) return bad(req, res, 400, 'Categoria inválida.');
  if (cat.is_active === false) return bad(req, res, 400, 'Essa categoria está desativada.');

  const { data, error } = await supabase.from('expenses')
    .insert({ user_id: u.id, category_id: categoryId, description, amount_cents: cents, spent_on: date })
    .select('id,description,amount_cents,spent_on,category:categories(id,name,color)').single();
  if (error) return bad(req, res, 500, 'Não foi possível salvar o gasto.');
  return json(res, 201, { ok: true, expense: data });
});

route('DELETE', '/api/expenses/:id', async (req, res) => {
  const u = await loadUser(req);
  if (!u || u.__inactive) return bad(req, res, 401, 'Faça login.');
  const id = str(req.params.id, 36, 36);
  if (!id) return bad(req, res, 400, 'ID inválido.');
  const { data, error } = await supabase.from('expenses').delete().eq('id', id).eq('user_id', u.id).select('id');
  if (error) return bad(req, res, 500, 'Erro ao excluir.');
  if (!data || !data.length) return bad(req, res, 404, 'Gasto não encontrado.');
  return json(res, 200, { ok: true });
});

// --- Categorias (autenticado) ---
route('GET', '/api/categories', async (req, res) => {
  const u = await loadUser(req);
  if (!u || u.__inactive) return bad(req, res, 401, 'Faça login.');
  const q = supabase.from('categories').select('id,name,color,is_active').order('name', { ascending: true });
  if (!u.is_admin) q.eq('is_active', true);
  const { data, error } = await q;
  if (error) return bad(req, res, 500, 'Erro ao carregar categorias.');
  return json(res, 200, { ok: true, categories: data || [] });
});

// --- Admin ---
function requireAdmin(req, res, u) {
  if (!u || u.__inactive) return bad(req, res, 401, 'Faça login.');
  if (!u.is_admin) return bad(req, res, 403, 'Acesso restrito ao administrador.');
  return null;
}

route('GET', '/api/admin/overview', async (req, res) => {
  const u = await loadUser(req);
  const err = requireAdmin(req, res, u); if (err) return err;
  const [{ count: userCount }, { data: users }, { data: expenses }] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id,username,is_active'),
    supabase.from('expenses').select('user_id,amount_cents')
  ]);
  const byUser = {};
  for (const e of (expenses || [])) byUser[e.user_id] = (byUser[e.user_id] || 0) + e.amount_cents;
  let total = 0; const active = [];
  const rows = (users || []).map(x => {
    const cents = byUser[x.id] || 0;
    total += cents;
    if (x.is_active) { active.push(x.id); total; }
    return { id: x.id, username: x.username, is_active: x.is_active, total_cents: cents };
  });
  rows.sort((a, b) => b.total_cents - a.total_cents);
  return json(res, 200, {
    ok: true,
    total_cents: total,
    user_count: userCount || 0,
    active_count: active.length,
    avg_cents: active.length ? Math.round(total / active.length) : 0,
    users: rows
  });
});

route('POST', '/api/admin/categories', async (req, res) => {
  const u = await loadUser(req);
  const err = requireAdmin(req, res, u); if (err) return err;
  const b = await readBody(req);
  const name = str(b.name, 1, 40);
  const color = str(b.color, 4, 9) || '#64748B';
  if (!name) return bad(req, res, 400, 'Informe o nome da categoria.');
  const { data: dup } = await supabase.from('categories').select('id').eq('name', name).maybeSingle();
  if (dup) return bad(req, res, 409, 'Já existe uma categoria com esse nome.');
  const { data, error } = await supabase.from('categories')
    .insert({ name, color, is_active: true }).select().single();
  if (error) return bad(req, res, 500, 'Não foi possível criar a categoria.');
  return json(res, 201, { ok: true, category: data });
});

route('PATCH', '/api/admin/categories/:id', async (req, res) => {
  const u = await loadUser(req);
  const err = requireAdmin(req, res, u); if (err) return err;
  const id = str(req.params.id, 36, 36);
  if (!id) return bad(req, res, 400, 'ID inválido.');
  const b = await readBody(req);
  if (typeof b.is_active !== 'boolean') return bad(req, res, 400, 'Payload inválido.');
  if (b.is_active === false) {
    const { count } = await supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('category_id', id);
    if (count > 0) return bad(req, res, 400, 'Não é possível desativar: já existe gasto nessa categoria.');
  }
  const { data, error } = await supabase.from('categories').update({ is_active: b.is_active }).eq('id', id).select().single();
  if (error) return bad(req, res, 500, 'Erro ao atualizar categoria.');
  return json(res, 200, { ok: true, category: data });
});

route('PATCH', '/api/admin/users/:id', async (req, res) => {
  const u = await loadUser(req);
  const err = requireAdmin(req, res, u); if (err) return err;
  const id = str(req.params.id, 36, 36);
  if (!id) return bad(req, res, 400, 'ID inválido.');
  if (id === u.id) return bad(req, res, 400, 'Você não pode desativar a sua própria conta.');
  const b = await readBody(req);
  if (typeof b.is_active !== 'boolean') return bad(req, res, 400, 'Payload inválido.');
  const { data, error } = await supabase.from('users').update({ is_active: b.is_active }).eq('id', id).select().single();
  if (error) return bad(req, res, 500, 'Erro ao atualizar usuário.');
  return json(res, 200, { ok: true, user: { id: data.id, username: data.username, is_active: data.is_active } });
});

// ---------- servidor ----------
function matchPath(pattern, urlPath) {
  const a = pattern.split('/').filter(Boolean);
  const b = urlPath.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

function makeHandler() {
  return async function handler(req, res) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const p = url.pathname;

      if (p.startsWith('/api/')) {
        for (const r of routes) {
          if (r.method !== req.method) continue;
          const params = matchPath(r.path, p);
          if (params === null) continue;
          req.params = params;
          return await r.handler(req, res);
        }
        return bad(req, res, 404, 'Rota não encontrada.');
      }

      let filePath;
      if (p === '/' ) filePath = path.join(PUBLIC_DIR, 'index.html');
      else {
        const clean = p.split('?')[0];
        filePath = path.normalize(path.join(PUBLIC_DIR, clean));
        if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end(); return; }
      }
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        sendFile(res, path.join(PUBLIC_DIR, 'index.html'), 'text/html; charset=utf-8');
        return;
      }
      sendFile(res, filePath, MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
    } catch (e) {
      console.error(e);
      try { bad(req, res, 500, 'Erro interno no servidor.'); } catch {}
    }
  };
}

if (typeof fetch === 'undefined') {
  const http = await import('node:http');
  const server = http.createServer(makeHandler());
  server.listen(PORT, () => console.log(`🌱 Servidor rodando em http://localhost:${PORT}`));
} else {
  const handler = makeHandler();
  export default {
    fetch(req) { return handler(req, { writeHead, end, setHeader }, new URL(req.url)); }
  };
}

function fakeRes() {}
function writeHead(status, headers) {}
function end(body) {}
function setHeader() {}

// wrapper para Cloudflare Workers (req é o Request nativo; adaptamos para our handler)
if (typeof fetch !== 'undefined') {
  const handler = makeHandler();
  export default {
    async fetch(request) {
      const url = new URL(request.url);
      const method = request.method;
      const headersIn = {};
      request.headers.forEach((v, k) => { headersIn[k.toLowerCase()] = v; });
      const reqShim = { url: request.url, method, headers: headersIn };
      const resShim = {
        statusCode: 200, headersOut: new Map(), bodyChunks: [], ended: false,
        writeHead(status, headers) { this.statusCode = status; if (headers) { for (const k in headers) this.headersOut.set(k.toLowerCase(), Array.isArray(headers[k]) ? headers[k].join(', ') : String(headers[k])); } },
        setHeader(k, v) { this.headersOut.set(k.toLowerCase(), String(v)); },
        end(body) { this.bodyChunks.push(body); this.ended = true; }
      };
      await handler(reqShim, resShim);
      const headers = new Headers(resShim.headersOut);
      const body = Buffer.concat(resShim.bodyChunks.map(b => b == null ? [] : Buffer.from(b)));
      return new Response(body.length ? body : null, { status: resShim.statusCode || 200, headers });
    }
  };
}
