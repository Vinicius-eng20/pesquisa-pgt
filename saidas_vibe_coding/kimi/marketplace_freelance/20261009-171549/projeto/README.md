# FreelaHub - Marketplace de Serviços Freelance

Um marketplace completo e autocontido para contratação de serviços freelance, com painel administrativo integrado.

## Funcionalidades

### Para Usuários (Freelancers e Contratantes)
- **Cadastro e Login**: Crie sua conta e acesse de qualquer dispositivo
- **Publicar Serviços**: Ofereça seus serviços com título, descrição, preço e categoria
- **Explorar Marketplace**: Busque e filtre serviços por categoria ou palavra-chave
- **Contratar Serviços**: Contrate serviços de outros usuários com um clique
- **Gerenciar Contratos**: Acompanhe seus contratos como cliente ou prestador
- **Editar/Excluir**: Gerencie seus próprios serviços (exceto com contratos ativos)

### Para Administradores
- **Moderação de Conteúdo**: Aprove, rejeite ou remova serviços publicados
- **Gestão de Usuários**: Visualize todos os usuários, suspenda ou reative contas
- **Visão Geral**: Acesse todos os serviços e contratos da plataforma
- **Estatísticas**: Veja quantidade de serviços e contratos por usuário

## Requisitos do Sistema

- Node.js 16 ou superior
- npm (gerenciador de pacotes do Node)

## Instalação e Execução

### 1. Instalar Dependências
```bash
npm install
```

### 2. Iniciar o Servidor
```bash
npm start
```

O servidor iniciará na porta 3000. Acesse:
```
http://localhost:3000
```

### 3. Primeiro Acesso

**Administrador Padrão:**
- Email: `admin@marketplace.com`
- Senha: `admin123`

**Para testar como usuário:**
1. Clique em "Cadastrar"
2. Crie uma nova conta com seu email
3. Publique serviços e explore o marketplace

## Estrutura do Projeto

```
├── server.js          # Backend (API REST + Banco de Dados)
├── package.json       # Dependências do projeto
├── marketplace.db     # Banco de dados SQLite (criado automaticamente)
└── public/
    └── index.html     # Frontend (SPA - Single Page Application)
```

## Tecnologias Utilizadas

- **Backend**: Node.js + Express
- **Banco de Dados**: SQLite (better-sqlite3) - Arquivo local, sem necessidade de instalar nada extra
- **Autenticação**: JWT (JSON Web Tokens)
- **Frontend**: HTML5, CSS3, JavaScript Vanilla (sem dependências externas)
- **Segurança**: Senhas criptografadas com bcrypt, validação de dados, proteção contra SQL Injection

## Recursos de Persistência

- **Dados salvos localmente**: Tudo fica armazenado no arquivo `marketplace.db`
- **Sincronização automática**: Acesse de qualquer dispositivo e veja os mesmos dados
- **Transações seguras**: Uso de WAL (Write-Ahead Logging) para garantir integridade
- **Backup**: Basta copiar o arquivo `marketplace.db` para fazer backup

## API Endpoints

### Públicos
- `POST /api/register` - Criar conta
- `POST /api/login` - Fazer login

### Usuários Autenticados
- `GET /api/services` - Listar serviços aprovados
- `POST /api/services` - Criar novo serviço
- `GET /api/my-services` - Meus serviços
- `PUT /api/services/:id` - Editar serviço
- `DELETE /api/services/:id` - Excluir serviço
- `POST /api/contracts` - Contratar serviço
- `GET /api/my-contracts` - Meus contratos
- `PUT /api/contracts/:id/status` - Atualizar status do contrato

### Administradores
- `GET /api/admin/services` - Todos os serviços (com filtros)
- `PUT /api/admin/services/:id/status` - Aprovar/Rejeitar/Remover serviço
- `GET /api/admin/users` - Listar todos os usuários
- `PUT /api/admin/users/:id/status` - Suspender/Reativar usuário
- `GET /api/admin/contracts` - Todos os contratos

## Segurança

- Senhas nunca são armazenadas em texto plano (hash bcrypt)
- Tokens JWT expiram e são validados em cada requisição
- Proteção contra SQL Injection usando prepared statements
- Validação de dados em todas as entradas
- Controle de acesso por roles (usuário vs administrador)
- Usuários suspensos não podem acessar o sistema

## Observações Importantes

1. **Banco de Dados**: O SQLite é perfeito para este caso de uso. Os dados persistem mesmo reiniciando o servidor.

2. **Deploy**: Para colocar na internet, você precisará de um servidor (VPS, AWS, etc.) e configurar um domínio. O projeto está pronto para produção.

3. **Backup**: Faça backup regular do arquivo `marketplace.db`.

4. **Senha do Admin**: Altere a senha padrão do administrador após o primeiro login.

## Suporte

Este é um sistema completo e funcional. Todos os dados são armazenados localmente no servidor, permitindo acesso simultâneo de múltiplos dispositivos com sincronização em tempo real.
