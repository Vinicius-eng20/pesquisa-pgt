# 📚 Biblioteca Digital Online

Sistema completo de biblioteca digital com empréstimo de itens, funcionando de verdade na internet. Tudo salvo em banco de dados próprio — nada se perde ao fechar o site.

## O que o sistema faz

### 👤 Leitores
- Criar conta e entrar com login e senha
- Buscar e ver todos os itens do acervo (livros, revistas, DVDs, etc.)
- Pegar itens emprestados (com prazo de 14 dias)
- Devolver os itens que pegou
- Ver seus empréstimos ativos e histórico

### 👔 Bibliotecário
- Cadastrar, editar e remover itens do acervo
- Ver todos os empréstimos de todos os leitores (ativos e histórico)
- Bloquear/desbloquear leitores (leitores com atraso ficam impossibilitados de pegar novos itens automaticamente, e o bibliotecário também pode bloquear manualmente)
- Cadastrar novos bibliotecários

## Como instalar e executar

### Pré-requisitos
- **Node.js** instalado (versão 18 ou superior). Baixe em: https://nodejs.org

### Passo a passo

1. **Abra o terminal** (Prompt de Comando no Windows, Terminal no Mac/Linux) na pasta do projeto.

2. **Instale as dependências:**
```bash
npm install
```

3. **Execute o site:**
```bash
npm start
```

4. **Abra no navegador:**
```
http://localhost:3000
```

Pronto! O site está funcionando.

### Primeiro acesso

Na primeira vez que o site rodar, é criada automaticamente a conta do bibliotecário:

- **Usuário:** `admin`
- **Senha:** `admin123`

⚠️ **Importante:** Entre com essa conta e mude a senha na primeira vez (ou cadastre outro bibliotecário e use a conta nova).

Os leitores se cadastram sozinhos na tela inicial, clicando em "Criar conta de leitor".

## Como colocar na internet (funcionar de verdade online)

Para que qualquer pessoa acesse pela internet, você precisa hospedar o site. Opções simples:

### Opção 1: Render (gratuito, recomendado)
1. Crie uma conta em https://render.com
2. Suba este projeto para um repositório no GitHub
3. No Render, clique em "New" → "Web Service" → conecte seu repositório
4. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Adicione um **disco persistente** (para o banco de dados não ser apagado):
   - Em "Disks", adicione um disco com mount path: `/opt/render/project/src/data`
   - Crie a variável de ambiente: `DATA_DIR=/opt/render/project/src/data`
6. Clique em "Deploy" — pronto, seu site estará no ar com um endereço tipo `https://sua-biblioteca.onrender.com`

### Opção 2: Railway (gratuito)
1. Crie conta em https://railway.app
2. Suba o projeto no GitHub e conecte
3. Adicione um volume montado em `/app/data` e a variável `DATA_DIR=/app/data`
4. Deploy automático

### Opção 3: Servidor próprio (VPS)
Se tiver um servidor (ex: DigitalOcean, Hostinger VPS):
```bash
npm install
npm start
```
E configure um proxy (nginx) ou acesse pela porta 3000.

## Variáveis de ambiente (opcionais)

| Variável | Padrão | Para que serve |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `DATA_DIR` | pasta `data/` do projeto | Onde o banco de dados fica salvo |
| `SESSION_SECRET` | gerado automaticamente | Segredo das sessões (defina um valor fixo em produção) |
| `ADMIN_PASSWORD` | `admin123` | Senha inicial do admin |

Exemplo em produção:
```bash
SESSION_SECRET=minha-senha-secreta-longa-e-aleatoria npm start
```

## Onde os dados ficam salvos

Tudo fica no arquivo `data/biblioteca.db` (banco SQLite). Para fazer backup, basta copiar esse arquivo.

## Tecnologias
- Node.js + Express (servidor)
- SQLite (banco de dados embutido — não precisa instalar nada extra)
- HTML/CSS/JS puro no frontend (sem build, sem complicação)

---
