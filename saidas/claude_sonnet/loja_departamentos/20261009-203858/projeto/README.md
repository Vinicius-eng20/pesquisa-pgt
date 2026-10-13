# Loja Virtual - Shopping Online

Uma loja virtual completa com carrinho de compras, sistema de pedidos e painel administrativo.

## Funcionalidades

### Para Clientes:
- Navegação por produtos e categorias
- Visualização detalhada de produtos
- Carrinho de compras persistente
- Finalização de pedidos
- Histórico de pedidos
- Sistema de autenticação (cadastro e login)

### Para Administradores:
- Gerenciamento completo de produtos (criar, editar, excluir)
- Visualização de todos os pedidos
- Alteração de status dos pedidos
- Dashboard com estatísticas

## Instalação

### Pré-requisitos
- Node.js (versão 14 ou superior)

### Passos para instalar e executar:

1. Clone ou extraia os arquivos do projeto em uma pasta

2. Abra o terminal/prompt de comando na pasta do projeto

3. Instale as dependências:
```bash
npm install
```

4. Inicie o servidor:
```bash
npm start
```

5. Acesse o site no navegador:
```
http://localhost:3000
```

## Informações de Login

### Conta Administrador (já criada):
- Email: admin@loja.com
- Senha: admin123

### Conta de Cliente:
- Crie sua conta clicando em "Cadastrar" no site

## Estrutura do Projeto

```
loja-virtual/
├── server.js          # Servidor backend com todas as APIs
├── package.json       # Dependências do projeto
├── loja.db           # Banco de dados (criado automaticamente)
├── public/
│   ├── index.html    # Página HTML principal
│   ├── styles.css    # Estilos da aplicação
│   └── app.js        # JavaScript do frontend
└── README.md         # Este arquivo
```

## Tecnologias Utilizadas

- **Backend**: Node.js + Express
- **Banco de Dados**: SQLite (better-sqlite3)
- **Autenticação**: bcryptjs + cookies
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)

## Observações Importantes

- Todos os dados ficam salvos no arquivo `loja.db` que é criado automaticamente
- O carrinho de compras fica salvo no navegador e sincroniza com o servidor ao finalizar pedidos
- A aplicação funciona em qualquer dispositivo (responsiva)
- Não é necessário criar conta em outros serviços, tudo funciona localmente
- Para usar em produção (internet), você precisará hospedar em um servidor Node.js

## Comandos Disponíveis

```bash
# Instalar dependências
npm install

# Iniciar servidor
npm start

# Iniciar servidor (alternativo)
npm run dev
```

## Suporte

O servidor roda na porta 3000 por padrão. Se quiser mudar a porta, defina a variável de ambiente PORT:

```bash
PORT=8080 npm start
```

## Produtos de Exemplo

O sistema já vem com 12 produtos de exemplo em diferentes categorias:
- Eletrônicos
- Moda
- Eletrodomésticos
- Livros

Você pode adicionar, editar ou remover produtos através do painel administrativo.
