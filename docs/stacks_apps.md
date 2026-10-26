# Stacks das aplicações geradas

Levantamento das tecnologias usadas por cada modelo (vibe coding) e por cada plataforma low-code para produzir as aplicações do experimento, categorizadas em **frontend**, **backend** e **banco de dados / persistência**.

Data do levantamento: 26/10/2026. Replit fora do escopo (ver `README.md`).

## Método

Para cada domínio de cada fonte foi lida a pasta `projeto/` da geração registrada como `gerada`. A classificação usou:

- dependências declaradas (`package.json`, `requirements.txt`);
- estrutura de arquivos (presença de `public/*.html`, `views/`, `templates/*.html`, `src/*.tsx`, migrações);
- leitura do código de inicialização e de acesso a dados (driver de banco, leitura e escrita em arquivo `.json`, uso de `localStorage`, forma como as páginas são entregues).

Convenções usadas nas tabelas:

- **HTML/JS (vanilla):** páginas HTML estáticas com JavaScript puro, servidas pelo backend, que consomem a API por `fetch`.
- **EJS / Jinja2:** páginas renderizadas no servidor a partir de templates.
- **Arquivo JSON:** os dados ficam em um ou mais arquivos `.json` lidos e regravados pelo próprio servidor, sem SGBD.
- **SQLite (better-sqlite3)** e **SQLite (sqlite3)** indicam o driver Node usado.

---

## 1. Vibe coding

### 1.1 claude_sonnet (`anthropic/claude-sonnet-4.5`)

| Domínio | Frontend | Backend | Banco / persistência | Observações |
|---|---|---|---|---|
| agendamento_servicos | HTML/JS (vanilla) | Node.js + Express | SQLite (better-sqlite3) | |
| biblioteca_digital | HTML/JS (vanilla) | Node.js + Express | SQLite (better-sqlite3) | Sessões em SQLite (connect-sqlite3) |
| cursos_online | HTML/JS (vanilla), 5 páginas | Node.js + Express | SQLite (better-sqlite3) | |
| despesas_pessoais | HTML/JS (vanilla) | Node.js + Express | SQLite (sqlite3) | |
| inscricao_eventos | HTML/JS (vanilla) | Node.js + Express | Arquivo JSON | |
| loja_departamentos | HTML/JS (vanilla) | Node.js + Express | SQLite (better-sqlite3) | |
| marketplace_freelance | HTML/JS (vanilla), 3 páginas | Node.js + Express | Arquivo JSON (`database.json`) | |
| reservas_hotel | HTML/JS (vanilla), 5 páginas | Node.js + Express | Arquivo JSON (`users`, `rooms`, `reservations`) | |
| restaurante_pedidos | HTML/JS (vanilla) | Node.js + Express | SQLite (better-sqlite3) | |
| tarefas_equipe | HTML/JS (vanilla) | Node.js + Express | Arquivo JSON | |

### 1.2 deepseek (`deepseek/deepseek-v4.1-flash`)

| Domínio | Frontend | Backend | Banco / persistência | Observações |
|---|---|---|---|---|
| agendamento_servicos | HTML/JS (vanilla) | Node.js + Express | SQLite (better-sqlite3) | |
| biblioteca_digital | HTML/JS (vanilla) | Node.js + Express | Arquivo JSON (`dados.json`) | Correção de build aplicada: texto excedente removido do `package.json` |
| cursos_online | EJS | Node.js + Express | SQLite (sqlite3) | Sessões em SQLite (connect-sqlite3) |
| despesas_pessoais | EJS | Node.js + Express | SQLite (sqlite3) | Sessões em SQLite (connect-sqlite3) |
| inscricao_eventos | HTML/JS (vanilla) | Node.js + Express | SQLite (sqlite3) | |
| loja_departamentos | HTML/JS (vanilla) | Node.js + Express | SQLite (better-sqlite3) | |
| marketplace_freelance | HTML/JS (vanilla) | Node.js + Express | Arquivo JSON | |
| reservas_hotel | HTML/JS (vanilla) | Node.js + Express | SQLite (better-sqlite3) | |
| restaurante_pedidos | HTML/JS (vanilla) | Node.js + Express | SQLite (better-sqlite3) | Correção de build aplicada: `better-sqlite3` atualizado para `^13.0.3` |
| tarefas_equipe | HTML/JS (vanilla) | Node.js + Express | SQLite (sqlite3) | |

