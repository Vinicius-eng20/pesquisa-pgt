# Sistema de Agendamento de Serviços

Sistema completo de agendamento que funciona de verdade na internet, com dados salvos em um banco de dados SQLite no próprio servidor.

## O que o sistema faz

**Clientes podem:**
- Criar conta e fazer login
- Ver todos os serviços disponíveis
- Ver horários livres e marcar um horário
- Ver seus agendamentos
- Cancelar agendamentos

**Administrador (responsável pelo negócio) pode:**
- Fazer login
- Cadastrar e editar serviços
- Cadastrar e editar horários disponíveis
- Confirmar ou recusar agendamentos
- Ver todos os agendamentos de todos os clientes

## Como instalar e executar

Você precisa ter o **Node.js** instalado (versão 18 ou superior). Baixe em https://nodejs.org

1. Abra o terminal (ou Prompt de Comando) na pasta do projeto
2. Instale as dependências:
```
npm install
```
3. Inicie o servidor:
```
npm start
```
4. Abra o navegador em: **http://localhost:3000**

## Conta do administrador

Na primeira vez que o site roda, uma conta de administrador é criada automaticamente:

- **E-mail:** admin@admin.com
- **Senha:** admin123

## Como colocar na internet (de verdade)

Como o projeto já é um servidor Node.js com banco de dados próprio, você pode hospedá-lo em qualquer serviço de hospedagem de Node.js. Alguns gratuitos ou baratos:

- **Render.com** (tem plano gratuito)
- **Railway.app**
- **Fly.io**

Passos gerais:
1. Suba o projeto para um repositório no GitHub
2. No serviço de hospedagem, conecte o repositório
3. Comando de build: `npm install`
4. Comando de start: `npm start`
5. O site vai ganhar um endereço na internet que funciona em qualquer computador ou celular

## Observação importante sobre o banco de dados

Os dados ficam salvos no arquivo `agendamentos.db` que é criado automaticamente na pasta do projeto. Enquanto esse arquivo existir, nada se perde. Ao hospedar na internet, verifique se o serviço de hospedagem salva os arquivos permanentemente (a maioria tem uma pasta de dados que persiste).
