# Plataforma de Cursos Online

Uma plataforma simples de cursos online com sistema de matrícula. Alunos podem ver cursos, se matricular e ver seus cursos. O administrador pode cadastrar, editar e remover cursos, ver todas as matrículas e cancelá-las.

Tudo fica salvo no próprio servidor (em um arquivo `data/db.json`). Por isso, se a mesma pessoa entrar do celular ou do computador, ela encontra as mesmas informações, e o que uma pessoa faz aparece para quem deve ver.

## Requisitos

- **Node.js 18** ou superior instalado no seu computador/servidor.
  - Para verificar: abra o terminal e digite `node -v`.
  - Se não tiver, baixe em: https://nodejs.org

## Como instalar e executar

1. Abra o terminal (ou Prompt de Comando) na pasta deste projeto.
2. Instale as dependências:

   ```bash
   npm install
   ```

3. Inicie o site:

   ```bash
   npm start
   ```

4. O site ficará disponível em:

   ```
   http://localhost:3000
   ```

## Contas

- **Administrador** (já criada):
  - E-mail: `admin@plataforma.com`
  - Senha: `admin123`

- **Alunos**: crie a conta pela aba "Criar conta" na tela de login.

## Funcionalidades

**Aluno:**
- Ver cursos disponíveis
- Matricular-se em um curso
- Ver os cursos em que está matriculado
- Cancelar sua própria matrícula

**Administrador:**
- Cadastrar, editar e remover cursos
- Ver todas as matrículas de todos os alunos
- Cancelar qualquer matrícula

## Como colocar na internet (opcional)

O servidor precisa rodar em um computador/servidor acessível pela internet. Você pode usar um serviço de hospedagem que execute Node.js (por exemplo, um VPS, Railway, Render ou Fly.io). Basta fazer upload deste projeto e rodar `npm install` e `npm start`.

> Observação: o site usa `http`. Para um ambiente profissional, recomende usar `https` (certificado). As informações ficam salvas em `data/db.json` — faça backup desse arquivo e da pasta `data`.
