# 📚 Biblioteca Digital

Site completo de biblioteca com empréstimo de itens, contas de usuário (leitores e bibliotecário) e dados salvos em banco local (SQLite). Tudo funciona sem depender de serviços externos.

## Como instalar e executar

Você precisa ter o **Node.js** instalado (versão 18 ou superior). Baixe em https://nodejs.org.

1. Abra o terminal na pasta do projeto.
2. Instale as dependências:
   ```
   npm install
   ```
3. Inicie o site:
   ```
   npm start
   ```
4. Abra o navegador em: **http://localhost:3000**

## Conta de bibliotecário padrão

- **Email:** admin@biblioteca.com
- **Senha:** admin123

## Como usar

### Leitores
- Clicam em **Cadastre-se** na tela inicial, escolhem o tipo "Leitor".
- Aba **Acervo**: buscam itens por título, autor ou categoria e pegam emprestado.
- Aba **Meus Empréstimos**: veem o que pegaram e podem devolver.
- Prazo de devolução: 14 dias. Se ficar em atraso, não conseguem pegar novos itens até devolver.

### Bibliotecário
- Aba **Acervo**: mesmo que os leitores.
- Aba **Gerenciar Itens**: cadastrar, editar e remover itens.
- Aba **Histórico**: vê todos os empréstimos de todos os leitores.
- Aba **Leitores**: vê a situação de cada leitor (quem está bloqueado por atraso).

## Onde ficam os dados

Todos os dados (contas, itens e empréstimos) ficam salvos no arquivo `biblioteca.db` na pasta do projeto. Mesmo fechando o site e abrindo de novo, tudo permanece.

## Colocar na internet

Para publicar, hospede em um serviço como Render, Railway ou Fly.io. Envie os arquivos do projeto, defina o comando de start como `npm start` e o site estará acessível publicamente. O banco `biblioteca.db` ficará salvo junto com a aplicação.
