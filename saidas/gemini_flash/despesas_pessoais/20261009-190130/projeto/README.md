# Sistema de Controle de Despesas Pessoais

Sistema web completo de controle financeiro pessoal com suporte a múltiplos usuários e painel de administrador.

Todas as informações são gravadas automaticamente em um banco de dados SQLite (`despesas.db`) mantido no próprio servidor. As alterações feitas pelo computador ou pelo celular permanecem salvas de forma unificada e permanente.

---

## 🚀 Como Instalar e Rodar o Projeto

Você precisa ter o **Node.js** instalado no seu computador (versão 16 ou superior). Se ainda não tiver, baixe e instale em [nodejs.org](https://nodejs.org/).

### Passo 1: Abrir o terminal na pasta do projeto
Abra a pasta onde você descompactou os arquivos do projeto no seu terminal (Prompt de Comando, PowerShell ou Terminal).

### Passo 2: Instalar as dependências
Execute o comando abaixo e aguarde alguns segundos:
```bash
npm install
```

### Passo 3: Iniciar o site
Execute o comando para ligar o servidor:
```bash
npm start
```

### Passo 4: Acessar no navegador
Abra o seu navegador de internet e entre no endereço:
```
http://localhost:3000
```

Se quiser acessar do seu celular conectado na mesma rede Wi-Fi, basta abrir o navegador do celular e digitar o IP do seu computador com a porta 3000 (exemplo: `http://192.168.1.15:3000`).

---

## 🔑 Contas e Acessos

### 1. Conta do Administrador (criada automaticamente)
- **E-mail:** `admin@admin.com`
- **Senha:** `admin123`

O Administrador tem acesso a menus exclusivos:
- **Visão Geral:** visualiza a soma de todos os gastos já cadastrados no site por todos os usuários, número total de usuários e gráficos consolidados.
- **Categorias:** cadastra novas categorias de gastos com cores personalizadas ou remove categorias existentes.
- **Gerenciar Usuários:** visualiza quanto cada usuário cadastrado já gastou no sistema e possui o botão para **Desativar** ou **Reativar** a conta de qualquer pessoa.

### 2. Usuários Comuns (Você e outras pessoas)
- Qualquer pessoa pode clicar na aba **"Criar Conta"** na tela inicial, digitar seu nome, e-mail e senha.
- O usuário registra seus gastos diários informando descrição, valor, data e categoria.
- Pode selecionar o **mês de referência** para ver a soma total gasta naquele mês e o percentual gasto em cada categoria.
- Pode filtrar despesas por categoria ou excluir gastos que errou.
- Se a conta de um usuário for desativada pelo administrador, ele é impedido de entrar até que a conta seja reativada.

---

## 🌐 Como colocar na Internet de verdade (Gratuitamente)

Como o site é totalmente autocontido e não depende de nenhum serviço externo, você pode publicá-lo em qualquer plataforma de hospedagem em nuvem:

1. Suba esta pasta para um repositório no **GitHub**.
2. Crie uma conta gratuita no [Render.com](https://render.com) ou [Railway.app](https://railway.app).
3. Conecte seu repositório do GitHub:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. O Render ou Railway gerará um link público seguro (com `https://`) que você e qualquer pessoa podem acessar diretamente de computadores ou celulares em qualquer lugar do mundo.
