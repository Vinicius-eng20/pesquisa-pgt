"""
Importação e registro das aplicações do grupo low-code (TCC).

As aplicações são geradas à mão na interface de cada plataforma, seguindo o
protocolo-lowcode.md (versão PROTOCOLO_VERSAO). Este script não fala com as
plataformas: ele recebe o ZIP exportado, guarda uma cópia íntegra (com SHA-256),
extrai o projeto, coleta a ficha da geração e registra tudo.

A primeira versão deste script, que tentava gerar por MCP/API, foi descartada no
piloto e está preservada em saidas_lowcode_piloto/gerar_lowcode_mcp_api_piloto.py.

Uso (PowerShell, na pasta do projeto):
    python gerar_lowcode.py situacao
    python gerar_lowcode.py importar bolt restaurante_pedidos C:\\Downloads\\project.zip
    python gerar_lowcode.py importar replit restaurante_pedidos --sem-zip
    python gerar_lowcode.py reparo saidas_lowcode\\bolt\\restaurante_pedidos\\<data-hora> C:\\Downloads\\project.zip --erro-arquivo erro.txt
    python gerar_lowcode.py resumir saidas_lowcode\\bolt\\restaurante_pedidos\\<data-hora>\\projeto

Saídas em saidas_lowcode/<plataforma>/<dominio>/<AAAAMMDD-HHMMSS>/:
    projeto/          código extraído do ZIP (sem node_modules e .git)
    projeto.zip       cópia íntegra do ZIP exportado
    parcial/          código de uma geração não entregue, quando houver ZIP
    registro.json     ficha da geração e metadados
    estrutura.json    resumo automático da arquitetura entregue
    reparo_N/         rodadas de reparo, com a mesma estrutura
e uma linha por geração ou reparo em saidas_lowcode/registro.csv.
"""

import argparse
import csv
import hashlib
import json
import re
import shutil
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from gerar_app import DOMINIOS, MENSAGEM_REPARO, PROMPT_VERSAO

# ---------------------------------------------------------------------------
# Configuração (congelada no protocolo-lowcode.md)
# ---------------------------------------------------------------------------

PROTOCOLO_VERSAO = "1.0"
PASTA_SAIDA = Path("saidas_lowcode")
PLATAFORMAS = ("lovable", "bolt", "replit")

# Ordem dos domínios: sorteio com random.Random(20261020).shuffle sobre a ordem do
# dicionário DOMINIOS. Um domínio por dia, o mesmo nas três plataformas.
SEMENTE_ORDEM = 20261020
ORDEM_DOMINIOS = [
    "restaurante_pedidos", "despesas_pessoais", "cursos_online", "inscricao_eventos",
    "biblioteca_digital", "loja_departamentos", "tarefas_equipe", "agendamento_servicos",
    "reservas_hotel", "marketplace_freelance",
]

MAX_RODADAS_REPARO = 3
MAX_MENSAGENS_APOIO = 5
PASTAS_EXCLUIDAS = {"node_modules", ".git"}

OPCOES_BANCO = {
    "1": "automatico",            # a plataforma criou o banco sem perguntar
    "2": "confirmacao_aceita",    # a plataforma pediu confirmação e ela foi aceita
    "3": "exigiu_servico_externo",  # só oferecia banco com conta em outro serviço
    "4": "nenhum",                # nenhum banco foi criado
}

CAMPOS_CSV = [
    "data_hora_registro_utc", "protocolo_versao", "prompt_versao", "plataforma", "dominio",
    "dia_ordem", "rodada", "conta", "inicio_local", "fim_local", "duracao_min",
    "cota_antes", "cota_depois", "cota_esgotada", "concluida_pela_plataforma", "banco",
    "n_mensagens_apoio", "estado", "n_arquivos", "tem_backend", "tipo_backend",
    "tem_migrations", "esquema_por_orm", "usa_localstorage", "arquivos_env",
    "variaveis_sensiveis_env", "zip_sha256", "n_desvios", "pasta",
]


class ErroRegistro(Exception):
    pass


