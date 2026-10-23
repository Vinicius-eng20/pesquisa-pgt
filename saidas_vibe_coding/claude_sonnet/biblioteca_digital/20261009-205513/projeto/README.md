# Biblioteca Digital

Sistema completo de biblioteca digital com empréstimo de itens.

## Requisitos
- Node.js 18+ instalado

## Instalação e Execução

```bash
# Instalar dependências
npm install

# Executar o projeto
npm start
```

O site estará disponível em: http://localhost:3000

## Contas padrão

### Bibliotecário
- Email: admin@biblioteca.com
- Senha: admin123

### Leitor
- Email: leitor@exemplo.com
- Senha: leitor123

## Como usar

### Para Leitores:
1. Faça login com sua conta
2. Busque itens no acervo
3. Clique em "Emprestar" para pegar um item
4. Veja seus empréstimos na aba "Meus Empréstimos"
5. Devolva itens quando terminar

### Para Bibliotecário:
1. Faça login com a conta de administrador
2. Cadastre novos itens na aba "Gerenciar Acervo"
3. Veja todos os empréstimos na aba "Todos os Empréstimos"
4. Bloqueie leitores com atraso se necessário

Todos os dados ficam salvos no servidor e sincronizam automaticamente entre dispositivos.
