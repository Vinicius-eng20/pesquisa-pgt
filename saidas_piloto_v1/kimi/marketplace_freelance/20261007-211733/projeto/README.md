# FreelanceHub - Marketplace de Serviços

## Instalação
```bash
npm install
```

## Configuração
Crie um arquivo `.env` na raiz:
```bash
PORT=3000
SESSION_SECRET=mude-isto-para-uma-chave-secreta-longa
DATABASE_PATH=./database.sqlite
```

## Execução
```bash
npm start
```
Acesse: http://localhost:3000

## Conta Admin Padrão
- Email: admin@freelancehub.com
- Senha: admin123

Altere a senha após o primeiro login!

## Funcionalidades
- Usuários: cadastro, login, publicar serviços, contratar serviços, ver contratos
- Admin: aprovar/remover serviços, suspender usuários, ver tudo
