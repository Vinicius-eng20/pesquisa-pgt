# Sistema de Agendamento de Serviços

Sistema completo de agendamento online com área para clientes e administradores.

## Funcionalidades

### Para Clientes
- Criar conta e fazer login
- Ver serviços disponíveis
- Ver horários livres
- Agendar serviços
- Ver seus agendamentos
- Cancelar agendamentos

### Para Administradores
- Cadastrar e editar serviços
- Definir horários disponíveis
- Ver todos os agendamentos
- Confirmar ou recusar agendamentos
- Gerenciar todo o sistema

## Requisitos

- Node.js (versão 14 ou superior)

## Como Instalar e Executar

1. Instale as dependências:
```bash
npm install
```

2. Inicie o servidor:
```bash
npm start
```

3. Acesse no navegador:
```
http://localhost:3000
```

## Login do Administrador

- **Email:** admin@admin.com
- **Senha:** admin123

**IMPORTANTE:** Altere a senha do administrador após o primeiro acesso!

## Como Colocar na Internet

### Opção 1: Servidor VPS (DigitalOcean, AWS, etc)

1. Contrate um servidor VPS
2. Instale o Node.js no servidor
3. Faça upload dos arquivos
4. Execute `npm install`
5. Configure um gerenciador de processos (PM2):
```bash
npm install -g pm2
pm2 start server.js
pm2 save
pm2 startup
```

### Opção 2: Serviços de Hospedagem Node.js

Plataformas que aceitam aplicações Node.js:
- **Render** (render.com)
- **Railway** (railway.app)
- **Heroku** (heroku.com)
- **Vercel** (vercel.com)

Faça o upload do código e configure conforme a documentação da plataforma.

## Banco de Dados

O sistema usa SQLite, que cria automaticamente o arquivo `agendamento.db` na primeira execução. Todos os dados ficam salvos neste arquivo.

## Segurança

Em produção, altere a chave secreta JWT no arquivo `server.js`:
```javascript
const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-mude-em-producao';
```

Ou configure a variável de ambiente:
```bash
export JWT_SECRET=sua-chave-super-secreta
```

## Estrutura do Projeto

```
├── server.js           # Servidor backend
├── package.json        # Dependências
├── agendamento.db      # Banco de dados (criado automaticamente)
└── public/
    ├── index.html      # Página principal
    ├── style.css       # Estilos
    └── app.js          # Lógica do frontend
```

## Suporte

Para dúvidas ou problemas, verifique:
- Se o Node.js está instalado corretamente
- Se todas as dependências foram instaladas
- Se a porta 3000 está disponível
- Os logs do servidor no terminal
