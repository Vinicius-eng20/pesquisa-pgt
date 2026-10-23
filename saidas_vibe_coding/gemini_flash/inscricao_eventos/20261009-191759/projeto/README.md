# Portal de Inscrição em Eventos

Portal completo e pronto para uso de gestão e inscrição de eventos. Não depende de serviços externos, bancos de dados em nuvem ou cadastros em outros sites: tudo roda de forma 100% autônoma e os dados ficam salvos permanentemente no próprio servidor dentro da pasta `data/`.

---

## 🚀 Como Colocar para Rodar (Passo a Passo)

Você só precisa ter o **Node.js** instalado no seu computador. Se não tiver, baixe a versão recomendada (LTS) no site oficial: [https://nodejs.org](https://nodejs.org) (basta clicar em avançar e instalar).

### 1. Abra o Terminal ou Prompt de Comando
Navegue até a pasta onde estão os arquivos deste projeto:

```bash
cd caminho/para/a/pasta/do/projeto
```

### 2. Instale as dependências
Execute o comando:

```bash
npm install
```

### 3. Inicie o portal
Execute o comando:

```bash
npm start
```

Pronto! Você verá a mensagem:
`Portal de Eventos rodando em: http://localhost:3000`

Abra seu navegador (Chrome, Edge, Firefox, Safari) e acesse:
**[http://localhost:3000](http://localhost:3000)**

---

## 👥 Contas Prontas para Testar de Imediato

O sistema já inicia com duas contas pré-configuradas para você testar tudo de imediato:

### 1. Conta de Organizador
- **E-mail:** `organizador@portal.com`
- **Senha:** `senha123`
- **Permissões:**
  - Criar novos eventos;
  - Editar dados (título, descrição, categoria, data, local e vagas);
  - Cancelar ou reativar eventos;
  - Acessar a tela **"Presença & Inscritos"** com a lista de todos os inscritos;
  - Fazer check-in / confirmar a presença de cada participante com 1 clique.

### 2. Conta de Participante
- **E-mail:** `participante@portal.com`
- **Senha:** `senha123`
- **Permissões:**
  - Visualizar todos os eventos disponíveis e vagas restantes;
  - Inscrever-se em eventos com 1 clique;
  - Acessar a tela **"Minhas Inscrições"**;
  - Cancelar suas próprias inscrições quando quiser;
  - Ver se sua presença já foi confirmada pelo organizador.

> **Novas contas:** Qualquer pessoa pode clicar em "Cadastrar", escolher se quer ser **Participante** ou **Organizador** e criar sua própria conta.

---

## 📱 Como Usar no Celular e no Computador ao Mesmo Tempo

Tudo fica salvo no servidor central (pasta `data/`). Portanto, tudo o que for feito em um aparelho aparece imediatamente no outro:

1. No computador onde o servidor foi iniciado, abra o terminal e descubra seu IP local (ex: no Windows digite `ipconfig`; no Mac/Linux digite `ifconfig` ou `ip a`). Exemplo: `192.168.1.15`.
2. Conecte o celular na mesma rede Wi-Fi.
3. No navegador do celular, acesse: `http://SEU_IP:3000` (ex: `http://192.168.1.15:3000`).
4. Faça login com a mesma conta e você verá todos os dados sincronizados.

---

## 🌐 Como Colocar na Internet de Verdade (Gratuitamente)

Se você quiser colocar este site no ar para qualquer pessoa do mundo acessar sem depender do seu computador ligado, basta hospedar em qualquer plataforma como:
- **Render.com** (Basta conectar a pasta ou repositório GitHub e clicar em "New Web Service" -> Node -> `npm start`);
- **Railway.app** ou **Fly.io** ou qualquer VPS (Linux/Ubuntu).

Nenhum arquivo ou banco de dados externo é necessário. Tudo o que o sistema precisa já está contido neste projeto!
