# Sistema de Gestão de Tarefas da Equipe

Um site completo para gerenciar tarefas de uma equipe. O **gerente** cria e distribui tarefas para os membros, edita e remove qualquer tarefa e vê tudo. Os **membros** veem as tarefas que receberam, mudam o status e criam tarefas para si mesmos. Tudo fica salvo no próprio servidor do site (não no aparelho), então cada pessoa encontra as mesmas informações de qualquer computador ou celular, e o que uma pessoa faz aparece para quem precisa ver.

## Requisitos

- [Node.js](https://nodejs.org) versão **18** ou mais nova instalada.

## Como instalar e executar

1. Abra um terminal na pasta do projeto e rode:

```bash
npm install
```

2. Inicie o site:

```bash
npm start
```

3. Abra o navegador em:

```
http://localhost:3000
```

Para rodar em outra porta, use:

```bash
PORT=8080 npm start
```

## Como usar

- **Criar a conta do gerente:** na tela inicial, escolha **Criar conta**. A **primeira** conta criada é automaticamente o **gerente** da equipe.
- **Criar contas dos membros:** cada membro acessa o site de qualquer computador/celular e usa **Criar conta** com seu nome, e-mail e senha.
- **Entrar:** depois de criada, a pessoa escolhe **Entrar** e digita e-mail e senha.
- **Gerente:** pode criar tarefas e atribuí-las a um ou mais membros, editar e remover qualquer tarefa, mudar status e ver todas as tarefas de todos.
- **Membro:** vê as tarefas atribuídas a ele, muda o status (A fazer / Em andamento / Concluída) e cria tarefas apenas para si mesmo.

## Onde ficam os dados

Todos os dados (contas, tarefas, configurações) ficam salvos no arquivo `data.json`, criado automaticamente na pasta do projeto. Por isso as informações **não somem** ao fechar o site e são **compartilhadas** entre todos os usuários.

> **Importante:** para que as pessoas da equipe acessem de outros computadores/celulares, o servidor precisa estar disponível na internet (por exemplo, rodando em um computador com acesso de rede, ou publicado em uma hospedagem/serviço de deploy). Neste projeto não é preciso se cadastrar em nenhum outro site nem ligar com outros serviços — tudo fica dentro do próprio site.
