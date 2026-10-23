# Loja Virtual de Departamentos

Projeto completo de uma loja virtual com:

- Cadastro e login de usuários
- Cliente:
  - Visualizar produtos
  - Buscar produtos
  - Adicionar ao carrinho
  - Finalizar pedido
  - Ver pedidos feitos
- Dono da loja / administrador:
  - Cadastrar produtos
  - Editar produtos
  - Remover produtos
  - Ver todos os pedidos
  - Alterar status dos pedidos
- Dados salvos no servidor em banco SQLite
- Funciona em computador e celular
- Não depende de serviços externos

## Requisitos

Instale no computador ou servidor:

- Node.js 18 ou superior
- npm

## Instalar

```bash
npm install
```

## Executar

```bash
npm start
```

Depois acesse no navegador:

```text
http://localhost:3000
```

## Conta inicial do dono da loja

Ao iniciar o projeto pela primeira vez, uma conta de administrador é criada automaticamente:

```text
Email: admin@loja.com
Senha: admin123
```

Entre com essa conta para cadastrar produtos e gerenciar pedidos.

## Observações importantes

- O banco de dados fica no arquivo `database.sqlite`.
- Os dados não somem ao fechar o navegador.
- Para colocar na internet de verdade, hospede este projeto em um servidor Node.js.
- Não apague o arquivo `database.sqlite` se quiser manter os dados.
