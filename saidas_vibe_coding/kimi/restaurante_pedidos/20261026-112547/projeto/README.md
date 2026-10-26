# Sistema de Pedidos de Restaurante (Clientes + Gerente)

## Como rodar na sua máquina (para testar)
1. Instale o **Node.js (versão 18 ou superior)**.
2. Baixe este projeto e abra um terminal na pasta dele.
3. Instale as dependências:
   ```bash
   npm install
   ```
4. Rode o servidor:
   ```bash
   npm start
   ```
5. Abra no navegador:
   - http://localhost:3000

## Login do Gerente (primeiro acesso)
- E-mail: `gerente@restaurante.com`
- Senha: `123456`

> Troque essa senha depois (o projeto já salva usuários no banco; você pode criar outro usuário e mudar o papel para `manager` no banco se quiser).

## Como colocar “na internet de verdade” (opcional)
Você precisa hospedar o servidor em um provedor (ex.: um VPS). Depois de copiar os arquivos para o servidor:
- `npm install`
- `npm start`

O banco SQLite fica salvo no arquivo `data/restaurante.db` (persistente).

## Variáveis de ambiente (opcional, recomendado)
- `SESSION_SECRET` (obrigatório em produção)
- `PORT` (padrão 3000)
- `DB_FILE` (padrão `data/restaurante.db`)
