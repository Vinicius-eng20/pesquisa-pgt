# Biblioteca Digital — acervo, empréstimos e devoluções

Um site completo que funciona **de verdade na internet**: leitores entram de qualquer computador ou celular e veem as mesmas informações; tudo que alguém faz aparece para quem precisa ver; e nada some ao fechar e reabrir o site.

Todo o servidor fica **dentro do próprio projeto**. Você não precisa criar conta em nenhum outro site nem ligar com nenhum serviço externo.

## O que você precisa

- Um computador com **Python 3** instalado.
  - No Windows: baixe o instalador em https://www.python.org/downloads/ e, durante a instalação, **marque a opção "Add Python to PATH"**.
  - No Mac: abra o **Terminal** e digite `python3`. Se aparecer uma versão, já está pronto.
- Para rodar **online na internet** (etapa 2), uma conta gratuita no **Render** (render.com).

Não precisa instalar nada mais. As dependências do site são instaladas automaticamente.

## Como rodar no seu computador (teste rápido)

Abra um terminal **na pasta deste projeto** e digite:

```bash
python -m venv .venv
```

Depois:

- **Windows:**
  ```bash
  .venv\Scripts\activate
  python -m pip install -r requirements.txt
  python -m venv\Scripts\activate
  python main.py
  ```
- **Mac ou Linux:**
  ```bash
  source .venv/bin/activate
  python -m pip install -r requirements.txt
  python main.py
  ```

Depois que aparecer a mensagem "no ar", abra no navegador: **http://localhost:8000**

> Dica: para abrir com o navegador sozinho, mude a última linha de `main.py` para `uvicorn.run(app, host="0.0.0.0", port=8000, reload=True, open_url=True)`.

Para **parar o site**, aperte **Ctrl + C** no terminal.

## Como colocar na internet (para leitores e bibliotecário usarem)

1. Crie uma conta gratuita no **Render** (render.com) e faça login.
2. Crie um repositório no **GitHub** com os arquivos deste projeto.
3. No Render: **New** → **Web Service** → aponte para o seu repositório do GitHub.
   - **Runtime:** Python
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python main.py`
4. Clique em **Deploy**. Quando terminar, o Render te dá um endereço como `https://nome-do-site.onrender.com`. Esse é o site na internet, acessível por qualquer pessoa, de qualquer aparelho.

> O Render pode "dormir" quando fica sem uso e volta a subir sozinho após alguns segundos no primeiro acesso — é normal na versão gratuita.

## Criando as contas

Na tela de login tem um botão **"Criar conta"**:

- **Leitores:** criam a própria conta (nome, usuário, senha).
- **Bibliotecário:** crie uma conta de leitor normalmente e depois, na tela de admin, toque em **"Solicitar acesso de bibliotecário"** (ou mande o administrador criar a conta com o papel de bibliotecário).

**Importante:** guarde a sua senha — não há sistema de "esqueci a senha". Se alguém perder a senha, o bibliotecário pode recriar a conta na tela de administração.

## Onde ficam os dados

Os dados ficam em um arquivo **`dados.json`** dentro da pasta do projeto.

- **No seu computador:** ele fica na pasta do projeto. Não apague.
- **No Render (na internet):** os arquivos locais podem ser apagados ao atualizar o site. Para garantir que nada suma, conecte um **disco persistente** do Render e aponte ele para a pasta de dados. No Render: no seu serviço, vá em **Disk** → **Add Persistent Disk**, e depois, nas **Environment Variables**, crie uma variável `DATA_DIR` com o valor que o Render indicar (ex.: `/data`). O site passa a salvar tudo lá.

Se você **não** conectar o disco, os dados na internet podem ser perdidos em cada atualização — por isso, para uso real, **faça a conexão do disco**.

## Regras do site (resumo)

- Cada item tem um **número de exemplares**. Se só há 1 exemplar, ele pode estar emprestado por apenas uma pessoa de cada vez.
- O **prazo** de empréstimo é em dias (definido por item, padrão 14).
- Um leitor com **empréstimo em atraso** tem os **novos empréstimos bloqueados** — ele precisa devolver primeiro.
- O bibliotecário pode **bloquear manualmente** um leitor (para impedir novos empréstimos) e **desbloquear** depois.
- O bibliotecário vê o **histórico de empréstimos de todos** e pode **devolver um item** em nome do leitor.
- Leitor e bibliotecário veem **avisos de atraso** automaticamente.

## Estrutura dos arquivos

- `main.py` — o site inteiro (páginas, regras e banco de dados).
- `requirements.txt` — as dependências.
- `dados.json` — criado automaticamente; guarda tudo (contas, acervo, empréstimos).
