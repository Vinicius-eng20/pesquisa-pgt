# Pesquisa PGT

Autor: Vinícius Eduardo Tinoco da Silva

Material de apoio do experimento do TCC "Análise de Vulnerabilidades em Aplicações Web Desenvolvidas com IA Generativa (vibe coding) e em Plataformas Low-Code: um estudo baseado no OWASP Top 10".

Este repositório guarda o código que gera as aplicações do experimento e as saídas produzidas. A análise de segurança das aplicações é feita em etapa posterior, em ambiente isolado.

## 1. Finalidade do experimento

Comparar o nível de segurança de aplicações web de uma mesma especificação funcional quando construídas por dois caminhos:

- **Vibe coding:** um modelo de linguagem recebe o pedido de um usuário leigo e escreve a aplicação completa (frontend e backend).
- **Low-code:** uma plataforma (Lovable, v0 e Bolt.diy) recebe o mesmo pedido e produz a aplicação com seus próprios recursos.

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

| Grupo | Ferramentas | Aplicações |
|---|---|---|
| Vibe coding | 6 modelos via OpenRouter | 10 domínios x 6 modelos = 60 |
| Low-code | Lovable, v0 e Bolt.diy | 10 domínios x 3 plataformas = 30 (plano em revisão) |

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

O texto de cada domínio simula um usuário leigo: descreve apenas requisitos funcionais, não usa termos de segurança e pede que tudo fique dentro do próprio site, sem integração com outros serviços. Os 10 textos estão no dicionário `DOMINIOS` e são enviados sem alteração.

### 3.2 Grupo vibe coding (automatizado)

O script `gerar_app.py` envia ao modelo escolhido o prompt de sistema (que apenas define o formato de saída: arquivos no padrão `=== caminho ===` e um README) e o prompt do domínio.

Parâmetros fixos para todos os modelos:

- Chamada não streaming à API de chat do OpenRouter.
- `max_tokens` = 32000.
- Raciocínio (reasoning) desligado.
- Sem modelos `:free` misturados com modelos pagos.
- Novas tentativas com espera crescente em caso de erro temporário (por exemplo, 429). Em timeout de leitura não há nova tentativa, para evitar cobrança duplicada.

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
- Nenhuma edição manual de código. Cada rodada fica em `reparo_N/`.
- Apenas erros ocorridos no ambiente padrão de execução (contêiner Linux com versão fixa do Node) justificam reparo.

### 3.4 Grupo low-code (manual)

Os mesmos prompts são colados na interface de cada plataforma, respeitando os créditos gratuitos. O código resultante é exportado para um repositório do GitHub (sincronização) e executado localmente. As mensagens de apoio e o limite de interações seguem o protocolo pré-registrado, e desvios são registrados.

### 3.5 Saídas e registro

```
saidas/
  registro.csv                         # uma linha por geração
  <modelo>/<dominio>/<AAAAMMDD-HHMMSS>/
    projeto/                           # arquivos da aplicação
    resposta.txt                       # resposta bruta do modelo
    resposta_api.json                  # resposta completa da API
    registro.json                      # metadados da execução
    reparo_N/                          # rodadas de reparo, se houver
```

Colunas do `registro.csv`: data_hora_utc, modelo, modelo_id, provedor, dominio, rodada, gratuito, tokens_entrada, tokens_saida, tokens_raciocinio, tokens_total, custo_usd, motivo_termino, tentativas_api, duracao_s, duracao_api_s, tokens_por_s, n_arquivos, tem_readme, cercas_removidas, estado, pasta, erro.

Estados possíveis: `gerada`, `truncada`, `sem_arquivos` e `erro_api`.

## 4. Análise de segurança (etapa seguinte)

Cada aplicação é executada em contêiner isolado e analisada por:

- OWASP ZAP automatizado em todas as aplicações;
- Burp Suite manual em uma subamostra (27 aplicações);
- scripts em Python, incluindo busca de segredos (H2) e uma bateria fixa de verificações aplicada a todas as aplicações, para cobrir falhas de lógica que o ZAP não detecta.

Cada achado é mapeado para o OWASP Top 10:2025 e pontuado com CVSS v4.0 (Base).

## 5. Pendências de definição

- Regra para quando uma plataforma low-code exigir integração externa.
- Papéis do domínio marketplace (papel único comum).
- Tratamento de variáveis de ambiente (SESSION_SECRET, NODE_ENV) para não apagar achados.
- Critério de contagem de achados de cabeçalhos HTTP.
- Classificação de segredos para H2 (chave pública e URL não contam como segredo).
- Validação e congelamento do prompt de sistema e do protocolo.
- Confirmação final de IDs de modelos e provedores no OpenRouter.
