# FreelaHub - Plataforma de Marketplace Freelance

Um sistema completo de marketplace para contratação e oferta de serviços freelance, totalmente independente, com banco de dados próprio e persistência automática.

---

## 📋 Funcionalidades Principais

1. **Para Prestadores e Clientes**:
   - Cadastro e Login com e-mail e senha protegidos com criptografia.
   - Publicar serviços com categoria, preço, prazo e descrição detalhada.
   - Contratar serviços de outras pessoas especificando requisitos e orientações.
   - Acompanhar contratos ativos tanto como cliente quanto como prestador do serviço.
   - Marcar contratos como concluídos ou cancelados.
   - Totalmente responsivo para celulares, tablets e computadores.

2. **Para o Administrador da Plataforma**:
   - Conta padrão com privilégios de moderação pronta para uso.
   - Moderação de serviços: aprovar serviços para ficarem públicos no marketplace, rejeitar ou excluir definitivamente.
   - Gestão de usuários: suspender contas ou reativá-las. Usuários suspensos são bloqueados imediatamente em qualquer aparelho.
   - Visualização de todos os serviços publicados e de todos os contratos firmados em toda a plataforma.
   - Métricas de faturamento em tempo real e quantidade de usuários ativos.

3. **Banco de Dados Real e Persistente**:
   - Salva tudo no arquivo `dados_marketplace.sqlite` no próprio servidor.
   - Você pode fechar o navegador, desligar a máquina ou acessar de outro computador/celular que todas as informações continuam gravadas exatamente no mesmo lugar.

---

## 🚀 Como Instalar e Rodar o Projeto

Você só precisa ter o **Node.js** (versão 18 ou superior) instalado no computador.

### Passo 1: Instalar as dependências
Abra o terminal (Prompt de Comando ou PowerShell no Windows, Terminal no Mac/Linux) dentro da pasta do projeto e execute:

```bash
npm install
```

### Passo 2: Iniciar o site
Após a instalação terminar, digite:

```bash
npm start
```

### Passo 3: Acessar no Navegador
Abra o seu navegador (Chrome, Edge, Firefox, Safari) e acesse:

```
http://localhost:3000
```

---

## 🔑 Contas de Acesso Já Criadas

O sistema já inicializa com as seguintes contas padrão para você testar imediatamente:

### 1. Administrador da Plataforma:
- **E-mail:** `admin@plataforma.com`
- **Senha:** `admin123`
- *Permite acessar a aba "🛡️ Painel Admin" para aprovar serviços, suspender usuários e ver todos os contratos.*

### 2. Usuário de Demonstração (Prestador):
- **E-mail:** `marcos@exemplo.com`
- **Senha:** `123456`
- *Já possui 2 serviços cadastrados e aprovados no catálogo.*

Você também pode clicar no botão **"Criar Conta"** a qualquer momento e cadastrar quantos usuários desejar!

---

## 🌐 Como Colocar na Internet de Verdade (Grátis)

Como o projeto é 100% autônomo e não depende de nenhum serviço externo, você pode colocá-lo no ar em serviços de hospedagem gratuitos como:

1. **Render.com**:
   - Crie um novo "Web Service".
   - Conecte seu repositório Git ou faça o upload.
   - Comando de Build: `npm install`
   - Comando de Inicialização: `npm start`

2. **Railway.app** ou **Fly.io**:
   - Basta importar a pasta e o serviço detectará automaticamente o arquivo `server.js` e rodará o aplicativo.
