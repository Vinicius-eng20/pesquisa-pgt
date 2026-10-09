# Sistema de Gestão de Tarefas de Equipe

Sistema web completo para gerenciar tarefas de uma equipe, com contas separadas para membros e gerente. Todos os dados ficam salvos em arquivos no próprio servidor (SQLite), sem depender de serviços externos.

## O que ele faz

- **Primeiro usuário cadastrado vira gerente automaticamente.** Os próximos usuários cadastrados viram membros da equipe.
- **Membros da equipe** podem:
  - Ver apenas as tarefas que receberam.
  - Mudar a situação (pendente / em andamento / concluída) das suas tarefas.
  - Criar tarefas para si mesmos.
- **Gerente** pode:
  - Criar tarefas e distribuir para qualquer membro.
  - Editar título, descrição, responsável e situação de qualquer tarefa.
  - Remover tarefas.
  - Ver todas as tarefas de todos os membros.
- **Login individual** por usuário e senha. A sessão dura até você clicar em "Sair" (fica salva por 7 dias).
- Todos os dados persistem mesmo que você feche o navegador ou reinicie o servidor.

## Como instalar e executar

Pré-requisito: ter o **Node.js** instalado (versão 16 ou superior). Baixe em https://nodejs.org.

No terminal, dentro da pasta do projeto, rode:

```
npm install
npm start
```

Depois abra no navegador:

```
http://localhost:3000
```

Na primeira vez, clique em **"Criar conta"** para registrar o gerente. Depois, cada membro da equipe cria sua própria conta e entra normalmente.

## Como colocar na internet

Como é um site Node.js, hospede em serviços que rodam Node, como:

- **Railway** (railway.app) — simples, com deploy direto do GitHub.
- **Render** (render.com) — plano gratuito disponível.
- **Fly.io** — também funciona bem.

Em qualquer um deles, basta subir os arquivos do projeto e definir o comando de start como `npm start`. Os arquivos `data.db` e `sessions.db` serão criados automaticamente na primeira execução e mantêm tudo salvo no próprio servidor.

## Observações importantes

- Para trocar o "segredo" das sessões (recomendado antes de publicar), abra `server.js` e mude o valor de `secret` na linha do `express-session`.
- As senhas são guardadas criptografadas com bcrypt.
- As tarefas e os usuários ficam guardados nos arquivos `data.db` e `sessions.db` criados automaticamente na pasta do projeto. Faça backup desses arquivos de vez em quando.
