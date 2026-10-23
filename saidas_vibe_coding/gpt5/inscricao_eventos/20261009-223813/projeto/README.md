# Portal de Inscrição para Eventos

Site completo para participantes e organizador criarem contas, entrarem no sistema, criarem eventos, se inscreverem, cancelarem inscrições, confirmarem presença e acompanharem tudo com dados salvos em banco SQLite no próprio projeto.

## Requisitos

Instale o Node.js versão 18 ou superior:

- https://nodejs.org/

## Como instalar

Abra o terminal dentro da pasta do projeto e rode:

```bash
npm install
```

Depois crie o banco de dados inicial:

```bash
npm run init-db
```

## Como executar

```bash
npm start
```

Acesse no navegador:

```text
http://localhost:3000
```

## Conta inicial do organizador

Ao rodar `npm run init-db`, uma conta de organizador é criada automaticamente:

- E-mail: `organizador@eventos.local`
- Senha: `admin123`

Você pode alterar a senha depois editando diretamente pelo banco ou criando outra conta organizadora no script, se desejar.

## Como publicar na internet

Este projeto funciona com Node.js e SQLite. Para colocar na internet sem serviços externos, use um servidor/VPS próprio com Node.js instalado.

Passos gerais no servidor:

```bash
npm install
npm run init-db
npm start
```

Para uso real em produção, configure também:

- HTTPS
- domínio
- proxy reverso, como Nginx
- backup periódico do arquivo `data/app.db`

## Observação importante

Tudo fica salvo no arquivo:

```text
data/app.db
```

Não apague esse arquivo se quiser manter usuários, eventos e inscrições.