# ---------------------------------------------------------------------------
# Utilitários
# ---------------------------------------------------------------------------

def _agora_utc():
    return datetime.now(timezone.utc)


def _salvar_json(caminho, dados):
    Path(caminho).write_text(json.dumps(dados, ensure_ascii=False, indent=2, default=str),
                             encoding="utf-8")


def _sha256(caminho):
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def _ler_registros():
    arquivo = PASTA_SAIDA / "registro.csv"
    if not arquivo.exists():
        return []
    with arquivo.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _acrescentar_csv(registro):
    PASTA_SAIDA.mkdir(parents=True, exist_ok=True)
    arquivo = PASTA_SAIDA / "registro.csv"
    novo = not arquivo.exists()
    with arquivo.open("a", newline="", encoding="utf-8") as f:
        escritor = csv.DictWriter(f, fieldnames=CAMPOS_CSV)
        if novo:
            escritor.writeheader()
        linha = {c: registro.get(c, "") for c in CAMPOS_CSV}
        for c in ("arquivos_env", "variaveis_sensiveis_env"):
            if isinstance(linha[c], list):
                linha[c] = "; ".join(linha[c])
        linha["n_desvios"] = len(registro.get("desvios", []))
        escritor.writerow(linha)


def _extrair_zip(caminho_zip, destino):
    """Extrai o ZIP sem node_modules e .git, recusando caminhos que saiam do destino.
    Se tudo estiver dentro de uma única pasta raiz (ex.: 'project/' no Bolt ou
    '<repo>-main/' no GitHub), essa pasta é removida do caminho."""
    destino = Path(destino)
    base = destino.resolve()
    with zipfile.ZipFile(caminho_zip) as z:
        nomes = [n for n in z.namelist() if not n.endswith("/")]
        raizes = {n.split("/", 1)[0] for n in nomes}
        prefixo = (next(iter(raizes)) + "/") if len(raizes) == 1 and all("/" in n for n in nomes) else ""
        gravados, excluidos, recusados = [], 0, []
        for nome in nomes:
            relativo = nome[len(prefixo):]
            if PASTAS_EXCLUIDAS & set(relativo.split("/")[:-1]):
                excluidos += 1
                continue
            alvo = (base / relativo).resolve()
            if alvo == base or base not in alvo.parents:
                recusados.append(nome)
                continue
            alvo.parent.mkdir(parents=True, exist_ok=True)
            alvo.write_bytes(z.read(nome))
            gravados.append(relativo)
    return gravados, excluidos, recusados


# ---------------------------------------------------------------------------
# Ficha da geração (perguntas ao pesquisador)
# ---------------------------------------------------------------------------

def _perguntar(texto, validar=None, opcional=False):
    while True:
        resposta = input(f"{texto}: ").strip()
        if not resposta and opcional:
            return ""
        if not resposta:
            print("  resposta obrigatória.")
            continue
        if validar is None:
            return resposta
        try:
            return validar(resposta)
        except ValueError as e:
            print(f"  {e}")


def _sim_nao(resposta):
    r = resposta.lower()
    if r in ("s", "sim"):
        return True
    if r in ("n", "nao", "não"):
        return False
    raise ValueError("responda s ou n.")


def _data_hora(resposta):
    try:
        return datetime.strptime(resposta, "%Y-%m-%d %H:%M").strftime("%Y-%m-%d %H:%M")
    except ValueError:
        raise ValueError("use o formato AAAA-MM-DD HH:MM (horário local).")


def _inteiro(resposta):
    if not resposta.isdigit():
        raise ValueError("informe um número inteiro.")
    return int(resposta)


def _banco(resposta):
    if resposta not in OPCOES_BANCO:
        raise ValueError(f"escolha uma das opções {list(OPCOES_BANCO)}.")
    return OPCOES_BANCO[resposta]


def _ler_multilinhas(titulo):
    print(f"{titulo} (cole o texto e termine com uma linha contendo só FIM):")
    linhas = []
    for linha in sys.stdin:
        if linha.rstrip("\r\n") == "FIM":
            break
        linhas.append(linha.rstrip("\r\n"))
    return "\n".join(linhas)