### 1.3 gemini_flash (`google/gemini-3.8-flash`)

| Domínio | Frontend | Backend | Banco / persistência | Observações |
|---|---|---|---|---|
| agendamento_servicos | HTML/JS (vanilla) | Node.js + Express | SQLite (sqlite3) | |
| biblioteca_digital | Jinja2 (templates) | Python + Flask | SQLite (módulo `sqlite3` do Python) | |
| cursos_online | HTML/JS (vanilla) | Node.js + Express | Arquivo JSON | |
| despesas_pessoais | HTML/JS (vanilla) | Node.js + Express | SQLite (sqlite3) | |
| inscricao_eventos | HTML/JS (vanilla) | Node.js + Express | Arquivo JSON | Sessões em arquivo (session-file-store) |
| loja_departamentos | HTML/JS (vanilla) | Node.js + Express | SQLite (sqlite3) | Upload de arquivos (multer) |
| marketplace_freelance | HTML/JS (vanilla) | Node.js + Express | SQLite (better-sqlite3) | |
| reservas_hotel | HTML/JS (vanilla) | Node.js + Express | Arquivo JSON | |
| restaurante_pedidos | Jinja2 (template único com JS) | Python + Flask | SQLite (módulo `sqlite3` do Python) | |
| tarefas_equipe | HTML/JS (vanilla) | Node.js + Express | SQLite (sqlite3) | |

### 1.4 gpt5 (`openai/gpt-5.5`)

| Domínio | Frontend | Backend | Banco / persistência | Observações |
|---|---|---|---|---|
| agendamento_servicos | EJS | Node.js + Express | SQLite (better-sqlite3) | Sessões em SQLite (connect-sqlite3) |
| biblioteca_digital | EJS | Node.js + Express | SQLite (better-sqlite3) | Sessões em SQLite |
| cursos_online | EJS | Node.js + Express | SQLite (better-sqlite3) | Sessões em SQLite |
| despesas_pessoais | HTML/JS (vanilla), 5 páginas | Node.js + Express | SQLite (better-sqlite3) | Sessões em SQLite |
| inscricao_eventos | EJS | Node.js + Express | SQLite (better-sqlite3) | Sessões em SQLite; usa `helmet` |
| loja_departamentos | EJS | Node.js + Express | SQLite (better-sqlite3) | Sessões em SQLite |
| marketplace_freelance | EJS | Node.js + Express | SQLite (sqlite3) | Sessões em SQLite |
| reservas_hotel | HTML/JS (vanilla) | Node.js + Express | SQLite (better-sqlite3) | Sessões em SQLite |
| restaurante_pedidos | EJS | Node.js + Express | SQLite (better-sqlite3) | Sessões em SQLite; usa `helmet` |
| tarefas_equipe | EJS | Node.js + Express | SQLite (better-sqlite3) | Sessões em SQLite |

### 1.5 kimi (`moonshotai/kimi-k3`)

| Domínio | Frontend | Backend | Banco / persistência | Observações |
|---|---|---|---|---|
| agendamento_servicos | HTML/JS (vanilla) | Node.js + Express | SQLite (sqlite3) | |
| biblioteca_digital | HTML/JS (vanilla) | Node.js + Express | SQLite (better-sqlite3) | |
| cursos_online | HTML/JS (vanilla) | Node.js + Express | **PostgreSQL** (pg) | Traz script `.sql` e `.env.example` |
| despesas_pessoais | HTML/JS (vanilla) | Node.js + Express | SQLite (sqlite3) | Correção de build aplicada: resto de cerca Markdown removido do `package.json` |
| inscricao_eventos | HTML/JS (vanilla) | Node.js + Express | SQLite (sqlite3) | |
| loja_departamentos | HTML/JS (vanilla), 2 páginas | Node.js + Express | SQLite (sqlite3) | Sessões em SQLite (connect-sqlite3) |
| marketplace_freelance | HTML/JS (vanilla) | Node.js + Express | SQLite (better-sqlite3) | |
| reservas_hotel | HTML/JS (vanilla) | Node.js + Express | SQLite (better-sqlite3) | Usa `helmet` e `compression` |
| restaurante_pedidos | HTML/JS (vanilla) | Node.js + Express | SQLite (better-sqlite3) | Sessões em SQLite (connect-sqlite3); usa `helmet` |
| tarefas_equipe | HTML/JS (vanilla) | Node.js + Express | Arquivo JSON (`users`, `tasks`) | |

