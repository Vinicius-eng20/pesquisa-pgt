# FreelanceMarket

Marketplace de serviços freelance que roda **no próprio servidor** (sem depender de outros sites).
Usuários podem publicar serviços, contratar serviços de outras pessoas e ver os contratos em que
participam. O administrador aprova/remove serviços, suspende contas e vê todos os serviços,
contratos e usuários.

Tudo fica salvo num **banco de dados no servidor** (arquivo `data.sqlite`). Por isso, se você
entrar pelo celular e depois pelo computador (ou fechar e reabrir), encontra as mesmas
informações: os dados ficam no site, não no aparelho.

## Como instalar e rodar

Você precisa ter o **Node.js** instalado (versão 18 ou mais nova). Para conferir:

```bash
node -v
```

Se não tiver, baixe em: https://nodejs.org

Depois, dentro da pasta do projeto, execute estes comandos:

```bash
# 1) Instalar as dependências
npm install

# 2) Subir o servidor
npm start
```

Pronto. Abra no navegador: **http://localhost:3000**

> O primeiro `npm install` pode demorar alguns minutos (ele baixa o banco de dados SQLite).
> Se aparecer uma mensagem de erro do `sqlite3`, rode só uma vez: `npm rebuild sqlite3`.

## Contas

- **Administrador** (criado automaticamente na primeira execução):
  - E-mail: `admin@freelance.com`
  - Senha: `admin123`
  - **Troque essa senha** na aba "Perfil" assim que entrar.
- **Usuários comuns**: crie a conta pela tela "Criar conta".

## O que cada pessoa pode fazer

**Usuário (quem oferece ou contrata):**
- Criar conta e entrar de qualquer aparelho.
- Publicar um serviço que oferece (passa pela aprovação do admin).
- Ver seus serviços e o status de cada um (Aprovado / Aguardando / Removido).
- Contratar serviços de outras pessoas e ver todos os seus contratos.
- Atualizar nome e senha no perfil.

**Administrador:**
- Aprovar ou remover qualquer serviço publicado.
- Suspender ou reativar contas de usuários (a pessoa suspensa não consegue entrar).
- Ver todos os serviços, todos os contratos e todos os usuários.

## Configurações opcionais

Você pode criar um arquivo `.env` na pasta do projeto (veja `.env.example`):

```
PORT=3000                 # porta do site
SECRET=seu-texto-secreto   # usado para gerar as sessões (use algo longo e aleatório)
DB_FILE=./data.sqlite      # onde fica o banco de dados
```

## Para colocar no ar na internet (de verdade)

1. Rode o comando de produção (deixa o site pronto para receber acessos externos):
   ```bash
   npm run build
   npm start
   ```
2. Hospede a pasta num servidor (VPS, Render, Railway, Heroku, etc.) com porta pública (padrão 3000) e um endereço `https`.
3. Todos que abrirem o endereço do site veram as mesmas informações, porque tudo é salvo no `data.sqlite` do servidor.

Para rodar em modo de desenvolvimento (com recarregamento automático):
```bash
npm run dev   # abre em http://localhost:5173 (ele já encaminha as chamadas do site para a porta 3000)
```