def coletar_ficha(reparo=False):
    """Perguntas da ficha (seção 9 do protocolo). Datas em horário local."""
    print("\nFicha da " + ("rodada de reparo" if reparo else "geração") + " (protocolo-lowcode.md)")
    ficha = {
        "conta": _perguntar("Conta usada (identificador anônimo, ex.: bolt-1)"),
        "inicio_local": _perguntar("Início (AAAA-MM-DD HH:MM)", _data_hora),
        "fim_local": _perguntar("Fim (AAAA-MM-DD HH:MM)", _data_hora),
        "cota_antes": _perguntar("Cota antes, como a plataforma mostra"),
        "cota_depois": _perguntar("Cota depois, como a plataforma mostra"),
        "cota_esgotada": _perguntar("A cota acabou durante a execução? (s/n)", _sim_nao),
        "concluida_pela_plataforma": _perguntar(
            "A plataforma declarou o trabalho concluído, sem pendências? (s/n)", _sim_nao),
    }
    if not reparo:
        print("Banco de dados: 1 = criado automaticamente; 2 = pediu confirmação e foi aceita; "
              "3 = só oferecia serviço externo; 4 = nenhum")
        ficha["banco"] = _perguntar("Opção", _banco)
    n = _perguntar(f"Quantas mensagens de apoio foram enviadas? (máximo {MAX_MENSAGENS_APOIO})",
                   _inteiro)
    ficha["n_mensagens_apoio"] = n
    ficha["mensagens_apoio"] = [
        _perguntar(f"  Mensagem {i + 1}: situação e texto enviado (ex.: pergunta -> opção recomendada)")
        for i in range(n)]
    ficha["registro_conversa"] = _perguntar(
        "Gravação de tela ou histórico exportado (nome do arquivo)")
    ficha["observacoes"] = _perguntar("Observações (Enter para nenhuma)", opcional=True)
    return ficha


def _validar_ficha(ficha, reparo=False):
    obrigatorios = ["conta", "inicio_local", "fim_local", "cota_antes", "cota_depois",
                    "cota_esgotada", "concluida_pela_plataforma", "n_mensagens_apoio",
                    "registro_conversa"] + ([] if reparo else ["banco"])
    faltando = [c for c in obrigatorios if ficha.get(c) in (None, "")]
    if faltando:
        raise ErroRegistro(f"Ficha incompleta: {faltando}")
    inicio = datetime.strptime(ficha["inicio_local"], "%Y-%m-%d %H:%M")
    fim = datetime.strptime(ficha["fim_local"], "%Y-%m-%d %H:%M")
    if fim < inicio:
        raise ErroRegistro("O fim é anterior ao início.")
    ficha["duracao_min"] = int((fim - inicio).total_seconds() // 60)
    return ficha


# ---------------------------------------------------------------------------
# Resumo automático da arquitetura entregue
# ---------------------------------------------------------------------------

EXTENSOES_TEXTO = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json", ".sql", ".prisma",
                   ".toml", ".py", ".html", ".vue", ".svelte", ".yaml", ".yml"}
PADROES_SERVIDOR = re.compile(
    r"\bexpress\(\)|\bfastify\(|\.listen\(\s*(port|PORT|\d)|\bcreateServer\(|\bnew Hono\(|"
    r"\bcreateServerFn\(|^\s*['\"]use server['\"]|\bDeno\.serve\(", re.MULTILINE)
PADRAO_ENV_CODIGO = re.compile(
    r"(?:process\.env|import\.meta\.env)(?:\.|\[\s*['\"])([A-Z][A-Z0-9_]+)|Deno\.env\.get\(\s*['\"]([A-Z][A-Z0-9_]+)")
NOMES_SENSIVEIS = re.compile(r"SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|PASSWD|TOKEN|DATABASE_URL")


