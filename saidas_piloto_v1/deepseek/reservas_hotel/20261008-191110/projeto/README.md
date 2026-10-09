# Sistema de Reservas de Hotel

Um site completo de reservas de hotel com duas áreas: hóspede e gerente.

## O que o sistema faz

**Hóspedes podem:**
- Criar uma conta e fazer login
- Ver quartos disponíveis nas datas escolhidas
- Reservar um quarto
- Ver e cancelar suas reservas

**O gerente pode:**
- Fazer login com a conta de administrador
- Cadastrar, editar e remover quartos
- Confirmar ou recusar reservas
- Ver todas as reservas de todos os hóspedes

## Como instalar e executar

Você precisa ter o **Node.js** instalado (versão 18 ou superior). Baixe em https://nodejs.org

Depois, abra o terminal na pasta do projeto e rode:

```
npm install
npm start
```

O site vai abrir em: **http://localhost:3000**

## Conta do gerente (já vem pronta)

- **Email:** gerente@hotel.com
- **Senha:** admin123

## Como funciona na internet

Este projeto roda como um servidor Node.js. Para publicar na internet de graça, você pode usar o **Render.com** ou **Railway.app**:

1. Crie uma conta no Render.com
2. Crie um "Web Service" e conecte o repositório do projeto
3. Comando de build: `npm install`
4. Comando de start: `npm start`
5. Pronto! Ele te dá um link público

**Importante:** todos os dados (usuários, quartos, reservas) ficam salvos no arquivo `data/db.json` dentro do próprio projeto. Nada é enviado para serviços externos.

---
