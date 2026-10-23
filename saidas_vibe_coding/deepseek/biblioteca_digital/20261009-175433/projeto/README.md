# Biblioteca Digital

Sistema de biblioteca digital com empréstimo de itens, controle de acervo e usuários.

## Como usar

### Instalação

1. Instale o [Node.js](https://nodejs.org) (versão 18 ou superior).
2. Abra o terminal (Prompt de Comando no Windows) na pasta do projeto.
3. Execute:

```
npm install
```

### Executar

```
npm start
```

4. Abra o navegador em: **http://localhost:3000**

### Contas de teste

- **Bibliotecário**: usuário `admin` / senha `admin123`
- **Leitor**: usuário `joao` / senha `joao123`
- **Leitor**: usuário `maria` / senha `maria123`

### Sobre os dados

Todos os dados (usuários, itens do acervo, empréstimos) ficam salvos no arquivo `dados.json` dentro da pasta do projeto. Nada depende de serviços externos — tudo funciona apenas com o Node.js instalado.

---
