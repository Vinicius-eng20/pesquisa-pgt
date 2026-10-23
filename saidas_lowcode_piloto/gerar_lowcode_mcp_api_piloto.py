"""
Piloto do grupo low-code (TCC): geração das aplicações em plataformas low-code.

Plataformas e forma de acesso:
    lovable  servidor MCP oficial (https://mcp.lovable.dev), login OAuth no navegador
    v0       API REST v2 (https://api.v0.dev/v2), chave V0_API_KEY no .env
    replit   servidor MCP oficial (https://mcp.replit.com/server/mcp), login OAuth;
             o código é baixado à mão (ZIP) e importado com importar_zip
    bolt     geração manual em bolt.new; o ZIP exportado é importado com importar_zip

Os prompts de domínio são importados do gerar_app.py (mesmo texto, mesma versão).
Nenhuma aplicação é publicada: o script não chama deploy em nenhuma plataforma.

Uso (PowerShell, na pasta do projeto):
    pip install requests python-dotenv mcp==2.2.0
    python gerar_lowcode.py explorar lovable            # só lista as ferramentas (sem custo)
    python gerar_lowcode.py gerar lovable loja_departamentos
    python gerar_lowcode.py gerar v0 loja_departamentos
    python gerar_lowcode.py gerar replit loja_departamentos
    python gerar_lowcode.py importar bolt loja_departamentos C:\\caminho\\projeto.zip
    python gerar_lowcode.py importar replit loja_departamentos C:\\caminho\\projeto.zip --pasta <pasta da geração>
    python gerar_lowcode.py resumir <pasta do projeto>

Saídas em saidas_lowcode_piloto/<plataforma>/<dominio>/<AAAAMMDD-HHMMSS>/:
    projeto/        código da aplicação
    eventos.json    todas as chamadas feitas à plataforma e as respostas brutas
    registro.json   metadados da geração
    estrutura.json  resumo automático do projeto (backend, banco, migrations, variáveis)
e uma linha em saidas_lowcode_piloto/registro.csv.
"""

import argparse
import asyncio
import csv
import json
import os
import re
import threading
import time
import webbrowser
import zipfile
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import requests
from dotenv import load_dotenv

from gerar_app import DOMINIOS, MENSAGEM_REPARO, PROMPT_VERSAO, formatar_tempo

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

PASTA_SAIDA = Path("saidas_lowcode_piloto")

# Tokens OAuth ficam fora da pasta do repositório, para não irem ao Git.
PASTA_TOKENS = Path.home() / ".tcc_lowcode_oauth"
PORTA_CALLBACK = 33418
URL_CALLBACK = f"http://localhost:{PORTA_CALLBACK}/callback"

URL_MCP = {
    "lovable": "https://mcp.lovable.dev",
    "replit": "https://mcp.replit.com/server/mcp",
}

URL_V0 = "https://api.v0.dev/v2"
V0_MODELO = "v0-mini"          # fixado explicitamente; a documentação não informa o padrão
V0_INTERVALO_CONSULTA = 10      # segundos entre consultas da mensagem assíncrona
V0_TEMPO_MAXIMO = 40 * 60       # segundos por mensagem

REPLIT_APP_STACK = "react_website"

TIMEOUT_MCP = 15 * 60           # segundos por chamada de ferramenta MCP
LOVABLE_INTERVALO_CONSULTA = 15
LOVABLE_TEMPO_MAXIMO = 40 * 60

MAX_INTERACOES = 10             # limite de respostas automáticas por geração

# Mensagens fixas de apoio. PROVISÓRIAS: o piloto serve para decidir o texto final.
MENSAGEM_PERGUNTA = "Pode seguir do jeito que achar melhor."
MENSAGEM_PLANO = "Pode seguir."
MENSAGEM_APOS_BANCO = "Pode continuar."

# Consultas somente de leitura para fotografar o banco gerado no Lovable Cloud.
# Servem para conferir depois se a cópia local (Supabase local) ficou igual.
CONSULTAS_ESQUEMA = {
    "tabelas_colunas": """
        select table_schema, table_name, column_name, data_type, is_nullable, column_default
        from information_schema.columns
        where table_schema not in ('pg_catalog','information_schema','auth','storage',
              'realtime','supabase_functions','extensions','graphql','graphql_public',
              'net','pgsodium','pgsodium_masks','vault','pgbouncer','supabase_migrations','cron')
        order by table_schema, table_name, ordinal_position""",
    "rls_tabelas": """
        select n.nspname as schema, c.relname as tabela, c.relrowsecurity as rls_ativo,
               c.relforcerowsecurity as rls_forcado
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where c.relkind = 'r' and n.nspname = 'public' order by 2""",
    "politicas": "select * from pg_policies order by schemaname, tablename, policyname",
    "funcoes": """
        select n.nspname as schema, p.proname as nome, pg_get_function_identity_arguments(p.oid) as args,
               p.prosecdef as security_definer, pg_get_functiondef(p.oid) as definicao
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' order by 2""",
    "triggers": """
        select event_object_schema, event_object_table, trigger_name, action_timing,
               event_manipulation, action_statement
        from information_schema.triggers order by 2, 3""",
    "buckets": "select id, name, public from storage.buckets order by 1",
    "migracoes_aplicadas": "select * from supabase_migrations.schema_migrations order by 1",
}

CAMPOS_CSV = [
    "data_hora_utc", "plataforma", "dominio", "prompt_versao", "modelo", "id_externo",
    "url_editor", "estado", "duracao_s", "n_interacoes", "intervencoes_manuais",
    "banco", "creditos_antes", "creditos_depois", "creditos_usados", "tokens_entrada",
    "tokens_saida", "n_arquivos", "tem_backend", "tem_migrations", "usa_localstorage",
    "pasta", "erro",
]


