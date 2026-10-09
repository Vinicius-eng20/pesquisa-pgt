# Plataforma de Cursos Online

Site completo para cadastro e matrícula em cursos online, com área de aluno e área de administrador. Todo o conteúdo (cursos, matrículas e contas) fica salvo dentro do próprio navegador, então as informações permanecem mesmo se você fechar e abrir o site de novo.

## Como instalar e executar

Você precisa ter o **Node.js** instalado (instale em https://nodejs.org se ainda não tiver).

1. Abra o terminal dentro da pasta do projeto.
2. Rode o comando:
   ```
   npm install
   ```
3. Para abrir o site no seu computador (modo de desenvolvimento):
   ```
   npm run dev
   ```
   Depois abra o navegador em `http://localhost:5173`.

4. Para publicar na internet (produção):
   ```
   npm run build
   ```
   O site pronto para publicar fica na pasta `dist`.
   Você pode publicar a pasta `dist` em qualquer hospedagem estática como **Netlify**, **Vercel** ou **GitHub Pages**.

> Dica rápida para Netlify: no painel, crie um site novo e arraste a pasta `dist`. Pronto.

## Como funciona

- Na tela inicial, escolha **Entrar como Aluno** ou **Entrar como Administrador**.
- **Conta padrão do administrador** (já vem criada):
  - Usuário: `admin`
  - Senha: `admin123`
- Os alunos escolhem seu nome, usuário e senha quando entram pela primeira vez (é criado o cadastro automaticamente).
- Depois de entrar, o aluno pode: ver os cursos disponíveis, se matricular e ver seus cursos matriculados.
- O administrador pode: cadastrar, editar e remover cursos, ver todas as matrículas de todos os alunos e cancelar matrículas.

## Observação importante sobre "funcionar na internet"

Nesta versão, os dados ficam guardados no navegador de cada pessoa (localStorage). Ou seja:

- O site funciona de verdade na internet, mas cada visitante vê e salva os dados no seu próprio navegador.
- Um aluno que matricula em um curso não vê essa matrícula na tela do administrador (e vice-versa), pois não há um servidor compartilhando os dados entre todos.

Se você quiser que **todos os usuários vejam os mesmos cursos e matrículas de verdade** (administrador vê as matrículas de todos os alunos), é necessário uma base de dados em um servidor (backend). Posso criar essa versão também se você me pedir.
