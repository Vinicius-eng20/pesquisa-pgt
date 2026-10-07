Sistema de Reservas de Hotel
=============================

COMO EXECUTAR LOCALMENTE:
1. Instale o Node.js (versão 18 ou superior): https://nodejs.org
2. Abra o terminal na pasta do projeto
3. Execute: npm install
4. Execute: npm start
5. Abra o navegador em: http://localhost:3000

CREDENCIAIS PADRÃO (Gerente):
- Email: admin@hotel.com
- Senha: admin123

FUNCIONALIDADES:
- Hóspedes: ver quartos, reservar, ver/cancelar reservas
- Gerente: cadastrar/editar/remover quartos, confirmar/recusar reservas, ver todas as reservas
- Dados salvos automaticamente em banco SQLite (arquivo hotel.db)
- Sistema de login com sessões seguras

PARA HOSPEDAR NA INTERNET:
1. Crie conta em um serviço como Render, Railway ou Heroku
2. Faça upload do código
3. Configure o comando de start como: node server.js
4. O banco de dados SQLite será criado automaticamente

ARQUIVOS:
- server.js: servidor backend com API
- package.json: dependências do projeto
- public/: arquivos do site (HTML, CSS, JS)
- hotel.db: banco de dados (criado automaticamente)
