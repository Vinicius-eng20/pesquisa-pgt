# Plataforma de Cursos Online

Site completo com cadastro de alunos, matrícula em cursos e painel de administração. Os dados ficam salvos em um banco de dados SQLite (arquivo `cursos.db`), ou seja, tudo permanece salvo mesmo ao fechar e reabrir o site.

## O que vem pronto

- **Alunos**: podem criar conta, ver cursos disponíveis, se matricular e ver os cursos em que estão matriculados.
- **Administrador**: pode cadastrar, editar e remover cursos, ver todas as matrículas de todos os alunos e cancelar matrículas.
- **Login do administrador padrão** (já criado automaticamente):
  - Email: `admin@admin.com`
  - Senha: `admin123`

## Como instalar e executar

Você precisa ter o **Node.js** instalado (baixe em https://nodejs.org — escolha a versão LTS e instale com as opções padrão).

Depois, abra o terminal (Prompt de Comando no Windows, ou Terminal no Mac/Linux) na pasta do projeto e rode:

```
npm install
```

Isso instala tudo que o site precisa (só precisa fazer uma vez).

Depois, para iniciar o site:

```
npm start
```

Você verá a mensagem: `Servidor rodando em http://localhost:3000`

Abra o navegador e acesse:

```
http://localhost:3000
```

Pronto! O site está funcionando.

## Como publicar na internet

Para que o site fique acessível pela internet, hospede em um serviço que suporte Node.js. Recomendamos o **Render** (render.com) ou **Railway** (railway.app) — ambos possuem planos gratuitos:

1. Crie uma conta nesses serviços.
2. Faça upload do projeto (ou conecte um repositório no GitHub).
3. Configure:
   - **Build command**: `npm install`
   - **Start command**: `npm start`
4. O serviço irá gerar uma URL pública do tipo `https://seu-site.onrender.com`. Basta compartilhar essa URL.

O banco de dados continuará funcionando automaticamente, pois fica salvo junto com o site.

## Como usar

1. Acesse o site e **crie uma conta** (aba "Criar Conta") ou entre com uma conta existente.
2. Como aluno, veja os cursos em **Cursos Disponíveis** e clique em **Matricular-se**.
3. Veja seus cursos em **Meus Cursos**.
4. Para entrar como administrador, faça login com `admin@admin.com` / `admin123`. No painel de admin você poderá criar/editar/remover cursos e gerenciar todas as matrículas.