def _variaveis_env(caminho):
    """Lê um arquivo .env e devolve só os nomes das variáveis e as que parecem segredo.
    Os valores nunca são copiados para o registro."""
    nomes, sensiveis = [], []
    for linha in caminho.read_text(encoding="utf-8", errors="ignore").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        nome, valor = (p.strip() for p in linha.split("=", 1))
        nome = nome.removeprefix("export ").strip()
        valor = valor.strip("'\"")
        nomes.append(nome)
        if valor and (NOMES_SENSIVEIS.search(nome) or valor.startswith("sb_secret_")
                      or '"role":"service_role"' in _payload_jwt(valor)):
            sensiveis.append(nome)
    return nomes, sensiveis


def _payload_jwt(valor):
    import base64
    partes = valor.split(".")
    if len(partes) != 3 or not valor.startswith("eyJ"):
        return ""
    try:
        p = partes[1] + "=" * (-len(partes[1]) % 4)
        return json.dumps(json.loads(base64.urlsafe_b64decode(p)), separators=(",", ":"))
    except (ValueError, UnicodeDecodeError):
        return ""


def resumir_projeto(projeto):
    """Classificação heurística da arquitetura (mesmo espírito do fase-piloto.md).
    Serve para triagem; casos limítrofes exigem conferência manual."""
    projeto = Path(projeto)
    arquivos = [p for p in projeto.rglob("*") if p.is_file()
                and not (PASTAS_EXCLUIDAS | {"dist", ".next", "build"}) & set(p.relative_to(projeto).parts)]
    rel = [p.relative_to(projeto).as_posix() for p in arquivos]

    migrations = [r for r in rel if r.endswith(".sql") and re.search(r"(^|/)(migrations?|scripts|db|sql)/", r)]
    funcoes_edge = sorted({r.split("/")[2] for r in rel
                           if r.startswith("supabase/functions/") and r.count("/") >= 3})
    rotas_api = [r for r in rel if re.search(r"(^|/)app/api/.+/route\.[jt]sx?$", r)
                 or re.search(r"(^|/)pages/api/.+\.[jt]sx?$", r)]
    esquema_orm = [r for r in rel if r.endswith("schema.prisma") or re.search(r"drizzle\.config\.[jt]s$", r)]
    servidor, local_storage, supabase_client = [], [], []
    variaveis_codigo, dependencias = set(), {}
    arquivos_env, sensiveis_env = {}, set()

    for p, r in zip(arquivos, rel):
        if p.name.startswith(".env"):
            nomes, sens = _variaveis_env(p)
            arquivos_env[r] = nomes
            sensiveis_env.update(f"{r}:{n}" for n in sens)
            continue
        if p.suffix.lower() not in EXTENSOES_TEXTO:
            continue
        try:
            texto = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        if PADROES_SERVIDOR.search(texto) and not r.startswith("supabase/functions/"):
            servidor.append(r)
        if "localStorage" in texto:
            local_storage.append(r)
        if "createClient" in texto and "supabase" in texto.lower():
            supabase_client.append(r)
        for a, b in PADRAO_ENV_CODIGO.findall(texto):
            variaveis_codigo.add(a or b)
        if p.name == "package.json":
            try:
                pkg = json.loads(texto)
                dependencias[r] = sorted({**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})})
            except ValueError:
                dependencias[r] = "package.json inválido"

    deps = {d for v in dependencias.values() if isinstance(v, list) for d in v}
    deps_banco = sorted(d for d in deps if re.search(
        r"supabase|@neondatabase|^pg$|postgres|prisma|drizzle|sqlite|mysql|mongo|@upstash|redis", d))

    tipo = []
    if supabase_client:
        tipo.append("supabase")
    if servidor or rotas_api:
        tipo.append("servidor_proprio")
    if funcoes_edge:
        tipo.append("funcoes_edge")

    return {
        "n_arquivos": len(rel),
        "tem_backend": bool(tipo),
        "tipo_backend": "+".join(tipo) or "nenhum",
        "tem_migrations": bool(migrations),
        "esquema_por_orm": bool(esquema_orm),
        "usa_localstorage": bool(local_storage),
        "migrations": migrations,
        "esquema_orm": esquema_orm,
        "funcoes_edge_supabase": funcoes_edge,
        "rotas_api": rotas_api,
        "arquivos_servidor": servidor,
        "clientes_supabase": supabase_client,
        "arquivos_localstorage": local_storage,
        "dependencias_banco": deps_banco,
        "variaveis_no_codigo": sorted(variaveis_codigo),
        "arquivos_env": arquivos_env,
        "variaveis_sensiveis_env": sorted(sensiveis_env),
        "package_json": list(dependencias),
    }


