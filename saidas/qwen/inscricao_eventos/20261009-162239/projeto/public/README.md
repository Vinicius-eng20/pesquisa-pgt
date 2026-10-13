# Portal de Eventos

Site de inscrição para eventos. Funciona na internet, com dados salvos no servidor.

## Como instalar e rodar

1. Instale o [Node.js](https://nodejs.org) (versão 18 ou mais recente).
2. Na pasta do projeto, instale as dependências:
   ```
   npm install
   ```
3. Inicie o servidor:
   ```
   npm start
   ```
4. Abra no navegador:
   ```
   http://localhost:3000
   ```

## Conta de organizador (já criada)

- **Email:** admin@portal.com
- **Senha:** admin123

## Como usar

- **Participantes:** crie a conta, veja os eventos, inscreva-se e veja/cancele suas inscrições.
- **Organizadores:** crie, edite e cancele eventos, confirme a presença dos inscritos e veja todas as inscrições.

## Onde ficam os dados

- Os dados ficam salvos no servidor, no arquivo `app/data/data.json`.
- Tudo que você faz fica salvo no servidor. Se você entrar pelo celular, encontra as mesmas informações que deixou no computador.
- Para não perder nada, **não apague** a pasta `app/data`.

## Publicar na internet

Para colocar na internet, o site precisa de um **servidor** (um computador ou serviço que fica ligado o tempo todo).

1. **Coloque o site em um servidor** que tenha o Node.js.
2. Copie todos os arquivos do projeto para o servidor.
3. No servidor, rode:
   ```
   npm install
   npm start
   ```
4. Para que o servidor não pare quando você fechar a janela, use:
   ```
   nohup npm start > server.log 2>&1 &
   ```
5. Acesse pela internet usando o endereço do servidor (ex.: `http://seudominio.com` ou `http://seu-endereco-ip:3000`).

## Recomendação

- Use um **domínio próprio** (ex.: `portal.eventos.com`) para facilitar a vida dos participantes.
- Troque a senha do organizador para algo mais seguro.
- Faça **cópia de segurança** (backup) da pasta `app/data` periodicamente.

---

*Este é o README local. O `README.md` na raiz do projeto tem os mesmos comandos.*
