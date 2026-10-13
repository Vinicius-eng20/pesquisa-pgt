# Marketplace de Serviços Freelance

Projeto completo de um marketplace de serviços freelance com:

- cadastro e login de usuários;
- publicação de serviços;
- listagem de serviços aprovados;
- contratação de serviços;
- área do usuário com serviços e contratos;
- painel administrativo;
- aprovação e remoção de serviços;
- suspensão de usuários;
- persistência em banco de dados local SQLite;
- funcionamento em computador e celular.

## Requisitos

Instale no computador ou servidor:

- Node.js 18 ou superior

## Como instalar

```bash
npm install
```

## Como executar

```bash
npm start
```

Depois acesse no navegador:

```text
http://localhost:3000
```

## Conta de administrador padrão

Ao iniciar o sistema pela primeira vez, será criada automaticamente a conta:

```text
E-mail: admin@admin.com
Senha: admin123
```

Recomenda-se trocar a senha diretamente criando outro administrador ou alterando no banco em uma instalação real.

## Observações importantes

Este projeto salva os dados em um arquivo SQLite chamado:

```text
database.sqlite
```

Esse arquivo fica no próprio servidor onde o site está rodando. Portanto:

- se abrir em outro computador ou celular acessando o mesmo endereço do servidor, os dados serão os mesmos;
- se fechar e abrir novamente o site, os dados continuarão salvos;
- para funcionar na internet, coloque este projeto em um servidor com Node.js e acesse pelo domínio ou IP do servidor.

## Comandos úteis

Instalar dependências:

```bash
npm install
```

Rodar o projeto:

```bash
npm start
```

Rodar em modo desenvolvimento:

```bash
npm run dev
```
