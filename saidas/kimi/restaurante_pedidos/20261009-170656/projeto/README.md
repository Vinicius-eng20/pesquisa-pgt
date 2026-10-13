# Sistema de Pedidos - Restaurante

Este projeto contém o código para um site de um restaurante.

## O que este site faz

*   **Para o Cliente:** Permite criar uma conta, ver o cardápio, fazer pedidos e ver a lista de pedidos que já fez.
*   **Para o Gerente:** Permite fazer login com uma conta de gerente, ver todos os pedidos de todos os clientes, mudar o status de um pedido (de "Pendente" para "Em preparo", etc.), e gerenciar o cardápio (adicionar, editar e remover pratos).

## Importante: Como fazer funcionar na internet

O código está completo, mas para que ele funcione de verdade na internet (acessível de qualquer lugar e com os dados salvos para todos), ele precisa ser instalado em um **servidor**.

Um servidor é um computador que fica ligado 24 horas por dia na internet. Você pode contratar um em empresas de hospedagem de sites. Os dados não serão salvos apenas no seu aparelho, mas sim neste servidor, garantindo que todos vejam as mesmas informações.

**A pessoa que for instalar isso para você precisará seguir os passos abaixo.**

---

## Comandos para Instalar e Rodar o Projeto (Para a pessoa técnica)

Estas instruções são para a pessoa que vai configurar o site no servidor.

### 1. Pré-requisitos (O que precisa estar instalado no servidor)

*   **Node.js:** É a ferramenta que permite que o nosso código funcione no servidor.
    *   **Como instalar (em servidores Linux/Ubuntu):**
        ```bash
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        sudo apt-get install -y nodejs
        ```
*   **MongoDB:** É o banco de dados onde todas as informações (usuários, cardápio, pedidos) ficarão salvas de forma segura e permanente.
    *   **Como instalar (em servidores Linux/Ubuntu):** Siga o tutorial oficial do MongoDB, pois ele garante a instalação correta e segura. Você pode encontrar [aqui](https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/).

### 2. Instalando o Site

1.  **Salve os arquivos:** Crie uma pasta no seu servidor e salve os dois arquivos abaixo (`package.json` e `server.js`) dentro dela.

2.  **Abra um terminal** (ou "prompt de comando") na pasta onde você salvou os arquivos.

3.  **Instale as dependências:** Este comando lê o arquivo `package.json` e instala todas as peças que o nosso site precisa para funcionar.
    ```bash
    npm install
    ```

4.  **Inicie o Servidor:** Este comando liga o site.
    ```bash
    node server.js
    ```

    Se tudo deu certo, você verá a mensagem `Servidor rodando em http://localhost:3000`. O site está no ar! Para acessá-lo de outros lugares, você usará o endereço de IP ou o domínio do seu servidor.

### 3. Como criar a conta de Gerente

Por segurança, a conta de gerente não é criada pelo site.

1.  Primeiro, crie uma conta de cliente normal pelo site (por exemplo, com o e-mail `gerente@restaurante.com`).
2.  Depois, a pessoa técnica precisa rodar um comando no servidor para transformar essa conta em gerente.

    *   Abra um novo terminal na pasta do projeto.
    *   Rode o seguinte comando, trocando o e-mail pelo e-mail que você cadastrou:
    ```bash
    node server.js make-admin "gerente@restaurante.com"
    ```
    Pronto! Agora, ao fazer login com essa conta, você terá acesso ao painel de gerente.

---

### Código Fonte

Abaixo estão os dois arquivos necessários para o sistema funcionar.
