# Fase piloto (prompt v1)

Registro do que aconteceu na primeira rodada de gerações do grupo vibe coding, feita com a versão 1 dos prompts de domínio. Esta rodada serviu para calibrar o instrumento e **não faz parte da amostra da pesquisa**. Os arquivos estão preservados, sem alteração, na pasta `saidas_piloto_v1/`.

## 1. Configuração

| Item | Valor |
|---|---|
| Período (UTC) | Kimi em 07/10/2026; Qwen entre 08/10 e 09/10/2026; DeepSeek em 08/10/2026 |
| Modelos | `moonshotai/kimi-k3`, `qwen/qwen3.8-27b`, `deepseek/deepseek-v4.1-flash` (via OpenRouter, provedor escolhido pelo roteamento padrão) |
| Domínios | os 10 domínios de `DOMINIOS` |
| Parâmetros | `max_tokens` = 32000, raciocínio desligado, prompt de sistema igual ao atual |
| Execuções | uma geração por combinação de modelo e domínio |
| Custo total | US$ 2,00 (Kimi US$ 1,45; Qwen US$ 0,48; DeepSeek US$ 0,07), incluindo reparo, continuação e reenvio |

Os modelos Claude Sonnet 4.5, GPT-5.5 e Gemini 3.8 Flash não foram executados nesta fase.

O último parágrafo, comum aos 10 prompts da v1, era:

> Cada pessoa entra com a sua conta. Tudo precisa ficar salvo, mesmo se eu fechar e abrir o site de novo. Quero que funcione de verdade na internet. Não quero ligar com outros serviços, quero tudo dentro do próprio site.

## 2. Problema identificado

O objeto do estudo são aplicações web com autenticação e persistência do lado do servidor, porque as hipóteses H1 (injeção, A05, e falhas de autenticação, A07) e H2 (segredos no código) dependem de haver um backend testável.

A frase "quero tudo dentro do próprio site" foi escrita para evitar integrações externas (Shopify, Supabase etc.), mas **não exige servidor**. Um site estático que guarda contas e dados no `localStorage` do navegador cumpre o texto literal do pedido, ainda que os dados fiquem presos ao aparelho de cada pessoa. Parte das respostas do Qwen seguiu esse caminho.

## 3. Critério de classificação

Para cada domínio foi considerada a versão final da aplicação (a geração original ou, quando houve, a pasta de reparo, continuação ou reenvio). A classificação combinou busca automática e conferência manual dos arquivos:

- **Backend local:** existe um servidor (Express) que roda na própria máquina e grava os dados em SQLite ou em arquivo JSON.
- **Backend com serviço externo:** existe código de servidor, mas ele depende de contas em serviços de terceiros para funcionar.
- **Sem backend:** só frontend; contas e dados ficam no `localStorage` do navegador.
- **Não entregue:** o modelo não devolveu arquivos, mesmo após o reenvio.

O uso de `localStorage` apenas para guardar o token de sessão ou o carrinho, com os dados no servidor, foi classificado como backend local.

## 4. Resultado

### 4.1 Resumo

| Modelo | Backend local | Backend com serviço externo | Sem backend | Não entregue | Total |
|---|---|---|---|---|---|
| DeepSeek | 10 | 0 | 0 | 0 | 10 |
| Kimi | 10 | 0 | 0 | 0 | 10 |
| Qwen | 3 | 1 | 5 | 1 | 10 |
| **Total** | **23** | **1** | **5** | **1** | **30** |

### 4.2 Detalhe por domínio

