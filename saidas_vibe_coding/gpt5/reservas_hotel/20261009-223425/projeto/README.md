# Sistema de Reservas de Hotel

Este projeto é um site completo de reservas de hotel, com:

- Cadastro e login de hóspedes
- Login de gerente
- Quartos cadastrados no banco de dados
- Reservas salvas no servidor
- Consulta de disponibilidade por datas
- Cancelamento de reservas por hóspedes
- Confirmação ou recusa de reservas pelo gerente
- Cadastro, edição e remoção de quartos pelo gerente
- Interface responsiva para computador e celular

Os dados ficam salvos em um banco SQLite no servidor, no arquivo `hotel.db`.

## Requisitos

Instale antes:

- Node.js versão 18 ou superior

## Como instalar

Abra o terminal na pasta do projeto e execute:

```bash
npm install
```

## Como iniciar

```bash
npm start
```

Depois abra no navegador:

```text
http://localhost:3000
```

## Conta inicial do gerente

Ao iniciar o projeto pela primeira vez, o sistema cria automaticamente uma conta de gerente:

```text
E-mail: gerente@hotel.com
Senha: gerente123
```

## Observações importantes

- Para usar na internet de verdade, este projeto precisa ser colocado em um servidor com Node.js.
- O banco de dados fica no arquivo `hotel.db`.
- Não depende de serviços externos.
- As informações não ficam apenas no navegador: ficam salvas no servidor.
