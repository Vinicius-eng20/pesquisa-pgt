# Controle de Despesas Pessoais

Sistema web completo de controle de despesas pessoais com autenticação, categorias e painel administrativo.

## Requisitos

- Node.js 18 ou superior instalado no computador
- Nenhum outro serviço externo é necessário (banco de dados fica em arquivo local)

## Como instalar

1. Abra o terminal (Prompt de Comando no Windows, Terminal no Mac/Linux) na pasta do projeto.
2. Execute o comando abaixo para instalar as dependências:

```
npm install
```

## Como executar

```
npm start
```

Depois de executar, abra o navegador e acesse:

```
http://localhost:3000
```

## Usuário administrador padrão

Na primeira vez que o site rodar, será criado automaticamente um administrador:

- **E-mail:** admin@admin.com
- **Senha:** admin123

**Importante:** troque a senha do administrador após o primeiro acesso (você pode criar um novo admin e desativar o antigo, ou editar o arquivo `data/db.json`).

## Como usar

### Para quem controla os gastos
1. Acesse a página inicial e clique em **Cadastrar**.
2. Crie sua conta com e-mail e senha.
3. Faça login e use o painel para:
   - Registrar gastos (valor, descrição, categoria e data)
   - Ver o total gasto no mês
   - Ver gastos agrupados por categoria
   - Excluir gastos lançados por engano

### Para o administrador
1. Faça login com a conta de administrador.
2. No painel administrativo você pode:
   - Cadastrar novas categorias de gasto
   - Ativar/desativar usuários
   - Ver o total de gastos de todos os usuários

## Onde ficam os dados

Todos os dados ficam salvos no arquivo `data/db.json` dentro da pasta do projeto. Isso significa que mesmo fechando o navegador ou desligando o computador, tudo continua salvo.

Para colocar na internet, hospede este projeto em qualquer serviço que rode Node.js (Render, Railway, Fly.io, VPS, etc). O arquivo de dados persistirá enquanto o disco do servidor for persistente.

## Estrutura

- `server.js` — servidor principal (Express + API + páginas)
- `data/db.json` — banco de dados em arquivo (criado automaticamente)
- `public/` — arquivos estáticos (HTML, CSS, JS do navegador)
- `package.json` — configuração do projeto
