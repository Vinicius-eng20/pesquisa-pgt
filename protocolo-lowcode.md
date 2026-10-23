# Protocolo do grupo low-code (versão 1.0, congelada em 20/10/2026)

Este documento define como as aplicações do grupo low-code são geradas, exportadas, registradas e preparadas para os testes de segurança. Ele foi congelado antes da primeira geração da amostra. Qualquer mudança posterior entra como desvio (seção 12), sem alterar o texto desta versão.

As decisões vêm do piloto de 19 e 20/10/2026, resumido na seção 13. As aplicações do piloto ficam fora da amostra.

## 1. Escopo

| Item | Definição |
|---|---|
| Plataformas | Lovable, Bolt (bolt.new) e Replit |
| Plano | Somente gratuito, nas três plataformas |
| Domínios | Os 10 domínios de `DOMINIOS` (`gerar_app.py`) |
| Prompt | Versão v2, idêntica à do grupo vibe coding |
| Amostra prevista | 10 domínios x 3 plataformas = 30 aplicações |
| Forma de geração | Manual, na interface web de cada plataforma |
| Registro | `gerar_lowcode.py` (importação e ficha), pasta `saidas_lowcode/` |

O v0 foi excluído (seção 13). A geração automatizada por MCP ou API foi descartada no piloto. O motivo foi que a criação do banco de dados, que define a arquitetura da aplicação, depende de ações na interface que essas vias não reproduzem. Além disso, a interface é o caminho que o usuário leigo realmente usa.

## 2. Contas

1. Somente contas no plano gratuito. Nenhum crédito pago, cupom ou teste de plano pago.
2. No Bolt, podem ser usadas várias contas para respeitar a cota. Cada geração usa uma única conta, do início ao fim.
3. Cada conta recebe um identificador anônimo (ex.: `bolt-1`, `bolt-2`, `lovable-1`, `replit-1`), registrado na ficha. Os e-mails das contas não entram no registro.
4. Nenhuma conta pode ter instruções personalizadas ativas: knowledge de workspace ou de projeto, regras de conta, prompts de sistema do usuário, memórias ou integrações conectadas por iniciativa do pesquisador. Isso é conferido antes da primeira geração de cada conta.
5. Nenhuma conta é ligada a serviços externos (Supabase, Neon, Vercel, Stripe etc.) por iniciativa do pesquisador. A exceção é o GitHub da conta Lovable, necessário para a exportação (seção 7).

## 3. Ordem e calendário

Uma geração por plataforma por dia, durante 10 dias. No mesmo dia, as três plataformas recebem o mesmo domínio. A ordem foi sorteada com `random.Random(20261020).shuffle` sobre a ordem do dicionário `DOMINIOS`:

| Dia | Domínio |
|---|---|
| 1 | restaurante_pedidos |
| 2 | despesas_pessoais |
| 3 | cursos_online |
| 4 | inscricao_eventos |
| 5 | biblioteca_digital |
| 6 | loja_departamentos |
| 7 | tarefas_equipe |
| 8 | agendamento_servicos |
| 9 | reservas_hotel |
| 10 | marketplace_freelance |

Os dias não precisam ser consecutivos, mas a ordem é mantida. O comando `python gerar_lowcode.py situacao` mostra o próximo domínio de cada plataforma. Uma importação fora da ordem fica registrada como desvio.

## 4. Antes de cada geração

1. Abrir a plataforma já logada na conta do dia e anotar a cota disponível, exatamente como a plataforma mostra.
2. Iniciar a gravação da tela (ou garantir que o histórico da conversa poderá ser exportado ao final). Anotar a hora de início.
3. Criar um projeto novo a partir da tela inicial da plataforma.
4. Manter o modo, o modelo e o tipo de projeto padrão. Não escolher template, design system, modo de planejamento nem modo de discussão. Se a plataforma perguntar o tipo de aplicação antes de começar, escolher a opção padrão ou a que corresponde a site ou aplicação web.
5. Colar o prompt v2 do domínio exatamente como está em `DOMINIOS`, sem anexos e sem nenhum texto adicional, e enviar.

## 5. Durante a geração

### 5.1 Mensagens de apoio

