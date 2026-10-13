# Gestão de Tarefas da Equipe

Sistema completo de gestão de tarefas para equipes, com contas de usuário, gerente e membros.

## Como instalar e executar

Você precisa ter o **Node.js** instalado (baixe em https://nodejs.org).

1. Abra o terminal (ou prompt de comando) na pasta do projeto.
2. Instale as dependências:
   ```
   npm install
   ```
3. Inicie o servidor:
   ```
   npm start
   ```
4. Abra o navegador em: **http://localhost:3000**

## Primeiro acesso (gerente)

- **Email:** gerente@equipe.com
- **Senha:** admin123

Troque a senha depois criando seu próprio gerente (só é possível ter um gerente por vez).

## Como usar

**Gerente:**
- Cria contas de membros pela tela inicial (aba "Criar conta" → "Sou gerente" — mas só o primeiro pode ser gerente).
- Cria tarefas e atribui aos membros.
- Edita, remove e vê todas as tarefas de todos.

**Membro:**
- Cria sua própria conta (aba "Criar conta" → "Sou membro").
- Vê apenas as tarefas atribuídas a ele.
- Pode mudar o status (Pendente → Em andamento → Concluída).
- Pode criar tarefas para si mesmo.

## Funciona na internet (deploy)

Os dados ficam salvos no arquivo `dados.db` na pasta do projeto (não somem ao fechar). Para colocar online:

1. Suba o projeto para um serviço gratuito de hospedagem Node.js (ex: **Render**, **Railway**, **Fly.io**).
2. Configure a variável `PORT` (a maioria já define automaticamente).
3. Use um disco persistente (Persistent Disk) para que o arquivo `dados.db` não seja apagado em reinícios.

Comandos de build/start:
- Build: `npm install`
- Start: `npm start`

## Acesso pelo celular

Como o site roda no servidor, qualquer pessoa pode acessar do celular ou computador usando o mesmo endereço. Tudo é salvo no servidor — o que você faz no celular aparece no computador e vice-versa.
