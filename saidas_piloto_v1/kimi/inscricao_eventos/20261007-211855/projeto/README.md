# Portal de Eventos

Sistema completo de inscrição em eventos, com contas de usuário, painel do organizador e dados salvos em banco de dados SQLite. Tudo funciona dentro do próprio site, sem serviços externos.

## Requisitos

- [Node.js](https://nodejs.org) versão 18 ou superior (baixe e instale a versão LTS). Nenhum outro programa é necessário.

## Instalação

1. Baixe ou copie todos os arquivos deste projeto para uma pasta no seu computador.
2. Abra um terminal (Prompt de Comando / PowerShell no Windows) dentro dessa pasta.
3. Execute:

```bash
npm install
```

## Executando o site

```bash
npm start
```

Depois abra no navegador: **http://localhost:3000**

Para parar o site, pressione `Ctrl + C` no terminal.

## Conta do organizador

Na primeira vez que o site for iniciado, uma conta de organizador é criada automaticamente:

- **E-mail:** admin@eventos.com
- **Senha:** admin123

Entre com ela e troque a senha depois (banco de dados: edite o arquivo `database.sqlite` ou crie outra conta e promova-a alterando o campo `role` para `organizer`). Os participantes se cadastram pela própria tela de registro.

## Colocando na internet de verdade

Opção simples (serviços de hospedagem gratuitos ou baratos como **Render**, **Railway**, **Fly.io** ou um VPS):

1. Suba estes arquivos para um repositório (ex.: GitHub) ou envie para o servidor.
2. No serviço de hospedagem, configure:
   - **Comando de build:** `npm install`
   - **Comando de start:** `npm start`
3. Defina a variável de ambiente `SESSION_SECRET` com um texto longo e secreto (ex.: uma sequência aleatória de 40 caracteres).
4. O serviço fornecerá um endereço público (ex.: `https://seu-site.onrender.com`).

Em um VPS (ex.: Ubuntu):

```bash
sudo apt update && sudo apt install -y nodejs npm
cd pasta-do-projeto
npm install
SESSION_SECRET="um-segredo-bem-longo" PORT=3000 npm start
```

Para manter rodando após fechar o terminal, use por exemplo:

```bash
npm install -g pm2
SESSION_SECRET="um-segredo-bem-longo" pm2 start server.js --name portal-eventos
pm2 save && pm2 startup
```

## Onde os dados ficam salvos

Tudo fica no arquivo `database.sqlite`, criado automaticamente na pasta do projeto. Para backup, basta copiar esse arquivo com o site parado. Apagar o arquivo apaga todos os dados (contas, eventos e inscrições).

## Funcionalidades

**Participante:**
- Criar conta e entrar
- Ver eventos disponíveis (com vagas restantes)
- Inscrever-se em eventos (com respeito ao limite de vagas)
- Ver e cancelar suas inscrições

**Organizador:**
- Criar, editar e cancelar eventos
- Ver todas as inscrições de todos os participantes, por evento ou geral
- Confirmar presença (check-in) dos inscritos
