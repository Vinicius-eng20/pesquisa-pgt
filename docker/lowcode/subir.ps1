<#
.SYNOPSIS
  Sobe uma aplicacao low-code (Bolt ou Lovable) para o pentest, com Supabase local.

.DESCRIPTION
  1. Localiza saidas_lowcode\<plataforma>\<dominio>\<execucao>\projeto.
  2. Copia as migracoes da aplicacao para uma area de trabalho do Supabase
     (docker\lowcode\supabase_trabalho), sem alterar o projeto gerado.
     Bolt: supabase\migrations. Lovable: drizzle\migrations (renomeadas com
     prefixo de data, exigido pelo Supabase CLI).
  3. supabase start + supabase db reset (banco limpo com o schema e o RLS da app).
  4. Le as chaves locais e sobe o container pgt-lowcode (Node 22 + bun), que
     roda o servidor de desenvolvimento do Vite.

.EXAMPLE
  subir bolt restaurante_pedidos
  subir lovable restaurante_pedidos
  subir lovable restaurante_pedidos -Reinstalar
  subir -Parar
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)][string]$Plataforma,
  [Parameter(Position = 1)][string]$Dominio,
  [string]$Execucao,      # timestamp da pasta de execucao (padrao: a mais recente)
  [switch]$Reinstalar,    # apaga o volume da app e reinstala as dependencias
  [switch]$SemReset,      # nao recria o banco (mantem usuarios e dados do teste anterior)
  [switch]$Parar          # para o container e o Supabase local
)

$ErrorActionPreference = 'Continue'
$Lowcode   = $PSScriptRoot
$Raiz      = (Resolve-Path (Join-Path $Lowcode '..\..')).Path
$Compose   = Join-Path $Lowcode 'compose.yaml'
$Trabalho  = Join-Path $Lowcode 'supabase_trabalho'
$SbDir     = Join-Path $Trabalho 'supabase'
$ProjectId = 'pgt-lowcode'

function Info([string]$m)  { Write-Host "[subir] $m" -ForegroundColor Cyan }
function Aviso([string]$m) { Write-Host "[subir] $m" -ForegroundColor Yellow }
function Falha([string]$m) { Write-Host "[subir] $m" -ForegroundColor Red; exit 1 }

function Exige([string]$cmd, [string]$dica) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Falha "'$cmd' nao encontrado. $dica" }
}

function Remover-ContainerApp {
  $ids = docker ps -aq --filter 'label=pgt.lowcode=1'
  foreach ($id in $ids) { docker rm -f $id | Out-Null }
}

Exige 'docker'   'Instale e abra o Docker Desktop.'
Exige 'supabase' 'Instale o Supabase CLI (scoop install supabase).'
docker info --format '{{.ServerVersion}}' | Out-Null
if ($LASTEXITCODE -ne 0) { Falha 'O Docker nao respondeu. Abra o Docker Desktop e tente de novo.' }

# ---------------------------------------------------------------- parar
if ($Parar) {
  Info 'Parando o container da aplicacao'
  Remover-ContainerApp
  if (Test-Path (Join-Path $SbDir 'config.toml')) {
    Info 'Parando o Supabase local'
    Push-Location $Trabalho; supabase stop; Pop-Location
  }
  Info 'Pronto.'
  exit 0
}

# ---------------------------------------------------------------- argumentos
$Plataforma = "$Plataforma".ToLower()
$baseApp = if ($Dominio) { Join-Path $Raiz "saidas_lowcode\$Plataforma\$Dominio" } else { '' }
if ($Plataforma -notin @('bolt', 'lovable') -or -not $Dominio -or -not (Test-Path $baseApp)) {
  if ($Dominio -and $Plataforma -in @('bolt', 'lovable')) { Aviso "Pasta nao encontrada: $baseApp" }
  Write-Host 'Uso: subir <bolt|lovable> <dominio> [-Reinstalar] [-SemReset] [-Execucao <timestamp>]'
  Write-Host '     subir -Parar'
  $pastaLc = Join-Path $Raiz 'saidas_lowcode'
  if (Test-Path $pastaLc) {
    Write-Host ''
    Write-Host 'Aplicacoes disponiveis:'
    foreach ($p in @('bolt', 'lovable')) {
      $d = Get-ChildItem (Join-Path $pastaLc $p) -Directory -ErrorAction SilentlyContinue | ForEach-Object Name
      if ($d) { Write-Host ("  {0,-8} {1}" -f $p, ($d -join ', ')) }
    }
  }
  exit 1
}

