# Sistema de Pedidos do Restaurante

Um site de pedidos onde os clientes veem o cardápio, fazem pedidos e acompanham o andamento, e o gerente cadastra/edita/remove pratos, vê todos os pedidos e muda o status deles.

Tudo fica salvo num banco de dados do próprio site (arquivo `data.db`). Quem fizer alguma coisa, a mudança aparece para todo mundo que entra no site — no computador ou no celular.

---

## O que você precisa ter instalado (uma única vez)

Só uma coisa: o **Node.js**.

1. Abra este link: **https://nodejs.org**
2. Baixe a versão **LTS** (o botão maior, verde).
3. Instale normalmente (próximo, próximo, pronto).
4. Depois é só fechar e reabrir o terminal.

Para conferir que instalou, abra o terminal (Windows: menu Iniciar, digite `cmd` e abra "Prompt de Comando") e escreva:

```
node -v
```

Se aparecer um número (tipo `v20...`), está tudo certo.

---

## Como colocar para rodar

1. Salve **todos os arquivos** abaixo dentro de **uma mesma pasta** (por exemplo, uma pasta chamada `restaurante`).
2. Abra o terminal **dentro dessa pasta**:
   - **Windows:** abra a pasta no Explorador, clique na barra de endereço no topo, digite `cmd` e aperte Enter.
   - **Mac:** abra o Finder, clique na pasta, depois menu **Arquivo → Novo Terminal na Pasta**.
3. Na pasta ainda **não existe** o arquivo `data.db` — ele é criado automaticamente na primeira vez.
4. Para instalar as coisas que o programa precisa, digite:

   ```
   npm install
   ```

   Aguarde terminar.

5. Para **ligar o site**, digite:

   ```
   npm start
   ```

   Se aparecer algo como `Servidor rodando em http://localhost:3000`, está no ar.

6. Abra o site no navegador:
   - **No mesmo computador:** http://localhost:3000
   - **No celular ou em outro computador da mesma rede** (mesmo Wi-Fi): use o IP do seu computador. Veja como descobrir abaixo.

### Como descobrir o IP do seu computador

No terminal (mesma pasta), digite:

- **Windows:**
  ```
  ipconfig
  ```
  Procure a linha **Endereço IPv4** (algo tipo `192.168.x.x`).

- **Mac:**
  ```
  ifconfig
  ```
  Procure a linha que começa com `inet` e não é `127.0.0.1` (algo tipo `192.168.x.x`).

Depois, no **celular** (conectado no **mesmo Wi-Fi**), abra o navegador e vá para:

```
http://192.168.x.x:3000
```

(coloque o número que apareceu no lugar de `192.168.x.x`)

### Para **desligar o site**

Mantenenha o terminal aberto enquanto o site estiver ligado. Para parar, digite `Ctrl + C` no terminal.

---

## Contas já prontas (para começar agora)

Já vem um gerente cadastrado. Para entrar:

- **Gerente**
  - Nome: `Gerente`
  - E-mail: `gerente@restaurante.com`
  - Senha: `123456`

> A partir daí, você pode criar mais contas na tela de login (para cada cliente) ou cadastrar mais gerentes.

> Importante: o site só funciona enquanto o `npm start` estiver rodando no seu computador. Para ele ficar 24h na internet, você precisaria hospedar o servidor num computador que fique ligado — mas, enquanto estiver rodando assim, tudo funciona normalmente entre os aparelhos da mesma rede.

---

## Arquivos

| Arquivo | O que é |
|---|---|
| `server.js` | O servidor (roda no seu computador, guarda os dados) |
| `package.json` | Lista as dependências |
| `public/index.html` | A página única do site |
| `public/style.css` | A aparência |
| `public/app.js` | As funções do site |

---

## Observações

- **Senha esquecida:** se perder a senha, você pode excluir a pasta `data` (apagar o arquivo `data.db`) para recomeçar do zero — mas isso apaga todos os pedidos, pratos e contas.
- **Fazer backup:** basta copiar o arquivo `data/data.db`. Ele guarda tudo.
- **Cardápio inicial:** já vem com alguns pratos de exemplo que você pode editar ou apagar na tela do gerente.
