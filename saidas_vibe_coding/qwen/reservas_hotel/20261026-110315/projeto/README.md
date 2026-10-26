# Hotel Azul — Sistema de Reservas

Um site completo para reservas de hotel, com duas áreas:
- **Hóspede**: vê os quartos disponíveis nas datas escolhidas, faz e consulta/cancela reservas.
- **Gerente**: cadastra/edita/exclui quartos e confirma/recusa/exclui reservas, vendo tudo.

Os dados ficam salvos no próprio servidor (banco `hotel.db`), então:
- você entra de qualquer computador/celular e encontra a mesma informação;
- o que uma pessoa faz aparece para quem precisa ver;
- fechar e reabrir o site não apaga nada.

---

## 1. Instalar e rodar (no seu computador)

**Pré-requisito:** Python 3.8 ou mais novo. (Se não tiver, baixe em https://www.python.org — durante a instalação, marque a opção “Add Python to PATH”.)

Abra um terminal **na pasta deste projeto** e digite:

```
pip install flask
```

Depois inicie o servidor:

```
python app.py
```

- No **Windows** talvez precise de `pip3` no lugar de `pip`, e `python3` no lugar de `python`.
- O terminal ficará preso nesse comando — é normal (o servidor está rodando).

Abra no navegador:

```
http://localhost:5000
```

### Contas de teste
| Papel    | Usuário  | Senha    |
|----------|----------|----------|
| Gerente  | `gerente`| `123456` |
| Hóspede  | `hospede`| `123456` |

> Os 5 quartos de exemplo já vêm criados. Logue como **gerente** para vê-los.

Para parar o servidor: pressione `Ctrl + C` no terminal.

---

## 2. Como usar

**Hóspede**
1. Crie sua conta (ou use `hospede`/`123456`).
2. Em **Quartos**, escolha a data de entrada e de saída. Os quartos ocupados nessas datas aparecem como “Ocupado nestas datas”.
3. Clique em **Reservar** num quarto disponível. A reserva fica *Pendente* até o gerente confirmar.
4. Em **Minhas reservas**, veja, cancele ou acompanhe o status.

**Gerente**
1. Logue como `gerente`/`123456`.
2. Em **Reservas** (aba *Pendentes*), confirme ou recuse cada reserva. Também pode excluir.
3. Em **Quartos**, cadastre, edite, desative ou exclua quartos.

---

## 3. Publicar na internet para as pessoas (verdadeiro “funcionar na internet”)

No seu PC, `http://localhost:5000` só é visível para você. Para que os hóspedes e o gerente acessem de qualquer lugar, hospede o projeto num serviço **gratuito**. Recomendo dois:

### Opção A — Render (recomendado)
1. Crie uma conta grátis em https://render.com (com GitHub).
2. Crie um repositório vazio no GitHub e mande os arquivos deste projeto para ele (`git init; git add .; git commit -m "site"; git remote add origin ...; git push -u origin main`).
3. No Render, crie um **Web Service** apontando para esse repositório.
   - *Build Command*: `pip install -r requirements.txt`
   - *Start Command*: `python app.py`
   - Crie uma **variável de ambiente** `FLASK_APP=1` (apenas um flag para o banco).
4. O Render vai te dar um endereço `https://nome-alvo.onrender.com` — esse é o link público do seu hotel.

### Opção B — Railway
1. Crie conta em https://railway.app (também com GitHub).
2. “New Project” → “Deploy from GitHub repo” (o mesmo repositório).
3. Railway detecta Python; ele vai criar o banco por conta própria.
4. Faça “Generate Domain” para ter um link público.

### Opção C — Tunnelling rápido (para testar agora, sem conta)
Se só quer ver do celular **agora** (e estiver no mesmo Wi-Fi do seu PC):
```
pip install flask_ngrok
```
Depois, em `app.py`, após `init_db()` e antes do `if __name__`, adicione:
```python
if __name__ == "__main__":
    from flask_ngrok import run_with_ngrok
    run_with_ngrok(app)
```
Reinicie o `python app.py`. O terminal mostrará uma URL pública — acesse de qualquer lugar. *(Isso é para teste; para uso contínuo, use a Opção A ou B.)*

> Importante: para o “mesmo login de qualquer lugar” funcionar de verdade, todos precisam usar o **mesmo endereço público** e o **mesmo banco**. Os planos gratuitos podem “dormir” quando estão ociosos e, no Render, recomenda-se usar um banco externo (Postgres) para não perder dados — os dados ficam em `hotel.db` por padrão e são recriados se o banco não for persistido.

---

## 4. Estrutura do projeto
```
app.py              servidor Python (Flask) + banco SQLite
requirements.txt    dependências (flask)
requirements.md     resumo de instalação
static/
  index.html        página principal
  style.css         visual
  app.js            toda a interface (login, quartos, reservas)
  htmx.min.js       pequeno shim para manter o app autocontido
```
