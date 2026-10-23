# MegaMall — Loja virtual de departamentos

Um shopping online completo: os **clientes** navegam, adicionam ao carrinho, finalizam pedidos e acompanham os seus pedidos; o **lojista** cadastra/edita/remove produtos, muda a situação de cada pedido e acompanha todas as vendas.

Tudo fica salvo em um **banco de dados dentro do próprio site** (arquivo `data/db.json`). As informações sobrevivem a reinícios e são compartilhadas entre todos: o que o cliente faz aparece no painel do lojista e vice-versa, em qualquer computador ou celular.

> **Por que precisa de um servidor?** Salvar dados *dentro* de um site estático (só um arquivo `.html`) não é possível: cada aparelho guardaria uma cópia própria e nada se encontraria. Por isso o MegaMall usa um servidor Node.js com um banco de dados embutido, criado automaticamente na primeira execução — **sem** criar conta em outros serviços e **sem** ligar a nada externo.

---

## O que precisa ter instalado

Apenas o **Node.js** (versão 16 ou mais recente).
- Baixe e instale em: https://nodejs.org
- Para confirmar, abra o terminal e digite:
  ```
  node -v
  ```
  Deve aparecer algo como `v18.x.x` ou `v20.x.x`.

---

## Como instalar e executar

1. Abra o terminal (ou "Prompt de comando") dentro da pasta do projeto.
2. Instale as dependências (só uma vez):
   ```
   npm install
   ```
3. Inicie a loja:
   ```
   npm start
   ```
4. Abra no navegador:
   ```
   http://localhost:3000
   ```

> Na primeira execução a pasta `data` é criada sozinha e já vem com produtos de exemplo e a conta do lojista.

---

## Contas

| Quem | Usuário | Senha |
|------|---------|-------|
| Lojista (já criada) | `admin` | `admin123` |
| Clientes | você cria | você escolhe |

- O lojista entra e cai direto no **Painel do Lojista** (produtos, pedidos e vendas).
- Qualquer visitante pode **Criar conta** na tela de login para comprar e acompanhar os próprios pedidos.
- Após logar, o botão **Entrar** vira o **seu nome** — clique nele para sair (logout).

---

## Como usar

**Cliente**
- Navegue pelas categorias ou use a busca.
- Toque em um produto para ver detalhes e **Adicionar ao carrinho** (🛒 no topo).
- No carrinho, ajuste quantidades e toque em **Finalizar Pedido**.
- Preencha os dados de entrega e confirme. (O pagamento é **simulado** — não é cobrado nada.)
- Em **Meus Pedidos** você acompanha a situação do seu pedido.

**Lojista (admin)**
- **📦 Produtos**: cadastrar, editar e excluir produtos (nome, categoria, preço, estoque e ícone).
- **🧾 Pedidos**: ver todos os pedidos de todos os clientes e mudar a situação (Pendente → Processando → Enviado → Entregue, ou Cancelar). Cancelar devolve o produto ao estoque.
- **📊 Vendas**: faturamento total, quantidade de pedidos e resumo por situação.

---

## Como colocar na internet (para acessar de qualquer lugar)

O site roda em qualquer servidor com Node.js — um VPS, um Raspberry Pi, um computador seu, etc.

**Opção 1 — Rodar em um servidor na nuvem** (ex.: um VPS barato):
```
# no servidor
npm install
npm start
```
Depois acesse pela IP/domínio do servidor: `http://SEU-IP:3000` (ou configure um domínio).

**Dica — deixar ligado o tempo todo e na porta padrão (80/443):** instale o [pm2](https://pm2.keymetrics.io/) e use um [reverse proxy](https://www.nginx.com/) (Nginx). Exemplo simples com pm2:
```
npm install -g pm2
pm2 start server.js --name megamall
pm2 save
pm2 startup
```
Para trocar a porta padrão, use: `PORT=8080 npm start`.

**Opção 2 — Testar localmente, mas acessar pelo celular na mesma rede:** rode `npm start` no computador e, no celular, acesse `http://IP-DO-COMPUTADOR:3000` (mesma rede Wi-Fi). Descubra o IP do computador com `ipconfig` (Windows) ou `ifconfig`/`ip a` (Mac/Linux).

---

## Onde ficam os dados

- Banco de dados: **`data/db.json`** (criado automaticamente). Faça backup deste arquivo para não perder nada.
- Para zerar a loja, apague a pasta `data` e reinicie (`npm start`) — ela é recriada com os produtos de exemplo.
- Cada navegador guarda apenas sua sessão local (o "estou logado"), para você não precisar digitar a senha a cada visita. Os dados de verdade estão no servidor.

---

## Estrutura do projeto

```
├── package.json
├── server.js          # Servidor + banco de dados + regras (login, produtos, pedidos)
├── data/db.json       # Criado automaticamente — é o banco de dados
└── public/
    ├── index.html     # Página do site
    ├── style.css      # Visual
    └── app.js         # O que o navegador faz (loja, carrinho, painel)
```

## Solução de problemas

- **`npm` não é reconhecido** → o Node.js não está instalado ou o terminal precisa ser reaberto.
- **A porta 3000 já está ocupada** → use outra: `PORT=3001 npm start`.
- **Nada aparece ao recarregar** → confirme que o servidor está rodando (a mensagem "Loja no ar!" aparece no terminal).
- **Esqueci a senha do admin** → o admin padrão é sempre `admin` / `admin123` (o banco é o arquivo `data/db.json`; remova-o para recriar tudo do zero, se precisar).
