# Sistema de Gestão de Tarefas de Equipe

Este é um sistema completo e funcional, pronto para uso imediato na internet. Não requer configurações complexas, contas em serviços externos ou conhecimento técnico avançado para começar a usar.

## Pré-requisitos

Apenas o **Node.js** instalado no computador ou servidor onde o site vai rodar.
- Baixe e instale em: https://nodejs.org/ (versão LTS recomendada)
- Verifique se instalou abrindo o terminal e digitando: `node -v`

## Como instalar e executar

1.  **Baixe ou clone os arquivos** para uma pasta no seu computador ou servidor.
2.  **Abra o terminal** (Prompt de Comando no Windows, Terminal no Mac/Linux) e navegue até essa pasta.
3.  **Instale as dependências** (bibliotecas necessárias) digitando:
    ```bash
    npm install
    ```
4.  **Inicie o servidor** digitando:
    ```bash
    npm start
    ```
5.  **Acesse o site**:
    - No mesmo computador: abra o navegador e vá para `http://localhost:3000`
    - De outros computadores ou celulares na mesma rede: use o IP do computador onde o servidor está rodando (ex: `http://192.168.1.10:3000`)
    - Para acesso pela internet (qualquer lugar): você precisará hospedar este projeto em um servidor com IP público ou usar um serviço de hospedagem Node.js (como Render, Railway, VPS, etc.). O sistema funciona de forma independente, sem depender de bancos de dados externos.

## Primeiro Acesso (Importante)

O sistema cria automaticamente um usuário **Gerente** padrão na primeira vez que é executado:

- **Usuário:** `admin`
- **Senha:** `admin123`

**Recomendação de Segurança:** Assim que entrar pela primeira vez, vá em "Gerenciar Membros", edite o usuário `admin` e altere a senha.

## Como usar

1.  **Login:** Entre com `admin` / `admin123`.
2.  **Criar Membros:** No painel do gerente, clique em "Gerenciar Membros" e adicione as pessoas da sua equipe. Defina um nome de usuário e senha para cada um.
3.  **Criar Tarefas:** O gerente pode criar tarefas e atribuir a qualquer membro. Membros também podem criar tarefas para si mesmos.
4.  **Acesso dos Membros:** Cada membro entra com sua própria conta e vê apenas suas tarefas (ou pode ver todas se for gerente).
5.  **Sincronização:** Tudo é salvo automaticamente no servidor. Se você criar uma tarefa no computador, ela aparecerá no celular ao atualizar a página. Se um membro atualizar o status, o gerente vê a mudança.

## Estrutura de Dados

Os dados são salvos em arquivos locais na pasta `data/`:
- `users.json`: Lista de usuários e permissões.
- `tasks.json`: Lista de todas as tarefas.

**Não apague a pasta `data/`** enquanto o sistema estiver em uso, pois isso apagará todas as informações.

## Solução de Problemas

- **Erro "Port already in use":** A porta 3000 está ocupada. Feche outros programas que usem essa porta ou altere a porta no arquivo `server.js` (linha `const PORT = 3000;`).
- **Não consigo acessar de outro dispositivo:** Verifique se o firewall do computador permite conexões na porta 3000. Certifique-se de que ambos estão na mesma rede Wi-Fi.
- **Esqueci a senha do admin:** Pare o servidor, delete o arquivo `data/users.json` e reinicie o servidor. Isso recriará o usuário admin padrão (mas apagará os outros usuários).
