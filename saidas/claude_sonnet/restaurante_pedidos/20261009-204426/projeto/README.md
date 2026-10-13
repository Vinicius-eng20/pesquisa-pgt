# Sistema de Pedidos para Restaurante

Sistema completo de pedidos online para restaurantes com autenticação de usuários, gerenciamento de cardápio e acompanhamento de pedidos em tempo real.

## Requisitos

- Node.js 18 ou superior
- npm (gerenciador de pacotes do Node.js)

## Instalação

1. Instale o Node.js em https://nodejs.org/ (escolha a versão LTS)

2. Abra o terminal/prompt de comando na pasta do projeto

3. Instale as dependências:
```bash
npm install
```

## Executar o projeto

1. Inicie o servidor:
```bash
npm start
```

2. Abra o navegador e acesse:
```
http://localhost:3000
```

## Contas padrão

### Gerente
- Email: gerente@restaurante.com
- Senha: gerente123

### Cliente de teste
- Email: cliente@email.com
- Senha: cliente123

Você pode criar novas contas na tela de registro.

## Funcionalidades

### Para Clientes:
- Ver cardápio completo
- Fazer pedidos
- Acompanhar status dos pedidos
- Histórico de pedidos

### Para Gerente:
- Cadastrar, editar e remover pratos
- Ver todos os pedidos
- Alterar status dos pedidos (Pendente → Preparando → Pronto → Entregue)
- Gerenciar cardápio completo

## Tecnologias utilizadas

- Node.js + Express (backend)
- HTML/CSS/JavaScript (frontend)
- SQLite (banco de dados)
- Autenticação com sessões
