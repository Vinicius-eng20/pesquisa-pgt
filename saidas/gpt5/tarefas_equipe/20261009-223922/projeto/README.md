# Sistema de Gestão de Tarefas de Equipe

Este projeto é um site completo para gestão de tarefas de equipe, com login, usuários, permissões, tarefas salvas em banco de dados e acesso por computador ou celular.

## O que o sistema faz

- Login com conta individual
- Gerente:
  - vê todas as tarefas
  - cria tarefas para qualquer membro
  - edita tarefas
  - remove tarefas
  - cria novos usuários da equipe
- Membro:
  - vê suas próprias tarefas
  - cria tarefas para si mesmo
  - altera o status das próprias tarefas
- Tudo fica salvo no banco de dados do próprio sistema
- Funciona no navegador, em computador ou celular

## Contas iniciais

Ao iniciar pela primeira vez, o sistema cria automaticamente um gerente:

- E-mail: `gerente@equipe.com`
- Senha: `123456`

Depois de entrar como gerente, você pode criar os membros da equipe.

## Requisitos

Instale o Node.js versão 18 ou superior:

https://nodejs.org/

## Como instalar

No terminal, dentro da pasta do projeto, execute:

```bash
npm install
```

## Como executar

```bash
npm start
```

Depois abra no navegador:

```text
http://localhost:3000
```

## Para usar na internet de verdade

Este sistema já salva os dados no servidor em um banco SQLite local.

Para ficar disponível na internet, coloque esta pasta em um servidor/VPS com Node.js instalado e execute:

```bash
npm install
npm start
```

Depois configure seu domínio ou IP apontando para a porta `3000`.

Para produção real, recomenda-se também usar HTTPS e um gerenciador de processo como PM2.

## Observações importantes

- O banco de dados será criado automaticamente em `data/app.db`
- Não apague a pasta `data`, pois ela guarda os dados do sistema
- Altere a senha padrão do gerente após o primeiro acesso
