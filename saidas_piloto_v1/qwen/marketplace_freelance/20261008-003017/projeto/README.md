# Marketplace de Serviços Freelance

Um site completo para que pessoas **ofereçam** serviços, **contratem** serviços de outras pessoas e que um **administrador** aprove/remova serviços, suspenda contas e veja tudo.

Tudo fica salvo **dentro do próprio site** (em um arquivo de dados), sem depender de nenhum serviço externo.

## Requisitos

- [Node.js](https://nodejs.org) instalado (versão 18 ou superior).
  Para checar, abra o terminal e digite: `node -v`

## Como instalar e rodar (no seu computador)

1. Abra o terminal **na pasta do projeto**.
2. Instale as dependências:

   ```bash
   npm install
   ```

3. Inicie o site:

   ```bash
   npm start
   ```

4. Abra no navegador: **http://localhost:3000**

> Se você quiser que a porta seja outra (ex.: 8080), use:
> ```bash
> PORT=8080 npm start
```

> **Windows (PowerShell):** `$env:PORT=8080; npm start`

## Conta de administrador (já criada)

- **E-mail:** `admin@marketplace.com`
- **Senha:** `admin123`

> **Troque essa senha depois que entrar**, em *Minha conta → Alterar senha*.

## Como publicar um serviço

Depois de entrar:

1. Vá em **Publicar serviço**.
2. Preencha título, categoria, descrição, preço e forma de pagamento.
3. Clique em **Publicar**.

> O serviço fica **“Pendente”** até o administrador aprovar. Somente serviços **aprovados** aparecem para os outros usuários.

## Como contratar um serviço

1. Abra **Explorar** e escolha um serviço aprovado.
2. Clique em **Ver detalhes** → **Contratar**.
3. Escreva uma mensagem para o prestador e confirme.

A partir daí o contrato aparece em **Meus contratos** para as duas pessoas. O prestador pode **Aceitar** ou **Recusar**; quando aceito, o **contratante** pode **Concluir**, encerrando o contrato.

## Como funciona a publicação (resumo do fluxo)

| Ação | Quem |
|---|---|
| Publica um serviço (fica “Pendente”) | Usuário que oferece |
| Aprova ou remove um serviço | Administrador |
| Contrata um serviço (cria “Contrato pendente”) | Usuário que contrata |
| Aceita ou recusa um contrato | Prestador do serviço |
| Conclui um contrato aceito | Contratante |
| Suspende/reativa contas, vê tudo | Administrador |

## Onde ficam os dados

- Os dados ficam no arquivo `data/dados.json` (criado automaticamente na primeira vez que alguém se cadastra).
- Para **zerar tudo** (devolver a plataforma ao estado inicial), apague a pasta `data/` e inicie o site de novo.

## Publicar na internet (de verdade)

Como você quer que funcione na internet, você precisa colocar este projeto em um servidor online. Veja 3 caminhos, do mais simples ao mais avançado:

### Opção A — Render (recomendado, grátis, mais fácil)
1. Crie uma conta gratuita no [Render.com](https://render.com).
2. Faça push deste projeto para um repositório no **GitHub**.
3. No Render: *New → Web Service* → escolha o repositório.
4. O Render detecta o `npm start` automaticamente. Clique em **Deploy**.
5. Pronto: o Render gera uma URL pública (ex.: `seu-nome.onrender.com`).

### Opção B — Railway (grátis para começar)
1. Crie uma conta no [Railway.app](https://railway.app).
2. *New Project → Deploy from GitHub repo* (ou envie as pastas por CLI).
3. Clique em **Deploy**.
4. A URL pública aparece na tela.

### Opção C — Seu próprio VPS (DigitalOcean, Hostinger VPS, etc.)
```bash
# no servidor
npm install
NODE_ENV=production PORT=3000 nohup npm start &
```
Depois aponte um domínio para o servidor (via DNS) e, se quiser HTTPS, use o [Caddy](https://caddyserver.com) ou o proxy do seu painel.

### ⚠️ Importante sobre os dados na internet
O site salva os dados em um arquivo no disco. Em serviços de hospedagem “efêmeros” (como o plano grátis do Render), esse arquivo **pode ser apagado** quando o serviço dorme. Para garantir que nada se perca, você tem duas opções:

1. **Disk permanente (Render):** em *Environment → Disks*, conecte um disco em `/data` e ajuste o caminho no `.env` (`DATA_DIR=/data`).
2. **Usar um banco de dados externo** (ex.: PostgreSQL + Prisma/Sequelize). É a solução mais robusta para produção. Posso migrar o projeto para um banco se você quiser.

> **Dica de segurança:** defina no ambiente de hospedagem a variável `ADMIN_INITIAL_PASSWORD` com uma senha forte e troque a senha logo após entrar.

## Estrutura do projeto

```
.
├── server.js          # Servidor Node.js + Express (a API e o front)
├── package.json
├── public/
│   ├── index.html     # Página inicial do site (SPA)
│   ├── style.css      # Estilos
│   └── app.js         # Lógica do front-end (JavaScript)
└── data/              # (criado em tempo de execução)
    └── dados.json     # Onde tudo fica salvo
```

Boa sorte com seu marketplace! 🚀
