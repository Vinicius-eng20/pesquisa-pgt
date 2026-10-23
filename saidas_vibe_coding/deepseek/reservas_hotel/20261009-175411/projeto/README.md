# Sistema de Reservas de Hotel

Sistema completo de reservas de hotel com armazenamento em banco de dados SQLite (no próprio servidor), autenticação de usuários e perfis de hóspede/gerente.

## Como instalar e executar

1. Instale o [Node.js](https://nodejs.org/) (versão 18 ou superior).
2. Abra o terminal na pasta do projeto.
3. Instale as dependências:

```bash
npm install
```

4. Inicie o servidor:

```bash
npm start
```

5. Abra o navegador em: http://localhost:3000

## Contas pré-criadas

Ao iniciar pela primeira vez, o sistema cria automaticamente:

- **Gerente**: usuário `gerente` / senha `gerente123`
- **Hóspede**: usuário `hospede` / senha `hospede123`

Novos hóspedes podem se cadastrar livremente pela tela inicial.

## Observações

- Todos os dados ficam salvos no arquivo `hotel.db` (SQLite), no próprio servidor.
- Para usar na internet, hospede este projeto em qualquer serviço que rode Node.js (Render, Railway, Fly.io, VPS, etc.). Basta subir os arquivos e rodar `npm install && npm start`.
- O banco de dados persiste entre reinicializações.
