# Sistema de Agendamento de Serviços

Este projeto é um sistema completo de agendamento de serviços com:

- Cadastro e login de usuários
- Área do cliente
- Área do responsável pelo negócio
- Cadastro, edição e exclusão de serviços
- Cadastro e exclusão de horários disponíveis
- Agendamento de serviços pelos clientes
- Cancelamento de agendamentos pelos clientes
- Confirmação ou recusa de agendamentos pelo responsável
- Visualização de todos os agendamentos
- Dados salvos em banco SQLite no servidor

## Importante

Este projeto funciona de verdade com dados persistentes, mas precisa ser executado em um servidor Node.js.

Você não precisa criar conta em serviços externos.

## Requisitos

Instale antes:

- Node.js 18 ou superior

## Como instalar

Abra o terminal na pasta do projeto e execute:

```bash
npm install
```

## Como iniciar

```bash
npm start
```

Depois acesse no navegador:

```text
http://localhost:3000
```

## Conta inicial do responsável

Ao iniciar o sistema pela primeira vez, ele cria automaticamente uma conta de administrador:

```text
E-mail: admin@site.com
Senha: admin123
```

Entre com essa conta para cadastrar serviços e horários.

## Como colocar na internet

Para funcionar na internet, envie este projeto para um servidor que execute Node.js.

Exemplos: VPS própria, servidor dedicado ou qualquer hospedagem que permita rodar Node.js e manter arquivos no disco.

O banco de dados fica salvo no arquivo:

```text
database.sqlite
```

Não apague esse arquivo, pois ele guarda os usuários, serviços, horários e agendamentos.

## Comandos

Instalar:

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
