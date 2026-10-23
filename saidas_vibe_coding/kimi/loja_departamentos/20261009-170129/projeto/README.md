# Loja Virtual Completa

## Como instalar e executar

1. **Pré-requisitos**: Instale o Node.js (versão 14 ou superior) em seu computador/servidor

2. **Instalação**:
   ```bash
   npm install
   ```

3. **Executar**:
   ```bash
   npm start
   ```

4. **Acessar**: Abra o navegador em `http://localhost:3000`

## Para colocar na internet (hospedar)

Você precisará de um servidor (VPS) como DigitalOcean, AWS, ou similar:

1. Copie todos os arquivos para o servidor
2. Instale o Node.js no servidor
3. Execute `npm install`
4. Execute `npm start` (use PM2 para manter rodando: `pm2 start server.js`)
5. Configure um domínio apontando para o IP do servidor
6. Configure HTTPS com Let's Encrypt (recomendado)

## Primeiro acesso

- **Criar conta de dono**: Acesse `/admin-setup` e crie a primeira conta de administrador
- **Clientes**: Podem se registrar normalmente na página inicial

## Funcionalidades

### Cliente
- Navegar por produtos
- Adicionar ao carrinho
- Finalizar pedidos
- Ver histórico de pedidos

### Dono da loja
- Cadastrar/editar/remover produtos
- Ver todos os pedidos
- Alterar status dos pedidos

## Banco de dados

O sistema usa SQLite (arquivo `database.db`) que é criado automaticamente. Todos os dados ficam salvos permanentemente no servidor.
