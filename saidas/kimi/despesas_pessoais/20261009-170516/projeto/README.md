# 💰 Controle de Despesas Pessoais

Sistema completo para gerenciamento de despesas pessoais com sincronização em tempo real.

## 👥 Tipos de Usuários

### 👤 Usuário Comum
- Registrar despesas com descrição, valor, categoria e data
- Organizar gastos por categorias
- Visualizar gastos mensais
- Acesso de qualquer dispositivo (computador/celular)

### 🔐 Administrador
- Criar e gerenciar categorias de gastos
- Ativar/desativar contas de usuários
- Visualizar total de gastos de todos os usuários
- Dashboard administrativo completo

---

## 🛠️ Tecnologias

- **Backend:** Node.js + Express
- **Banco de Dados:** SQLite (arquivo local)
- **Frontend:** HTML5, CSS3, JavaScript
- **Autenticação:** JWT (JSON Web Tokens)
- **Sessões:** Persistência no servidor

---

## 📦 Instalação e Execução

### 1️⃣ Instalar Node.js
Baixe e instale o Node.js: https://nodejs.org (versão 16 ou superior)

### 2️⃣ Instalar Dependências
```bash
cd despesa-pessoal
npm install
```

### 3️⃣ Executar o Servidor
```bash
npm start
```

### 4️⃣ Acessar o Sistema
Abra seu navegador e acesse: `http://localhost:3000`

---

## 🔑 Primeiro Acesso

### Criar Conta de Administrador
1. Acesse `http://localhost:3000`
2. Clique em "Registrar"
3. Preencha os dados e marque "Administrador"
4. Faça login

### Criar Conta de Usuário
1. Acesse `http://localhost:3000`
2. Clique em "Registrar"
3. Preencha os dados (sem marcar "Administrador")
4. Faça login

---

## 📂 Estrutura do Projeto

```
despesa-pessoal/
├── server.js          # Servidor backend
├── database.js        # Configuração do banco de dados
├── package.json       # Dependências do projeto
├── public/            # Arquivos do frontend
│   ├── index.html    # Página principal
│   ├── style.css     # Estilos
│   └── app.js        # Lógica do frontend
└── database.sqlite    # Banco de dados (criado automaticamente)
```

---

## 🌐 Disponibilizar na Internet

Para acessar de qualquer lugar da internet, você precisa:

1. **Opção 1 - Servidor Próprio:** Hospedar em um servidor VPS (AWS, DigitalOcean, etc.)
2. **Opção 2 - Hospedagem Simples:** Usar serviços como:
   - Railway.app
   - Render.com
   - Vercel (com ajustes)
   - Heroku

**Para hospedar:**
```bash
# Instalar PM2 (gerenciador de processos)
npm install -g pm2

# Executar com PM2
pm2 start server.js --name despesa-pessoal
pm2 save
pm2 startup
```

---

## 📱 Funcionalidades

### Para Usuários:
✅ Cadastro e login seguro  
✅ Registrar despesas  
✅ Categorizar gastos  
✅ Ver gastos do mês  
✅ Editar/excluir despesas  
✅ Relatório mensal  
✅ Acesso multiplataforma  

### Para Administradores:
✅ Gerenciar categorias  
✅ Ativar/desativar usuários  
✅ Ver total de gastos  
✅ Dashboard completo  
✅ Estatísticas gerais  

---

## 🔒 Segurança

- Senhas criptografadas com bcrypt
- Autenticação via JWT
- Sessões seguras
- Validação de dados no backend
- Proteção contra SQL Injection

---

## 💾 Backup dos Dados

O banco de dados está em `database.sqlite`. Para fazer backup:

```bash
cp database.sqlite database_backup_$(date +%Y%m%d).sqlite
```

---

## 🆘 Problemas Comuns

### Porta 3000 já em uso
```bash
# Mudar a porta no arquivo server.js, linha:
const PORT = 3001; // ou outra porta disponível
```

### Erro ao instalar dependências
```bash
# Limpar cache e reinstalar
rm -rf node_modules package-lock.json
npm install
```

---

## 📞 Suporte

Para dúvidas ou problemas, verifique:
1. Console do navegador (F12)
2. Logs do servidor no terminal
3. Arquivo de banco de dados existe

---

**✨ Sistema completo e pronto para uso!**
```

```javascript
