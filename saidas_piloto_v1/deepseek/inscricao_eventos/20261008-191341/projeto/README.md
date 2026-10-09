# Portal de Inscrição para Eventos

Site completo (frontend + backend + banco de dados) para gerenciar eventos e inscrições.

## O que faz

**Participantes:**
- Ver eventos disponíveis
- Inscrever-se em um evento
- Ver suas inscrições
- Cancelar inscrições

**Organizadores:**
- Criar, editar e cancelar eventos
- Ver todas as inscrições de todos os participantes
- Confirmar / cancelar / reativar a presença de cada inscrito

Todos os dados ficam salvos em um arquivo `data.db` (SQLite) na pasta do projeto. Não é necessário nenhum serviço externo.

## Como instalar e executar

Pré-requisitos: ter o **Node.js** instalado (versão 18 ou superior). Baixe em https://nodejs.org

No terminal, dentro da pasta do projeto, execute:

```bash
npm install
npm start
```

Depois abra no navegador:

```
http://localhost:3000
```

## Como usar

1. Clique em **Criar conta** e escolha o tipo:
   - **Participante** — para se inscrever nos eventos.
   - **Organizador** — para criar e gerenciar eventos.
2. Cada pessoa cria a própria conta com e-mail e senha. O login fica salvo por 30 dias.
3. O organizador cria os eventos no menu **Painel do Organizador**.
4. Os participantes veem os eventos e se inscrevem.
5. O organizador confirma a presença dos inscritos em **Todas as Inscrições**.

## Publicar na internet

Para deixar disponível na internet, hospede este projeto em qualquer serviço que rode Node.js (Render, Railway, Fly.io, etc.). Basta:

1. Enviar o projeto para o serviço.
2. Definir o comando de start como `npm start`.
3. Opcional (recomendado): definir a variável de ambiente `JWT_SECRET` com um texto aleatório longo, para as sessões não expirarem quando o servidor reiniciar.

Os dados ficam salvos no arquivo `data.db` no disco do servidor.
```

## Como rodar

1. Instale o [Node.js](https://nodejs.org) (versão 18+).
2. Abra o terminal na pasta do projeto e execute `npm install` e depois `npm start`.
3. Acesse `http://localhost:3000` no navegador.

Crie uma conta escolhendo **Participante** ou **Organizador** conforme o uso. Depois:
- O **organizador** cria eventos no painel e gerencia as inscrições (confirmar/cancelar presença).
- O **participante** vê os eventos, se inscreve, e pode ver/cancelar suas inscrições.

Tudo é salvo automaticamente no arquivo `data.db` criado na pasta do projeto — feche e reabra o site, os dados continuarão lá.
