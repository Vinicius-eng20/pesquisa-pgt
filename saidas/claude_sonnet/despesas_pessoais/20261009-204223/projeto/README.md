# Controle de Despesas Pessoais

Sistema completo de controle de despesas com autenticação de usuários e painel administrativo.

## Requisitos

- Node.js 18 ou superior
- NPM ou Yarn

## Instalação

```bash
npm install
```

## Executar o projeto

```bash
npm start
```

O site estará disponível em: http://localhost:3000

## Primeiro acesso

### Conta Administrador (já criada):
- Email: admin@sistema.com
- Senha: admin123

### Criar conta de usuário:
- Clique em "Criar conta" na tela de login
- Preencha seus dados
- Faça login com suas credenciais

## Funcionalidades

### Usuários:
- Registrar despesas
- Organizar por categorias
- Ver total gasto no mês
- Acesso de qualquer dispositivo

### Administrador:
- Cadastrar categorias
- Desativar usuários
- Ver total de gastos de todos

## Estrutura

- Backend: Node.js + Express
- Banco de dados: SQLite (arquivo local)
- Frontend: HTML, CSS, JavaScript puro
- Autenticação: JWT + Bcrypt

Todos os dados ficam salvos no arquivo `database.sqlite` na pasta do projeto.
