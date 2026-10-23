# Controle de Despesas Pessoais

Site completo para controle de despesas pessoais com usuários comuns e administrador.

## O que o sistema faz

- Usuários podem:
  - Criar conta
  - Entrar no sistema
  - Registrar despesas
  - Escolher categoria da despesa
  - Ver total gasto no mês
  - Ver histórico de despesas

- Administrador pode:
  - Entrar no painel administrativo
  - Cadastrar categorias de gastos
  - Ativar ou desativar categorias
  - Desativar contas de usuários
  - Reativar contas de usuários
  - Ver total de gastos de todos os usuários
  - Ver total de usuários e despesas

- Os dados ficam salvos em banco SQLite no servidor.
- Funciona em computador e celular.
- Não depende de serviços externos.

## Requisitos

Você precisa ter instalado:

- Node.js 18 ou superior

Para verificar se tem Node.js instalado:

```bash
node -v
```

## Como instalar

Na pasta do projeto, execute:

```bash
npm install
```

## Como iniciar o site

Execute:

```bash
npm start
```

Depois abra no navegador:

```text
http://localhost:3000
```

## Conta de administrador inicial

Ao iniciar o sistema pela primeira vez, ele cria automaticamente um administrador:

```text
E-mail: admin@admin.com
Senha: admin123
```

Depois de entrar, recomenda-se alterar diretamente criando outro administrador no banco ou modificando a senha no código antes de usar publicamente.

## Observação importante para uso real na internet

Este projeto salva tudo em um arquivo chamado:

```text
database.sqlite
```

Ele fica na própria pasta do projeto no servidor.

Para colocar na internet, você precisa hospedar este projeto em um servidor que rode Node.js e mantenha o arquivo `database.sqlite` salvo entre reinicializações.

## Comandos principais

Instalar dependências:

```bash
npm install
```

Executar:

```bash
npm start
```

Executar em modo desenvolvimento:

```bash
npm run dev
```

## Estrutura

```text
server.js
database.js
package.json
public/
  index.html
  login.html
  register.html
  dashboard.html
  admin.html
  styles.css
  app.js
```
