# Biblioteca Digital - Sistema de Acervo e Empréstimos

Sistema completo e autônomo de biblioteca digital com controle de acervo, empréstimos, devoluções, bloqueio de leitores em atraso e múltiplos usuários (Leitores e Bibliotecário). Funciona em computadores e celulares conectados à mesma rede ou em um servidor na internet.

---

## 🚀 Como Instalar e Rodar (Passo a Passo)

Você só precisa ter o **Python** instalado no seu computador (se não tiver, baixe a versão mais recente em [python.org](https://www.python.org/downloads/) marcando a opção *"Add Python to PATH"* no instalador).

### 1. Abra o Terminal ou Prompt de Comando
Navegue até a pasta onde descompactou os arquivos do projeto:
```bash
cd caminho/para/a/pasta
```

### 2. Instale os componentes necessários
Execute o comando abaixo:
```bash
pip install -r requirements.txt
```

### 3. Inicie o site
Execute:
```bash
python app.py
```

Pronto! O site já está funcionando.

---

## 🌐 Como Acessar

- **No próprio computador**: Abra o navegador e acesse:
  `http://localhost:5000`

- **Pelo celular ou outro computador na mesma rede Wi-Fi**:
  Descubra o endereço de IP do computador que está rodando o programa (ex: `192.168.1.15`) e abra no navegador do celular:
  `http://SEU_IP:5000` (exemplo: `http://192.168.1.15:5000`)

---

## 🔑 Contas Pré-cadastradas para Testar

O sistema cria automaticamente as seguintes contas na primeira execução:

1. **Bibliotecário (Acesso completo e administrativo):**
   - **E-mail:** `admin@biblioteca.com`
   - **Senha:** `admin123`

2. **Leitor (Demonstração):**
   - **E-mail:** `leitor@biblioteca.com`
   - **Senha:** `leitor123`

*(Novos leitores podem se cadastrar livremente clicando em "Cadastre-se" na página inicial).*

---

## 📚 Funcionalidades Incluídas

- **Leitor:**
  - Busca de livros por título, autor ou gênero.
  - Ver detalhes do exemplar e quantidade de cópias disponíveis em tempo real.
  - Pegar livro emprestado com 1 clique (com prazo automático de 14 dias).
  - Ver empréstimos ativos, prazos e histórico completo.
  - Devolver livros diretamente pelo sistema.
- **Bibliotecário:**
  - Cadastrar, alterar dados e remover livros do acervo.
  - Histórico geral e em tempo real de empréstimos de todos os leitores.
  - Filtro de empréstimos ativos, atrasados e devolvidos.
  - Painel de controle de leitores com identificação de atrasos.
  - Botão de bloqueio/desbloqueio imediato para impedir novos empréstimos de leitores inadimplentes.
- **Armazenamento Seguro:**
  - Banco de dados SQLite permanente (`biblioteca.db`). Não perde nada ao fechar ou reiniciar.