class ErroPlataforma(Exception):
    pass


# ---------------------------------------------------------------------------
# Utilitários comuns
# ---------------------------------------------------------------------------

def _agora():
    return datetime.now(timezone.utc)


def _salvar_json(caminho, dados):
    Path(caminho).write_text(json.dumps(dados, ensure_ascii=False, indent=2, default=str),
                             encoding="utf-8")


class Geracao:
    """Pasta, registro e log de eventos de uma geração."""

    def __init__(self, plataforma, dominio, pasta=None):
        if dominio not in DOMINIOS:
            raise KeyError(f"Domínio '{dominio}' não existe. Opções: {list(DOMINIOS)}")
        self.inicio = _agora()
        self.t0 = time.monotonic()
        self.pasta = Path(pasta) if pasta else (
            PASTA_SAIDA / plataforma / dominio / self.inicio.strftime("%Y%m%d-%H%M%S"))
        self.pasta.mkdir(parents=True, exist_ok=True)
        self.eventos = []
        self.registro = {
            "data_hora_utc": self.inicio.isoformat(timespec="seconds"),
            "plataforma": plataforma,
            "dominio": dominio,
            "prompt_versao": PROMPT_VERSAO,
            "prompt_usuario": DOMINIOS[dominio],
            "pasta": str(self.pasta),
            "interacoes": [],
            "intervencoes_manuais": [],
        }

    def evento(self, tipo, **dados):
        self.eventos.append({"hora_utc": _agora().isoformat(timespec="seconds"),
                             "tipo": tipo, **dados})
        _salvar_json(self.pasta / "eventos.json", self.eventos)

    def interacao(self, descricao, **dados):
        self.registro["interacoes"].append({"descricao": descricao, **dados})
        print(f"  interação automática: {descricao}")

    def intervencao_manual(self, descricao):
        self.registro["intervencoes_manuais"].append(
            {"hora_utc": _agora().isoformat(timespec="seconds"), "descricao": descricao})

    def finalizar(self, estado, erro=""):
        self.registro["estado"] = estado
        self.registro["erro"] = erro
        self.registro["duracao_s"] = round(time.monotonic() - self.t0, 1)
        projeto = self.pasta / "projeto"
        if projeto.exists() and any(projeto.iterdir()):
            estrutura = resumir_projeto(projeto)
            _salvar_json(self.pasta / "estrutura.json", estrutura)
            self.registro.update(
                n_arquivos=estrutura["n_arquivos"],
                tem_backend=estrutura["tem_backend"],
                tem_migrations=estrutura["tem_migrations"],
                usa_localstorage=estrutura["usa_localstorage"],
            )
        _salvar_json(self.pasta / "registro.json", self.registro)
        _acrescentar_csv({
            **self.registro,
            "n_interacoes": len(self.registro["interacoes"]),
            "intervencoes_manuais": len(self.registro["intervencoes_manuais"]),
        })
        print(f"Estado: {estado} | duração: {formatar_tempo(self.registro['duracao_s'])} "
              f"| arquivos: {self.registro.get('n_arquivos', 0)} | pasta: {self.pasta}")
        if erro:
            print(f"Erro: {erro}")
        return self.registro


def _acrescentar_csv(linha):
    PASTA_SAIDA.mkdir(parents=True, exist_ok=True)
    arquivo = PASTA_SAIDA / "registro.csv"
    novo = not arquivo.exists()
    with arquivo.open("a", newline="", encoding="utf-8") as f:
        escritor = csv.DictWriter(f, fieldnames=CAMPOS_CSV)
        if novo:
            escritor.writeheader()
        escritor.writerow({c: linha.get(c, "") for c in CAMPOS_CSV})


def _gravar_arquivo(base, caminho, conteudo):
    """Grava um arquivo recusando caminhos que saiam da pasta do projeto."""
    base = Path(base).resolve()
    destino = (base / caminho.replace("\\", "/").lstrip("/")).resolve()
    if destino == base or base not in destino.parents:
        return False
    destino.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(conteudo, bytes):
        destino.write_bytes(conteudo)
    else:
        destino.write_text(conteudo, encoding="utf-8", newline="")
    return True


def _extrair_zip(caminho_zip, destino):
    """Extrai o ZIP em destino, recusando caminhos inseguros. Se todo o conteúdo estiver
    dentro de uma única pasta raiz, essa pasta é removida do caminho."""
    with zipfile.ZipFile(caminho_zip) as z:
        nomes = [n for n in z.namelist() if not n.endswith("/")]
        raizes = {n.split("/", 1)[0] for n in nomes}
        prefixo = (raizes.pop() + "/") if len(raizes) == 1 and all("/" in n for n in nomes) else ""
        gravados, recusados = [], []
        for nome in nomes:
            relativo = nome[len(prefixo):]
            if _gravar_arquivo(destino, relativo, z.read(nome)):
                gravados.append(relativo)
            else:
                recusados.append(nome)
    return gravados, recusados


def _pausar(mensagem):
    """Pausa para uma ação do pesquisador e devolve o que ele digitar."""
    print("\n" + "=" * 70)
    print(mensagem)
    print("=" * 70)
    return input("Depois de concluir, descreva o que fez (ou só Enter): ").strip()


# ---------------------------------------------------------------------------
# Resumo automático da estrutura do projeto
# ---------------------------------------------------------------------------

EXTENSOES_TEXTO = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json", ".sql", ".prisma",
                   ".toml", ".py", ".html", ".vue", ".svelte", ".md", ".env", ".yaml", ".yml"}
