# Sistema de Reservas de Hotel

Sistema completo de gestão de reservas de hotel com autenticação de usuários, gerenciamento de quartos e reservas.

## Requisitos

- Node.js 18 ou superior
- npm (gerenciador de pacotes do Node.js)

## Instalação

```bash
npm install
```

## Executar o Projeto

```bash
npm start
```

O site estará disponível em: http://localhost:3000

## Primeiro Acesso

### Conta de Gerente (já criada):
- Email: gerente@hotel.com
- Senha: gerente123

### Hóspedes:
- Criar nova conta na página de cadastro

## Funcionalidades

### Hóspedes:
- Ver quartos disponíveis por data
- Fazer reservas
- Ver suas reservas
- Cancelar reservas

### Gerente:
- Cadastrar/editar/remover quartos
- Ver todas as reservas
- Confirmar ou recusar reservas
- Gerenciar disponibilidade

## Dados Persistentes

Todos os dados são salvos em arquivos JSON na pasta `data/` e persistem entre reinicializações do servidor.
