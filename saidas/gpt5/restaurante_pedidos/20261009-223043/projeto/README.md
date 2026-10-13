# Sistema de Pedidos para Restaurante

Um site completo para restaurante com:

- Login e cadastro de usuários
- Cliente:
  - Visualizar cardápio
  - Fazer pedidos
  - Acompanhar seus pedidos
- Gerente:
  - Cadastrar, editar e remover pratos
  - Ver todos os pedidos
  - Alterar situação dos pedidos
- Banco de dados próprio usando SQLite
- Dados persistentes no servidor
- Funciona em computador e celular

## Requisitos

Você precisa ter instalado:

- Node.js 20 ou superior
- npm

## Como instalar

No terminal, dentro da pasta do projeto, execute:

```bash
npm install
```

## Como iniciar

```bash
npm start
```

Depois acesse no navegador:

```text
http://localhost:3000
```

## Conta inicial do gerente

Ao iniciar o sistema pela primeira vez, uma conta de gerente é criada automaticamente:

```text
Email: gerente@restaurante.com
Senha: gerente123
```

Você pode usar essa conta para cadastrar os pratos do cardápio.

## Observações importantes

- Os dados ficam salvos no arquivo `database.sqlite`, criado automaticamente.
- Se fechar e abrir o site novamente, os dados continuam salvos.
- Para usar na internet de verdade, instale este projeto em um servidor/VPS próprio com Node.js.
- Não depende de serviços externos.

## Scripts

```bash
npm start
```

Inicia o servidor.

```bash
npm run dev
```

Inicia com reinicialização automática durante desenvolvimento.