### 1.6 qwen (`qwen/qwen3.8-27b`)

| Domínio | Frontend | Backend | Banco / persistência | Observações |
|---|---|---|---|---|
| agendamento_servicos | EJS (em arquivos `.html`) | Node.js + Express | SQLite (sqlite3) | Ver nota abaixo: os templates não são renderizados |
| biblioteca_digital | Jinja2 (templates) | Python + FastAPI (uvicorn) | Arquivo JSON (`dados.json`) | |
| cursos_online | HTML/JS (vanilla) | Node.js + Express | Arquivo JSON (`db.json`) | |
| despesas_pessoais | HTML/JS (vanilla), 3 páginas | Node.js + Express | **MongoDB** (driver oficial), com fallback em arquivos JSON | |
| inscricao_eventos | HTML/JS (vanilla) | Node.js + Express | Arquivo JSON (`data.json`) | |
| loja_departamentos | HTML/JS (vanilla) | Node.js + Express | Arquivo JSON (`db.json`) | |
| marketplace_freelance | React + TypeScript (Vite) | Node.js + Express | SQLite (sqlite3) | Única SPA com framework no grupo vibe coding |
| reservas_hotel | HTML/JS (vanilla), servido como estático pelo Flask | Python + Flask | SQLite (módulo `sqlite3` do Python) | Importa `htmx` no JavaScript |
| restaurante_pedidos | HTML/JS (vanilla) | Node.js + Express | SQLite (better-sqlite3) | |
| tarefas_equipe | HTML/JS (vanilla) | Node.js + Express | Arquivo JSON (lowdb, `data.json`) | |

**Nota sobre qwen/agendamento_servicos.** As 8 páginas em `views/` contêm tags EJS (`<% ... %>`), e o `ejs` está declarado no `package.json`, mas o servidor não configura o EJS como motor de templates: entrega as páginas com `res.sendFile`, que envia o arquivo sem processá-lo. Na execução, as páginas devem chegar ao navegador com o código do template visível e sem os dados. O problema é de lógica de renderização, não de build, e precisa ser confirmado ao subir a aplicação.

### 1.7 Consolidado do grupo vibe coding (60 aplicações)

**Frontend**

| Stack | claude | deepseek | gemini | gpt5 | kimi | qwen | Total |
|---|---|---|---|---|---|---|---|
| HTML/JS (vanilla) | 10 | 8 | 8 | 2 | 10 | 7 | **45** |
| EJS (renderizado no servidor) | 0 | 2 | 0 | 8 | 0 | 1 | **11** |
| Jinja2 (Flask/FastAPI) | 0 | 0 | 2 | 0 | 0 | 1 | **3** |
| React + TypeScript (Vite) | 0 | 0 | 0 | 0 | 0 | 1 | **1** |

**Backend**

| Stack | claude | deepseek | gemini | gpt5 | kimi | qwen | Total |
|---|---|---|---|---|---|---|---|
| Node.js + Express | 10 | 10 | 8 | 10 | 10 | 8 | **56** |
| Python + Flask | 0 | 0 | 2 | 0 | 0 | 1 | **3** |
| Python + FastAPI | 0 | 0 | 0 | 0 | 0 | 1 | **1** |

**Banco de dados / persistência**

| Stack | claude | deepseek | gemini | gpt5 | kimi | qwen | Total |
|---|---|---|---|---|---|---|---|
| SQLite | 6 | 8 | 7 | 10 | 8 | 4 | **43** |
| Arquivo JSON | 4 | 2 | 3 | 0 | 1 | 5 | **15** |
| MongoDB | 0 | 0 | 0 | 0 | 0 | 1 | **1** |
| PostgreSQL | 0 | 0 | 0 | 0 | 1 | 0 | **1** |

