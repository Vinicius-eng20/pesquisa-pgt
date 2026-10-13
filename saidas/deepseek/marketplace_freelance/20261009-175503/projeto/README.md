# FreelaHub - Marketplace de Serviços Freelance

Um marketplace completo de serviços freelance com autenticação, publicação de serviços, contratação e painel administrativo. Tudo funciona dentro do próprio site, com dados persistentes no servidor.

## Requisitos

- Node.js 18 ou superior (baixe em https://nodejs.org)

## Instalação e execução

1. Abra o terminal (ou prompt de comando) na pasta do projeto.
2. Instale as dependências:
   ```
   npm install
   ```
3. Inicie o servidor:
   ```
   npm start
   ```
4. Abra o navegador em: http://localhost:3000

## Conta de administrador (criada automaticamente)

- **E-mail:** admin@freelahub.com
- **Senha:** admin123

## Como usar

1. **Cadastro:** Clique em "Cadastre-se" para criar uma conta (como cliente/contratante ou freelancer).
2. **Publicar serviço:** Após entrar, clique em "Publicar serviço" no topo.
3. **Contratar:** Vá em "Explorar", escolha um serviço aprovado e clique em "Contratar".
4. **Meus contratos:** Veja todos os contratos em que você participa em "Contratos".
5. **Administração:** Entre com a conta de admin para aprovar/remover serviços, suspender usuários e ver tudo.

## Dados persistentes

Todos os dados ficam salvos na pasta `data/` no servidor (arquivo `db.json`). Nada se perde ao fechar o site.

## Funciona na internet?

Sim. Basta hospedar este projeto em qualquer serviço que rode Node.js (Render, Railway, Fly.io, etc.). Não precisa configurar banco de dados externo nem outros serviços.