# ---------------------------------------------------------------------------
# Ordem dos domínios e situação
# ---------------------------------------------------------------------------

def _geracoes_registradas(plataforma):
    return [r for r in _ler_registros()
            if r["plataforma"] == plataforma and r["rodada"] == "0"]


def proximo_dominio(plataforma):
    feitos = {r["dominio"] for r in _geracoes_registradas(plataforma)}
    return next((d for d in ORDEM_DOMINIOS if d not in feitos), None)


def situacao():
    registros = _ler_registros()
    print(f"Protocolo {PROTOCOLO_VERSAO} | ordem (semente {SEMENTE_ORDEM}):")
    for i, d in enumerate(ORDEM_DOMINIOS, 1):
        celulas = []
        for p in PLATAFORMAS:
            g = [r for r in registros if r["plataforma"] == p and r["dominio"] == d and r["rodada"] == "0"]
            reparos = [r for r in registros if r["plataforma"] == p and r["dominio"] == d and r["rodada"] != "0"]
            estado = g[-1]["estado"] if g else "-"
            if reparos:
                estado += f" (+{len(reparos)} reparo)"
            celulas.append(f"{p}: {estado}")
        print(f"  dia {i:2d}  {d:22s}  " + " | ".join(celulas))
    for p in PLATAFORMAS:
        print(f"Próximo domínio em {p}: {proximo_dominio(p) or 'todos registrados'}")


# ---------------------------------------------------------------------------
# Importação
# ---------------------------------------------------------------------------

def _confirmar(texto, resposta_padrao=None):
    if resposta_padrao is not None:
        return resposta_padrao
    return _perguntar(f"{texto} (s/n)", _sim_nao)


def _guardar_codigo(caminho_zip, pasta, subpasta):
    copia = pasta / "projeto.zip"
    shutil.copyfile(caminho_zip, copia)
    gravados, excluidos, recusados = _extrair_zip(copia, pasta / subpasta)
    estrutura = resumir_projeto(pasta / subpasta)
    _salvar_json(pasta / "estrutura.json", estrutura)
    return {
        "zip_origem": str(caminho_zip),
        "zip_sha256": _sha256(copia),
        "n_arquivos": len(gravados),
        "n_excluidos_dependencias": excluidos,
        "caminhos_recusados": recusados,
        **{k: estrutura[k] for k in ("tem_backend", "tipo_backend", "tem_migrations",
                                     "esquema_por_orm", "usa_localstorage")},
        "arquivos_env": list(estrutura["arquivos_env"]),
        "variaveis_sensiveis_env": estrutura["variaveis_sensiveis_env"],
    }


