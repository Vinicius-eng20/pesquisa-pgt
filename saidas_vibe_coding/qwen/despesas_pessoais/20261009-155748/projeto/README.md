# Controle de Despesas Pessoais

Este é um site completo para controlar despesas pessoais. As pessoas cadastram sua
conta, registram gastos, organizam por categoria e veem quanto gastaram no mês.
O administrador cadastra as categorias, desativa contas e vê o total de gastos de
todos.

Os dados ficam salvos no próprio site (num banco de dados), então:
- Se a pessoa entrar pelo celular, encontra as mesmas informações de quando usava o computador.
- Se fechar e abrir de novo, nada some.
- Tudo funciona na internet, com contas de usuário de verdade (login e senha).
- Não precisa de nenhuma conta em outros sites.

O administrador já vem criado. A senha padrão é `admin123` (usuário `admin`).
**Troque a senha logo** pelo próprio site (botão "Trocar senha").

---

## Requisitos

Para rodar este projeto você precisa ter instalados:

1. **Node.js** (versão 18 ou mais nova) — https://nodejs.org
2. **MongoDB** rodando na sua máquina — https://www.mongodb.com

Depois de instalar o Node.js, verifique no terminal:
```
node -v
```

Para instalar o MongoDB, siga o guia oficial para o seu sistema. Para usar local,
deixe o serviço do MongoDB rodando (normalmente na porta 27017).

---

## Como instalar e executar

Abra o terminal na pasta do projeto e rode, nesta ordem:

```
# 1) Instalar as dependências
npm install

# 2) (Opcional) editar o arquivo .env se quiser mudar porta, senha do admin ou nome do banco

# 3) Rodar o site
npm start
```

Depois que iniciar, o terminal mostra um endereço, por exemplo:
```
http://localhost:3000
```

Abra esse endereço no navegador. Pronto.

Para testar, entre com a conta do administrador:
- Usuário: `admin`
- Senha: `admin123`

Ou crie uma conta nova de usuário pelo botão "Criar conta".

---

## Para colocar na internet (hospedar)

Este projeto é auto-contido (backend + frontend num só programa). Para colocar
online você precisa de uma máquina (VPS, ou um serviço como Render, Railway,
Oracle Cloud, etc.) com:

- Node.js instalado
- Um MongoDB acessível (local na mesma máquina, ou um serviço gerenciado)

Passos:
1. Copie a pasta do projeto para a máquina.
2. Rode `npm install`.
3. No arquivo `.env`, defina `PORTA` (geralmente 8080) e a string de conexão do
   banco (ver "String de conexão do banco" abaixo).
4. Rode `npm start` (ou use um gerenciador como `pm2` para manter ativo).
5. Aponte o domínio para a máquina.

### String de conexão do banco

Por padrão o programa tenta se conectar a `mongodb://localhost:27017`.
Para apontar para outro banco, crie o arquivo `.env` e adicione:
```
STRING_CONEXAO=mongodb://usuario:senha@host:27017
```
Opcional também:
```
BANCO_DB=despesas
```

---

## Comandos úteis

- Iniciar o site: `npm start`
- Criar categorias padrão (opcional, já acontece no primeiro uso): o sistema já cria
  categorias iniciais automaticamente.

---

## Estrutura

- `server.js` — servidor (rota da página + API + regras do sistema)
- `views/` — páginas (login, cadastro, painel do usuário, painel do admin)
- `public/` — JavaScript das telas
- `data/` — criado automaticamente caso o MongoDB não esteja disponível (modo de teste)