O pesquisador só intervém quando a plataforma para e pede uma ação. Cada intervenção conta como uma mensagem de apoio, e só são permitidas as respostas da tabela abaixo.

| Situação | Resposta fixa |
|---|---|
| Pergunta com opções | Escolher a opção marcada como recomendada. Sem marcação, a primeira opção |
| Pergunta aberta, pedido de confirmação para seguir, ou agente parado com tarefas pendentes | "Pode seguir do jeito que achar melhor." |
| Plano apresentado para aprovação | Aprovar pelo botão. Se exigir texto: "Pode seguir." |
| Oferta de banco, backend ou autenticação da própria plataforma (ex.: Lovable Cloud, banco do Bolt, banco do Replit) | Aceitar |
| Pedido de criar conta ou conectar serviço externo (ex.: Neon, Supabase próprio, Stripe) | Não criar e não conectar. Responder "Pode seguir do jeito que achar melhor." Marcar "exigiu serviço externo" na ficha |
| Pedido de chave de API, segredo ou senha de serviço externo | Não fornecer. Responder "Pode seguir do jeito que achar melhor." |
| Botão de correção automática de erro exibido pela plataforma durante a geração (ex.: "Try to fix") | Clicar uma vez por ocorrência |
| Sugestão de publicar (deploy) | Não publicar. Se a plataforma ficar parada nesse ponto, responder "Pode seguir do jeito que achar melhor." |

Limite: 5 mensagens de apoio por geração. Ofertas opcionais de melhoria feitas depois da conclusão ("quer que eu adicione...?") não são respondidas.

### 5.2 O que o pesquisador não faz

- Não edita código, nem pela interface nem no editor da plataforma.
- Não testa a aplicação na prévia hospedada, além de observar se ela carrega. Não cria contas nem insere dados na prévia.
- Não envia mensagens além das previstas, nem para elogiar, explicar ou pedir melhorias.

### 5.3 Fim da geração

A geração termina na primeira destas situações:

1. A plataforma declara o trabalho concluído e não há pergunta pendente.
2. O limite de 5 mensagens de apoio foi atingido e a plataforma parou de novo.
3. A cota acabou.

Ao terminar, anotar a hora de fim e a cota restante.

## 6. Cota

1. Se a cota acabar no meio da geração, o domínio é registrado como **não entregue** naquela plataforma. A geração não é continuada no dia seguinte nem em outra conta. Se houver código parcial exportável, ele é guardado em `parcial/` para fins descritivos, fora do pentest.
2. Uma falha de infraestrutura da plataforma antes de qualquer código ser gerado (site fora do ar, erro de servidor) não conta como geração e não é importada. A tentativa é repetida em outro dia e anotada na tabela de desvios (seção 12).
3. A geração do dia sempre vem antes de qualquer reparo (seção 8). Reparos usam apenas a cota que sobrar depois da geração do dia, ou os dias seguintes ao dia 10.

## 7. Exportação e importação

| Plataforma | Exportação |
|---|---|
| Lovable | Baixar o ZIP usando uma extensão "Lovable Downloader" |
| Bolt | Baixar o ZIP pelo menu da plataforma (ou repositório privado do GitHub) |
| Replit | Baixar o ZIP do projeto pelo menu da plataforma |

1. Exportar no mesmo dia, logo após o fim da geração, sem nenhuma alteração.
2. Importar com `python gerar_lowcode.py importar <plataforma> <dominio> <arquivo.zip>` e responder a ficha (seção 9).
3. O script guarda uma cópia íntegra do ZIP com o hash SHA-256, extrai o projeto sem `node_modules` e `.git`, e gera o `estrutura.json`. Os arquivos `.env` exportados são mantidos como vieram, porque fazem parte do objeto de análise da H2. Só os nomes das variáveis vão para o registro, nunca os valores.
4. Geração não entregue sem código: `python gerar_lowcode.py importar <plataforma> <dominio> --sem-zip --motivo "..."`.

## 8. Reparo

