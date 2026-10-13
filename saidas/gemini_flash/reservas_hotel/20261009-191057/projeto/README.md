# Sistema de Reservas de Hotel - Hotel Bellagio

Sistema web completo de reservas para hotel, pronto para uso tanto por **hóspedes** quanto pelo **gerente do hotel**. Todos os dados ficam salvos em arquivo permanente no servidor (`data/hotel.json`), permitindo que as informações persistam mesmo se o computador ou servidor for reiniciado, e que hóspedes e gerente acessem de qualquer aparelho (computador ou celular) com sincronização em tempo real.

---

## 🚀 Como Instalar e Rodar (Passo a Passo Simples)

### 1. Pré-requisito
Você só precisa ter o **Node.js** instalado no seu computador.
Se não tiver, baixe a versão recomendada no site oficial: [https://nodejs.org/](https://nodejs.org/) (a instalação é apenas avançar).

### 2. Baixar e Entrar na Pasta do Projeto
Abra o **Terminal** (no Mac/Linux) ou **Prompt de Comando / PowerShell** (no Windows) e entre na pasta do projeto:

```bash
cd caminho/para/a/pasta/do/projeto
```

### 3. Instalar as Dependências
Execute o comando abaixo:

```bash
npm install
```

### 4. Iniciar o Sistema
Execute o comando:

```bash
npm start
```

Pronto! O terminal mostrará:
```text
===============================================
 Hotel Bellagio - Sistema de Reservas Online
 Servidor rodando com sucesso na porta: 3000
 Acesse pelo computador: http://localhost:3000
===============================================
```

Abra seu navegador (Google Chrome, Firefox, Edge ou Safari) e acesse:
👉 **`http://localhost:3000`**

---

## 👥 Contas Prontas para Testar

O sistema já vem configurado com duas contas de teste:

### 👑 Conta do Gerente do Hotel:
* **E-mail:** `gerente@hotel.com`
* **Senha:** `admin123`
* **O que o gerente pode fazer:**
  * Acessar a aba **Painel do Gerente**.
  * Ver **todas as reservas** feitas por todos os hóspedes.
  * **Confirmar** ou **Recusar** qualquer reserva pendente.
  * **Cadastrar novos quartos** com foto, comodidades, valor da diária e capacidade.
  * **Editar** dados dos quartos existentes ou **excluir** quartos.

### 👤 Conta de Hóspede de Teste:
* **E-mail:** `hospede@email.com`
* **Senha:** `123456`
* (Ou qualquer pessoa pode clicar em **"Entrar / Cadastrar"** e criar sua própria conta na hora com seu próprio e-mail e senha).
* **O que o hóspede pode fazer:**
  * Escolher datas de check-in, check-out e quantidade de pessoas para pesquisar quartos disponíveis.
  * Ver apenas quartos livres para as datas escolhidas (o sistema não permite quartos duplicados na mesma data).
  * Fazer reservas com cálculo automático do valor total das diárias.
  * Acessar a aba **Minhas Reservas** para acompanhar se a reserva foi confirmada ou cancelá-la se desejar.

---

## 📱 Como Usar no Celular (Mesma Rede Wi-Fi)

Para testar o site funcionando no seu celular ao mesmo tempo que no computador:
1. Conecte o celular na mesma rede Wi-Fi do computador.
2. Descubra o IP local do seu computador:
   * **Windows:** Abra o Prompt de Comando e digite `ipconfig` (procure por *Endereço IPv4*, ex: `192.168.1.15`).
   * **Mac/Linux:** Abra o Terminal e digite `ifconfig` ou `ip a`.
3. No navegador do seu celular, digite:
   `http://SEU_IP_AQUI:3000` (exemplo: `http://192.168.1.15:3000`).
4. Tudo o que você fizer no celular aparecerá imediatamente no computador e vice-versa!

---

## 🌐 Como Colocar na Internet de Verdade (Grátis)

Se quiser colocar na internet para qualquer pessoa no mundo acessar sem precisar do seu computador ligado, basta subir este projeto em serviços gratuitos como:
* [Render.com](https://render.com) (Web Service gratuito)
* [Railway.app](https://railway.app)
* [Fly.io](https://fly.io)

Basta conectar sua pasta do projeto e o comando de inicialização é automaticamente `npm start`.

---

## 💾 Onde os Dados Ficam Salvos?
Todos os usuários cadastrados, quartos criados e histórico de reservas são gravados automaticamente no arquivo:
`data/hotel.json`

Mesmo se você desligar o computador ou fechar o terminal, **nada é perdido**. Ao rodar `npm start` novamente, todos os dados continuarão exatamente como você deixou.