Padrão dominante: **Express + SQLite + páginas HTML com JavaScript puro**. O GPT-5 é o único que prefere renderização no servidor (EJS) e o único que usa SQLite em todas as aplicações. O Qwen é o modelo com stacks mais variadas (Express, Flask e FastAPI; HTML puro, EJS, Jinja2 e React; SQLite, arquivos JSON e MongoDB). Arquivos JSON como banco aparecem em cinco dos seis modelos e são mais frequentes no Qwen e no Claude.

---

## 2. Low-code

### 2.1 Bolt.new (10 aplicações)

As dez aplicações seguem a mesma stack, derivada do template `bolt-vite-react-ts`:

| Camada | Stack |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS (SPA) |
| Backend | Nenhum backend próprio: o navegador acessa o **Supabase** diretamente (Supabase Auth + API REST/PostgREST). Sem Edge Functions |
| Banco | PostgreSQL (Supabase) com políticas **RLS**; schema em migrações SQL (`supabase/migrations/`), 16 arquivos no total |

| Domínio | Observações |
|---|---|
| loja_departamentos | Usa `react-router-dom`; carrinho em `localStorage` |
| demais 9 domínios | Stack idêntica à descrita acima |

### 2.2 Lovable (10 aplicações)

As dez aplicações seguem a mesma stack, derivada do template `tanstack_start_ts`:

| Camada | Stack |
|---|---|
| Frontend | React 19 + TypeScript + **TanStack Start** (SSR) + TanStack Router/Query + Tailwind CSS 4 + shadcn/ui (Radix) |
| Backend | Servidor SSR em Node (Nitro), sem lógica de negócio própria; os dados são acessados no **Supabase** (Auth + API REST/PostgREST + funções SQL `SECURITY DEFINER`). Sem Edge Functions |
| Banco | PostgreSQL (Supabase) com políticas **RLS**; schema via **Drizzle** (`drizzle/migrations/`, uma migração por aplicação) |
| Gerenciador de pacotes | bun (`bun.lock`) |

| Domínio | Autenticação do Lovable Cloud (`@lovable.dev/cloud-auth-js`) | Funções SQL próprias além de `handle_new_user` e `has_role` |
|---|---|---|
| agendamento_servicos | Sim | |
| biblioteca_digital | Sim | |
| cursos_online | Sim | |
| despesas_pessoais | Não | |
| inscricao_eventos | Não | |
| loja_departamentos | Sim | |
| marketplace_freelance | Sim | |
| reservas_hotel | Sim | `available_rooms`, `validate_booking` |
| restaurante_pedidos | Não | `place_order` (total calculado no banco) |
| tarefas_equipe | Sim | `guard_task_update` |

---

## 3. Comparação entre os grupos

| Camada | Vibe coding (padrão dominante) | Low-code (Bolt e Lovable) |
|---|---|---|
| Frontend | HTML com JavaScript puro servido pelo backend (45 de 60) | React + TypeScript com Vite (Bolt) ou TanStack Start com SSR (Lovable) |
| Backend | Servidor próprio escrito pelo modelo (Express em 56 de 60) | Sem backend escrito; regras ficam no Supabase |
| Banco | SQLite local (43 de 60) ou arquivo JSON (15 de 60) | PostgreSQL gerenciado (Supabase) com RLS |
| Onde fica o controle de acesso | Código do servidor (middlewares, rotas) | Políticas RLS e funções SQL no banco |

Implicações para a execução e o pentest:

- O perfil local precisa cobrir **MongoDB** (qwen/despesas_pessoais) e **PostgreSQL** (kimi/cursos_online), além de SQLite, arquivos JSON, Python (Flask e FastAPI) e Supabase CLI.
- **qwen/agendamento_servicos** pode não exibir as páginas corretamente por causa dos templates não renderizados (ver nota na seção 1.6).
- Nas aplicações low-code, o alvo principal do teste é a configuração de RLS; nas de vibe coding, é o código do servidor (ver `pentests.md`).
