# Biblioteca Digital — empréstimo de itens

Um site de biblioteca com acervo, cadastro de usuários, empréstimo/devolução,
bloqueio automático de leitores com atraso e histórico completo.

Tudo é salvo **dentro do próprio navegador** (localStorage). Por isso o acervo,
os usuários, os empréstimos e o histórico continuam existindo mesmo se você
fechar e abrir o site de novo. Não é preciso instalar banco de dados nem
ligar a nenhum serviço externo.

## Como instalar

Você tem duas opções. Use a que preferir — as duas dão o mesmo resultado.

### Opção 1 — Abrir direto no navegador (mais simples, sem instalar nada)

1. Crie uma pasta no seu computador.
2. Salve o arquivo `index.html` dentro dessa pasta (ele já contém todo o site).
3. Dê um duplo clique em `index.html`.
4. Pronto: o site abre no seu navegador e funciona.

> Dica: se algo parecer "atrasado" só quando você fecha o navegador,
> use a Opção 2 abaixo (recomendado para uso real).

### Opção 2 — Servidor local (recomendado para uso real)

Precisa de [Node.js](https://nodejs.org) instalado. Depois:

```bash
# dentro da pasta do projeto
npm install
npm start
```

O comando abre o site no navegador em `http://localhost:5173`.

Para parar, tecle `Ctrl + C` no terminal.

## Como usar

- **Entrar:** use e-mail + senha na tela inicial.
- **Criar conta:** clique em "Criar conta". O sistema monta o e-mail a partir
  do seu nome (ex.: Nome: João Silva -> joao.silva@biblioteca.local) e já
  te dá uma senha provisória na tela. Anote-a e faça login.
- **Leitor:** busque e veja os itens, "Pegar emprestado" e depois "Devolver".
- **Bibliotecário:** crie sua conta com a opção "É bibliotecário" marcada.
  Depois você pode cadastrar/editar/remover itens, ver o histórico de todos os
  leitores e o bloqueio de empréstimos de quem está em atraso aparece sozinho.

## Conta inicial do bibliotecário

Para não depender de nenhum cadastro manual, a conta do bibliotecário já vem
pronta:

- **E-mail:** `bibliotecario@biblioteca.local`
- **Senha:** `biblioteca123`

Troque a senha depois (botão "Minha conta") se quiser.

## Sobre o armazenamento

- Os dados ficam salvos **no navegador do computador** (localStorage).
- Por isso o acervo/conta de um computador não aparece em outro.
  Cada máquina tem seus próprios dados.
- Para começar de novo, limpe o localStorage do site (Ferramentas do
  desenvolvedor -> Application -> Local Storage -> apagar), ou feche a aba e
  o site volta com os dados daquela máquina.
```

```