$execucoes = Get-ChildItem $baseApp -Directory | Sort-Object Name -Descending
if ($Execucao) { $execucoes = $execucoes | Where-Object Name -eq $Execucao }
$exec = $execucoes | Select-Object -First 1
if (-not $exec) { Falha "Nenhuma execucao encontrada em $baseApp" }
$AppDir = Join-Path $exec.FullName 'projeto'
if (-not (Test-Path (Join-Path $AppDir 'package.json'))) { Falha "package.json nao encontrado em $AppDir" }
if (@(Get-ChildItem $baseApp -Directory).Count -gt 1 -and -not $Execucao) {
  Aviso "Ha mais de uma execucao em $baseApp; usando a mais recente ($($exec.Name))."
}
$AppId = "${Plataforma}__${Dominio}"
$Porta = if ($Plataforma -eq 'bolt') { 5173 } else { 8081 }
Info "Aplicacao: $AppId ($($exec.Name))"

# ---------------------------------------------------------------- area de trabalho do Supabase
if (-not (Test-Path (Join-Path $SbDir 'config.toml'))) {
  Info 'Criando a area de trabalho do Supabase (uma vez)'
  New-Item -ItemType Directory -Force $Trabalho | Out-Null
  Push-Location $Trabalho
  "n`nn`n" | supabase init | Out-Host
  Pop-Location
  $cfg = Join-Path $SbDir 'config.toml'
  if (-not (Test-Path $cfg)) {
    New-Item -ItemType Directory -Force $SbDir | Out-Null
    Set-Content -Path $cfg -Encoding Ascii -Value "project_id = `"$ProjectId`""
  }
  $txt = Get-Content $cfg -Raw
  $txt = $txt -replace '(?m)^project_id\s*=.*$', "project_id = `"$ProjectId`""
  $txt = $txt -replace '(?m)^site_url\s*=.*$', 'site_url = "http://localhost:5173"'
  $txt = $txt -replace '(?m)^additional_redirect_urls\s*=.*$', 'additional_redirect_urls = ["http://localhost:5173", "http://localhost:8081", "http://127.0.0.1:5173", "http://127.0.0.1:8081"]'
  [IO.File]::WriteAllText($cfg, $txt)
}

if (-not $SemReset) {
  $mig = Join-Path $SbDir 'migrations'
  if (Test-Path $mig) { Remove-Item $mig -Recurse -Force }
  New-Item -ItemType Directory $mig | Out-Null
  $copiadas = 0
  foreach ($origem in @('supabase\migrations', 'drizzle\migrations')) {
    $pasta = Join-Path $AppDir $origem
    if (-not (Test-Path $pasta)) { continue }
    $i = 0
    foreach ($f in (Get-ChildItem $pasta -Filter '*.sql' -File | Sort-Object Name)) {
      # O Supabase CLI ordena por <versao>_<nome>.sql; as do Drizzle (0000_x.sql)
      # recebem um prefixo de data fixo que preserva a ordem original.
      $destino = if ($f.Name -match '^\d{14}_') { $f.Name } else { '20000101{0:D6}_{1}' -f $i, $f.Name }
      Copy-Item $f.FullName (Join-Path $mig $destino)
      Info "  migracao: $origem\$($f.Name) -> $destino"
      $i++; $copiadas++
    }
  }
  if ($copiadas -eq 0) { Falha "Nenhuma migracao .sql encontrada em $AppDir" }
}

# ---------------------------------------------------------------- Supabase local
# Outra stack do Supabase usando as mesmas portas impede o start; para ela (os dados ficam guardados).
$outras = docker ps --format '{{.Names}}' | Where-Object { $_ -like 'supabase_db_*' -and $_ -ne "supabase_db_$ProjectId" }
foreach ($c in $outras) {
  $id = $c.Substring('supabase_db_'.Length)
  Aviso "Parando outra stack do Supabase que ocupa as portas ($id)"
  supabase stop --project-id $id
}

Push-Location $Trabalho
Info 'supabase start'
supabase start
if ($LASTEXITCODE -ne 0) { Pop-Location; Falha 'supabase start falhou (veja a mensagem acima).' }
if (-not $SemReset) {
  Info 'supabase db reset (banco limpo + migracoes da aplicacao)'
  supabase db reset
  if ($LASTEXITCODE -ne 0) { Pop-Location; Falha 'Erro ao aplicar as migracoes. Registre o erro: a migracao gerada pela plataforma falhou.' }
}
$status = supabase status -o env
Pop-Location

$sb = @{}
foreach ($linha in $status) { if ($linha -match '^([A-Z_]+)="?(.*?)"?$') { $sb[$Matches[1]] = $Matches[2] } }
$anon = if ($sb['ANON_KEY']) { $sb['ANON_KEY'] } else { $sb['PUBLISHABLE_KEY'] }
$service = if ($sb['SERVICE_ROLE_KEY']) { $sb['SERVICE_ROLE_KEY'] } else { $sb['SECRET_KEY'] }
if (-not $anon) { Falha 'Nao foi possivel ler a chave anon do Supabase local (supabase status -o env).' }

# ---------------------------------------------------------------- porta 54321
# Diagnostico usado so quando o Auth nao responde: outro programa escutando em
# 127.0.0.1:54321 (por exemplo um Supabase/Docker dentro de uma distribuicao do
# WSL) pode "roubar" o trafego do Docker Desktop. O wslrelay sozinho nao prova
# isso, porque o proprio Docker Desktop pode usa-lo para expor portas.
function Mostrar-DonosPorta {
  $donos = Get-NetTCPConnection -LocalPort 54321 -State Listen -ErrorAction SilentlyContinue |
    Select-Object LocalAddress, OwningProcess -Unique
  foreach ($d in $donos) {
    $nome = (Get-Process -Id $d.OwningProcess -ErrorAction SilentlyContinue).ProcessName
    Aviso ("  porta 54321 em {0}: {1} (PID {2})" -f $d.LocalAddress, $nome, $d.OwningProcess)
  }
  Aviso '  Se houver uma distribuicao do WSL alem da docker-desktop rodando (wsl -l -v), encerre-a com wsl --terminate <nome>.'
}

# ---------------------------------------------------------------- gateway (Kong)
# O db reset reinicia o Auth e o REST com novos enderecos internos, e o Kong
# (porta 54321) pode continuar apontando para os antigos: o cadastro e o login
# passam a dar 504 (o navegador mostra como erro de CORS). Reiniciar o Kong
# e esperar o /auth/v1/health responder evita isso.
function Testar-Auth {
  try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:54321/auth/v1/health' -Headers @{ apikey = $anon } -UseBasicParsing -TimeoutSec 5
    return ($r.StatusCode -eq 200)
  } catch { return $false }
}
if (-not $SemReset) {
  Info 'Reiniciando o gateway do Supabase (Kong)'
  docker restart "supabase_kong_$ProjectId" | Out-Null
}
$okAuth = $false
for ($t = 0; $t -lt 30; $t++) {
  if (Testar-Auth) { $okAuth = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $okAuth) {
  Aviso 'O Auth nao respondeu em http://127.0.0.1:54321/auth/v1/health. Tentando reiniciar o Kong mais uma vez.'
  docker restart "supabase_kong_$ProjectId" | Out-Null
  for ($t = 0; $t -lt 30; $t++) {
    if (Testar-Auth) { $okAuth = $true; break }
    Start-Sleep -Seconds 2
  }
}
if ($okAuth) { Info 'Auth do Supabase respondendo' }
else {
  Aviso 'O Auth continua sem responder; cadastro e login devem falhar. Diagnostico:'
  Mostrar-DonosPorta
}

# ---------------------------------------------------------------- container
Info 'Subindo o container pgt-lowcode'
Remover-ContainerApp
if ($Reinstalar) { docker volume rm "pgt_lowcode_$AppId" 2>$null | Out-Null }

$env:PLATAFORMA = $Plataforma
$env:APP_DIR = $AppDir
$env:APP_ID = $AppId
$env:SUPABASE_ANON_KEY = $anon
$env:SUPABASE_SERVICE_ROLE_KEY = $service
docker compose -f $Compose up -d --build
if ($LASTEXITCODE -ne 0) { Falha 'docker compose up falhou.' }

Info "Instalando dependencias e iniciando o Vite (a primeira vez demora alguns minutos)..."
$url = "http://localhost:$Porta"
$limite = (Get-Date).AddMinutes(15)
$pronto = $false
while ((Get-Date) -lt $limite) {
  $rodando = docker inspect -f '{{.State.Running}}' pgt-lowcode 2>$null
  if ($rodando -ne 'true') {
    docker logs --tail 60 pgt-lowcode
    Falha 'O container parou. Veja o log acima.'
  }
  try {
    Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 | Out-Null
    $pronto = $true; break
  } catch {
    if ($_.Exception.Response) { $pronto = $true; break }   # respondeu (mesmo com erro HTTP)
  }
  Start-Sleep -Seconds 3
}
if (-not $pronto) { Aviso "A aplicacao ainda nao respondeu em $url. Acompanhe com: docker logs -f pgt-lowcode" }

$studio = if ($sb['STUDIO_URL']) { $sb['STUDIO_URL'] } else { 'http://127.0.0.1:54323' }
$emails = if ($sb['MAILPIT_URL']) { $sb['MAILPIT_URL'] } elseif ($sb['INBUCKET_URL']) { $sb['INBUCKET_URL'] } else { 'http://127.0.0.1:54324' }
Write-Host ''
Write-Host "  Aplicacao : $url" -ForegroundColor Green
Write-Host "  API       : http://127.0.0.1:54321"
Write-Host "  Studio    : $studio"
Write-Host "  E-mails   : $emails"
Write-Host "  ZAP (APP) : lowcode__${Plataforma}__${Dominio}"
Write-Host "  Logs      : docker logs -f pgt-lowcode"
Write-Host "  Parar     : subir -Parar"
Write-Host ''
Write-Host '  Lembrete: em geral o primeiro usuario cadastrado vira gerente/admin (confira na migracao).'