PADROES_SERVIDOR = re.compile(
    r"\bexpress\(\)|\bfastify\(|\bapp\.listen\(|\bcreateServer\(|\bHono\(|"
    r"^\s*['\"]use server['\"]|\bDeno\.serve\(|\bserve\(\s*async")
PADRAO_ENV = re.compile(
    r"(?:process\.env|import\.meta\.env|Deno\.env\.get\()\.?\(?['\"]?([A-Z][A-Z0-9_]+)")


def resumir_projeto(projeto):
    """Classificação heurística da arquitetura entregue (mesmo espírito do fase-piloto.md).
    Serve para triagem; os casos limítrofes precisam de conferência manual."""
    projeto = Path(projeto)
    arquivos = [p for p in projeto.rglob("*") if p.is_file()
                and "node_modules" not in p.parts and ".git" not in p.parts]
    rel = [p.relative_to(projeto).as_posix() for p in arquivos]

    migrations = [r for r in rel if re.search(r"(^|/)(supabase/)?migrations?/.*\.sql$", r)
                  or re.search(r"(^|/)(scripts|db|sql)/.*\.sql$", r)]
    funcoes_edge = sorted({r.split("/")[2] for r in rel
                           if r.startswith("supabase/functions/") and r.count("/") >= 3})
    rotas_api = [r for r in rel if re.search(r"(^|/)app/api/.+/route\.(t|j)sx?$", r)
                 or re.search(r"(^|/)pages/api/.+\.(t|j)sx?$", r)]
    servidor, local_storage, supabase_client = [], [], []
    variaveis = set()
    dependencias = {}

    for p, r in zip(arquivos, rel):
        if p.suffix.lower() not in EXTENSOES_TEXTO and not p.name.startswith(".env"):
            continue
        try:
            texto = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        if PADROES_SERVIDOR.search(texto) and not r.startswith("supabase/functions/"):
            servidor.append(r)
        if "localStorage" in texto:
            local_storage.append(r)
        if "createClient(" in texto and "supabase" in texto.lower():
            supabase_client.append(r)
        variaveis.update(PADRAO_ENV.findall(texto))
        if p.name == "package.json" and "node_modules" not in r:
            try:
                pkg = json.loads(texto)
                dependencias[r] = sorted({**pkg.get("dependencies", {}),
                                          **pkg.get("devDependencies", {})})
            except ValueError:
                dependencias[r] = "package.json inválido"

    todas_deps = {d for v in dependencias.values() if isinstance(v, list) for d in v}
    bancos = sorted(d for d in todas_deps if re.search(
        r"supabase|@neondatabase|^pg$|postgres|prisma|drizzle|sqlite|mysql|mongo|@upstash|"
        r"@vercel/(postgres|kv|blob)|redis", d))

    return {
        "n_arquivos": len(rel),
        "tem_backend": bool(servidor or rotas_api or funcoes_edge or supabase_client),
        "tem_migrations": bool(migrations),
        "usa_localstorage": bool(local_storage),
        "migrations": migrations,
        "funcoes_edge_supabase": funcoes_edge,
        "rotas_api": rotas_api,
        "arquivos_servidor": servidor,
        "clientes_supabase": supabase_client,
        "arquivos_localstorage": local_storage,
        "dependencias_banco": bancos,
        "variaveis_ambiente": sorted(variaveis),
        "package_json": list(dependencias),
    }


# ---------------------------------------------------------------------------
# Cliente MCP com OAuth (Lovable e Replit)
# ---------------------------------------------------------------------------

class _ArmazenamentoTokens:
    """Guarda tokens e registro do cliente OAuth em ~/.tcc_lowcode_oauth/<plataforma>.json."""

    def __init__(self, plataforma):
        PASTA_TOKENS.mkdir(parents=True, exist_ok=True)
        self.arquivo = PASTA_TOKENS / f"{plataforma}.json"

    def _ler(self):
        if self.arquivo.exists():
            return json.loads(self.arquivo.read_text(encoding="utf-8"))
        return {}

    def _gravar(self, chave, valor):
        dados = self._ler()
        dados[chave] = valor
        self.arquivo.write_text(json.dumps(dados), encoding="utf-8")

    async def get_tokens(self):
        from mcp.shared.auth import OAuthToken
        t = self._ler().get("tokens")
        return OAuthToken.model_validate(t) if t else None

    async def set_tokens(self, tokens):
        self._gravar("tokens", tokens.model_dump(mode="json", exclude_none=True))

    async def get_client_info(self):
        from mcp.shared.auth import OAuthClientInformationFull
        c = self._ler().get("client_info")
        return OAuthClientInformationFull.model_validate(c) if c else None

    async def set_client_info(self, client_info):
        self._gravar("client_info", client_info.model_dump(mode="json", exclude_none=True))


def _esperar_callback():
    """Sobe um servidor local de uma requisição só, para receber o código OAuth."""
    resultado = {}

    class Tratador(BaseHTTPRequestHandler):
        def do_GET(self):
            q = parse_qs(urlparse(self.path).query)
            resultado.update({k: v[0] for k, v in q.items()})
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write("Login concluído. Pode fechar esta aba.".encode("utf-8"))

        def log_message(self, *_):
            pass

    servidor = HTTPServer(("127.0.0.1", PORTA_CALLBACK), Tratador)
    servidor.timeout = 300
    servidor.handle_request()
    servidor.server_close()
    return resultado


