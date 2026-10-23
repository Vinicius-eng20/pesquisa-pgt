# Sistema de Pedidos para Restaurante

Site completo de pedidos para restaurante, com área do cliente e do gerente.

## Como rodar no seu computador

1. Instale o [Node.js](https://nodejs.org) (versão 18 ou superior). É só baixar e instalar, tudo padrão.
2. Abra o terminal (Prompt de Comando no Windows) dentro desta pasta.
3. Rode:

```
npm install
```

4. Depois rode:

```
npm start
```

5. Abra o navegador em: http://localhost:3000

## Como usar na primeira vez

Na primeira vez que o site abre, ele cria automaticamente um usuário gerente:

- **E-mail:** gerente@restaurante.com
- **Senha:** gerente123

Entre com esse usuário, cadastre os pratos do cardápio e depois crie contas de clientes (pela tela de cadastro normal).

**Importante:** troque a senha do gerente depois (ou crie outro gerente e apague este) — mas para começar está funcional.

## Colocar na internet de verdade

O site guarda tudo em um banco de dados SQLite (arquivo `restaurante.db`), dentro da própria pasta do projeto. Para publicar de verdade:

1. Suba este projeto num serviço como **Render**, **Railway** ou **Fly.io** (todos têm plano gratuito).
2. O comando de start é `npm start`. O site usa a variável `PORT` automaticamente.
3. Os dados ficam salvos no arquivo `restaurante.db` — em serviços com disco persistente eles não somem.

## O que cada um pode fazer

**Cliente:**
- Ver o cardápio
- Fazer pedidos (escolher prato e quantidade)
- Acompanhar seus pedidos e o status de cada um

**Gerente:**
- Cadastrar, editar e remover pratos
- Ver todos os pedidos de todos os clientes
- Mudar o status de qualquer pedido

## Estrutura

- `server.js` — servidor principal
- `database.js` — banco de dados e dados iniciais
- `public/` — páginas do site (HTML, CSS, JS)
- `restaurante.db` — arquivo do banco de dados (criado automaticamente)
