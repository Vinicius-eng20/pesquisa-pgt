# Sistema de Pedidos para Restaurante

Site completo com cadastro de clientes, cardápio, pedidos e painel do gerente. Tudo salvo em banco de dados local (SQLite), sem depender de serviços externos.

## Como instalar e executar

Você precisa ter o **Node.js** instalado (baixe em https://nodejs.org).

1. Abra o terminal (Prompt de Comando ou Terminal) na pasta do projeto.
2. Instale as dependências:

```
npm install
```

3. Inicie o servidor:

```
npm start
```

4. Abra o navegador em:

```
http://localhost:3000
```

## Contas

- **Gerente padrão** (criado automaticamente):
  - Email: `gerente@restaurante.com`
  - Senha: `admin123`

- **Clientes**: crie a conta na tela inicial (aba de cadastro).

## O que cada um pode fazer

**Cliente:**
- Ver o cardápio
- Adicionar pratos ao carrinho e finalizar pedido
- Acompanhar o status de seus pedidos

**Gerente:**
- Cadastrar, editar e remover pratos do cardápio
- Ver todos os pedidos de todos os clientes
- Alterar a situação de qualquer pedido (Pendente, Preparando, Pronto, Entregue, Cancelado)

## Colocar na internet

Para publicar na internet de verdade, hospede em serviços como Render, Railway ou Fly.io (todos aceitam projetos Node.js). O arquivo `restaurante.db` guarda todos os dados permanentemente. Em produção, recomenda-se usar um disco persistente para manter o banco.
