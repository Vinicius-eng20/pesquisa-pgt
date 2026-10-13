# Biblioteca Digital com Empréstimos

Site completo para biblioteca digital com:

- Cadastro e login de leitores e bibliotecário
- Busca no acervo
- Empréstimo e devolução de itens
- Histórico de empréstimos
- Cadastro, edição e remoção de itens pelo bibliotecário
- Bloqueio automático de novos empréstimos para leitores com atraso
- Banco de dados SQLite salvo no servidor, para funcionar de qualquer computador ou celular

## Requisitos

Instale o Node.js versão 18 ou superior.

Para verificar:

```bash
node -v
```

## Instalar

Na pasta do projeto, execute:

```bash
npm install
```

## Executar

```bash
npm start
```

Depois abra no navegador:

```text
http://localhost:3000
```

## Conta inicial do bibliotecário

Ao iniciar pela primeira vez, o sistema cria automaticamente:

- E-mail: `bibliotecario@biblioteca.local`
- Senha: `admin123`

Entre com essa conta para cadastrar itens e ver o painel do bibliotecário.

## Criar leitores

Na tela inicial, clique em **Criar conta de leitor**.

## Dados persistentes

O banco de dados fica salvo no arquivo:

```text
data/biblioteca.db
```

As sessões ficam salvas em:

```text
data/sessions.sqlite
```

Não apague a pasta `data` se quiser manter os dados.

## Colocar na internet

Este projeto é um site Node.js completo e usa banco SQLite local no próprio servidor. Para publicar na internet, envie a pasta do projeto para um servidor/VPS que aceite Node.js, rode `npm install` e depois `npm start`.

Para uso real em produção, recomenda-se:

- Usar HTTPS
- Alterar a senha inicial do bibliotecário
- Fazer backup periódico da pasta `data`