1. A aplicação é executada localmente segundo o perfil da seção 10. O reparo só se aplica a falhas de instalação, compilação ou inicialização nesse perfil. Falhas funcionais ou de segurança nunca justificam reparo.
2. Antes de pedir reparo, verificar se o erro vem do ambiente local (variável ausente, URL ainda apontando para o serviço hospedado, porta). Nesse caso, o ambiente é corrigido dentro do que a seção 10 permite. Isso não é reparo.
3. O reparo é feito no chat da própria plataforma, com a mensagem fixa "Deu esse erro: <erro>", com o texto do terminal sem alterações. A plataforma é a mesma da geração, na mesma conta e no mesmo projeto.
4. Aplicam-se as mesmas respostas fixas da seção 5.1, com o mesmo limite de 5 mensagens de apoio por rodada.
5. No máximo 3 rodadas por aplicação. Depois da terceira sem sucesso, a aplicação é registrada como não executável.
6. Se a cota acabar no meio de um reparo, a rodada conta como usada e fica registrada como `reparo_incompleto`.
7. Cada rodada é exportada de novo e registrada com `python gerar_lowcode.py reparo <pasta da geração> <arquivo.zip> --erro-arquivo erro.txt`.

## 9. Ficha de cada geração ou reparo

O script pergunta, no terminal:

| Campo | Conteúdo |
|---|---|
| conta | Identificador anônimo da conta |
| inicio_local, fim_local | Data e hora (AAAA-MM-DD HH:MM), horário local |
| cota_antes, cota_depois | Como a plataforma mostra (ex.: "5 créditos", "834K tokens") |
| cota_esgotada | Se a cota acabou durante a execução |
| concluida_pela_plataforma | Se a plataforma declarou o trabalho concluído, sem pendências |
| banco | automatico, confirmacao_aceita, exigiu_servico_externo ou nenhum (só na geração) |
| mensagens_apoio | Quantidade e, para cada uma, a situação e a resposta dada |
| registro_conversa | Nome do arquivo da gravação de tela ou do histórico exportado |
| observacoes | Livre |

Estados possíveis na fase de geração: `gerada` e `nao_entregue`. No reparo: `reparo_aplicado`, `reparo_sem_codigo` e `reparo_incompleto`. O estado de execução (executável ou não executável) é registrado na fase de execução local.

## 10. Perfil de execução local

O objetivo é reproduzir na máquina do pesquisador, em contêineres, o comportamento que a aplicação teria hospedada na nuvem, sem nunca usar os serviços hospedados das plataformas. O mesmo perfil é aplicado de forma idêntica às 90 aplicações do estudo (60 do grupo vibe coding e 30 do grupo low-code), para manter a comparação justa.

### 10.1 Infraestrutura

| Componente | Definição |
|---|---|
| Isolamento | Contêineres Docker em rede própria, acessados só pela máquina do pesquisador |
| Supabase (Lovable e Bolt) | Supabase local pela Supabase CLI, com a versão registrada no início da execução |
| PostgreSQL (Replit e outros) | PostgreSQL 16 em contêiner, versão compatível com a declarada pelo projeto (ex.: `postgresql-16` no `.replit`) |
| Node.js | A versão declarada pelo projeto (`engines`, `.replit`, `.nvmrc`). Sem declaração, a mesma versão fixa do grupo vibe coding |
| Modo | Produção quando o projeto oferecer (`build` seguido de `start` ou `preview`), com `NODE_ENV=production`. Se só houver modo de desenvolvimento, usá-lo e registrar |
| HTTPS | Proxy reverso local (ex.: Caddy) com certificado de uma autoridade local, na frente da aplicação, simulando o TLS da hospedagem |

### 10.2 O que pode ser ajustado

1. Somente variáveis de ambiente: URLs e chaves passam a apontar para os serviços locais.
2. Segredos que a aplicação exige e que a plataforma guardava fora do código (ex.: `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_CRON_SECRET`, `SESSION_SECRET`) recebem valores gerados localmente: as chaves do Supabase local, ou 32 bytes aleatórios para segredos de sessão.
3. Banco: aplicar as migrations que vieram no projeto, na ordem dos nomes dos arquivos (`supabase/migrations/`, `drizzle/migrations/` ou equivalente). Quando o projeto cria o esquema por ORM, sem migrations, usar o comando do próprio projeto (ex.: `drizzle-kit push`).
4. Autenticação do Supabase: configurações que a plataforma aplicou fora do código (ex.: confirmação de e-mail) são reproduzidas no `config.toml` local, conforme observado na plataforma, e registradas.

