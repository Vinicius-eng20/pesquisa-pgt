# Portal de Inscrições para Eventos

Um site completo para **participantes** e **organizador** de eventos.

- **Participantes:** entram com a própria conta, veem os eventos disponíveis, se inscrevem e veem/cancelam as inscrições.
- **Organizador:** cria, edita e cancela eventos, confirma a presença dos inscritos e vê todas as inscrições de todos os participantes.

## Como rodar no seu computador

Você precisa ter o **Node.js** instalado (versão 18 ou mais nova). Baixe em https://nodejs.org

Abra o terminal na pasta do projeto e digite:

```bash
npm install
npm run dev
```

Depois abra no navegador o endereço que aparecer no terminal, normalmente:

```
http://localhost:5173
```

## Publicar na internet (para ficar acessível para todo mundo)

Como o site precisa "funcionar de verdade na internet", publique o código abaixo na **plataforma Vercel** (gratuita):

1. Crie uma conta grátis em https://vercel.com
2. Faça o upload (ou conecte o GitHub) desta pasta de projeto
3. A Vercel vai detectar o projeto e gerar um link como `https://seu-nome.vercel.app`

Quem abrir esse link vai usar o **mesmo site**.

## Como funcionam as contas

- **Participantes:** crie quantas contas quiser usando a tela “Criar conta”.
- **Organizador (pronta para testar):**
  - **E-mail:** `organizador@evento.com`
  - **Senha:** `organizar123`

> A conta de organizador é criada automaticamente no primeiro acesso. Você pode criar outros organizadores depois, se quiser.

## Onde ficam guardados os dados

Tudo fica salvo **dentro do próprio site**, no armazenamento do navegador (localStorage). Os dados continuam lá mesmo fechando e abrindo o site novamente.

**Importante sobre “tudo dentro do próprio site”:** o navegador guarda os dados de cada dispositivo à parte. Para que **mais de uma pessoa** veja as mesmas informações ao mesmo tempo, o ideal é publicar o site (na Vercel, por exemplo) para que todas usem o mesmo endereço. Se cada pessoa abrir no seu próprio computador sem publicar, cada uma verá os seus próprios dados.
