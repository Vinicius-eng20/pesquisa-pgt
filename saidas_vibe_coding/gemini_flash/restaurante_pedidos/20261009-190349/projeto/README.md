# Sistema de Pedidos para Restaurante

Sistema completo de pedidos para restaurante, pronto para uso em computadores e celulares. Não necessita de serviços externos e armazena todos os dados de forma permanente no próprio servidor.

---

## 🚀 Como instalar e rodar (Passo a Passo)

Você só precisa ter o **Python** instalado no seu computador (se não tiver, baixe a versão mais recente em [python.org](https://www.python.org)).

### 1. Abra o Terminal ou Prompt de Comando
Navegue até a pasta onde descompactou os arquivos do projeto:
```bash
cd caminho/para/a/pasta
```

### 2. Instale os componentes necessários
Execute o comando:
```bash
pip install -r requirements.txt
```

### 3. Inicie o sistema
Execute o comando:
```bash
python app.py
```

### 4. Acesse no navegador
Abra seu navegador de internet e entre no endereço:
```
http://localhost:5000
```

Para acessar pelo **celular ou outro computador na mesma rede Wi-Fi**, basta abrir o navegador do celular e digitar o IP do computador onde o sistema está rodando (exemplo: `http://192.168.1.100:5000`). O próprio terminal mostra o endereço de rede ao iniciar.

---

## 👥 Contas de Acesso

O sistema já vem inicializado com um cardápio de exemplo e a conta do gerente:

- **Gerente (Administrador):**
  - **E-mail:** `gerente@restaurante.com`
  - **Senha:** `admin123`
  - *Funções:* Ver todos os pedidos em tempo real, mudar o status dos pedidos (Recebido, Em Preparo, Saiu para Entrega, Entregue, Cancelado), adicionar, editar, pausar e remover pratos do cardápio.

- **Clientes:**
  - Qualquer pessoa pode clicar em **"Criar Conta"** na tela inicial, cadastrar seu nome, telefone e endereço.
  - *Funções:* Navegar pelo cardápio, adicionar itens ao carrinho com observações, fechar pedidos e acompanhar o andamento em tempo real.

---

## 💾 Onde ficam salvos os dados?

Todos os dados (usuários, cardápio, fotos e histórico de pedidos) são gravados no arquivo de banco de dados `restaurante.db`, criado automaticamente na mesma pasta. Mesmo se o computador for desligado, nada é perdido.