def _abrir_cliente_mcp(plataforma):
    """Cria o cliente MCP com OAuth (abre o navegador no primeiro uso)."""
    import httpx2
    from mcp import Client
    from mcp.client.auth import OAuthClientProvider
    from mcp.client.streamable_http import create_mcp_http_client, streamable_http_client
    from mcp.shared.auth import AuthorizationCodeResult, OAuthClientMetadata

    async def redirecionar(url):
        print(f"\nAbrindo o navegador para login em {plataforma}. Se não abrir, acesse:\n{url}\n")
        webbrowser.open(url)

    async def receber_codigo():
        r = await asyncio.to_thread(_esperar_callback)
        if "code" not in r:
            raise ErroPlataforma(f"Login OAuth não retornou código: {r}")
        return AuthorizationCodeResult(code=r["code"], state=r.get("state"))

    provedor = OAuthClientProvider(
        server_url=URL_MCP[plataforma],
        client_metadata=OAuthClientMetadata(
            client_name="TCC piloto low-code",
            redirect_uris=[URL_CALLBACK],
            grant_types=["authorization_code", "refresh_token"],
            response_types=["code"],
            token_endpoint_auth_method="none",
        ),
        storage=_ArmazenamentoTokens(plataforma),
        redirect_handler=redirecionar,
        callback_handler=receber_codigo,
    )
    http = create_mcp_http_client(
        auth=provedor, timeout=httpx2.Timeout(30, read=TIMEOUT_MCP))
    transporte = streamable_http_client(URL_MCP[plataforma], http_client=http)
    return Client(transporte, read_timeout_seconds=TIMEOUT_MCP)


def _resultado_mcp(res):
    """Converte o resultado de uma ferramenta MCP em dicionário."""
    if getattr(res, "structured_content", None):
        return res.structured_content
    textos = [c.text for c in (res.content or []) if getattr(c, "type", "") == "text"]
    texto = "\n".join(textos)
    try:
        dados = json.loads(texto)
        return dados if isinstance(dados, dict) else {"dados": dados}
    except ValueError:
        return {"texto": texto}


def _achar(dados, *chaves):
    """Procura recursivamente a primeira chave existente (resposta com formato não documentado)."""
    if isinstance(dados, dict):
        for c in chaves:
            if dados.get(c) not in (None, ""):
                return dados[c]
        for v in dados.values():
            achado = _achar(v, *chaves)
            if achado not in (None, ""):
                return achado
    elif isinstance(dados, list):
        for v in dados:
            achado = _achar(v, *chaves)
            if achado not in (None, ""):
                return achado
    return None


class _SessaoMCP:
    """Chamadas de ferramenta com registro no log de eventos da geração."""

    def __init__(self, cliente, geracao=None):
        self.cliente = cliente
        self.geracao = geracao
        self.esquemas = {}

    async def carregar_ferramentas(self):
        lista = await self.cliente.list_tools()
        self.esquemas = {t.name: (t.input_schema if hasattr(t, "input_schema") else t.inputSchema)
                         for t in lista.tools}
        return lista

    async def chamar(self, ferramenta, argumentos, tolerar_erro=False):
        if self.esquemas and ferramenta not in self.esquemas:
            raise ErroPlataforma(f"Ferramenta '{ferramenta}' não existe neste servidor.")
        t0 = time.monotonic()
        res = await self.cliente.call_tool(ferramenta, argumentos)
        dados = _resultado_mcp(res)
        erro = bool(getattr(res, "is_error", False))
        if self.geracao:
            self.geracao.evento("mcp", ferramenta=ferramenta, argumentos=argumentos,
                                erro=erro, duracao_s=round(time.monotonic() - t0, 1),
                                resultado=dados)
        if erro and not tolerar_erro:
            raise ErroPlataforma(f"{ferramenta} falhou: {json.dumps(dados, ensure_ascii=False)[:800]}")
        return dados

    def propriedades(self, ferramenta):
        return (self.esquemas.get(ferramenta) or {}).get("properties", {})


async def explorar_mcp(plataforma):
    """Lista as ferramentas do servidor MCP e salva os esquemas (não gasta créditos)."""
    destino = PASTA_SAIDA / plataforma / f"ferramentas_{_agora():%Y%m%d-%H%M%S}.json"
    destino.parent.mkdir(parents=True, exist_ok=True)
    async with _abrir_cliente_mcp(plataforma) as cliente:
        sessao = _SessaoMCP(cliente)
        lista = await sessao.carregar_ferramentas()
        _salvar_json(destino, [
            {"nome": t.name, "descricao": t.description, "parametros": sessao.esquemas[t.name]}
            for t in lista.tools])
    print(f"{len(sessao.esquemas)} ferramentas salvas em {destino}")
    for nome in sorted(sessao.esquemas):
        print(f"  - {nome}: {list(sessao.propriedades(nome))}")
    return destino


# ---------------------------------------------------------------------------
# Lovable (MCP)
# ---------------------------------------------------------------------------

ESTADOS_EM_ANDAMENTO = {"pending", "queued", "running", "in_progress", "processing",
                        "streaming", "thinking", "working", "generating", "started"}


async def _lovable_aguardar(sessao, projeto_id, resposta, g):
    """Espera a mensagem do agente terminar. Para em pedido de aprovação (pausa manual)."""
    limite = time.monotonic() + LOVABLE_TEMPO_MAXIMO
    while True:
        estado = str(_achar(resposta, "status", "state") or "").lower()
        if estado not in ESTADOS_EM_ANDAMENTO:
            return resposta
        if time.monotonic() > limite:
            raise ErroPlataforma("Tempo máximo de espera do Lovable esgotado.")
        id_msg = _achar(resposta, "message_id", "messageId")
        if not id_msg:
            return resposta
        await asyncio.sleep(LOVABLE_INTERVALO_CONSULTA)
        args = {"project_id": projeto_id, "message_id": id_msg}
        thread = _achar(resposta, "thread_id", "threadId")
        if thread:
            args["thread_id"] = thread
        resposta = await sessao.chamar("get_message", args)
        print(f"  [{datetime.now():%H:%M:%S}] situação: {_achar(resposta, 'status', 'state')}")


