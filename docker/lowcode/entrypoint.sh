#!/usr/bin/env bash
# Sobe uma aplicacao low-code (Bolt ou Lovable) dentro do container.
#
# A pasta da aplicacao gerada e montada SOMENTE LEITURA em $ORIGEM. Tudo o que
# a execucao produz (node_modules, .env local, cache do Vite, routeTree.gen.ts
# regenerado) fica em $TRABALHO, um volume do Docker. O artefato gerado pela
# plataforma nao e alterado.
#
# Variaveis esperadas (o subir.ps1 preenche):
#   PLATAFORMA                 bolt | lovable
#   SUPABASE_ANON_KEY          chave anon do Supabase local
#   SUPABASE_SERVICE_ROLE_KEY  chave service_role do Supabase local (Lovable SSR)
#   SUPABASE_HOST              host do Supabase visto do container (padrao host.docker.internal)
set -euo pipefail

ORIGEM="${ORIGEM:-/origem}"
TRABALHO="${TRABALHO:-/app}"
PLATAFORMA="${PLATAFORMA:?defina PLATAFORMA=bolt ou PLATAFORMA=lovable}"
SUPABASE_HOST="${SUPABASE_HOST:-host.docker.internal}"
SUPABASE_PORTA="${SUPABASE_PORTA:-54321}"
PGT="$(cd "$(dirname "$0")" && pwd)"

log() { printf '[pgt-lowcode] %s\n' "$*"; }

case "$PLATAFORMA" in
  bolt)    PORTA=5173 ;;
  lovable) PORTA=8081 ;;  # 8080 fica livre para o proxy do OWASP ZAP
  *) log "PLATAFORMA invalida: $PLATAFORMA (use bolt ou lovable)"; exit 2 ;;
esac

[ -f "$ORIGEM/package.json" ] || { log "package.json nao encontrado em $ORIGEM"; exit 2; }

# 1) Copia de trabalho: apaga tudo menos node_modules e copia o projeto de novo.
#    Assim a copia reflete sempre o artefato original, sem reinstalar dependencias.
log "Copiando o projeto para a area de trabalho ($TRABALHO)"
mkdir -p "$TRABALHO"
find "$TRABALHO" -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} +
tar -C "$ORIGEM" --exclude=./node_modules --exclude=./.git -cf - . | tar -C "$TRABALHO" -xf -
cd "$TRABALHO"

# 1b) Lovable: parte do bun.lock aponta para o cache privado de pacotes do
#     sandbox da Lovable (<regiao>-npm.pkg.dev/lovable-core-prod/sandbox-npm-cache),
#     inacessivel fora da plataforma. O caminho do pacote e o mesmo do registro
#     publico do npm, entao a copia de trabalho passa a baixar de registry.npmjs.org.
#     Versoes e hashes de integridade (sha512) do lockfile continuam os mesmos,
#     e o bun confere cada pacote baixado contra eles.
if [ -f bun.lock ] && grep -q -- '-npm\.pkg\.dev/' bun.lock; then
  N="$(grep -o -- '-npm\.pkg\.dev/' bun.lock | wc -l)"
  sed -E -i 's#https://[a-z0-9-]+-npm\.pkg\.dev/[^/"]+/[^/"]+/#https://registry.npmjs.org/#g' bun.lock
  log "bun.lock: $N pacotes do cache da Lovable redirecionados para registry.npmjs.org (mesma versao e integridade)"
fi

# 2) .env apontando para o Supabase local (o .env original fica como .env.original).
node "$PGT/preparar-env.mjs" "$TRABALHO"

# 3) Encaminha 127.0.0.1:54321 do container para o Supabase local do Windows.
#    Com isso a mesma URL (http://127.0.0.1:54321) vale no navegador e no SSR.
node "$PGT/encaminhar.mjs" "$SUPABASE_PORTA" "$SUPABASE_HOST" "$SUPABASE_PORTA" &

# 4) Dependencias: instala so quando o lockfile ou o package.json mudarem.
assinatura() {
  cat package.json package-lock.json bun.lock bun.lockb 2>/dev/null | sha256sum | cut -d' ' -f1
  echo "$PLATAFORMA $(node -v) $(bun --version)"
}
ATUAL="$(assinatura | sha256sum | cut -d' ' -f1)"
MARCA="node_modules/.pgt-instalado"
if [ -f "$MARCA" ] && [ "$(cat "$MARCA")" = "$ATUAL" ]; then
  log "Dependencias ja instaladas (lockfile inalterado)"
else
  rm -rf node_modules
  if [ "$PLATAFORMA" = "lovable" ] && { [ -f bun.lock ] || [ -f bun.lockb ]; }; then
    log "bun install --frozen-lockfile"
    bun install --frozen-lockfile
  elif [ -f package-lock.json ]; then
    log "npm ci"
    npm ci --no-audit --no-fund
  else
    log "Sem lockfile: npm install"
    npm install --no-audit --no-fund
  fi
  echo "$ATUAL" > "$MARCA"
fi

# 5) Servidor de desenvolvimento do Vite, escutando em todas as interfaces do
#    container (o compose publica a porta so em 127.0.0.1 do Windows).
log "Node $(node -v) | bun $(bun --version) | plataforma $PLATAFORMA"
log "Aplicacao em http://localhost:$PORTA"
VITE_BIN="node_modules/vite/bin/vite.js"
if [ "$PLATAFORMA" = "lovable" ]; then
  exec node "$VITE_BIN" dev --host 0.0.0.0 --port "$PORTA" --strictPort
else
  exec node "$VITE_BIN" --host 0.0.0.0 --port "$PORTA" --strictPort
fi
