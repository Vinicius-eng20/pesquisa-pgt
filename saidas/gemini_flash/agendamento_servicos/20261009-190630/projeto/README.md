# Sistema de Agendamento de Serviços

Sistema completo, moderno e pronto para funcionar de agendamento de serviços online.
Ele roda direto no seu computador ou servidor web, com banco de dados próprio incluso e sem depender de contas ou integrações de terceiros.

---

## 🚀 Como instalar e colocar para funcionar (Passo a Passo)

### 1. Pré-requisito
Você só precisa ter o **Node.js** instalado no seu computador.
* Se ainda não tiver, baixe e instale a versão LTS oficial em: [https://nodejs.org](https://nodejs.org) (basta avançar e concluir a instalação normalmente).

---

### 2. Baixar as dependências e iniciar o site

Abra a pasta do projeto no Terminal (ou no Prompt de Comando / PowerShell do Windows) e execute apenas estes 2 comandos:

```bash
npm install
```

Quando a instalação terminar, inicie o sistema com:

```bash
npm start
```

Pronto! O site já está funcionando.

---

### 3. Acessar o site

Abra qualquer navegador (Chrome, Edge, Safari, Firefox, celular ou computador) e digite o endereço:

👉 **http://localhost:3000**

---

## 🔑 Contas de Acesso

O sistema já cria automaticamente no primeiro início a conta do responsável:

* **E-mail do Responsável:** `admin@negocio.com`
* **Senha:** `admin123`

> Os seus clientes podem clicar no botão **"Entrar / Cadastrar"** no topo da página e criar a própria conta em segundos informando apenas nome, telefone/WhatsApp, e-mail e senha.

---

## 🌟 O que o sistema faz

### Para os Clientes:
1. **Ver Serviços:** Acessar o catálogo com nome, descrição, duração e preço de cada serviço.
2. **Consultar Horários Livres:** Escolher um serviço e uma data. O sistema calcula automaticamente e exibe apenas os horários em que o negócio está aberto e que ainda não foram reservados por ninguém.
3. **Fazer o Agendamento:** Clicar no horário desejado e confirmar a reserva.
4. **Meus Horários:** Ver todos os agendamentos já feitos, acompanhar o status (Pendente, Confirmado, Recusado, Cancelado) e cancelar caso tenha um imprevisto.

### Para o Responsável pelo Negócio (Painel do Administrador):
1. **Painel Geral com Indicadores:** Quantidade de agendamentos pendentes, confirmados, agendados para hoje e total acumulado.
2. **Gerenciamento de Agendamentos:**
   * Ver todos os agendamentos de todos os clientes com nome, telefone e observações.
   * Botões para **Aprovar** ou **Recusar** agendamentos pendentes com 1 clique.
   * Filtros por status e por dia.
3. **Gerenciamento de Serviços:**
   * Cadastrar novos serviços.
   * Alterar nome, preço, duração em minutos e descrição.
   * Desativar ou excluir serviços.
4. **Horários de Funcionamento:**
   * Ativar ou desativar os dias da semana em que você atende.
   * Definir o horário de início e término de cada dia (ex: 08:00 às 18:00).
   * Definir a duração dos intervalos de horário (ex: 30 em 30 minutos).

---

## 💾 Onde as informações ficam salvas?

Tudo fica salvo em um banco de dados próprio (`agendamentos.db`) que é gerado na própria pasta do projeto. 
* Nada é perdido quando você desliga o computador ou reinicia o servidor.
* Se um cliente marcar um horário pelo celular, o responsável vê no computador imediatamente.
* Não é preciso pagar bancos de dados em nuvem nem criar contas externas.

---

## 🌐 Como colocar na internet para clientes reais usarem?

Basta subir esta mesma pasta para qualquer serviço de hospedagem simples de Node.js gratuito ou de baixo custo, como:
* **Render.com** (Basta conectar e clicar em Deploy)
* **Railway.app**
* Qualquer servidor VPS (Ubuntu/Debian com `npm start`)

O sistema lê a porta padrão da internet automaticamente (`process.env.PORT`) sem precisar mudar nenhuma linha de código.