def _lovable_pendencia(resposta):
    """Detecta pausa do agente pelo campo de situação (formato ainda não documentado)."""
    estado = str(_achar(resposta, "status", "state") or "").lower()
    if any(p in estado for p in ("approval", "awaiting", "waiting", "input_required",
                                 "requires_action", "paused")):
        return estado
    return None


async def _lovable_conversar(sessao, projeto_id, resposta, g):
    """Espera o agente terminar. Pausas (aprovação, pergunta) vão para ação manual
    registrada, porque o formato delas ainda não é conhecido; o piloto serve para isso."""
    for _ in range(MAX_INTERACOES):
        resposta = await _lovable_aguardar(sessao, projeto_id, resposta, g)
        pendencia = _lovable_pendencia(resposta)
        if not pendencia:
            return resposta
        nota = _pausar(
            f"O Lovable está em '{pendencia}'. Veja o último evento em "
            f"{g.pasta / 'eventos.json'} e resolva no editor do Lovable "
            f"({g.registro.get('url_editor') or 'lovable.dev'}) como um leigo faria "
            "(por exemplo, clicar em aprovar).")
        g.intervencao_manual(f"{pendencia}: {nota or 'sem nota'}")
        # Volta a acompanhar a mesma mensagem até ela terminar.
        resposta = {"status": "running",
                    "message_id": _achar(resposta, "message_id", "messageId"),
                    "thread_id": _achar(resposta, "thread_id", "threadId")}
    raise ErroPlataforma("Limite de interações atingido.")


async def _lovable_baixar_codigo(sessao, projeto_id, g):
    projeto = g.pasta / "projeto"
    projeto.mkdir(exist_ok=True)
    caminhos, cursor, ref = [], None, None
    props = sessao.propriedades("list_files")
    while True:
        args = {"project_id": projeto_id}
        if cursor:
            args["cursor"] = cursor
        if "limit" in props:
            args["limit"] = props["limit"].get("maximum", 100)
        r = await sessao.chamar("list_files", args)
        ref = ref or _achar(r, "ref", "commit", "commit_sha", "sha")
        itens = r.get("files") or r.get("data") or r.get("dados") or []
        for item in itens:
            caminho = item if isinstance(item, str) else (item.get("path") or item.get("name"))
            tipo = "" if isinstance(item, str) else str(item.get("type", "")).lower()
            if caminho and tipo not in ("dir", "directory", "folder", "tree"):
                caminhos.append(caminho)
        cursor = _achar(r.get("pagination") or {}, "next_cursor") or r.get("next_cursor")
        if not cursor:
            break

    ref = ref or "main"
    g.registro["lovable_ref"] = ref
    falhas = []
    print(f"  baixando {len(caminhos)} arquivos (ref {ref})...")
    for caminho in caminhos:
        r = await sessao.chamar("read_file", {"project_id": projeto_id, "path": caminho,
                                              "ref": ref}, tolerar_erro=True)
        conteudo = r.get("content") if isinstance(r.get("content"), str) else r.get("texto")
        if conteudo is None or not _gravar_arquivo(projeto, caminho, conteudo):
            falhas.append(caminho)
    g.registro["arquivos_nao_baixados"] = falhas
    if falhas:
        print(f"  AVISO: {len(falhas)} arquivo(s) não baixado(s); ver registro.json")


async def _lovable_gerar(dominio, ativar_banco):
    g = Geracao("lovable", dominio)
    try:
        async with _abrir_cliente_mcp("lovable") as cliente:
            sessao = _SessaoMCP(cliente, g)
            await sessao.carregar_ferramentas()
            g.evento("ferramentas", nomes=sorted(sessao.esquemas))

            espacos = await sessao.chamar("list_workspaces", {})
            espaco_id = _achar(espacos, "workspace_id", "id")
            g.registro["workspace_id"] = espaco_id
            antes = await sessao.chamar("get_workspace", {"workspace_id": espaco_id},
                                        tolerar_erro=True)
            g.registro["creditos_antes"] = _achar(antes, "credits_remaining", "credit_balance",
                                                  "credits", "remaining_credits")

            args = {"initial_message": DOMINIOS[dominio], "wait": True}
            if espaco_id:
                args["workspace_id"] = espaco_id
            maximo = sessao.propriedades("create_project").get("timeout_seconds", {}).get("maximum")
            if maximo:
                args["timeout_seconds"] = maximo
            print(f"[{datetime.now():%H:%M:%S}] Criando projeto no Lovable ('{dominio}')...")
            resposta = await sessao.chamar("create_project", args)
            projeto_id = _achar(resposta, "project_id", "projectId", "id")
            if not projeto_id:
                raise ErroPlataforma("create_project não devolveu o id do projeto.")
            g.registro["id_externo"] = projeto_id
            info = await sessao.chamar("get_project", {"project_id": projeto_id}, tolerar_erro=True)
            g.registro["url_editor"] = _achar(info, "editor_url", "editorUrl", "url")
            await _lovable_conversar(sessao, projeto_id, resposta, g)

            banco = await sessao.chamar("get_database_status", {"project_id": projeto_id})
            g.registro["banco_apos_geracao"] = banco
            ativo = _achar(banco, "enabled", "is_enabled", "status")
            ativo = ativo is True or str(ativo).lower() in ("true", "enabled", "active", "ready")
            g.registro["banco"] = "ativado_pelo_agente" if ativo else "nao_ativado"

            if not ativo and ativar_banco:
                print("  Lovable Cloud não foi ativado pelo agente; ativando (decisão do piloto)...")
                await sessao.chamar("enable_database", {"project_id": projeto_id})
                g.registro["banco"] = "ativado_pelo_pesquisador"
                g.interacao("enable_database + mensagem fixa", mensagem=MENSAGEM_APOS_BANCO)
                resposta = await sessao.chamar("send_message", {
                    "project_id": projeto_id, "message": MENSAGEM_APOS_BANCO, "wait": True})
                await _lovable_conversar(sessao, projeto_id, resposta, g)

            if g.registro["banco"] != "nao_ativado":
                esquema = {}
                for nome, sql in CONSULTAS_ESQUEMA.items():
                    esquema[nome] = await sessao.chamar(
                        "query_database", {"project_id": projeto_id, "sql": sql}, tolerar_erro=True)
                _salvar_json(g.pasta / "esquema_banco.json", esquema)

            await _lovable_baixar_codigo(sessao, projeto_id, g)

            depois = await sessao.chamar("get_workspace", {"workspace_id": espaco_id},
                                         tolerar_erro=True)
            g.registro["creditos_depois"] = _achar(depois, "credits_remaining", "credit_balance",
                                                   "credits", "remaining_credits")
            try:
                g.registro["creditos_usados"] = round(
                    float(g.registro["creditos_antes"]) - float(g.registro["creditos_depois"]), 2)
            except (TypeError, ValueError):
                pass
        return g.finalizar("gerada")
    except Exception as e:  # registra qualquer falha sem perder o que já foi salvo
        return g.finalizar("erro", f"{type(e).__name__}: {e}")


