# Sistema de Gestão de Tarefas de Equipe

Um sistema completo e autônomo de gestão de tarefas. Funciona 100% online, salva os dados de verdade e não precisa de nenhum serviço externo.

## O que você precisa ter instalado

Você só precisa de uma coisa: o **Node.js**.

1. Acesse [https://nodejs.org](https://nodejs.org)
2. Baixe a versão "LTS" (recomendada) e instale (apenas clique em "Avançar" até o fim).
3. Para confirmar que deu certo, abra o terminal (ou Prompt de Comando) e digite:
   ```
   node -v
   ```
   Se aparecer um número de versão (ex: `v20.11.0`), está tudo certo.

## Como executar o projeto no seu computador

1. Crie uma pasta no seu computador (ex: `gestao-tarefas`).
2. Coloque todos os arquivos deste projeto dentro dela.
3. Abra o terminal (ou Prompt de Comando) dentro dessa pasta.
4. Digite o comando abaixo e aperte Enter:
   ```
   npm install
   ```
5. Depois, digite este comando e aperte Enter:
   ```
   npm start
   ```
6. Pronto! Abra seu navegador e acesse:
   ```
   http://localhost:3000
   ```

**Importante:** Para parar o sistema, volte ao terminal e aperte `Ctrl + C`.

## Como colocar na internet (para a equipe usar de qualquer lugar)

Para o site funcionar 24h na internet, você precisa de um servidor. A forma mais fácil para quem não programa:

1. Crie uma conta no **Render.com** (é gratuito).
2. Crie um novo "Web Service" e conecte a este projeto.
3. Nas configurações, use:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. O Render vai te dar um link (ex: `https://minha-equipe.onrender.com`) para você compartilhar com a equipe.

## Como usar pela primeira vez

1. Acesse o site e clique em **"Criar nova conta"**.
2. A primeira pessoa a se cadastrar deve escolher o perfil **"Gerente de Equipe"**.
3. Os outros membros se cadastram como **"Membro da Equipe"**.
4. O Gerente cria e distribui as tarefas. Os Membros veem e atualizam.

**Onde os dados ficam salvos?**
Tudo é salvo automaticamente em um arquivo chamado `banco-de-dados.json` dentro da pasta do projeto. Mesmo se você fechar e abrir o site, ou reiniciar o computador, os dados continuam lá.

---