def importar(plataforma, dominio, caminho_zip=None, ficha=None, motivo_sem_zip="",
             forcar=False, aceitar_desvio=None):
    """Registra uma geração (rodada 0). ficha=None faz as perguntas no terminal."""
    if plataforma not in PLATAFORMAS:
        raise ErroRegistro(f"Plataforma '{plataforma}' fora do protocolo: {PLATAFORMAS}")
    if dominio not in DOMINIOS:
        raise ErroRegistro(f"Domínio '{dominio}' não existe: {list(DOMINIOS)}")
    if caminho_zip and not zipfile.is_zipfile(caminho_zip):
        raise ErroRegistro(f"'{caminho_zip}' não é um ZIP válido.")

    desvios = []
    if any(r["dominio"] == dominio for r in _geracoes_registradas(plataforma)):
        if not forcar:
            raise ErroRegistro(f"Já existe geração de '{dominio}' em {plataforma}. Use --forcar "
                               "apenas para um desvio justificado.")
        desvios.append("geracao_repetida")
    esperado = proximo_dominio(plataforma)
    if esperado and dominio != esperado and "geracao_repetida" not in desvios:
        print(f"AVISO: pela ordem do protocolo, o próximo domínio em {plataforma} é '{esperado}'.")
        if not _confirmar("Registrar fora de ordem como desvio?", aceitar_desvio):
            raise ErroRegistro("Importação cancelada.")
        desvios.append(f"fora_de_ordem (esperado: {esperado})")

    ficha = _validar_ficha(dict(ficha) if ficha else coletar_ficha())
    if ficha["n_mensagens_apoio"] > MAX_MENSAGENS_APOIO:
        desvios.append(f"mensagens_apoio_acima_do_limite ({ficha['n_mensagens_apoio']})")

    agora = _agora_utc()
    pasta = PASTA_SAIDA / plataforma / dominio / agora.strftime("%Y%m%d-%H%M%S")
    pasta.mkdir(parents=True)

    if ficha["cota_esgotada"]:
        estado = "nao_entregue"
        motivo = "cota_esgotada_durante_a_geracao"
    elif not caminho_zip:
        estado = "nao_entregue"
        motivo = motivo_sem_zip or _perguntar("Motivo de não haver ZIP")
    else:
        estado, motivo = "gerada", ""

    registro = {
        "data_hora_registro_utc": agora.isoformat(timespec="seconds"),
        "protocolo_versao": PROTOCOLO_VERSAO,
        "prompt_versao": PROMPT_VERSAO,
        "prompt_usuario": DOMINIOS[dominio],
        "plataforma": plataforma,
        "dominio": dominio,
        "dia_ordem": ORDEM_DOMINIOS.index(dominio) + 1,
        "rodada": 0,
        **ficha,
        "estado": estado,
        "motivo_nao_entregue": motivo,
        "desvios": desvios,
        "pasta": str(pasta),
    }
    if caminho_zip:
        # Geração não entregue com código parcial: guardado à parte, fora do pentest.
        registro.update(_guardar_codigo(caminho_zip, pasta,
                                        "projeto" if estado == "gerada" else "parcial"))

    _salvar_json(pasta / "registro.json", registro)
    _acrescentar_csv(registro)
    _imprimir_resumo(registro)
    return registro


def reparo(pasta_geracao, caminho_zip=None, erro="", ficha=None):
    """Registra uma rodada de reparo feita na plataforma com a mensagem fixa."""
    pasta_geracao = Path(pasta_geracao)
    arquivo = pasta_geracao / "registro.json"
    if not arquivo.exists():
        raise ErroRegistro(f"Não há registro.json em '{pasta_geracao}'.")
    original = json.loads(arquivo.read_text(encoding="utf-8"))
    if original.get("rodada") != 0:
        raise ErroRegistro("Indique a pasta da geração original, não a de um reparo.")
    if original.get("estado") != "gerada":
        raise ErroRegistro(f"Estado da geração é '{original.get('estado')}'; reparo não se aplica.")
    n = len(list(pasta_geracao.glob("reparo_*"))) + 1
    if n > MAX_RODADAS_REPARO:
        raise ErroRegistro(f"Limite de {MAX_RODADAS_REPARO} rodadas atingido: registre a "
                           "aplicação como não executável na fase de execução.")
    if not erro.strip():
        raise ErroRegistro("Informe o texto do erro (exatamente o que foi colado na plataforma).")
    if caminho_zip and not zipfile.is_zipfile(caminho_zip):
        raise ErroRegistro(f"'{caminho_zip}' não é um ZIP válido.")

    ficha = _validar_ficha(dict(ficha) if ficha else coletar_ficha(reparo=True), reparo=True)
    desvios = []
    if ficha["n_mensagens_apoio"] > MAX_MENSAGENS_APOIO:
        desvios.append(f"mensagens_apoio_acima_do_limite ({ficha['n_mensagens_apoio']})")

    pasta = pasta_geracao / f"reparo_{n}"
    pasta.mkdir()
    if ficha["cota_esgotada"]:
        estado = "reparo_incompleto"
    elif not caminho_zip:
        estado = "reparo_sem_codigo"
    else:
        estado = "reparo_aplicado"

    registro = {
        "data_hora_registro_utc": _agora_utc().isoformat(timespec="seconds"),
        "protocolo_versao": PROTOCOLO_VERSAO,
        "prompt_versao": original["prompt_versao"],
        "plataforma": original["plataforma"],
        "dominio": original["dominio"],
        "dia_ordem": original["dia_ordem"],
        "rodada": n,
        "mensagem_reparo": MENSAGEM_REPARO.format(erro=erro.strip("\n")),
        **ficha,
        "estado": estado,
        "desvios": desvios,
        "pasta": str(pasta),
        "pasta_geracao": str(pasta_geracao),
    }
    if caminho_zip:
        registro.update(_guardar_codigo(caminho_zip, pasta, "projeto"))
    _salvar_json(pasta / "registro.json", registro)
    _acrescentar_csv(registro)
    _imprimir_resumo(registro)
    return registro


