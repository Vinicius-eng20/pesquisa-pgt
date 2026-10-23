# Gestão de Tarefas da Equipe

Sistema completo de gestão e distribuição de tarefas para equipes e gerentes. Funciona em tempo real pelo navegador, tanto no computador quanto no celular. Os dados ficam salvos em um banco de dados próprio e nunca somem ao fechar a janela.

---

## 🚀 Como Colocar para Funcionar (Passo a Passo Fácil)

Você só precisa ter o **Node.js** instalado no seu computador. (Se ainda não tiver, baixe a versão recomendada em [nodejs.org](https://nodejs.org/)).

### 1. Abra o Terminal ou Prompt de Comando
Abra a pasta do projeto no Terminal (ou no Prompt de Comando do Windows).

### 2. Instale os componentes do sistema
Digite o comando abaixo e aperte **Enter**:
```bash
npm install
```
*Espere alguns segundos até que ele termine de baixar tudo o que precisa.*

### 3. Inicie o site
Digite o comando abaixo e aperte **Enter**:
```bash
npm start
```

Pronto! Você verá uma mensagem confirmando que o sistema está no ar:
```text
===============================================
 Sistema de Gestão de Tarefas Rodando!
 Acesso local: http://localhost:3000
===============================================
```

### 4. Abra no Navegador
Abra o navegador de sua preferência (Chrome, Edge, Firefox, Safari) e acesse:
👉 **`http://localhost:3000`**

---

## 👥 Contas Prontas para Testar

O sistema já vem com usuários e tarefas de teste cadastrados automaticamente:

### 👑 Carlos (Gerente)
* **E-mail:** `gerente@equipe.com`
* **Senha:** `123456`
* **Permissões:** Vê todas as tarefas de todos os membros, cria e distribui tarefas para qualquer pessoa, edita e exclui qualquer tarefa.

### 👤 Ana (Membro da Equipe)
* **E-mail:** `ana@equipe.com`
* **Senha:** `123456`
* **Permissões:** Vê apenas as tarefas que recebeu, altera o andamento das suas tarefas (Pendente, Em Andamento, Concluída) e cria tarefas para si mesma.

### 👤 Bruno (Membro da Equipe)
* **E-mail:** `bruno@equipe.com`
* **Senha:** `123456`

*(Você também pode clicar na aba "Criar Nova Conta" na tela inicial para registrar novos membros ou gerentes a qualquer momento).*

---

## 📱 Como Usar no Celular e em Outros Computadores

Se os aparelhos estiverem conectados na mesma rede Wi-Fi:
1. No computador onde o sistema foi ligado, descubra o seu IP local (ex: `192.168.1.15`).
2. No celular ou em outro computador, abra o navegador e digite o IP seguido de `:3000` (exemplo: `http://192.168.1.15:3000`).
3. Qualquer alteração feita no celular aparecerá imediatamente quando você acessar no computador!

## 🌐 Como Colocar na Internet de Verdade (Sem Pagar Nada)

Se quiser que qualquer pessoa da equipe acesse de qualquer lugar do mundo pela internet sem precisar do seu computador ligado, basta hospedar este projeto gratuitamente em plataformas como **Render.com** ou **Railway.app**:
1. Crie uma conta no [Render](https://render.com).
2. Clique em **New Web Service**.
3. Conecte o repositório ou envie os arquivos.
4. O comando de início (*Start Command*) será automaticamente: `npm start`.
5. Você receberá um link público da internet (exemplo: `https://sua-equipe-tarefas.onrender.com`) para enviar à sua equipe!
