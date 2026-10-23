# Sistema de Reservas de Hotel

Sistema completo de reservas de hotel com área para hóspedes e gerente. Todos os dados ficam salvos em um banco de dados no servidor, permitindo acesso de qualquer dispositivo.

## Funcionalidades

### Para Hóspedes:
- Criar conta e fazer login
- Buscar quartos disponíveis por data
- Fazer reservas
- Ver suas reservas
- Cancelar reservas

### Para Gerente:
- Cadastrar, editar e remover quartos
- Ver todas as reservas
- Confirmar ou recusar reservas pendentes
- Gerenciar disponibilidade

## Instalação

### Requisitos:
- Node.js 18 ou superior ([baixe aqui](https://nodejs.org))

### Passo a passo:

1. **Instalar as dependências:**
```bash
npm install
```

2. **Criar usuário gerente:**
```bash
npm run init-admin
```
Isso criará um usuário gerente com:
- Email: `gerente@hotel.com`
- Senha: `admin123`

⚠️ **IMPORTANTE:** Anote essas credenciais e altere a senha após o primeiro acesso!

3. **Iniciar o servidor:**
```bash
npm start
```

4. **Acessar o site:**
Abra seu navegador e acesse: `http://localhost:3000`

## Uso

### Primeiro Acesso - Gerente:
1. Acesse `http://localhost:3000`
2. Faça login com:
   - Email: `gerente@hotel.com`
   - Senha: `admin123`
3. Cadastre os quartos do hotel
4. Gerencie as reservas

### Hóspedes:
1. Acesse `http://localhost:3000`
2. Clique em "Cadastre-se"
3. Crie sua conta
4. Busque quartos e faça reservas

## Colocar na Internet

Para que o site funcione de verdade na internet (acessível de qualquer lugar), você precisa:

### Opção 1: Hospedagem VPS (Recomendado)
Contrate um VPS (servidor virtual) em provedores como:
- DigitalOcean
- AWS
- Google Cloud
- Azure
- Locaweb

Depois de contratar:
1. Instale Node.js no servidor
2. Envie os arquivos do projeto
3. Execute `npm install`
4. Execute `npm run init-admin`
5. Execute `npm start`
6. Configure um domínio (opcional)

### Opção 2: Hospedagem Node.js
Use serviços que suportam Node.js:
- Heroku
- Railway
- Render
- Vercel

Siga as instruções específicas de cada plataforma para fazer deploy de aplicações Node.js.

## Segurança

Antes de colocar em produção:

1. **Altere a senha do gerente**
2. **Configure uma chave secreta forte:**
   - Abra o arquivo `middleware/auth.js`
   - Mude a linha `JWT_SECRET` para uma senha forte e única
3. **Use HTTPS** (certificado SSL) - essencial para produção
4. **Configure firewall** no servidor

## Estrutura de Arquivos

```
projeto/
├── server.js              # Servidor principal
├── database.js            # Configuração do banco de dados
├── package.json           # Dependências do projeto
├── middleware/
│   └── auth.js           # Autenticação e segurança
├── routes/
│   ├── auth.js           # Rotas de login/cadastro
│   ├── rooms.js          # Rotas de quartos
│   ├── reservations.js   # Rotas de reservas
│   └── users.js          # Rotas de usuários
├── scripts/
│   └── init-admin.js     # Script para criar gerente
├── public/
│   ├── index.html        # Página principal
│   ├── css/
│   │   └── style.css     # Estilos
│   └── js/
│       └── app.js        # JavaScript do frontend
└── data/
    └── hotel.db          # Banco de dados (criado automaticamente)
```

## Backup dos Dados

Todos os dados ficam no arquivo `data/hotel.db`. Para fazer backup:
1. Pare o servidor
2. Copie o arquivo `data/hotel.db` para um local seguro
3. Reinicie o servidor

## Solução de Problemas

### Erro "Port already in use"
Outra aplicação está usando a porta 3000. Mude a porta:
```bash
PORT=8080 npm start
```

### Erro ao instalar dependências
Tente:
```bash
npm cache clean --force
npm install
```

### Banco de dados corrompido
Delete o arquivo `data/hotel.db` e execute novamente `npm run init-admin`

## Suporte

Para dúvidas sobre hospedagem ou configuração, consulte:
- Documentação do Node.js: https://nodejs.org/docs
- Tutoriais de deploy: https://www.youtube.com/results?search_query=deploy+nodejs

## Tecnologias Utilizadas

- **Backend:** Node.js + Express
- **Banco de Dados:** SQLite (better-sqlite3)
- **Autenticação:** JWT + bcrypt
- **Frontend:** HTML, CSS e JavaScript puro

O sistema está pronto para uso e todos os dados são salvos permanentemente no servidor!
