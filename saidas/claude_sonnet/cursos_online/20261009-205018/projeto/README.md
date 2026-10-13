# Plataforma de Cursos Online

Uma plataforma completa de cursos online com sistema de autenticação, matrículas e painel administrativo.

## Funcionalidades

### Para Alunos:
- Criar conta e fazer login
- Ver todos os cursos disponíveis
- Matricular-se em cursos
- Ver cursos em que está matriculado
- Cancelar matrículas

### Para Administradores:
- Cadastrar novos cursos
- Editar cursos existentes
- Remover cursos
- Ver todas as matrículas de todos os alunos
- Cancelar matrículas

## Requisitos

- Node.js (versão 14 ou superior)

## Instalação

1. Instale as dependências:
```bash
npm install
```

## Como Executar

1. Inicie o servidor:
```bash
npm run dev
```

2. Abra seu navegador e acesse:
```
http://localhost:3000
```

## Credenciais Padrão

**Administrador:**
- Email: admin@plataforma.com
- Senha: admin123

## Como Usar

1. **Primeira vez:**
   - Acesse a página inicial
   - Clique em "Criar Conta" para criar uma conta de aluno
   - Ou faça login como administrador usando as credenciais acima

2. **Como Aluno:**
   - Navegue pelos cursos disponíveis
   - Clique em "Matricular-se" para se inscrever em um curso
   - Acesse a aba "Meus Cursos" para ver seus cursos
   - Cancele matrículas se necessário

3. **Como Administrador:**
   - Clique em "Novo Curso" para cadastrar um curso
   - Clique em "Editar" para modificar um curso existente
   - Clique em "Remover" para excluir um curso
   - Acesse a aba "Todas as Matrículas" para ver e gerenciar todas as matrículas

## Armazenamento de Dados

Todos os dados são armazenados em um banco de dados SQLite local (arquivo `plataforma.db`). Os dados persistem mesmo após reiniciar o servidor.

## Porta

O servidor roda na porta 3000 por padrão. Se precisar mudar, defina a variável de ambiente PORT:
```bash
PORT=8080 npm run dev
```

## Observações

- Todos os dados ficam salvos no arquivo de banco de dados
- As sessões de login funcionam em qualquer dispositivo
- O sistema funciona completamente offline, sem necessidade de serviços externos
- Senha do admin pode ser alterada diretamente no banco de dados se necessário
