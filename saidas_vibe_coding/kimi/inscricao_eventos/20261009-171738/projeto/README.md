# Portal de Eventos

Um site simples para gerenciar inscrições em eventos. Funciona em computadores e celulares, com tudo salvo no próprio site (em um banco de dados SQLite no servidor).

## O que dá para fazer
- **Participantes**: podem ver os eventos, se inscrever, ver suas inscrições e cancelar.
- **Organizador**: pode criar, editar e cancelar eventos, ver todas as inscrições e confirmar presença dos participantes.

## Pré-requisitos
Você só precisa ter o **Node.js** instalado. Baixe em [https://nodejs.org](https://nodejs.org) (versão 18 ou superior). O resto o site instala sozinho.

## Como rodar
1. **Baixe o projeto**: copie todos os arquivos deste site para uma pasta no seu computador (por exemplo, `meu-portal`).
2. **Abra o terminal** (Prompt de Comando no Windows) dentro dessa pasta.
3. **Instale as dependências** (só na primeira vez):
   ```
   npm install
   ```
4. **Inicie o site**:
   ```
   npm start
   ```
5. Pronto! Acesse no navegador: `http://localhost:3000`.

## Primeiro acesso
- Na tela de login, clique em "Cadastre-se".
- Crie a conta do **Organizador** escolhendo a função "Organizador". O organizador pode criar os eventos.
- Crie contas de **Participantes** para as outras pessoas (ou elas mesmas criam), escolhendo a função "Participante".

## Para colocar na internet (opcional)
Se quiser que funcione na internet para outras pessoas acessarem de qualquer lugar, você precisa de um servidor (uma máquina virtual na nuvem, como na AWS, DigitalOcean, etc.).
1. Coloque os arquivos do projeto no servidor.
2. Instale o Node.js no servidor.
3. Rode `npm install` e `npm start`.
4. Libere a porta 3000 no firewall do servidor.

Feito isso, qualquer um com o endereço do servidor pode acessar.

## Detalhes técnicos (para curiosos)
- **Servidor**: Node.js com Express.
- **Banco de dados**: SQLite, salvo no arquivo `portal.db` na pasta do projeto. Tudo fica gravado aqui.
- **Login**: usa JWT para manter a sessão segura.
- **Frontend**: páginas HTML simples com JavaScript que conversa com o servidor.
- **Sem dependências externas**: todo o código e o banco de dados ficam na pasta do projeto.
