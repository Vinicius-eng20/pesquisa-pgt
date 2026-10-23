# Biblioteca Digital

Sistema completo de biblioteca digital com empréstimo de itens. Inclui área do leitor e do bibliotecário, com dados salvos no servidor (funciona em qualquer dispositivo).

## Conta do bibliotecário (já criada automaticamente)
- **E-mail:** admin@biblioteca.com
- **Senha:** admin123

Leitores se cadastram pela tela de "Cadastre-se".

## Como instalar e executar

### Pré-requisitos
- Node.js instalado (versão 16 ou superior). Baixe em: https://nodejs.org

### Passo a passo

1. Abra o terminal (ou Prompt de Comando) na pasta do projeto.

2. Instale as dependências:
```
npm install
```

3. Inicie o servidor:
```
npm start
```

4. Abra no navegador:
```
http://localhost:3000
```

## Como deixar disponível na internet (opcional)

Para que outras pessoas acessem de qualquer lugar, você pode usar o modo gratuito do Render, Railway ou similar. Como você pediu tudo dentro do próprio site sem criar conta em outros serviços, a forma mais simples é:

**Opção 1 - Na sua rede local (Wi-Fi):**
1. Descubra o IP do seu computador (ex: `ipconfig` no Windows ou `ifconfig` no Linux/Mac).
2. Inicie o servidor com: `npm start`
3. Outros aparelhos na mesma rede acessam: `http://SEU_IP:3000`

**Opção 2 - Na internet de verdade:**
Hospede em qualquer serviço de Node.js (Render, Railway, etc.) — o projeto está pronto, basta enviar os arquivos e definir o comando de start como `npm start`.

## Funcionalidades

### Leitor
- Criar conta e fazer login
- Buscar itens do acervo (por título, autor ou categoria)
- Ver detalhes e disponibilidade
- Pegar item emprestado (prazo de 14 dias)
- Ver seus empréstimos ativos e histórico
- Devolver itens

### Bibliotecário
- Cadastrar, editar e remover itens do acervo
- Ver todos os empréstimos de todos os leitores (ativos, atrasados, devolvidos)
- Bloquear/desbloquear leitores com atraso
- Ver painel com estatísticas

## Estrutura dos dados
Todos os dados ficam salvos no arquivo `biblioteca.db` (banco de dados SQLite), criado automaticamente na primeira execução. Nada se perde ao fechar o site.

## Para resetar tudo
Apague o arquivo `biblioteca.db` e reinicie o servidor.
