# Pesquisa PGT

Autor: Vinícius Eduardo Tinoco da Silva

Material de apoio do experimento do TCC "Análise de Vulnerabilidades em Aplicações Web Desenvolvidas com IA Generativa (vibe coding) e em Plataformas Low-Code: um estudo baseado no OWASP Top 10".

Este repositório guarda o código que gera as aplicações do experimento e as saídas produzidas. A análise de segurança das aplicações é feita em etapa posterior, em ambiente isolado.

Documentos relacionados:

- `docs/protocolo-lowcode.md`: protocolo do grupo low-code (versão 1.0).
- `docs/fase-piloto.md`: fase piloto (prompt v1, fora da amostra).
- `docs/stacks_apps.md`: stacks de frontend, backend e banco usadas por cada modelo e plataforma.
- `docs/pentests.md`: como subir cada tipo de aplicação (incluindo Supabase local) e como executar o pentest com o ZAP.

## 1. Finalidade do experimento

Comparar o nível de segurança de aplicações web de uma mesma especificação funcional quando construídas por dois caminhos:

- **Vibe coding:** um modelo de linguagem recebe o pedido de um usuário leigo e escreve a aplicação completa (frontend e backend).
- **Low-code:** uma plataforma (Lovable ou Bolt.new) recebe o mesmo pedido e produz a aplicação com seus próprios recursos.

As aplicações geradas são tratadas como objeto de teste. Nenhuma delas será colocada em produção. Os resultados são classificados pelo OWASP Top 10:2025 e pontuados pelo CVSS v4.0 (Base).

Hipóteses:

- **H1:** aplicações low-code apresentam menos falhas de injeção (A05) e falhas de autenticação (A07) que aplicações de vibe coding.
- **H2:** aplicações de vibe coding apresentam mais segredos fixos no código ou previsíveis (credenciais, chaves, valores padrão de sessão).

Análise estatística prevista: odds ratio com intervalo de confiança de 95%, teste de Mantel-Haenszel estratificado por domínio funcional, e teste exato de Fisher quando houver células pequenas (alfa de 0,05). Ao final, os achados alimentam recomendações e instruções curtas de prompt para usuários leigos.

## 2. O que será gerado

Dez domínios funcionais fixos, cada um com um prompt padronizado:

| Chave | Domínio |
|---|---|
| loja_departamentos | Loja de departamentos |
| restaurante_pedidos | Restaurante com pedidos |
| despesas_pessoais | Controle de despesas pessoais |
| agendamento_servicos | Agendamento de serviços |
| cursos_online | Cursos online |
| reservas_hotel | Reservas de hotel |
| biblioteca_digital | Biblioteca digital |
| marketplace_freelance | Marketplace de freelancers |
| inscricao_eventos | Inscrição em eventos |
| tarefas_equipe | Tarefas de equipe |

Cada aplicação deve ter login com conta própria, dois papéis de usuário e dados persistidos.

Grupos:

| Grupo | Ferramentas | Aplicações previstas |
|---|---|---|
| Vibe coding | 6 modelos via OpenRouter | 10 domínios x 6 modelos = 60 |
| Low-code | Lovable e Bolt.new (planos gratuitos) | 10 domínios x 2 plataformas = 20 |

**Exclusão do Replit.** O Replit foi retirado do grupo low-code por falta de orçamento para concluir as aplicações e porque a plataforma não permite criar múltiplas contas para contornar o limite do plano gratuito. Com isso, a amostra prevista passa de 90 para 80 aplicações.

Modelos do grupo vibe coding (definidos em `MODELOS` no `gerar_app.py`):

| Chave | ID no OpenRouter |
|---|---|
| qwen | qwen/qwen3.8-27b |
| kimi | moonshotai/kimi-k3 |
| claude_sonnet | anthropic/claude-sonnet-4.5 |
| gpt5 | openai/gpt-5.5 |
| gemini_flash | google/gemini-3.8-flash |
| deepseek | deepseek/deepseek-v4.1-flash |

