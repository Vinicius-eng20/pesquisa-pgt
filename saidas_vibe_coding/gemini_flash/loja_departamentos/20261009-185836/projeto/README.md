# SuperShop - Shopping Virtual de Departamentos

Loja virtual de departamentos completa, persistente e pronta para uso. Funciona em computadores, tablets e celulares, sincronizando os dados em tempo real no servidor SQLite local sem depender de nenhum serviço externo ou criar contas em outros sites.

---

## 🚀 Como Instalar e Rodar o Projeto

Você só precisa ter o **Node.js** instalado no seu computador (se não tiver, baixe a versão recomendada LTS no site oficial: [https://nodejs.org](https://nodejs.org)).

### Passo 1: Abrir a pasta do projeto no Terminal ou Prompt de Comando
Abra o Prompt de Comando (Windows) ou Terminal (Mac/Linux) na pasta onde estão os arquivos deste projeto.

### Passo 2: Instalar as dependências
Digite o comando abaixo e aperte Enter:
```bash
npm install
```

### Passo 3: Iniciar o site
Após o término da instalação, execute o comando:
```bash
npm start
```

### Passo 4: Acessar a loja
Abra seu navegador de internet (Chrome, Edge, Firefox, Safari) e acesse:
```
http://localhost:3000
```

> **Para acessar pelo celular ou outro computador na mesma rede Wi-Fi:**  
> Descubra o endereço de IP do seu computador (ex: `192.168.1.15`) e acesse no celular:  
> `http://192.168.1.15:3000`

---

## 🔑 Contas Pré-Cadastradas para Testar Imediatamente

O sistema já cria automaticamente duas contas iniciais e produtos de diversos departamentos:

### 1. Dono da Loja (Administrador)
- **E-mail:** `admin@shopping.com`
- **Senha:** `admin123`
- *Poderes:* Cadastrar novos produtos, editar preços e fotos, remover produtos, acompanhar todos os pedidos de todos os clientes e atualizar a situação (Pendente, Em Separação, Enviado, Entregue, Cancelado).

### 2. Cliente de Teste
- **E-mail:** `cliente@shopping.com`
- **Senha:** `cliente123`
- *Poderes:* Navegar por departamentos, buscar produtos, adicionar ao carrinho (o carrinho fica salvo na conta e sincroniza entre celular e computador), finalizar compras e acompanhar o histórico dos seus pedidos.

*(Qualquer visitante também pode clicar em **"Cadastre-se"** na barra superior e criar sua própria conta de cliente instantaneamente).*

---

## 📂 Departamentos Já Incluídos
- Eletrônicos & Informática
- Moda & Calçados
- Casa & Eletrodomésticos
- Esportes & Lazer
- Beleza & Cuidados Pessoais
- Brinquedos & Games