# ---------------------------------------------------------------------------
# v0 (API REST v2)
# ---------------------------------------------------------------------------

def _v0_chave():
    load_dotenv()
    chave = os.getenv("V0_API_KEY")
    if not chave:
        raise RuntimeError("Defina V0_API_KEY no arquivo .env.")
    return chave


def _v0(metodo, caminho, g, corpo=None, bruto=False, tentativas=5):
    """Chamada à API do v0 com novas tentativas para 429/5xx. Registra no log de eventos."""
    url = URL_V0 + caminho
    for tentativa in range(1, tentativas + 1):
        r = requests.request(metodo, url, json=corpo, timeout=(30, 300), headers={
            "Authorization": f"Bearer {_v0_chave()}", "Content-Type": "application/json"})
        if r.status_code in (429, 500, 502, 503, 504) and tentativa < tentativas:
            espera = float(r.headers.get("Retry-After") or min(2 ** tentativa, 60))
            print(f"  v0 respondeu {r.status_code}; nova tentativa em {espera:.0f}s")
            time.sleep(espera)
            continue
        break
    if bruto:
        g.evento("v0", metodo=metodo, caminho=caminho, status=r.status_code,
                 bytes=len(r.content))
        if not r.ok:
            raise ErroPlataforma(f"v0 {metodo} {caminho}: {r.status_code} {r.text[:500]}")
        return r.content
    try:
        dados = r.json()
    except ValueError:
        dados = {"texto": r.text[:2000]}
    g.evento("v0", metodo=metodo, caminho=caminho, corpo=corpo, status=r.status_code,
             resposta=dados)
    if r.status_code == 409:
        return {"conflito": True, **(dados if isinstance(dados, dict) else {})}
    if not r.ok:
        raise ErroPlataforma(f"v0 {metodo} {caminho}: {r.status_code} {json.dumps(dados)[:500]}")
    if isinstance(dados, dict) and isinstance(dados.get("data"), dict) and len(dados) <= 2:
        return dados["data"]
    return dados


def _v0_esperar(chat_id, msg_id, g):
    limite = time.monotonic() + V0_TEMPO_MAXIMO
    while True:
        m = _v0("GET", f"/chats/{chat_id}/messages/{msg_id}", g)
        if m.get("finishReason") is not None:
            return m
        if time.monotonic() > limite:
            raise ErroPlataforma("Tempo máximo de espera do v0 esgotado.")
        print(f"  [{datetime.now():%H:%M:%S}] gerando...")
        time.sleep(V0_INTERVALO_CONSULTA)


def _v0_ultima_assistente(chat_id, g):
    r = _v0("GET", f"/chats/{chat_id}/messages", g)
    lista = r if isinstance(r, list) else (r.get("data") or r.get("messages") or [])
    assist = [m for m in lista if m.get("role") == "assistant"]
    return max(assist, key=lambda m: m.get("createdAt") or "") if assist else None


def _v0_pendencia(m):
    """Devolve (tipo, parte) da interação pendente na mensagem, ou (None, None)."""
    for parte in reversed(m.get("parts") or []):
        if parte.get("type") == "agent-action" and parte.get("name") in (
                "ask_user_questions", "exit_plan_mode", "get_or_request_integration",
                "configure_vercel_connect") and parte.get("data"):
            return parte["name"], parte
        if parte.get("type") == "tool-call" and parte.get("suggestedPermissions"):
            return "permissao", parte
    return None, None