## 3. Como as aplicações são geradas

### 3.1 Prompt padronizado

O texto de cada domínio simula um usuário leigo: descreve apenas requisitos funcionais e não usa termos de segurança nem de tecnologia. Os 10 textos estão no dicionário `DOMINIOS` e são enviados sem alteração.

A versão em uso é a **v2** (`PROMPT_VERSAO` no `gerar_app.py`, gravada em cada registro). O último parágrafo pede que a pessoa use o site de qualquer computador ou celular, que as informações fiquem salvas no próprio site (e não só no aparelho) e que nada dependa de criar conta em outros sites. A **v1** foi usada apenas na fase piloto, documentada em `docs/fase-piloto.md`, com os arquivos em `saidas_piloto_v1/`, fora da amostra.

### 3.2 Grupo vibe coding (automatizado)

O script `gerar_app.py` envia ao modelo escolhido o prompt de sistema (que apenas define o formato de saída: arquivos no padrão `=== caminho ===` e um README) e o prompt do domínio.

Parâmetros fixos para todos os modelos:

- Chamada não streaming à API de chat do OpenRouter.
- `max_tokens` = 32000.
- Raciocínio (reasoning) desligado, **exceto no gemini_flash** (ver abaixo).
- Sem modelos `:free` misturados com modelos pagos.
- Novas tentativas com espera crescente em caso de erro temporário (por exemplo, 429). Em timeout de leitura não há nova tentativa, para evitar cobrança duplicada.

**Exceção do gemini_flash.** As dez primeiras chamadas ao `google/gemini-3.8-flash` falharam com erro 400 ("Reasoning is mandatory for this endpoint"), registradas como `erro_api`. O endpoint não aceita raciocínio desligado, então o modelo foi configurado com raciocínio ligado (`REASONING_POR_MODELO` no `gerar_app.py`) e as dez aplicações foram geradas em seguida, consumindo entre cerca de 1,5 mil e 3,7 mil tokens de raciocínio cada. Essa diferença de parâmetro deve ser declarada como limitação na comparação entre modelos.

Uso (em `main.py`):

```python
from gerar_app import gerar_aplicacao

gerar_aplicacao("deepseek", "loja_departamentos")
```

A chave da API fica em um arquivo `.env` (ignorado pelo Git):

```
OPENROUTER_API_KEY=...
```

Dependências: `requests` e `python-dotenv`.

### 3.3 Rodadas de reparo

Se a aplicação não instalar ou não iniciar, usa-se `corrigir_aplicacao(erro, modelo, contexto)`. Regras do protocolo pré-registrado:

- Mensagem fixa: "Deu esse erro: <erro>", com o texto do erro copiado sem alteração.
- Mesmo modelo da geração original.
- No máximo 3 rodadas por aplicação.
- Nenhuma edição manual de código, com exceção das correções de build descritas na seção 4.2. Cada rodada fica em `reparo_N/`.
- Apenas erros ocorridos no perfil de execução local (seção 4.1) justificam reparo.

### 3.3.1 Continuação de respostas cortadas

Quando a resposta termina por limite de tokens (estado `truncada`), usa-se `continuar_aplicacao(modelo, contexto)`. Não é reparo, tem contador próprio:

- Mensagem fixa: "A resposta foi cortada. Continue exatamente de onde parou."
- Mesmo modelo e mesmos parâmetros da geração.
- No máximo 2 continuações por aplicação. Se a última ainda terminar cortada, o estado vira `nao_entregue`: a aplicação sai do pentest e entra na taxa de conclusão da ferramenta.
- Cada continuação fica em `continuacao_N/`, com o projeto completo (resposta anterior unida à nova). O campo `uniao` do `registro.json` informa como foi a união (`continuacao_direta`, `arquivo_reiniciado` ou `novo_arquivo_apos_corte`).

### 3.3.2 Reenvio do pedido (resposta sem arquivos)

