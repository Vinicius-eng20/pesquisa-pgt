# Sistema de Gestão de Tarefas de Equipe

Este é um site de gestão de tarefas para uma equipe. Ele funciona por inteiro
dentro do próprio site, sem ligar a outros serviços.

- Cada pessoa entra com a sua conta (nome + senha).
- O **Gerente** pode criar, editar, remover e distribuir tarefas para os membros,
  e ver todas as tarefas de todos.
- Os **Membros** podem ver as tarefas que receberam, mudar a situação das suas
  tarefas e criar tarefas para si mesmos.
- Tudo fica salvo automaticamente. Se fechar e abrir o site de novo, continua lá.

## Como colocar na internet (grátis, em ~2 minutos)

1. Crie uma conta grátis no **Netlify**: https://app.netlify.com (pode criar com e-mail ou Google).
2. Na tela inicial, arraste a **pasta inteira do projeto** (que contém
   `index.html`, `manifest.json`, `icons` etc.) para a área que diz
   "Drag and drop your site folder here".
3. Pronto. O Netlify mostra um endereço como `seu-site-xyz.netlify.app`.
   Esse é o endereço do seu site na internet.

## Como cada pessoa usa no dia a dia

1. Abra o link do site.
2. Na tela de login, escolha **"Não tem conta? Criar"**.
   - Nome de usuário: qualquer nome (ex.: `joao`, `maria`).
   - Senha: a senha que você vai usar.
   - Perfil: escolha **Gerente** ou **Membro de equipe**.
3. Depois é só salvar a senha no navegador (ou digitar de novo) e entrar.

## Observações importantes

- O site guarda os dados **no navegador de cada pessoa** (localStorage).
- Por isso, o mesmo site aberto no celular do gerente e no computador do membro
  já funciona como contas separadas, cada um com o seu.
- Limpe o histórico/cache do navegador para apagar os dados daquele aparelho.
- Como os dados ficam no aparelho de cada pessoa, para um gerente "distribuir"
  uma tarefa ele deve estar logado no MESMO aparelho/browser onde os membros
  também têm conta (ou todos usam o mesmo dispositivo). Isso é o limite de um
  site 100% no navegador, sem servidor.
- Se no futuro você quiser que um gerente no celular mande tarefa para um membro
  no computador dele automaticamente, é preciso de um servidor. O código já está
  separado de forma que dá para conectar um banco depois, se você quiser.

## Como rodar localmente (opcional)

Não precisa de instalar nada. Basta abrir o arquivo `index.html` no navegador.

Se preferir um servidor local:

```
npm install
npm start
```

Depois abra `http://localhost:8080`.

## Arquivos do projeto

- `index.html` — toda a interface e a lógica do site.
- `manifest.json` — para instalar como aplicativo (PWA).
- `icons/` — ícones do aplicativo.