def _v0_resolver(chat_id, m, g):
    """Responde a interação pendente segundo as regras do piloto.
    Devolve o id da próxima mensagem do assistente, ou None se não havia pendência."""
    tipo, parte = _v0_pendencia(m)
    if not tipo:
        return None
    dados = parte.get("data") or {}

    if tipo == "ask_user_questions":
        respostas = []
        for q in dados.get("questions", []):
            opcoes = q.get("options") or []
            if opcoes:  # regra provisória: primeira opção oferecida pelo agente
                respostas.append({"questionId": q["id"], "questionText": q["question"],
                                  "selectedLabels": [opcoes[0]["label"]]})
            else:
                respostas.append({"questionId": q["id"], "questionText": q["question"],
                                  "selectedLabels": [], "customText": MENSAGEM_PERGUNTA})
        tarefa = {"type": "answered-questions", "answers": respostas}
        g.interacao("perguntas respondidas com a primeira opção", tarefa=tarefa)

    elif tipo == "exit_plan_mode":
        tarefa = {"type": "plan-exit-response", "status": "approved", "content": MENSAGEM_PLANO}
        g.interacao("plano aprovado", tarefa=tarefa)

    elif tipo == "permissao":
        tarefa = {"type": "confirmed-permissions", "permissions": parte["suggestedPermissions"]}
        g.interacao(f"permissão aprovada: {parte.get('name')}", tarefa=tarefa)

    elif tipo == "get_or_request_integration":
        pedidas = dados.get("requestedIntegrations") or []
        g.registro.setdefault("integracoes_pedidas", []).extend(pedidas)
        nota = _pausar(
            f"O v0 pediu integração: {pedidas}.\n"
            f"Abra o chat no v0 ({g.registro.get('url_editor')}) e conclua a instalação "
            "pela interface (decisão do piloto: aceitar a integração de banco).")
        g.intervencao_manual(f"integração {pedidas}: {nota or 'sem nota'}")
        tarefa = {"type": "confirmed-steps",
                  "connectedIntegrationNames": [str(p) if not isinstance(p, dict) else
                                                p.get("name") for p in pedidas]}
        g.interacao("integração confirmada", tarefa=tarefa)

    else:  # configure_vercel_connect: não previsto, fica manual
        nota = _pausar(f"Interação '{tipo}' não prevista. Resolva no v0 "
                       f"({g.registro.get('url_editor')}).")
        g.intervencao_manual(f"{tipo}: {nota or 'sem nota'}")
        tarefa = None

    if tarefa is not None:
        r = _v0("POST", f"/chats/{chat_id}/messages/resolve/async", g, {"task": tarefa})
        if not r.get("conflito"):
            return r["messageId"]
        print("  a tarefa já tinha sido resolvida pela interface; seguindo a conversa.")
    ultima = _v0_ultima_assistente(chat_id, g)
    if not ultima or ultima.get("id") == m.get("id"):
        raise ErroPlataforma(f"Não consegui seguir após a interação '{tipo}'.")
    return ultima["id"]


def _v0_conversar(chat_id, msg_id, g):
    for _ in range(MAX_INTERACOES):
        m = _v0_esperar(chat_id, msg_id, g)
        uso = m.get("usage") or {}
        g.registro["tokens_entrada"] = (g.registro.get("tokens_entrada") or 0) + \
            ((uso.get("tokens") or {}).get("input") or 0)
        g.registro["tokens_saida"] = (g.registro.get("tokens_saida") or 0) + \
            ((uso.get("tokens") or {}).get("output") or 0)
        g.registro["creditos_usados"] = round((g.registro.get("creditos_usados") or 0) +
                                              ((uso.get("creditsCost") or {}).get("total") or 0), 6)
        g.registro["motivo_termino"] = m.get("finishReason")
        proximo = _v0_resolver(chat_id, m, g)
        if not proximo:
            return m
        msg_id = proximo
    raise ErroPlataforma("Limite de interações atingido.")


def _v0_baixar(chat_id, g):
    zip_bytes = _v0("GET", f"/chats/{chat_id}/files/download", g, bruto=True)
    caminho_zip = g.pasta / "projeto.zip"
    caminho_zip.write_bytes(zip_bytes)
    gravados, recusados = _extrair_zip(caminho_zip, g.pasta / "projeto")
    g.registro["arquivos_recusados"] = recusados
    return gravados


def gerar_v0(dominio):
    g = Geracao("v0", dominio)
    g.registro["modelo"] = V0_MODELO
    corpo = {
        "message": DOMINIOS[dominio],
        "modelConfiguration": {"modelId": V0_MODELO, "imageGenerations": False},
        "mcpServerIds": [],      # sem servidores MCP ligados por padrão na conta
        "privacy": "private",
    }
    g.registro["parametros"] = {k: v for k, v in corpo.items() if k != "message"}
    try:
        print(f"[{datetime.now():%H:%M:%S}] Criando chat no v0 ('{dominio}', {V0_MODELO})...")
        r = _v0("POST", "/chats/async", g, corpo)
        chat_id = r["chatId"]
        g.registro["id_externo"] = chat_id
        chat = _v0("GET", f"/chats/{chat_id}", g)
        g.registro["url_editor"] = _achar(chat, "webUrl", "url")
        final = _v0_conversar(chat_id, r["messageId"], g)
        if final.get("finishReason") not in ("stop", "tool-calls"):
            g.registro["aviso"] = f"finishReason={final.get('finishReason')}"
        _salvar_json(g.pasta / "mensagens.json", _v0("GET", f"/chats/{chat_id}/messages", g))
        g.registro["banco"] = ", ".join(g.registro.get("integracoes_pedidas", [])) or "nenhuma_integracao"
        _v0_baixar(chat_id, g)
        return g.finalizar("gerada")
    except Exception as e:
        return g.finalizar("erro", f"{type(e).__name__}: {e}")