Quando a resposta termina normalmente mas não traz nenhum arquivo (estado `sem_arquivos`, por exemplo texto solto, pergunta ou chamada de ferramenta inexistente), usa-se `reenviar_pedido(modelo, contexto)`:

- Mensagem fixa: "Não recebi os arquivos do projeto. Envie o projeto completo."
- Uma única tentativa por aplicação, com contador próprio, no mesmo diálogo e com os mesmos parâmetros.
- Resultado em `reenvio_1/`. Se ainda não vierem arquivos, o estado vira `nao_entregue`.
- A função recusa se o `resposta.txt` já contiver arquivos que o extrator não leu; nesse caso usa-se `reprocessar_resposta`, sem custo.

### 3.4 Grupo low-code (manual)

As plataformas do grupo estão fixadas em Lovable e Bolt.new, ambas em plano gratuito. O v0 foi excluído após o piloto, por exigir conta externa (Neon) para o banco de dados e não entregar o escopo completo, e o Replit foi excluído pelos motivos da seção 2. O prompt v2 é colado sem alteração na interface de cada plataforma, uma geração por plataforma por dia, na ordem de domínios definida no protocolo. O código é exportado em ZIP (no Lovable, via repositório do GitHub privado) e registrado com `gerar_lowcode.py` (comandos `situacao`, `importar`, `reparo` e `resumir`), que apenas importa e registra, sem gerar. Se a cota gratuita acabar durante a geração, o domínio é registrado como `nao_entregue`. As mensagens de apoio, o limite de 5 interações, o reparo (máximo de 3 rodadas) e os desvios seguem o arquivo `docs/protocolo-lowcode.md` (versão 1.0, congelada em 20/10/2026). As saídas ficam em `saidas_lowcode/`, separadas das saídas do grupo vibe coding.

### 3.5 Saídas e registro

```
saidas_vibe_coding/
  registro.csv                         # uma linha por geração
  <modelo>/<dominio>/<AAAAMMDD-HHMMSS>/
    projeto/                           # arquivos da aplicação
    resposta.txt                       # resposta bruta do modelo
    resposta_api.json                  # resposta completa da API
    registro.json                      # metadados da execução
    reparo_N/                          # rodadas de reparo, se houver

saidas_lowcode/
  registro.csv                         # uma linha por geração
  <plataforma>/<dominio>/<AAAAMMDD-HHMMSS>/
    projeto/                           # código exportado da plataforma
    projeto.zip                        # exportação original (Bolt)
    estrutura.json                     # inventário de arquivos
    registro.json                      # metadados da geração
```

Colunas do `registro.csv` do vibe coding: data_hora_utc, modelo, modelo_id, provedor, dominio, prompt_versao, rodada, gratuito, tokens_entrada, tokens_saida, tokens_raciocinio, tokens_total, custo_usd, motivo_termino, tentativas_api, duracao_s, duracao_api_s, tokens_por_s, n_arquivos, tem_readme, cercas_removidas, continuacao, reenvio, estado, pasta, erro.

Estados possíveis: `gerada`, `truncada`, `nao_entregue`, `sem_arquivos` e `erro_api`. As colunas `continuacao` e `reenvio` indicam o número da rodada correspondente (vazias na geração e nos reparos).

O `registro.csv` do low-code registra, entre outros campos, plataforma, domínio, conta, duração, uso de cota, banco, tipo de backend, presença de migrações, uso de ORM, uso de `localStorage`, arquivos `.env` e o hash do ZIP exportado.

### 3.6 Situação das gerações (26/10/2026)

**Vibe coding** (`saidas_vibe_coding/registro.csv`):

| Modelo | Geradas | Observações |
|---|---|---|
| claude_sonnet | 10 | |
| deepseek | 10 | |
| gemini_flash | 10 | Após 10 registros `erro_api`; gerado com raciocínio ligado (seção 3.2) |
| gpt5 | 10 | |
| kimi | 10 | |
| qwen | 10 | |

