# Sistema de Gestão de Tarefas de Equipe

Uma aplicação web completa (um único arquivo) para gerenciar tarefas em equipe.
- **Membros** entram com sua conta e veem suas tarefas, mudam o status e criam tarefas para si.
- **Gerente** cria, distribui, edita e remove tarefas e vê tudo de todos.
- **Dados salvos no site (navegador)**: tudo fica salvo no próprio navegador. Nada é perdido se você fechar e abrir de novo.
- **Funciona em qualquer dispositivo**: funciona em qualquer computador ou celular.

## O que precisa para funcionar

1. Um navegador (Chrome, Firefox, Safari, Edge, etc.) com internet.
2. Um espaço para "hospedar" o site (colocar o arquivo na internet).

## Como usar

1. **Primeiro acesso (crie o gerente):**
   - Abra o site. A primeira conta que você cadastrar será o **gerente** (e o dono do sistema).
   - Depois, volte para a tela de login e faça login com essa conta.

2. **Criar a equipe:**
   - No menu, clique em **Equipe** e adicione cada membro com nome, e-mail e senha.
   - O e-mail é o que cada pessoa usa para entrar.

3. **Cada membro entra:**
   - Cada pessoa usa a página de login e entra com seu e-mail e senha.
   - Cada um vê apenas suas tarefas.

4. **Distribuir tarefas:**
   - O gerente (ou membro) cria tarefas em **Nova Tarefa** e escolhe para quem.
   - O membro vê a tarefa e muda o status (Aberta, Em andamento, Concluída, Bloqueada).

## Como instalar e executar

### Opção 1 — Rodar no seu computador (teste rápido)

```bash
python3 -m http.server 8000
```

Depois acesse no navegador: `http://localhost:8000`

### Opção 2 — Publicar na internet (funcionar de verdade)

Coloque o arquivo `index.html` em um serviço de hospedagem gratuita. Exemplos:
- **GitHub Pages** (recomendado)
- **Netlify**
- **Vercel**

Passo a passo (GitHub Pages):
1. Crie uma conta gratuita em https://github.com
2. Crie um novo repositório (ex.: `minha-tarefas`)
3. Envie o arquivo `index.html` para o repositório
4. Em "Settings" → "Pages", marque "Deploy from a branch" (main)
5. Pronto: o site ficará em algo como `https://SEU-USER.github.io/minha-tarefas`

## ⚠️ Importante sobre os dados

Os dados são salvos **no navegador** (localStorage). Por isso:
- **Funciona em qualquer dispositivo**: um membro entra com sua conta e vê suas tarefas.
- **Não se perde ao fechar**: o navegador guarda os dados.
- **Limite**: o navegador de cada pessoa guarda seus próprios dados. Para que o que o gerente vê apareça **exatamente** para os membros (em tempo real, em qualquer dispositivo), é necessário um **backend/servidor** (ex.: Firebase, Supabase, etc.).

A aplicação atual é **auto-suficiente** e funciona em qualquer navegador. Se você quiser sincronização em tempo real entre dispositivos, é só pedir — eu adiciono um backend (ex.: Firebase) para que tudo fique salvo em um servidor na nuvem.

## Comandos de uso

```bash
# Rodar localmente
python3 -m http.server 8000

# Ou abrir direto no navegador
# (duplo clique no arquivo index.html)
```

## Estrutura

```
index.html
```

Um único arquivo HTML com CSS e JavaScript embutidos.
