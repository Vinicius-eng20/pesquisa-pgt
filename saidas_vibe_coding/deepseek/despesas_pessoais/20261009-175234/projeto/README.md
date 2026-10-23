# Controle de Despesas Pessoais

Sistema web completo de controle de despesas pessoais, com contas de usuário, categorias e painel administrativo.

## Como instalar e executar

1. Instale o **Node.js** (versão 18 ou superior): https://nodejs.org
2. Abra o terminal (Prompt de Comando / Terminal) na pasta do projeto.
3. Instale as dependências:

```
npm install
```

4. Inicie o servidor:

```
npm start
```

5. Abra no navegador: http://localhost:3000

## Acesso do administrador padrão

- **Email:** admin@admin.com
- **Senha:** admin123

Recomenda-se trocar a senha após o primeiro acesso. Para criar outro usuário administrador, edite o banco ou crie um novo cadastro e altere o campo `is_admin` para `1` no banco de dados.

## O que cada tipo de usuário pode fazer

**Usuário comum:**
- Cadastrar-se e fazer login de qualquer dispositivo.
- Registrar despesas com valor, data, categoria e descrição.
- Ver o total gasto no mês e o resumo por categoria.
- Navegar entre meses.
- Excluir suas próprias despesas.

**Administrador:**
- Tudo que o usuário comum pode, mais:
- Cadastrar novas categorias de despesa.
- Desativar / ativar categorias.
- Desativar / ativar contas de usuários.
- Ver o total de gastos de todos os usuários e o valor individual de cada um.

## Onde os dados ficam salvos

Todos os dados ficam armazenados em banco de dados SQLite dentro do site, na pasta `data/`:
- `data/app.db` — usuários, categorias e despesas.
- `data/sessions.db` — sessões de login.

Nada é salvo apenas no aparelho do usuário: tudo fica no servidor, então ao entrar de qualquer computador ou celular os mesmos dados aparecem.

## Colocar na internet

O projeto funciona em qualquer serviço que hospede Node.js (Render, Railway, Fly.io, VPS, etc.). Basta:

1. Subir o projeto para o serviço.
2. Definir as variáveis de ambiente (opcional):
   - `PORT` — porta (a maioria dos serviços define automaticamente).
   - `SESSION_SECRET` — string aleatória para segurança das sessões.
   - `DATA_DIR` — pasta onde salvar o banco (importante em hospedagens com disco persistente, ex.: `/data`).
3. Usar um disco persistente apontando para a pasta de dados, para que nada seja perdido entre reinicializações.

Comando de start: `npm start`
