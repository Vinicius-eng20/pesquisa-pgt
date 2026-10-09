# Sistema de Agendamento de Serviços

Sistema completo de agendamento com login de clientes e administrador. Tudo funciona dentro do próprio site, sem serviços externos.

## Como instalar e rodar

### 1. Instale o Node.js
Baixe em https://nodejs.org (versão LTS recomendada).

### 2. Instale as dependências
No terminal, dentro da pasta do projeto, rode:

```
npm install
```

### 3. Inicie o servidor
```
npm start
```

O site vai abrir em: **http://localhost:3000**

## Conta do administrador (responsável pelo negócio)

Na primeira vez que o servidor rodar, será criada automaticamente:

- **Email:** admin@admin.com
- **Senha:** admin123

Use essa conta para cadastrar serviços e horários.

## Como usar

### Cliente
1. Acesse a página inicial e clique em **Cadastrar**.
2. Veja os serviços disponíveis, escolha um e clique em **Agendar**.
3. Escolha um horário livre e confirme.
4. Em **Meus agendamentos** você pode ver ou cancelar.

### Administrador
1. Faça login com a conta de admin.
2. Em **Serviços**: cadastre e edite serviços.
3. Em **Horários**: cadastre horários disponíveis.
4. Em **Agendamentos**: confirme, recuse ou veja todos.

## Onde os dados ficam salvos

Tudo é salvo em um arquivo `data.json` na pasta do projeto. Mesmo fechando o site, os dados continuam lá.

## Rodar na internet (produção)

Para deixar no ar, suba este projeto em um serviço como Railway, Render ou em um VPS com Node.js instalado. Basta rodar `npm start` lá. Também é possível definir a porta com a variável de ambiente `PORT`.

---
