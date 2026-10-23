# Plataforma de Cursos Online

Este é um site completo de plataforma de cursos online com sistema de matrículas. Funciona com qualquer navegador moderno (computador e celular).

## Requisitos

- Node.js (versão 14 ou superior)
- PostgreSQL (versão 12 ou superior)

## Instalação

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar o banco de dados

Crie um banco de dados PostgreSQL e execute o script `database.sql`:

```bash
psql -U seu_usuario -d postgres -f database.sql
```

### 3. Configurar variáveis de ambiente

Copie o arquivo `.env.example` para `.env` e edite com suas configurações:

```bash
cp .env.example .env
```

Edite o arquivo `.env`:
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=cursos_online
JWT_SECRET=uma_chave_secreta_bem_segura_aqui
PORT=3000
```

### 4. Executar o projeto

```bash
npm start
```

O site estará disponível em `http://localhost:3000`

## Como usar

### Primeiro acesso

1. Acesse o site no navegador
2. Clique em "Criar conta"
3. Preencha seus dados
4. O primeiro usuário criado será automaticamente o administrador

### Como aluno

- Visualize todos os cursos disponíveis
- Clique em "Matricular" para se inscrever em um curso
- Acesse "Meus Cursos" para ver suas matrículas

### Como administrador

- Acesse o painel administrativo
- Cadastre novos cursos
- Edite cursos existentes
- Remova cursos
- Veja todas as matrículas de todos os alunos
- Cancele matrículas

## Para deixar disponível na internet

Para que o site funcione na internet, você precisa hospedá-lo em um servidor. Opções:

1. **Servidor próprio (VPS)**: Alugue um VPS (DigitalOcean, Linode, AWS EC2) e siga os passos acima
2. **Heroku**: Faça deploy direto com PostgreSQL addon
3. **Railway**: Suporte nativo para Node.js + PostgreSQL

## Tecnologias

- Backend: Node.js + Express
- Banco de dados: PostgreSQL
- Frontend: HTML, CSS, JavaScript (vanilla)
- Autenticação: JWT (JSON Web Tokens)
