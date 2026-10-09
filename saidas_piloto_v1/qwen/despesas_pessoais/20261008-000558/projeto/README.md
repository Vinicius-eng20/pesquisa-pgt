# Minhas Despesas

Um site para controle de despesas pessoais. Cada pessoa cria a sua conta, registra os gastos, organiza por categoria e vê quanto gastou no mês. O administrador cadastra as categorias, desativa contas de usuários e vê o total de gastos de todos.

**Tudo fica salvo de verdade** — fecha o navegador, abre de novo, os dados continuam lá. As senhas ficam protegidas. Não depende de serviços de login externo (sem Facebook, Google, etc.).

---

## Como funciona

- **Usuário comum:** entra com a conta → registra gastos (descrição, valor, categoria, data) → vê o total do mês, o total geral, e o histórico agrupado por dia com filtros por mês e categoria → exclui o que quiser.
- **Administrador:** além de tudo acima, tem uma aba "Administração" → cadastra e desativa categorias → desativa/reativa contas de usuários → vê o total gasto de todos, o total por usuário e a média por usuário.

---

## O que você precisa (1h no máximo, tudo gratuito)

1. Uma conta gratuita no **Supabase** (é o banco de dados). → [supabase.com](https://supabase.com)
2. Uma conta gratuita no **Cloudflare Workers** (é onde o site fica no ar na internet). → [dash.cloudflare.com](https://dash.cloudflare.com)

O código já está pronto. Você só vai fazer 4 passos: criar o banco, colocar o link dele no site, subir na internet, e cadastrar você como administrador.

> É só clicar e copiar/colar. Se travar em alguma parte, o erro aparece na tela em português.

---

## Passo 1 — Criar o banco de dados (Supabase)

1. Acesse [supabase.com](https://supabase.com) e clique em **Sign up** (crie uma conta grátis com e-mail).
2. Clique em **New project**.
   - *Name:* `minhas-despesas` (qualquer nome)
   - *Database password:* crie uma senha (anote se quiser, mas não é obrigatório)
   - *Region:* a mais próxima do Brasil (ex.: **South America (São Paulo)**)
   - Clique em **Create new project**. Espere uns 2–3 minutos aparecer "ready".
3. No menu lateral esquerdo, clique em **SQL Editor**.
4. Copie **todo** o conteúdo do arquivo `supabase/schema.sql` (deste projeto) e cole na janela SQL.
5. Clique no botão **Run** (rodar). Vai aparecer "Success". Pronto, o banco está criado.

### Agora copie os dois "links" do banco

1. Menu lateral → **Project Settings** (engrenagem) → **API**.
2. Copie a linha **Project URL** (parece `https://abcdefgh.supabase.co`).
3. Copie a linha **service_role** (a **Service Key**) — é uma chave longa. *Use esta e NÃO a "anon public key".*

Guarde as duas. Vamos usá-las agora e no Passo 3.

---

## Passo 2 — Rodar no seu computador (teste rápido)

Isso testa tudo antes de colocar na internet. Precisa ter [Node.js 18 ou mais novo](https://nodejs.org) instalado (no terminal, digite `node -v`).

```bash
# 1) Instale as dependências
npm install

# 2) Configure os dados do seu banco (substitua pelas chaves do Passo 1)
export SUPABASE_URL="https://SEU_PROJETO.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbGciOi..."
# No Windows (cmd), use:
#   set SUPABASE_URL=https://SEU_PROJETO.supabase.co
#   set SUPABASE_SERVICE_KEY=eyJhbGciOi...

# 3) Rode
npm start
```

Abra **http://localhost:8787** no navegador.

- Crie uma conta qualquer (nome, e-mail, senha). Ela já entra como usuário comum.
- Para o **primeiro** usuário virar administrador, faça este comando no terminal **do mesmo lugar** (Substitua `seu-usuario` pelo nome de usuário que você acabou de criar):

```bash
node -e "
import('./src/config.js').then(async ({supabase}) => {
  const { data } = await supabase.from('users').select('id').eq('username', 'seu-usuario').single();
  if (!data) { console.log('usuário não encontrado'); return; }
  await supabase.from('users').update({ is_admin: true }).eq('id', data.id);
  console.log('OK: ' + 'seu-usuario' + ' agora é administrador');
}).catch(e => console.error('ERRO', e.message));
"
```

Agora saia da conta e entre de novo: a aba **Administração** aparece.

Teste: adicione algumas categorias e alguns gastos. Feche o navegador e abra de novo — tudo continua lá. 🎉

---

## Passo 3 — Colocar no ar na internet (Cloudflare Workers)

1. No site do Cloudflare, crie sua conta grátis.
2. Em um terminal, entre na pasta do projeto e execute:

```bash
npm install
npx wrangler login
```

(Segue o link que aparecer para autorizar no navegador.)

3. Crie o worker:

```bash
npx wrangler init controle-de-despesas
```

Se perguntar, pode manter os nomes sugeridos (já existe um `wrangler.toml` configurado — se o `init` reescrever, mantenha as linhas `main = "src/server.js"` e `compatibility_flags = ["nodejs_compat"]`).

4. Cadastre as chaves do Supabase como segredos (a chave nunca fica exposta):

```bash
npx wrangler secret put SUPABASE_URL
# cole a Project URL e Enter
npx wrangler secret put SUPABASE_SERVICE_KEY
# cole a Service Key e Enter
```

5. Publicar:

```bash
npx wrangler deploy
```

O Cloudflare mostra uma **URL pública** (algo como `https://controle-de-despesas.<seu-usuario>.workers.dev`). **Essa é a página do seu site na internet.** Envie para as pessoas usarem.

> Para atualizar o site depois de mudar alguma coisa: rode de novo `npx wrangler deploy`.

---

## Passo 4 — Cadastrar usuários

- **Usuários comuns:** cada pessoa abre o site no link do Passo 3 e clica em **Criar conta**. Fácil.
- **Administrador:** como você já tem um admin criado no Passo 2, ele já funciona. Se precisar criar outro administrador depois, repita o comando `node -e "..."` do Passo 2 com o nome do usuário que quiser promover (ou me peça um script).

---

## Estrutura do projeto

```
public/            ← a parte que o navegador vê (HTML, CSS, JS)
  index.html
  styles.css
  app.js
src/               ← o servidor
  server.js        (rotas e lógica)
  config.js        (liga com o Supabase)
  hash.js          (proteção das senhas)
supabase/
  schema.sql       (cria as tabelas — roda 1x)
wrangler.toml      (configuração do Cloudflare)
```

---

## Solução de problemas

| Problema | Causa provável / solução |
| --- | --- |
| `ERRO: variáveis de ambiente ... não configuradas` | No Passo 2 você esqueceu de rodar os `export`/`set`. Rode de novo antes de `npm start`. |
| `Erro 42P01` ou "relation does not exist" | A tabela não foi criada. Volte ao **Passo 1** e rode o `schema.sql` de novo. |
| `Failed to fetch` ao abrir | Use `http://localhost:8787` (não `https`) no seu computador, ou verifique se o `npm start` está rodando. |
| Não consigo criar conta | Confira se a **Service Key** (e não a anon key) está certa, e se o `schema.sql` rodou com sucesso. |
| Categoria não desativa | Já existe gasto naquela categoria. Exclua os gastos dela primeiro (proteção contra perder dados). |
| Admin não vê a aba | O usuário não foi promovido. Rode o comando `node -e "..."` do Passo 2. |

---

## Segurança (resumo)

- Senhas criptografadas com **bcrypt** (nunca ficam em texto).
- Sessão por cookie `HttpOnly` (o script da página não consegue roubar).
- Regras no banco impedem que um usuário leia os gastos de outro.
- Chaves do banco ficam como *segredos* no Cloudflare, nunca no navegador.
- Endereços de arquivo validados para evitar sair da pasta do site.
