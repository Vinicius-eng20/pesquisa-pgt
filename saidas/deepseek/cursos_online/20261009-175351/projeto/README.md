# Plataforma de Cursos Online

Site completo de cursos online com matrícula, contas de aluno e administrador. Tudo salvo no próprio servidor (banco de dados SQLite), funciona em qualquer computador ou celular pela internet.

## Como instalar e executar

Você precisa ter o **Node.js** instalado (versão 18 ou superior). Baixe em https://nodejs.org.

No terminal, dentro da pasta do projeto, execute:

```bash
npm install
npm start
```

O site ficará disponível em: **http://localhost:3000**

## Conta de administrador padrão

- **E-mail:** admin@admin.com
- **Senha:** admin123

(Recomendado trocar a senha depois do primeiro acesso.)

## O que os alunos podem fazer

- Ver todos os cursos disponíveis
- Criar conta e fazer login
- Matricular-se em cursos
- Ver e cancelar suas próprias matrículas

## O que o administrador pode fazer

- Cadastrar, editar e remover cursos
- Ver todas as matrículas de todos os alunos
- Cancelar qualquer matrícula

## Persistência de dados

Todos os dados ficam salvos na pasta `data/` (arquivos `app.db` e `sessions.db`). Isso significa que:
- Se você fechar e abrir o site, nada se perde.
- Se um aluno entrar pelo celular, verá os mesmos dados que via no computador.
- O administrador vê as matrículas feitas por todos os alunos, de qualquer aparelho.

## Como colocar na internet

O site usa apenas Node.js e arquivos locais, sem serviços externos. Para publicá-lo:

1. Envie o projeto para um serviço de hospedagem que rode Node.js (ex.: Render, Railway, Fly.io, VPS própria).
2. Configure o comando de start como `npm start`.
3. Pronto — o site estará acessível por qualquer navegador.

Lembre-se de fazer backup periódico da pasta `data/` para não perder os dados.
