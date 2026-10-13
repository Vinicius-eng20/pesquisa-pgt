# Sistema de Gestão de Tarefas de Equipe

## Requisitos
- Node.js (versão 14 ou superior)
- npm (geralmente vem com Node.js)

## Instalação

1. Instale o Node.js do site oficial: https://nodejs.org/

2. Abra o terminal/prompt de comando na pasta do projeto

3. Instale as dependências:
```bash
npm install
```

## Executar o projeto

1. Inicie o servidor:
```bash
npm start
```

2. Abra o navegador e acesse:
```
http://localhost:3000
```

## Contas pré-cadastradas para teste

### Gerente:
- Usuário: gerente
- Senha: gerente123

### Membros da equipe:
- Usuário: joao / Senha: joao123
- Usuário: maria / Senha: maria123
- Usuário: pedro / Senha: pedro123

## Como usar

### Para o Gerente:
- Criar tarefas e atribuir para membros da equipe
- Editar e remover qualquer tarefa
- Ver todas as tarefas de todos os membros
- Gerenciar usuários (criar novos membros)

### Para Membros da Equipe:
- Ver tarefas atribuídas a você
- Mudar o status das suas tarefas (Pendente → Em Progresso → Concluída)
- Criar tarefas para você mesmo

## Notas importantes

- Todos os dados ficam salvos no arquivo `database.json`
- Os dados persistem mesmo após fechar o navegador
- Funciona em qualquer dispositivo (computador, celular, tablet)
- Múltiplos usuários podem usar ao mesmo tempo
