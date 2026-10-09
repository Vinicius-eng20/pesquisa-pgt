# 🛒 Shopping Online - Loja Virtual de Departamentos

Loja virtual completa com cadastro de clientes, carrinho de compras, pedidos e painel administrativo. Todos os dados ficam salvos em um banco de dados SQLite no próprio servidor.

## 📋 O que o site faz

**Clientes podem:**
- Criar conta e fazer login
- Ver produtos por categoria ou buscar
- Adicionar produtos ao carrinho
- Finalizar pedidos informando endereço
- Ver todos os pedidos já realizados

**Administrador pode:**
- Cadastrar, editar e remover produtos (com foto)
- Ver todos os pedidos de todos os clientes
- Alterar a situação dos pedidos (pendente, pago, enviado, entregue, cancelado)
- Ver lista de clientes cadastrados

## 🔑 Conta do administrador (já criada automaticamente)

- **E-mail:** `admin@loja.com`
- **Senha:** `admin123`

> ⚠️ Importante: após entrar como admin, você pode alterar a senha manualmente no banco ou criar outro admin. Recomenda-se trocar essa senha em produção.

## 🚀 Como instalar e executar

### 1. Pré-requisitos
Instale o **Node.js** (versão 18 ou superior): https://nodejs.org

### 2. Instalar dependências
No terminal, dentro da pasta do projeto:

```bash
npm install
```

### 3. Iniciar o servidor

```bash
npm start
```

### 4. Acessar no navegador

Abra: **http://localhost:3000**

## 🌐 Como colocar na internet

O projeto funciona como um servidor Node.js normal. Para publicar online, use qualquer serviço de hospedagem Node.js:

- **Railway** (railway.app) — gratuito para começar
- **Render** (render.com) — gratuito para começar
- **Fly.io** (fly.io)
- **VPS** próprio (DigitalOcean, Contabo, etc.)

**Passos genéricos:**
1. Suba os arquivos para um repositório Git (GitHub, GitLab)
2. Conecte o repositório no serviço escolhido
3. Comando de build: `npm install`
4. Comando de start: `npm start`
5. O serviço define a porta automaticamente pela variável `PORT` (já suportada)

## 💾 Onde os dados ficam salvos

Todos os dados (usuários, produtos, pedidos) ficam no arquivo **`loja.db`** na raiz do projeto. Ele é criado automaticamente na primeira execução.

**Para backup:** basta copiar o arquivo `loja.db`.

## 📁 Estrutura do projeto

```
├── server.js           # Servidor e API
├── package.json        # Dependências
├── loja.db             # Banco de dados (criado automaticamente)
├── public/
│   ├── index.html      # Página principal
│   ├── style.css       # Estilos
│   ├── app.js          # Lógica do site
│   └── uploads/        # Imagens enviadas
└── README.md
```

## 🛠️ Funcionalidades técnicas

- Autenticação com sessão e senha criptografada (bcrypt)
- Banco SQLite embutido (não precisa instalar nada separado)
- Upload de imagens dos produtos
- Controle de estoque automático
- Carrinho salvo no navegador (localStorage)

## ❓ Problemas comuns

**"Porta já em uso"** → Altere a porta: `PORT=3001 npm start`

**Não consigo fazer login como admin** → Apague o arquivo `loja.db` e reinicie o servidor; a conta admin será recriada.

**Perdi meus dados** → Restaure o backup do arquivo `loja.db`.
</html>