def _imprimir_resumo(r):
    print(f"\nRegistrado: {r['plataforma']} | {r['dominio']} | rodada {r['rodada']} | "
          f"estado {r['estado']} | {r.get('n_arquivos', 0)} arquivos")
    if r.get("n_arquivos"):
        print(f"Backend: {r['tipo_backend']} | migrations: {r['tem_migrations']} | "
              f"esquema por ORM: {r['esquema_por_orm']} | localStorage: {r['usa_localstorage']}")
    if r.get("variaveis_sensiveis_env"):
        print(f"ATENÇÃO (H2): variáveis com aparência de segredo em .env: {r['variaveis_sensiveis_env']}")
    if r.get("caminhos_recusados"):
        print(f"AVISO: caminhos recusados no ZIP: {r['caminhos_recusados']}")
    for d in r.get("desvios", []):
        print(f"DESVIO registrado: {d}")
    print(f"Pasta: {r['pasta']}")


# ---------------------------------------------------------------------------
# Linha de comando
# ---------------------------------------------------------------------------

def main():
    p = argparse.ArgumentParser(description="Importação e registro do grupo low-code")
    sub = p.add_subparsers(dest="acao", required=True)
    sub.add_parser("situacao", help="mostra o andamento e o próximo domínio de cada plataforma")

    i = sub.add_parser("importar", help="registra uma geração")
    i.add_argument("plataforma", choices=PLATAFORMAS)
    i.add_argument("dominio", choices=list(DOMINIOS))
    i.add_argument("zip", nargs="?", help="ZIP exportado da plataforma")
    i.add_argument("--sem-zip", action="store_true", help="geração sem código (não entregue)")
    i.add_argument("--motivo", default="", help="motivo de não haver ZIP")
    i.add_argument("--forcar", action="store_true", help="repetir domínio (registrado como desvio)")

    r = sub.add_parser("reparo", help="registra uma rodada de reparo")
    r.add_argument("pasta_geracao")
    r.add_argument("zip", nargs="?", help="ZIP exportado depois do reparo")
    r.add_argument("--erro-arquivo", help="arquivo .txt com o erro colado na plataforma")

    s = sub.add_parser("resumir", help="mostra a estrutura de um projeto")
    s.add_argument("projeto")
    a = p.parse_args()

    try:
        if a.acao == "situacao":
            situacao()
        elif a.acao == "importar":
            if not a.zip and not a.sem_zip:
                raise ErroRegistro("Informe o ZIP ou use --sem-zip.")
            importar(a.plataforma, a.dominio, a.zip, motivo_sem_zip=a.motivo, forcar=a.forcar)
        elif a.acao == "reparo":
            erro = (Path(a.erro_arquivo).read_text(encoding="utf-8") if a.erro_arquivo
                    else _ler_multilinhas("Erro colado na plataforma"))
            reparo(a.pasta_geracao, a.zip, erro)
        else:
            print(json.dumps(resumir_projeto(a.projeto), ensure_ascii=False, indent=2))
    except ErroRegistro as e:
        print(f"ERRO: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
