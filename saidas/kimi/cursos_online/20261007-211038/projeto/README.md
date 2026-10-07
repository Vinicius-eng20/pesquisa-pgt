# Plataforma de Cursos Online

Este é um projeto completo de uma plataforma de cursos online com sistema de matrículas, painel de alunos e painel de administrador. Tudo (frontend, backend e banco de dados) está contido neste único projeto, sem a necessidade de serviços externos pagos ou APIs de terceiros.

## Requisitos
- Você precisa ter o **Node.js** instalado no seu computador (versão 14 ou superior). 
- Se não tiver, baixe e instale em: https://nodejs.org/

## Como rodar o projeto (Passo a passo)

1. Abra o terminal (ou Prompt de Comando) na pasta onde estão esses arquivos.
2. Instale as dependências do projeto rodando o comando:
   ```bash
   npm install
   ```
3. Inicie o servidor rodando o comando:
   ```bash
   npm start
   ```
4. O site estará rodando! Abra o seu navegador e acesse:
   ```
   http://localhost:3000
   ```

## Contas de Acesso Inicial
O sistema já cria um usuário Administrador automaticamente na primeira vez que é aberto.
- **Usuário Administrador:** `admin`
- **Senha do Administrador:** `admin123`

Para os alunos, basta clicar em "Criar conta de Aluno" na tela inicial e fazer o cadastro. 

## Como colocar na internet (Hospedagem)
Como este projeto roda um servidor próprio com banco de dados interno, você precisa de uma hospedagem que aceite Node.js (VPS ou plataformas como Render, Railway, Replit).
Para hospedar, basta subir esses arquivos para o seu servidor de preferência, instalar o Node.js nele e rodar os mesmos comandos acima (`npm install` e `npm start`).

---