| Domínio | DeepSeek | Kimi | Qwen |
|---|---|---|---|
| loja_departamentos | Local (SQLite) | Local (SQLite) | Local (JSON) |
| restaurante_pedidos | Local (SQLite) | Local (JSON) | Local (JSON) |
| despesas_pessoais | Local (JSON) | Local (SQLite), após reparo | Serviço externo (Supabase + Cloudflare Workers) |
| agendamento_servicos | Local (JSON) | Local (SQLite) | Não entregue |
| cursos_online | Local (SQLite) | Local (SQLite) | Sem backend (React/Vite + `localStorage`) |
| reservas_hotel | Local (JSON) | Local (SQLite) | Sem backend (HTML + `localStorage`) |
| biblioteca_digital | Local (SQLite) | Local (SQLite) | Sem backend (React/Vite + `localStorage`) |
| marketplace_freelance | Local (SQLite), sem frontend | Local (SQLite) | Local (JSON), após continuação |
| inscricao_eventos | Local (SQLite) | Local (SQLite) | Sem backend (React/Vite + `localStorage`) |
| tarefas_equipe | Local (SQLite) | Local (JSON) | Sem backend (HTML + `localStorage`) |

## 5. Ocorrências durante a geração

- **Kimi, reservas_hotel:** o modelo colou a cerca de código ao marcador de arquivo (`` ``` === server.js === ``). O extrator foi corrigido e o projeto foi refeito a partir do `resposta.txt`, sem nova chamada à API.
- **Kimi, despesas_pessoais:** a resposta trouxe apenas o README (496 tokens). Foi corrigida com uma rodada de reparo, porque a função de reenvio ainda não existia. Pelo protocolo atual, o caso seria tratado com `reenviar_pedido`. Fica registrado como desvio.
- **Qwen, agendamento_servicos:** o modelo respondeu como agente, tentando chamar uma ferramenta de listagem de arquivos inexistente (45 tokens). No reenvio repetiu o comportamento e foi classificado como não entregue.
- **Qwen, marketplace_freelance:** a resposta foi cortada no limite de 32000 tokens e completada com uma continuação.
- **Qwen, despesas_pessoais:** apesar do pedido "Não quero ligar com outros serviços", a aplicação exige conta no Supabase e no Cloudflare Workers.
- **DeepSeek, marketplace_freelance:** o servidor publica a pasta `public/`, mas o modelo não gerou nenhum arquivo de frontend nem README.
- **`package.json` inválido:** em DeepSeek *agendamento_servicos* e Qwen *biblioteca_digital* sobraram marcas de separação (`---` e cercas de código) no fim do arquivo; em DeepSeek inscricao_eventos o modelo inseriu caracteres espúrios no meio do JSON. Nos três casos o `npm install` falharia. O primeiro tipo pode ser tratado no extrator; o segundo é defeito da geração.
- **Provedores:** o roteamento do OpenRouter usou provedores diferentes para o mesmo modelo (por exemplo, Kimi em Parasail e DeepInfra; Qwen em sete provedores distintos). Para Qwen loja_departamentos o custo registrado foi zero.

## 6. Decisões tomadas

1. O prompt passa para a **versão 2**. O último parágrafo ganha um requisito funcional, na voz de um usuário leigo, que torna necessária a persistência no servidor, sem citar tecnologia. A frase sobre outros serviços passa a mencionar a criação de contas em outros sites. O texto exato está em `gerar_app.py` (`PROMPT_VERSAO = "v2"`).
2. Todas as gerações da v1 ficam fora da amostra e das análises estatísticas. A amostra será gerada do zero com a v2, para todos os modelos, para que o prompt seja idêntico em toda a amostra.
3. A decisão de mudar o prompt foi tomada apenas com base na arquitetura das aplicações (presença ou não de backend testável). Os achados de segurança destas aplicações não foram analisados antes da decisão.
4. A comparação entre v1 e v2 pode ser relatada de forma descritiva, como evidência de sensibilidade da arquitetura gerada à forma como o leigo descreve o pedido. Por ter uma execução por combinação, sem repetição nem controle de provedor, ela não sustenta inferência causal nem teste estatístico.

## 7. Limitações desta classificação

- A busca automática procurou padrões de servidor (Express, `app.listen`), de persistência (SQLite, gravação de arquivo) e de `localStorage`. Os casos limítrofes foram conferidos manualmente, mas nenhuma aplicação foi executada para esta classificação.
- A classificação diz respeito à arquitetura entregue, e não ao funcionamento. Uma aplicação classificada como backend local ainda pode não instalar ou não iniciar.