### 10.3 O que não pode ser ajustado

- Nenhuma linha de código-fonte, nenhuma migration e nenhum arquivo de configuração da aplicação.
- Nenhuma dependência nova nem versão diferente: a instalação segue o lockfile do projeto.
- Os arquivos `.env` originais exportados não são editados. As variáveis locais ficam num arquivo à parte (ex.: `.env.local` ou variáveis do contêiner), carregado na execução.

### 10.4 Verificação antes do pentest

Antes de qualquer teste, o pesquisador navega pela aplicação com o ZAP como proxy e confirma, no histórico, que nenhuma requisição sai para domínios das plataformas ou de seus serviços hospedados (ex.: `*.supabase.co`, `*.lovable.app`, `*.replit.dev`, `*.replit.app`, `*.bolt.new`). Se sair, a execução é interrompida e o ambiente é corrigido.

Toda troca de variável, versão de serviço e comando de inicialização é registrada na fase de execução local.

## 11. Segurança, ética e dados

1. Nenhuma aplicação é publicada em nenhuma plataforma.
2. Projetos e repositórios ficam privados quando a plataforma permitir. Se o plano gratuito não permitir projeto privado, isso é registrado.
3. Os serviços hospedados criados pelas plataformas (bancos, prévias) nunca são alvo de teste. Eles são excluídos ao fim do estudo.
4. Todos os dados inseridos nas aplicações são fictícios e criados pelo pesquisador, apenas no ambiente local.

## 12. Desvios

Qualquer ação fora deste protocolo é registrada:

- automaticamente pelo script, nos casos de geração fora de ordem, geração repetida e excesso de mensagens de apoio;
- manualmente, no campo de observações da ficha e na lista abaixo, com data, plataforma, domínio, descrição e justificativa.

| Data | Plataforma | Domínio | Desvio | Justificativa |
|---|---|---|---|---|
| | | | | |

## 13. Origem das decisões (piloto de 19 e 20/10/2026)

O piloto usou o domínio `despesas_pessoais` em todas as plataformas (e `loja_departamentos` na primeira tentativa do Lovable). Suas gerações ficam em `saidas_lowcode_piloto/` e não fazem parte da amostra. O domínio será gerado de novo no dia 2.

| Plataforma | Via no piloto | Resultado | Decisão |
|---|---|---|---|
| Lovable | MCP (OAuth) | Falha de autenticação antes de gerar | Geração manual |
| Lovable | Interface | Aplicação completa com Supabase (Lovable Cloud ativado pela plataforma) e migration SQL. Gastou os 5 créditos do dia | Incluída: uma geração por dia |
| Bolt | Interface | Aplicação completa com Supabase criado pela plataforma, sem conta externa, e duas migrations. Cerca de 166 mil tokens | Incluída: várias contas gratuitas |
| Replit | MCP | Projeto criado; cota gratuita esgotada antes do fim | Geração manual |
| Replit | Interface | API Express, PostgreSQL da própria plataforma e frontend React. Cerca de 90% da cota diária | Incluída: cota renova por dia |
| v0 | API v2 | Só interface com dados fixos; agente exigiu Neon e trocou de `v0-mini` para `v0-pro` nas respostas automáticas. US$ 0,66 | Excluída |
| v0 | Interface (`v0-mini`, Neon aceito) | Esqueleto de backend (login e duas tabelas) sem as funcionalidades pedidas | Excluída |

O v0 foi excluído por dois motivos. Ele só oferece banco por serviço externo (Neon pela Vercel), o que contraria o pedido do prompt e o item 5 da seção 2. E, com o modelo padrão, não entregou o escopo funcional em nenhuma das duas tentativas. O resultado é relatado de forma descritiva no capítulo de análise.

O script de geração por MCP e API usado no piloto está preservado em `saidas_lowcode_piloto/gerar_lowcode_mcp_api_piloto.py`.