Total: 60 de 60 aplicações previstas.

**Low-code** (`saidas_lowcode/registro.csv`):

| Plataforma | Geradas |
|---|---|
| Bolt.new | 10 |
| Lovable | 10 |

Total: 20 de 20 aplicações previstas.

**Pontos de atenção observados nas saídas** (detalhes em `docs/stacks_apps.md`):

- `qwen/agendamento_servicos`: as páginas têm tags EJS, mas o servidor as entrega com `res.sendFile`, sem renderizar o template. A confirmar na execução.
- `qwen/despesas_pessoais` usa MongoDB e `kimi/cursos_online` usa PostgreSQL; as demais usam SQLite, arquivos JSON ou Supabase.

## 4. Análise de segurança (etapa seguinte)

### 4.1 Perfil de execução local (único para todas as aplicações)

Todas as aplicações dos dois grupos (60 de vibe coding e 20 de low-code) são executadas pelo mesmo perfil, para que diferenças de achados não decorram do ambiente. O perfil reproduz localmente o comportamento de uma hospedagem em nuvem: contêineres Docker, o banco que cada aplicação declara (SQLite, PostgreSQL 16, MongoDB ou Supabase CLI local quando o projeto usa Supabase), `NODE_ENV=production` e proxy reverso local com HTTPS (certificado local). Podem ser alteradas variáveis de ambiente, URLs e chaves geradas localmente, além das correções de build da seção 4.2; a lógica, as migrações e as regras de acesso não são editadas. Antes do pentest, o ZAP confirma que nenhuma requisição sai para domínios das plataformas (`*.supabase.co`, `*.lovable.app`, `*.bolt.new`). A especificação completa está na seção 10 de `docs/protocolo-lowcode.md`, e o passo a passo de execução está em `docs/pentests.md`.

Cada aplicação é executada em contêiner isolado e analisada por:

- OWASP ZAP automatizado em todas as aplicações;
- Burp Suite manual em uma subamostra (27 aplicações);
- scripts em Python, incluindo busca de segredos (H2) e uma bateria fixa de verificações aplicada a todas as aplicações, para cobrir falhas de lógica que o ZAP não detecta.

Cada achado é mapeado para o OWASP Top 10:2025 e pontuado com CVSS v4.0 (Base).

### 4.2 Correções de build

Somente são feitas correções de **build**, isto é, o mínimo necessário para a aplicação instalar e iniciar no perfil local. Não se altera lógica de negócio, autenticação, autorização, validação de entrada, consultas ao banco nem configuração de segurança. Cada correção é registrada por aplicação (o quê, por quê e em qual arquivo).

Correções aplicadas até o momento:

| Aplicação | Problema | Correção aplicada |
|---|---|---|
| deepseek/restaurante_pedidos | `better-sqlite3@^11.3.0` sem binário nativo para o Node 24 | `better-sqlite3` atualizado para `^13.0.3` |
| deepseek/biblioteca_digital | Texto após o fechamento do JSON no `package.json` | Texto excedente removido |
| kimi/despesas_pessoais | Resto de cerca Markdown após o JSON no `package.json` | Texto excedente removido |

## 5. Pendências de definição

- Papéis do domínio marketplace (papel único comum).
- Tratamento de SESSION_SECRET e demais segredos no perfil local (valores gerados localmente; NODE_ENV já definido como production).
- Critério de contagem de achados de cabeçalhos HTTP.
- Classificação de segredos para H2 (chave pública e URL não contam como segredo).
- Validação e congelamento do prompt de sistema e do protocolo.
- Confirmação final de IDs de modelos e provedores no OpenRouter.
- Definir se a falha de renderização de qwen/agendamento_servicos, caso confirmada, será tratada como achado ou como aplicação que não atende ao requisito funcional.
- Registrar a exceção de raciocínio do gemini_flash como limitação.
- Ajustar `docs/protocolo-lowcode.md` à exclusão do Replit.
