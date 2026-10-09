# Sistema de Reservas de Hotel

Um site de reservas de hotel que funciona 100% no navegador. Hóspedes reservam quartos, o gerente cadastra quartos e confirma/recusa reservas. Tudo fica salvo localmente no seu navegador (mesmo se fechar e abrir de novo).

## Como instalar e executar

Você **não precisa instalar nada**.

1. Salve todos os arquivos abaixo na pasta deste projeto (exatamente com os nomes e pastas indicados).
2. Abra o arquivo `index.html` no navegador (deixe o mouse sobre ele, clique com o botão direito e "Abrir" / "Open with").
3. Pronto. O site está no ar.

> Dica: se o seu computador bloquear o site abrindo direto do disco, rode um servidor local. Com Node.js instalado, na pasta do projeto:
> ```
> npx serve
> ```
> E abra o endereço que aparecer.

## Criar a primeira conta

Na tela de login, escolha **"Gerente"** na aba "Tipo de conta". A primeira conta de gerente criada vira o **gerente principal** (dona do hotel) — quem cadastra quartos. Depois, o gerente pode criar contas de hóspedes em **Gerenciar Contas**.

## Como usar

### Hóspede
- **Início**: veja todos os quartos disponíveis.
- **Reservar**: clique em um quarto, escolha as datas e o nome do hóspede. A reserva nasce como "pendente".
- **Minhas Reservas**: veja, cancele reservas pendentes ou confirme o check-out de uma reserva concluída.

### Gerente
- **Quartos**: crie, edite e remova quartos.
- **Reservas**: veja **todas** as reservas de todos os hóspedes e confirme ou recusa cada uma.
- **Minhas Reservas**: o gerente também pode reservar quartos, como um hóspede.
- **Minha Conta**: veja seus dados.
- **Gerenciar Contas** (só o gerente principal): crie contas de hóspedes.

## Segurança das senhas

As senhas **nunca** ficam salvas em texto puro. Antes de salvar, cada senha é transformada em uma "impressão digital" (hash SHA-256 com um valor aleatório específico da conta). Assim, ninguém que acessar os dados vê a senha.

## Onde os dados ficam salvos

Tudo (contas, quartos e reservas) fica salvo em um espaço de armazenamento do próprio navegador chamado `localStorage`, no navegador e no computador de cada pessoa. Nenhuma informação sai para a internet e nenhum serviço externo é usado.

> **Importante:** o `localStorage` pertence ao navegador/computador. Cada pessoa que abrir o site no seu próprio dispositivo tem seus próprios dados. Se uma hóspede usa a mesma máquina que o gerente, ambas veem as mesmas informações.

## Estrutura dos arquivos

```
index.html
styles.css
app.js
```

---

Para colocar "na internet" de verdade (para outras pessoas acessarem pelo celular etc.), basta hospedar estes três arquivos em qualquer serviço estático gratuito (GitHub Pages, Netlify, Cloudflare Pages, Vercel). Não há servidor nem banco de dados por trás — é só site.
