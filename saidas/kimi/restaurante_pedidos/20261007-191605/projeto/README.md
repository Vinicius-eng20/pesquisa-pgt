# 🍽️ Sabor & Arte - Sistema de Pedidos para Restaurante

Este é um sistema completo de pedidos para restaurante, pronto para funcionar na internet. Ele já vem com tudo dentro do próprio site: não precisa contratar banco de dados, nem conectar outros serviços.

## ✅ O que este sistema faz

### 👤 Para os clientes
- Criar conta e entrar com login e senha
- Ver o cardápio com fotos, descrições e preços
- Adicionar pratos ao carrinho e finalizar pedidos
- Acompanhar a situação dos seus pedidos (Recebido → Preparando → A caminho → Entregue)
- Ver o histórico de todos os pedidos já feitos
- Cancelar pedidos que ainda não começaram a ser preparados

### 👔 Para o gerente
- Cadastrar, editar e remover pratos do cardápio
- Ver todos os pedidos de todos os clientes
- Mudar a situação dos pedidos (ex.: marcar como "Preparando", "Saiu para entrega", etc.)
- Ver estatísticas do dia (faturamento, total de pedidos)

## 🔐 Contas já criadas (você pode criar outras)

| Tipo | E-mail | Senha |
|------|--------|-------|
| Gerente | `gerente@restaurante.com` | `admin123` |
| Cliente (teste) | `joao@email.com` | `123456` |

> 💡 **Dica:** depois de entrar como gerente, você pode editar o cardápio à vontade. Qualquer pessoa pode criar uma conta de cliente na tela inicial.

## 🚀 Como colocar no ar (funcionando de verdade na internet)

O jeito mais fácil é usar o **Render** (gratuito). Você não precisa instalar nada no seu computador, só precisa de uma conta no GitHub e no Render.

### Passo 1: Colocar os arquivos no GitHub
1. Crie uma conta gratuita em [github.com](https://github.com) (se não tiver)
2. Clique em **"New repository"** (Novo repositório)
3. Dê um nome, por exemplo: `meu-restaurante`
4. Deixe como **Public** e clique em **"Create repository"**
5. Na página que abrir, clique em **"uploading an existing file"**
6. Arraste todos os arquivos deste projeto (`server.js`, `package.json`, `README.md` e a pasta `public` inteira) para a página
7. Clique no botão verde **"Commit changes"** no final da página

### Passo 2: Colocar no ar com o Render (gratuito)
1. Crie uma conta gratuita em [render.com](https://render.com) (pode entrar com a conta do GitHub)
2. No painel, clique em **"New +"** → **"Web Service"**
3. Escolha **"Build and deploy from a Git repository"** e clique em **Next**
4. Conecte sua conta do GitHub e selecione o repositório `meu-restaurante`
5. Preencha assim:
   - **Name:** `meu-restaurante` (será o endereço do site)
   - **Region:** deixe o padrão
   - **Branch:** `main`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** selecione **Free**
6. Clique em **"Create Web Service"**
7. Aguarde 2 a 5 minutos. Quando aparecer **"Live"**, seu site está no ar! 🎉
8. O endereço será algo como: `https://meu-restaurante.onrender.com` — é só mandar esse link para os clientes!

### ⚠️ Importante sobre os dados
Os dados ficam salvos em um arquivo chamado `database.json` dentro do servidor. No plano gratuito do Render, se o servidor for reiniciado do zero (raro), os dados voltam ao padrão. Para uso profissional intenso, considere o plano pago do Render com "Disco Persistente" (USD ~7/mês) — aí os dados ficam 100% garantidos para sempre.

## 💻 Como testar no seu próprio computador (opcional)

Se você quiser testar antes de colocar no ar:

1. Instale o **Node.js** no seu computador: baixe em [nodejs.org](https://nodejs.org) (versão LTS, clique em Next, Next, Finish)
2. Baixe os arquivos deste projeto em uma pasta, por exemplo `C:\meu-restaurante`
3. Abra o **Prompt de Comando** (Windows) ou **Terminal** (Mac/Linux) dentro dessa pasta
4. Digite os comandos abaixo, um de cada vez:

```bash
npm install
npm start
```

5. Abra o navegador e acesse: **http://localhost:3000**

## 🛠️ Como usar depois de no ar

1. **Primeiro acesso:** entre como gerente (`gerente@restaurante.com` / `admin123`) e personalize o cardápio com os pratos do seu restaurante (você pode colocar link de fotos ou deixar sem foto)
2. **Clientes:** eles acessam o link do site, clicam em "Criar conta" e já podem pedir
3. **Pedidos:** quando um cliente fizer um pedido, ele aparece na aba "Pedidos" do gerente na hora (atualiza sozinho a cada 10 segundos)
4. **Situação:** o gerente clica nos botões para avançar o pedido: Recebido → Preparando → Pronto / A caminho → Entregue

## 📁 Arquivos do projeto
- `server.js` — o "cérebro" do site (servidor, contas, pedidos, cardápio)
- `package.json` — lista de componentes necessários
- `public/index.html` — a página que os usuários veem (visual do site)

Qualquer dúvida, basta seguir os passos acima com calma. Bom apetite e boas vendas! 🍕
