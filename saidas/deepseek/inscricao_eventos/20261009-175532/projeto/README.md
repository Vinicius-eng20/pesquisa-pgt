# Portal de Inscrição para Eventos

Portal web completo para inscrição em eventos, com contas de **participante** e **organizador**, tudo salvo no próprio servidor.

## O que faz

**Participante:**
- Vê todos os eventos disponíveis
- Se inscreve em um evento
- Vê suas inscrições e cancela quando quiser

**Organizador:**
- Cria, edita e cancela eventos
- Vê todas as inscrições dos eventos que criou
- Confirma a presença dos inscritos

Todas as informações ficam salvas no servidor (banco de dados SQLite), então funcionam de qualquer computador ou celular, e persistem mesmo fechando o site.

## Como instalar e rodar

Você precisa ter o **Node.js** instalado (versão 16 ou superior). Baixe em https://nodejs.org.

No terminal, dentro da pasta do projeto, execute:

```bash
npm install
npm start
```

Depois abra no navegador:

```
http://localhost:3000
```

O site já está funcionando. Crie uma conta escolhendo "Participante" ou "Organizador" na tela de cadastro.

## Colocar na internet (opcional)

Para que outras pessoas acessem de qualquer lugar, hospede em um serviço que rode Node.js, por exemplo:

- **Render** (render.com) — plano gratuito disponível
- **Railway** (railway.app)
- **Fly.io**

Passos gerais:
1. Crie uma conta no serviço escolhido
2. Suba esta pasta do projeto (via GitHub ou upload direto)
3. Configure o comando de início como `npm start`
4. O serviço dará um endereço público (ex: `https://seusite.onrender.com`)

Não é necessário criar contas em outros sites nem conectar com serviços externos — o banco de dados fica dentro do próprio projeto (`portal.db`).

## Estrutura

- `server.js` — servidor e API (backend)
- `public/index.html` — página principal
- `public/style.css` — aparência
- `public/app.js` — comportamento das telas
- `portal.db` — banco de dados (criado automaticamente na primeira execução)
