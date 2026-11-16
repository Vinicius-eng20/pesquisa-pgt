# Imagem unica para executar as aplicacoes low-code (Bolt e Lovable) do experimento.
#
# Por que um container: o Bolt exige Node ^20.19 ou >=22.12 e o Lovable
# (TanStack Start 1.168) exige Node >=22.12, enquanto as aplicacoes vibe coding
# rodam no Node 20 do Windows. Com o Node 22 isolado aqui, nao e preciso trocar
# a versao do Node da maquina.
#
# Versoes fixas para reprodutibilidade (registrar no apendice do TCC).
FROM node:22.22.0-bookworm-slim

ARG BUN_VERSION=1.4.4

# bun: gerenciador de pacotes usado pelo Lovable (bun.lock). Instalado pelo npm
# para nao depender de outra imagem.
RUN npm install -g bun@${BUN_VERSION} --no-audit --no-fund \
    && bun --version

WORKDIR /opt/pgt
COPY entrypoint.sh preparar-env.mjs encaminhar.mjs ./
# Garante final de linha LF mesmo que o git do Windows converta para CRLF.
RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh

ENV NODE_ENV=development \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    ORIGEM=/origem \
    TRABALHO=/app

WORKDIR /app
ENTRYPOINT ["/opt/pgt/entrypoint.sh"]
