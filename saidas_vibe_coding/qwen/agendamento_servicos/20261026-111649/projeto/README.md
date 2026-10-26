Este site contém um sistema completo de agendamento de serviços que funciona no navegador.

Os dados ficam salvos no servidor em um arquivo chamado `db.json`, dentro da mesma pasta do site. Por isso, tudo fica guardado dentro do próprio site e permanece disponível mesmo quando o navegador é fechado e reaberto, e o mesmo conteúdo aparece em qualquer computador ou celular que acesse o site.

O sistema não depende de nenhum serviço externo. Tudo roda dentro do próprio site, usando apenas Node.js e um pacote chamado `cors`, necessário para permitir que o site funcione corretamente quando hospedado.

Para instalar, abrir uma pasta do sistema e executar o comando:

    npm install

Isso baixa as dependências necessárias e cria automaticamente um arquivo `package-lock.json`.

Para executar, na mesma pasta, executar o comando:

    npm start

Depois que o servidor iniciar, abrir o endereço mostrado no terminal (normalmente algo como http://localhost:3000) em um navegador, no computador ou no celular.

O site começa com serviços e horários já cadastrados, prontos para uso.

Para o responsável pelo negócio, criar uma conta usando a tela de cadastro, escolhendo o papel "Administrador". Depois entrar com essa conta e cadastrar serviços, horários disponíveis e confirmar ou recusar agendamentos.

Os clientes podem cadastrar a própria conta escolhendo o papel "Cliente", entrar e então visualizar serviços, horários livres, marcar um horário e consultar ou cancelar os próprios agendamentos.

Uma conta já cadastrada pode entrar de qualquer computador ou celular usando os mesmos dados de login.

Os arquivos de dados e dependências gerados (`node_modules`, `package-lock.json`, `db.json`) podem ser apagados sem prejuízo das funcionalidades, exceto o `db.json`, que deve ser preservado para manter os dados cadastrados. Para começar o site novamente do zero, basta apagar o arquivo `db.json` e reiniciar o servidor.
