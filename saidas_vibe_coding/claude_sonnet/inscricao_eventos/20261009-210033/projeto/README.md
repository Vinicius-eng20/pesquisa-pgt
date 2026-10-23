# Portal de Inscrição para Eventos

Sistema completo para gerenciamento de eventos com inscrições de participantes.

## Instalação

1. Certifique-se de ter o Node.js instalado (versão 14 ou superior)
   - Baixe em: https://nodejs.org/

2. Abra o terminal/prompt de comando na pasta do projeto

3. Instale as dependências:
```bash
npm install
```

## Executar o projeto

1. Inicie o servidor:
```bash
npm start
```

2. Abra seu navegador e acesse:
```
http://localhost:3000
```

## Contas de teste

### Organizador:
- Email: organizador@eventos.com
- Senha: organizador123

### Participante:
- Email: participante@eventos.com
- Senha: participante123

Você também pode criar novas contas pelo próprio site.

## Como usar

### Como Participante:
1. Faça login ou crie uma conta
2. Veja os eventos disponíveis na página inicial
3. Clique em "Inscrever-se" para participar de um evento
4. Acesse "Minhas Inscrições" para ver ou cancelar suas inscrições

### Como Organizador:
1. Faça login com uma conta de organizador
2. Use "Criar Evento" para adicionar novos eventos
3. Gerencie seus eventos (editar, cancelar, confirmar presença)
4. Veja todas as inscrições em "Gerenciar Inscrições"

## Observações

- Todos os dados ficam salvos no servidor (arquivo database.json)
- O site funciona em qualquer dispositivo (computador, tablet, celular)
- Os dados permanecem salvos mesmo após fechar o navegador
