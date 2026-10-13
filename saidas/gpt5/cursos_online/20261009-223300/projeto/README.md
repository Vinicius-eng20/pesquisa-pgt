# Plataforma de Cursos Online com Matrícula

Este projeto é um site completo com backend, frontend, login, cadastro, administração, cursos e matrículas.

Os dados ficam salvos em um banco SQLite no próprio projeto (`data/app.db`), então não somem ao fechar o navegador ou reiniciar o site.

## Requisitos

Instale o Node.js:

https://nodejs.org/

Recomendado: Node.js 20 ou superior.

## Como instalar

Abra o terminal na pasta do projeto e execute:

```bash
npm install
```

## Como iniciar

```bash
npm start
```

Depois acesse no navegador:

```text
http://localhost:3000
```

## Conta de administrador

Ao iniciar pela primeira vez, o sistema cria automaticamente uma conta de administrador:

```text
Email: admin@site.com
Senha: admin123
```

## Alunos

Alunos podem criar conta pelo botão "Criar conta" na tela inicial.

## Funcionalidades

### Aluno
- Criar conta
- Entrar com email e senha
- Ver cursos disponíveis
- Matricular-se em cursos
- Ver suas matrículas
- Cancelar sua própria matrícula

### Administrador
- Entrar com a conta admin
- Criar cursos
- Editar cursos
- Remover cursos
- Ver todas as matrículas
- Cancelar matrículas de qualquer aluno

## Observações

- O banco de dados fica em `data/app.db`.
- Para usar em outro computador na mesma rede, acesse pelo IP da máquina que está rodando o projeto.
- Para publicar na internet de verdade, é necessário colocar este projeto em um servidor/VPS próprio com Node.js. Não é necessário usar serviços externos de banco de dados.
