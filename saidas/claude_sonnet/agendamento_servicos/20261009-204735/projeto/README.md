# Sistema de Agendamento de Serviços

Sistema completo de agendamento de serviços com autenticação, gerenciamento de serviços, horários e agendamentos.

## Funcionalidades

### Para Clientes:
- Criar conta e fazer login
- Ver serviços disponíveis com preços e descrições
- Ver horários disponíveis em tempo real
- Agendar serviços
- Ver histórico de agendamentos
- Cancelar agendamentos

### Para Administradores:
- Cadastrar e editar serviços (nome, descrição, duração, preço)
- Configurar horários de funcionamento por dia da semana
- Ver todos os agendamentos de todos os clientes
- Confirmar ou recusar agendamentos
- Dashboard completo de gerenciamento

## Instalação

### Requisitos
- Node.js (versão 14 ou superior)

### Passo a Passo

1. Abra o terminal/prompt de comando na pasta do projeto

2. Instale as dependências:
```bash
npm install
```

3. Inicie o servidor:
```bash
npm start
```

4. Abra o navegador e acesse:
```
http://localhost:3000
```

## Login Administrador Padrão

Ao iniciar o sistema pela primeira vez, um usuário administrador é criado automaticamente:

- **Email:** admin@sistema.com
- **Senha:** admin123

Use estas credenciais para fazer o primeiro acesso como administrador.

## Como Usar

### Primeira Vez

1. Acesse o sistema pelo navegador
2. Faça login como administrador (credenciais acima)
3. Cadastre os serviços oferecidos (ex: Corte de Cabelo, Manicure, etc)
4. Configure os horários de funcionamento (ex: Segunda a Sexta, 9h às 18h)
5. Agora os clientes podem se registrar e agendar!

### Como Cliente

1. Clique em "Registrar" e crie sua conta
2. Na aba "Novo Agendamento":
   - Escolha o serviço desejado
   - Selecione a data
   - Escolha um horário disponível
   - Adicione observações se necessário
   - Clique em "Agendar"
3. Na aba "Meus Agendamentos" você vê todos os seus agendamentos e pode cancelá-los

### Como Administrador

1. **Gerenciar Serviços:**
   - Clique em "Serviços"
   - Clique em "Novo Serviço" para adicionar
   - Preencha nome, descrição, duração (em minutos) e preço
   - Use "Editar" para modificar ou "Desativar" para remover

2. **Configurar Horários:**
   - Clique em "Horários"
   - Clique em "Novo Horário"
   - Escolha o dia da semana
   - Defina hora de início e fim
   - O sistema gera slots de 30 minutos automaticamente

3. **Gerenciar Agendamentos:**
   - Na aba "Agendamentos" você vê todos os pedidos
   - Clique em "Confirmar" para aprovar
   - Clique em "Recusar" para negar

## Tecnologias Utilizadas

- **Backend:** Node.js + Express
- **Banco de Dados:** SQLite (arquivo local, não precisa instalar nada)
- **Frontend:** HTML + CSS + JavaScript puro
- **Autenticação:** Sessões com bcrypt para senhas

## Dados Salvos

Todos os dados ficam salvos no arquivo `agendamento.db` que é criado automaticamente na pasta do projeto. Este arquivo contém:

- Usuários (clientes e administradores)
- Serviços cadastrados
- Horários de funcionamento
- Todos os agendamentos

Mesmo fechando o navegador ou reiniciando o servidor, os dados permanecem salvos.

## Características

- ✅ Funciona em qualquer computador ou celular
- ✅ Interface responsiva e fácil de usar
- ✅ Não precisa criar conta em outros sites
- ✅ Tudo funciona dentro do próprio sistema
- ✅ Dados salvos permanentemente
- ✅ Sistema completo e pronto para uso
- ✅ Horários inteligentes (não permite conflitos)
- ✅ Múltiplos usuários podem acessar simultaneamente

## Porta Padrão

O sistema roda na porta 3000. Se precisar mudar, pode definir a variável de ambiente PORT:

```bash
PORT=8080 npm start
```

## Problemas Comuns

**Erro ao instalar:** Certifique-se de que o Node.js está instalado. Baixe em nodejs.org

**Porta em uso:** Se a porta 3000 já estiver sendo usada, o sistema mostrará erro. Feche outros programas ou mude a porta.

**Banco de dados:** O arquivo agendamento.db é criado automaticamente. Não delete este arquivo ou perderá todos os dados.

## Suporte

O sistema é autossuficiente e não depende de serviços externos. Tudo funciona localmente no seu computador.