def corrigir_v0(pasta_geracao, erro):
    """Rodada de reparo no mesmo chat do v0 (mensagem fixa do protocolo)."""
    pasta_geracao = Path(pasta_geracao)
    anterior = json.loads((pasta_geracao / "registro.json").read_text(encoding="utf-8"))
    n = len(list(pasta_geracao.glob("reparo_*"))) + 1
    if n > 3:
        raise ValueError("Limite de 3 rodadas de reparo atingido (protocolo).")
    g = Geracao("v0", anterior["dominio"], pasta=pasta_geracao / f"reparo_{n}")
    g.registro.update(rodada=n, modelo=V0_MODELO, id_externo=anterior["id_externo"],
                      url_editor=anterior.get("url_editor"))
    mensagem = MENSAGEM_REPARO.format(erro=erro.strip("\n"))
    g.registro["mensagem_reparo"] = mensagem
    try:
        r = _v0("POST", f"/chats/{anterior['id_externo']}/messages/async", g, {
            "message": mensagem,
            "modelConfiguration": {"modelId": V0_MODELO, "imageGenerations": False},
            "mcpServerIds": []})
        _v0_conversar(anterior["id_externo"], r["messageId"], g)
        _v0_baixar(anterior["id_externo"], g)
        return g.finalizar("gerada")
    except Exception as e:
        return g.finalizar("erro", f"{type(e).__name__}: {e}")


# ---------------------------------------------------------------------------
# Replit (MCP) e importação manual (Bolt e Replit)
# ---------------------------------------------------------------------------

async def _replit_gerar(dominio):
    g = Geracao("replit", dominio)
    try:
        async with _abrir_cliente_mcp("replit") as cliente:
            sessao = _SessaoMCP(cliente, g)
            await sessao.carregar_ferramentas()
            g.evento("ferramentas", nomes=sorted(sessao.esquemas),
                     esquema_create=sessao.esquemas.get("create_app_from_prompt"))
            props = sessao.propriedades("create_app_from_prompt")
            args = {"appDescription": DOMINIOS[dominio], "app_stack": REPLIT_APP_STACK}
            if "userQuotes" in props:  # o prompt literal também vai no campo de citações
                tipo = props["userQuotes"].get("type")
                args["userQuotes"] = [DOMINIOS[dominio]] if tipo == "array" else DOMINIOS[dominio]
            g.registro["parametros"] = {"app_stack": REPLIT_APP_STACK,
                                        "userQuotes": "userQuotes" in args}
            print(f"[{datetime.now():%H:%M:%S}] Criando app no Replit ('{dominio}')...")
            r = await sessao.chamar("create_app_from_prompt", args)
            g.registro["id_externo"] = _achar(r, "replId", "repl_id", "id")
            g.registro["url_editor"] = _achar(r, "url", "replUrl", "editorUrl")
        print("\nO Replit Agent continua trabalhando na plataforma. Acompanhe pelo navegador, "
              "baixe o ZIP quando terminar e rode:\n"
              f"  python gerar_lowcode.py importar replit {dominio} <arquivo.zip> --pasta {g.pasta}")
        return g.finalizar("aguardando_codigo")
    except Exception as e:
        return g.finalizar("erro", f"{type(e).__name__}: {e}")


def importar_zip(plataforma, dominio, caminho_zip, pasta=None, observacao=""):
    """Importa o ZIP de um projeto gerado (Bolt manual ou Replit) para a estrutura padrão."""
    if pasta:
        g = Geracao(plataforma, dominio, pasta=pasta)
        anterior = Path(pasta) / "registro.json"
        if anterior.exists():
            g.registro.update({k: v for k, v in json.loads(
                anterior.read_text(encoding="utf-8")).items()
                if k not in ("estado", "erro", "duracao_s")})
    else:
        g = Geracao(plataforma, dominio)
    g.registro["origem_zip"] = str(caminho_zip)
    g.registro["observacao"] = observacao
    copia = g.pasta / "projeto.zip"
    copia.write_bytes(Path(caminho_zip).read_bytes())
    gravados, recusados = _extrair_zip(copia, g.pasta / "projeto")
    g.registro["arquivos_recusados"] = recusados
    g.evento("importacao_zip", arquivo=str(caminho_zip), n_arquivos=len(gravados))
    return g.finalizar("gerada")


# ---------------------------------------------------------------------------
# Pontos de entrada
# ---------------------------------------------------------------------------

def gerar_lovable(dominio, ativar_banco=True):
    return asyncio.run(_lovable_gerar(dominio, ativar_banco))


def gerar_replit(dominio):
    return asyncio.run(_replit_gerar(dominio))


def explorar(plataforma):
    return asyncio.run(explorar_mcp(plataforma))


def main():
    p = argparse.ArgumentParser(description="Piloto do grupo low-code")
    sub = p.add_subparsers(dest="acao", required=True)
    e = sub.add_parser("explorar", help="lista as ferramentas MCP (sem custo)")
    e.add_argument("plataforma", choices=["lovable", "replit"])
    g = sub.add_parser("gerar")
    g.add_argument("plataforma", choices=["lovable", "v0", "replit"])
    g.add_argument("dominio", choices=list(DOMINIOS))
    g.add_argument("--sem-banco", action="store_true",
                   help="Lovable: não ativar o Lovable Cloud se o agente não ativar")
    i = sub.add_parser("importar")
    i.add_argument("plataforma", choices=["bolt", "replit"])
    i.add_argument("dominio", choices=list(DOMINIOS))
    i.add_argument("zip")
    i.add_argument("--pasta", help="pasta de uma geração já registrada (Replit)")
    i.add_argument("--obs", default="", help="observação livre sobre a geração manual")
    r = sub.add_parser("resumir")
    r.add_argument("projeto")
    a = p.parse_args()

    if a.acao == "explorar":
        explorar(a.plataforma)
    elif a.acao == "gerar" and a.plataforma == "lovable":
        gerar_lovable(a.dominio, ativar_banco=not a.sem_banco)
    elif a.acao == "gerar" and a.plataforma == "v0":
        gerar_v0(a.dominio)
    elif a.acao == "gerar":
        gerar_replit(a.dominio)
    elif a.acao == "importar":
        importar_zip(a.plataforma, a.dominio, a.zip, a.pasta, a.obs)
    else:
        print(json.dumps(resumir_projeto(a.projeto), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
