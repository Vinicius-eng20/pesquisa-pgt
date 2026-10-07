# Sistema de Agendamento de Serviços

Este projeto é um sistema completo de agendamento de serviços, pronto para uso na internet.

## Funcionalidades

- **Clientes:**
  - Criar conta e entrar
  - Ver lista de serviços disponíveis
  - Ver horários livres
  - Agendar um serviço
  - Ver e cancelar seus agendamentos
- **Responsável (Admin):**
  - Entrar com conta de administrador
  - Cadastrar, editar e excluir serviços
  - Cadastrar, editar e excluir horários disponíveis
  - Confirmar ou recusar agendamentos
  - Ver todos os agendamentos de todos os clientes

## Tecnologias

- Node.js
- Express
- SQLite (banco de dados local, tudo salvo em arquivo)
- HTML/CSS/JS (frontend simples)

## Como rodar o projeto

### 1. Instalar o Node.js
Baixe e instale o Node.js em https://nodejs.org/

### 2. Instalar as dependências
Abra o terminal na pasta do projeto e rode:
```
npm install
```

### 3. Rodar o servidor
```
node server.js
```

### 4. Acessar o site
Abra o navegador e acesse:
```
http://localhost:3000
```

### 5. Usuário administrador padrão
- **Usuário:** admin
- **Senha:** admin123

> Você pode criar outros usuários pelo site.

## Como publicar na internet

- Você pode hospedar este projeto em qualquer servidor que rode Node.js (ex: Render, Railway, VPS, etc).
- O banco de dados fica salvo no arquivo `database.sqlite` na pasta do projeto.

---
