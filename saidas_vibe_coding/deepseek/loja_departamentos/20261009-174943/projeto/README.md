# Loja Virtual de Departamentos

Uma loja virtual completa com produtos variados, carrinho de compras, pedidos e painel administrativo.

## Como instalar e executar

1. Instale o [Node.js](https://nodejs.org/) (versão 18 ou superior).

2. Abra o terminal na pasta do projeto e rode:

```bash
npm install
```

3. Inicie o servidor:

```bash
npm start
```

4. Abra o navegador em: http://localhost:3000

## Contas padrão

- **Administrador (dono da loja):**
  - Email: `admin@loja.com`
  - Senha: `admin123`

- **Cliente de exemplo:**
  - Email: `cliente@loja.com`
  - Senha: `cliente123`

## Para publicar na internet

Você pode hospedar este projeto em serviços como [Render](https://render.com), [Railway](https://railway.app) ou qualquer servidor com Node.js. Basta subir os arquivos e rodar `npm start`.

## Funcionalidades

### Clientes
- Cadastro e login
- Ver produtos por departamento
- Adicionar ao carrinho
- Finalizar pedido
- Ver histórico de pedidos

### Administrador
- Cadastrar, editar e remover produtos
- Ver todos os pedidos
- Alterar situação dos pedidos

## Armazenamento

Todos os dados (usuários, produtos, pedidos) são salvos em um banco de dados SQLite no próprio servidor (`loja.db`). Nada depende do navegador — funciona de qualquer dispositivo.
