# 🍽️ Bella Cucina — Sistema de Pedidos para Restaurante

Um site completo para o seu restaurante: **clientes** veem o cardápio, fazem pedidos e acompanham o status; o **gerente** cadastra/edita/remove pratos, muda a situação dos pedidos e vê tudo.

**Tudo funciona dentro do próprio site.** Não precisa de internet fora do site, de bancos externos ou de integrações. Os dados ficam salvos em um arquivo na máquina do servidor e permanecem mesmo depois de fechar e reabrir.

---

## O que você precisa

- **Node.js** instalado (a versão 18 ou mais nova).

  Para verificar, abra o terminal e digite:
  ```
  node -v
  ```
  Se aparecer um número, está pronto. Se não tiver, baixe em: https://nodejs.org/ (escolha a versão LTS) e instale.

---

## Como instalar e executar

1. Abra o terminal **na pasta do projeto** (onde está este arquivo `README.md`).

2. Instale as dependências:
   ```
   npm install
   ```

3. Inicie o site:
   ```
   npm start
   ```

4. Abra no navegador:
   ```
   http://localhost:3000
   ```

   No terminal aparecerá algo como:
   ```
   🍽️  Restaurante pronto em: http://localhost:3000
   ```

---

## Contas para você testar

| Papel   | E-mail                        | Senha |
|---------|-------------------------------|-------|
| Gerente | `gerente@restaurante.com`    | `1234` |
| Cliente | `cliente@restaurante.com`    | `1234` |

- **Gerente** vê: Cardápio, **Todos os Pedidos** (pode mudar a situação) e **Gerenciar Cardápio** (cadastrar/editar/remover pratos).
- **Cliente** vê: Cardápio (para pedir) e **Meus Pedidos** (acompanhamento).

> ⚠️ **Troque a senha** de `gerente@restaurante.com` antes de usar de verdade. A senha `1234` é só para teste. (O site não tem tela para trocar a senha ainda — basta criar uma nova conta para você ou usar as contas de exemplo.)

---

## Como fica salvo?

Os dados (contas, pratos e pedidos) são gravados em um arquivo chamado `data.json`, criado na pasta do projeto na primeira vez. Tudo fica salvo automaticamente e **não se perde** ao fechar o site. Para "zerar", apague o arquivo `data.json` e reinicie.

---

## Usar na internet (para o mundo de fora)

### Opção 1 — Compartilhar na sua rede local (rápido)
Depois de `npm start`, o site já funciona para quem está na mesma rede do seu computador. Descubra seu IP com `ipconfig` (Windows) ou `ifconfig` (Mac/Linux) e acesse `http://SEU-IP:3000` no celular.

### Opção 2 — Hospedar na internet de verdade (recomendado)
Para que **qualquer pessoa** acesse pela web, suba o projeto num serviço gratuito que roda Node.js:

1. Crie uma conta gratuita em **Render** (https://render.com) ou **Railway** (https://railway.app).
2. Coloque este projeto num repositório Git (ex.: crie um repositório no GitHub e envie os arquivos).
3. No Render: **New → Web Service** → aponte para seu repositório.
4. Adicione uma variável de ambiente `JWT_SECRET` com uma frase longa e aleatória.
5. Deploy. Ele vai gerar um endereço tipo `https://seu-restaurante.onrender.com`.

> 💡 **Importante para salvar:** no **Railway** os dados persistem (ótimo). No **Render** grátis, o disco pode ser zerado em deploys — para dados garantidos de verdade, prefira Railway ou um servidor próprio (VPS) com um `data.json` persistente.

---

## Comandos úteis

| Comando       | O que faz                          |
|---------------|------------------------------------|
| `npm start`   | Inicia o site (porta 3000)        |
| `npm run dev` | Inicia o site (mesma coisa)       |
| `npm install` | Instala as dependências (1ª vez)  |

Para mudar a porta, use: `PORT=5000 npm start`

---

## Estrutura do projeto

```
restaurante-pedidos/
├── server.js        → servidor (salva dados, autentica, gerencia API)
├── package.json
├── data.json        → (gerado) onde ficam guardados os dados
└── public/
    ├── index.html   → páginas
    ├── style.css    → visual
    └── app.js       → comportamento (cardápio, pedidos, gerente)
```

Pronto! É só rodar. 🎉
