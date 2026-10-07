# MegaShop - Loja Virtual de Departamentos

Este é um projeto de uma loja virtual completa (shopping online) com área para clientes e área administrativa para o dono da loja.

## Funcionalidades
*   **Clientes:** Podem se cadastrar, ver produtos por departamentos, adicionar ao carrinho, finalizar compras e ver o histórico de seus pedidos.
*   **Dono da Loja (Admin):** Pode cadastrar, editar e remover produtos, além de ver todos os pedidos da loja e atualizar a situação deles (Pendente, Enviado, Entregue).
*   **Banco de Dados Local:** Tudo é salvo em um arquivo dentro do próprio site. Não precisa de internet externa ou outros serviços para funcionar.

## Como Instalar e Rodar
Para o site funcionar, você precisa ter o **Node.js** instalado no seu computador ou no seu servidor de hospedagem.

1. Abra a pasta do projeto no terminal (ou prompt de comando).
2. Instale as dependências digitando:
   ```bash
   npm install
   ```
3. Inicie o site digitando:
   ```bash
   npm start
   ```
4. O site estará rodando! Acesse pelo navegador no endereço: `http://localhost:3000`

## Acesso Inicial
Para facilitar, o sistema já cria sozinho o usuário do **Dono da Loja** na primeira vez que rodar:
*   **E-mail:** admin@loja.com
*   **Senha:** admin123

Você pode usar essa conta para cadastrar os primeiros produtos da loja. Depois, crie uma conta normal na tela de cadastro para testar a visão do cliente.
