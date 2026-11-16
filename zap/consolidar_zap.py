#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Consolida os relatorios JSON do OWASP ZAP (template "traditional-json") do
experimento do TCC em planilhas prontas para a analise estatistica e para a
apresentacao dos resultados.

USO (dentro da pasta pesquisa-pgt):
    python zap/consolidar_zap.py [pasta_relatorios] [opcoes]

    pasta_relatorios      pasta com os <grupo>__<fonte>__<dominio>.json
                          (padrao: relatorios_zap)

OPCOES:
    --excluir-pendentes   desconsidera alertas que exigem validacao manual e
                          ainda nao foram decididos (use na rodada final)
    --confianca-minima N  1=Baixa (padrao), 2=Media, 3=Alta. Alertas abaixo
                          desse nivel so contam se validados como VP
    --excluir-cabecalhos  desconsidera alertas de cabecalhos HTTP de
                          seguranca (criterio pendente no README)
    --csv-padrao          CSV com virgula e ponto decimal. Sem esta opcao, o
                          CSV usa ponto e virgula e virgula decimal (abre
                          direto no Excel em portugues e e o formato que o
                          notebook de analise espera por padrao)

ARQUIVOS GERADOS em <pasta_relatorios>/consolidado/:
    achados.csv            um alerta por aplicacao (dado mestre), com
                           categoria OWASP, validacao e se entra na analise
    presenca_owasp.csv     aplicacao x A01..A10 em 0/1: base para odds ratio,
                           Mantel-Haenszel e Fisher
    matriz_owasp.csv       aplicacao x A01..A10 com a contagem de alertas
    resumo_apps.csv        por aplicacao: contagem por risco, cobertura da
                           varredura (endpoints, % de respostas 5xx) e as
                           aplicacoes previstas que ainda nao tem relatorio
    resumo_fontes.csv      por modelo/plataforma e por grupo: media, mediana,
                           desvio padrao, % de apps com achado alto e
                           prevalencia por categoria OWASP
    alertas_frequentes.csv tipos de alerta mais frequentes (n e % de apps)
    testes_hipoteses.csv   previa dos testes vibe coding x low-code por
                           desfecho: prevalencias com IC 95% (Wilson), odds
                           ratio bruto (IC 95%), p do teste exato de Fisher,
                           odds ratio de Mantel-Haenszel estratificado por
                           dominio (IC 95% de Robins-Breslow-Greenland) e p
                           do teste de Cochran-Mantel-Haenszel (correcao de
                           continuidade so quando |O-E| >= 0,5). A analise
                           oficial do capitulo 4 e feita no notebook
                           analise/analise_estatistica.ipynb, que le
                           achados.csv e resumo_apps.csv e usa os mesmos
                           metodos.
    nao_mapeados.csv       CWEs fora das listas oficiais do OWASP 2025

ARQUIVO MANTIDO PELO AUTOR em <pasta_relatorios>/validacao.csv:
    O script acrescenta a esse arquivo os alertas que exigem validacao manual
    (risco Alto, ou risco Medio com confianca Baixa), com URI, parametro,
    ataque e evidencia de exemplo. Preencha a coluna "decisao" com VP
    (verdadeiro positivo) ou FP (falso positivo) e, se quiser, a
    "justificativa". Decisoes ja preenchidas nunca sao apagadas. Qualquer
    outro alerta pode ser incluido a mao, preenchendo a coluna "chave" no
    formato <app>|<alertRef>. A correspondencia usa a "chave", porque o Excel
    pode converter alertRefs como "6-5" em data na coluna "alertRef". O
    arquivo pode ser salvo pelo Excel em UTF-8 ou ANSI, com ";" ou ",".

REGRAS DE CONTAGEM:
    - Somente hosts locais (localhost, 127.0.0.1, ::1) entram; dominios
      externos que aparecem no relatorio sao descartados.
    - A unidade de analise e a aplicacao. Cada tipo de alerta (alertRef)
      conta uma vez por aplicacao, independentemente do numero de instancias.
    - Alertas informativos (risco 0) e alertas marcados como falso positivo
      no proprio ZAP (confianca 0) nao entram nas contagens.
    - FP na validacao exclui o alerta; VP o inclui mesmo com confianca baixa.
    - Odds ratio: exposicao = vibe coding, referencia = low-code. OR > 1
      indica maior chance de achado nas aplicacoes de vibe coding. Quando ha
      celula zero, aplica-se a correcao de Haldane-Anscombe (+0,5) ao OR
      bruto e ao seu IC (coluna "obs").
    - A classificacao OWASP usa as listas oficiais de CWEs do OWASP Top 10:2025
      (abaixo). CWEs fora delas vao para nao_mapeados.csv e nao sao
      classificados automaticamente.
    - A hipotese H2 (segredos no codigo) nao e medida pelo ZAP.
"""

import argparse
import csv
import glob
import json
import math
import os
import statistics
import sys
from collections import Counter, defaultdict

# ---------------------------------------------------------------------------
# OWASP Top 10:2025 - listas oficiais de CWEs mapeados ("List of Mapped CWEs")
# Fonte: https://top10.owasp.org/2025/ (paginas A01 a A10), consultadas em
# 12/11/2026. A pagina A03 cita a CWE-477 no texto, mas a lista oficial traz
# a CWE-447; mantida aqui a lista oficial.
# ---------------------------------------------------------------------------
OWASP_2025_NOMES = {
    "A01": "Broken Access Control",
    "A02": "Security Misconfiguration",
    "A03": "Software Supply Chain Failures",
    "A04": "Cryptographic Failures",
    "A05": "Injection",
    "A06": "Insecure Design",
    "A07": "Authentication Failures",
    "A08": "Software or Data Integrity Failures",
    "A09": "Security Logging and Alerting Failures",
    "A10": "Mishandling of Exceptional Conditions",
}
OWASP_2025_CWES = {
    "A01": [22, 23, 36, 59, 61, 65, 200, 201, 219, 276, 281, 282, 283, 284, 285,
            352, 359, 377, 379, 402, 424, 425, 441, 497, 538, 540, 548, 552, 566,
            601, 615, 639, 668, 732, 749, 862, 863, 918, 922, 1275],
    "A02": [5, 11, 13, 15, 16, 260, 315, 489, 526, 547, 611, 614, 776, 942, 1004,
            1174],
    "A03": [447, 1035, 1104, 1329, 1357, 1395],
    "A04": [261, 296, 319, 320, 321, 322, 323, 324, 325, 326, 327, 328, 329, 330,
            331, 332, 334, 335, 336, 337, 338, 340, 342, 347, 523, 757, 759, 760,
            780, 916, 1240, 1241],
    "A05": [20, 74, 76, 77, 78, 79, 80, 83, 86, 88, 89, 90, 91, 93, 94, 95, 96, 97,
            98, 99, 103, 104, 112, 113, 114, 115, 116, 129, 159, 470, 493, 500,
            564, 610, 643, 644, 917],
    "A06": [73, 183, 256, 266, 269, 286, 311, 312, 313, 316, 362, 382, 419, 434,
            436, 444, 451, 454, 472, 501, 522, 525, 539, 598, 602, 628, 642, 646,
            653, 656, 657, 676, 693, 799, 807, 841, 1021, 1022, 1125],
    "A07": [258, 259, 287, 288, 289, 290, 291, 293, 294, 295, 297, 298, 299, 300,
            302, 303, 304, 305, 306, 307, 308, 309, 346, 350, 384, 521, 613, 620,
            640, 798, 940, 941, 1390, 1391, 1392, 1393],
    "A08": [345, 353, 426, 427, 494, 502, 506, 509, 565, 784, 829, 830, 915, 926],
    "A09": [117, 221, 223, 532, 778],
    "A10": [209, 215, 234, 235, 248, 252, 274, 280, 369, 390, 391, 394, 396, 397,
            460, 476, 478, 484, 550, 636, 703, 754, 755, 756],
}
CATEGORIAS = list(OWASP_2025_NOMES)
CWE_OWASP = {}
for _cat, _lista in OWASP_2025_CWES.items():
    for _cwe in _lista:
        CWE_OWASP.setdefault(_cwe, _cat)

# Desenho experimental (README): fontes e dominios previstos.
FONTES_PREVISTAS = {
    "vibe": ["claude_sonnet", "deepseek", "gemini_flash", "gpt5", "kimi", "qwen"],
    "lowcode": ["bolt", "lovable"],
}
DOMINIOS = ["agendamento_servicos", "biblioteca_digital", "cursos_online",
            "despesas_pessoais", "inscricao_eventos", "loja_departamentos",
            "marketplace_freelance", "reservas_hotel", "restaurante_pedidos",
            "tarefas_equipe"]
# Apelidos usados nos nomes dos relatorios -> chave do README.
ALIAS_FONTE = {"claude": "claude_sonnet", "sonnet": "claude_sonnet",
               "gemini": "gemini_flash", "gpt-5": "gpt5", "gpt_5": "gpt5"}
GRUPO_EXPOSTO, GRUPO_REFERENCIA = "vibe", "lowcode"
GRUPO_CORRIGIDO = []   # arquivos cujo prefixo de grupo nao batia com a fonte

# Regras do ZAP sobre cabecalhos HTTP de seguranca e sobre cookies.
REGRAS_CABECALHO = {"10015", "10020", "10021", "10035", "10036", "10037",
                    "10038", "10055", "10063"}
REGRAS_COOKIE = {"10010", "10011", "10054"}

HOSTS_LOCAIS = {"localhost", "127.0.0.1", "::1", "[::1]"}
RISCO_NOME = {0: "Informativo", 1: "Baixo", 2: "Medio", 3: "Alto"}
CONF_NOME = {0: "Falso positivo", 1: "Baixa", 2: "Media", 3: "Alta", 4: "Confirmada"}
Z95 = 1.959963984540054


# ---------------------------------------------------------------------------
# Utilitarios
# ---------------------------------------------------------------------------
def inteiro(valor, padrao):
    try:
        return int(str(valor).strip())
    except (TypeError, ValueError):
        return padrao


def identidade(caminho):
    base = os.path.splitext(os.path.basename(caminho))[0]
    partes = base.split("__")
    if len(partes) != 3:
        return base, "", "", ""
    grupo, fonte, dominio = partes[0].lower(), partes[1].lower(), partes[2].lower()
    fonte = ALIAS_FONTE.get(fonte, fonte)
    # O grupo vem da fonte (bolt/lovable = lowcode; modelos = vibe), e nao do
    # prefixo do arquivo: um "vibe__bolt__x" (APP: esquecido no plano do ZAP)
    # seria contado no grupo errado e invalidaria a H1.
    for g, fontes in FONTES_PREVISTAS.items():
        if fonte in fontes and grupo != g:
            GRUPO_CORRIGIDO.append(f"{base} -> {g}__{fonte}__{dominio}")
            grupo = g
    return "__".join((grupo, fonte, dominio)), grupo, fonte, dominio


class Saida:
    """Escreve CSV no formato escolhido (csv2 do Excel pt-BR ou padrao)."""

    def __init__(self, pasta, padrao):
        self.pasta = pasta
        self.delim = "," if padrao else ";"
        self.decimal = "." if padrao else ","

    def num(self, x, casas=2):
        if x is None:
            return "NA"
        if isinstance(x, float):
            if math.isinf(x):
                return "Inf"
            if math.isnan(x):
                return "NA"
            return f"{x:.{casas}f}".replace(".", self.decimal)
        return x

    def escrever(self, nome, cabecalho, linhas):
        caminho = os.path.join(self.pasta, nome)
        with open(caminho, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f, delimiter=self.delim)
            w.writerow(cabecalho)
            for linha in linhas:
                w.writerow(linha)


# ---------------------------------------------------------------------------
# Estatistica (biblioteca padrao)
# ---------------------------------------------------------------------------
def wilson(x, n):
    if n == 0:
        return None, None
    p = x / n
    den = 1 + Z95 ** 2 / n
    centro = (p + Z95 ** 2 / (2 * n)) / den
    meia = Z95 * math.sqrt(p * (1 - p) / n + Z95 ** 2 / (4 * n * n)) / den
    return max(0.0, centro - meia), min(1.0, centro + meia)


def odds_ratio(a, b, c, d):
    """OR bruto (a*d)/(b*c) com IC 95% de Woolf; Haldane-Anscombe se ha zero."""
    obs = ""
    if 0 in (a, b, c, d):
        a, b, c, d = a + .5, b + .5, c + .5, d + .5
        obs = "correcao +0,5"
    orr = (a * d) / (b * c)
    ep = math.sqrt(1 / a + 1 / b + 1 / c + 1 / d)
    return orr, math.exp(math.log(orr) - Z95 * ep), math.exp(math.log(orr) + Z95 * ep), obs


def fisher_bilateral(a, b, c, d):
    """Teste exato de Fisher, bilateral (soma das tabelas com P <= P observada)."""
    l1, l2, c1 = a + b, c + d, a + c
    n = l1 + l2
    total = math.comb(n, c1)

    def prob(x):
        return math.comb(l1, x) * math.comb(l2, c1 - x) / total

    p_obs = prob(a)
    p = sum(prob(x) for x in range(max(0, c1 - l2), min(l1, c1) + 1)
            if prob(x) <= p_obs * (1 + 1e-7))
    return min(1.0, p)


def mantel_haenszel(estratos):
    """estratos: lista de (a, b, c, d). Retorna OR_MH, IC95 (RBG), p CMH, n."""
    validos = [(a, b, c, d) for a, b, c, d in estratos
               if (a + b) > 0 and (c + d) > 0]
    if not validos:
        return None, None, None, None, 0
    R = S = PR = PS_QR = QS = 0.0
    soma_a = soma_e = soma_v = 0.0
    for a, b, c, d in validos:
        n = a + b + c + d
        r, s = a * d / n, b * c / n
        p, q = (a + d) / n, (b + c) / n
        R += r
        S += s
        PR += p * r
        PS_QR += p * s + q * r
        QS += q * s
        if n > 1:
            soma_a += a
            soma_e += (a + b) * (a + c) / n
            soma_v += (a + b) * (c + d) * (a + c) * (b + d) / (n * n * (n - 1))
    if S == 0 and R == 0:
        orr = ic_inf = ic_sup = None
    elif S == 0:
        orr, ic_inf, ic_sup = math.inf, None, None
    elif R == 0:
        orr, ic_inf, ic_sup = 0.0, None, None
    else:
        orr = R / S
        var = PR / (2 * R * R) + PS_QR / (2 * R * S) + QS / (2 * S * S)
        ic_inf = math.exp(math.log(orr) - Z95 * math.sqrt(var))
        ic_sup = math.exp(math.log(orr) + Z95 * math.sqrt(var))
    p = None
    if soma_v > 0:
        delta = abs(soma_a - soma_e)
        yates = 0.5 if delta >= 0.5 else 0.0  # correcao so quando |O-E| >= 0,5
        x2 = (delta - yates) ** 2 / soma_v
        p = math.erfc(math.sqrt(x2 / 2))
    return orr, ic_inf, ic_sup, p, len(validos)


# ---------------------------------------------------------------------------
# Leitura dos relatorios
# ---------------------------------------------------------------------------
def ler_relatorio(caminho):
    with open(caminho, encoding="utf-8") as f:
        dados = json.load(f)
    meta = {"versao_zap": dados.get("@version", ""),
            "gerado": dados.get("@generated", ""),
            "endpoints": None, "pct_5xx": None, "hosts_externos": set()}

    melhor = -1
    for ins in dados.get("insights", []):
        site = ins.get("site", "")
        host = site.split("://")[-1].split(":")[0].split("/")[0]
        if host not in HOSTS_LOCAIS:
            continue
        if ins.get("key") == "insight.endpoint.total":
            n = inteiro(ins.get("statistic"), 0)
            if n > melhor:
                melhor = n
                meta["endpoints"] = n
                meta["_site_principal"] = site
    for ins in dados.get("insights", []):
        if (ins.get("site") == meta.get("_site_principal")
                and ins.get("key") == "insight.code.5xx"):
            meta["pct_5xx"] = inteiro(ins.get("statistic"), None)
    if meta["endpoints"] is not None and meta["pct_5xx"] is None:
        meta["pct_5xx"] = 0

    alertas = {}
    for site in dados.get("site", []):
        host = site.get("@host", "")
        if host not in HOSTS_LOCAIS:
            meta["hosts_externos"].add(host)
            continue
        for al in site.get("alerts", []):
            ref = al.get("alertRef") or al.get("pluginid", "")
            instancias = al.get("instances") or []
            novo = {
                "pluginid": str(al.get("pluginid", "")),
                "nome": al.get("name", ""),
                "risco": inteiro(al.get("riskcode"), 0),
                "conf": inteiro(al.get("confidence"), 2),
                "cwe": inteiro(al.get("cweid"), -1),
                "n_inst": inteiro(al.get("count"), len(instancias)),
                "instancias": instancias,
            }
            if ref in alertas:  # mesmo alerta em mais de uma porta local
                atual = alertas[ref]
                atual["n_inst"] += novo["n_inst"]
                atual["instancias"] += novo["instancias"]
                if (novo["risco"], novo["conf"]) > (atual["risco"], atual["conf"]):
                    atual["risco"], atual["conf"] = novo["risco"], novo["conf"]
            else:
                alertas[ref] = novo
    return meta, alertas


def exige_validacao(risco, conf):
    return risco == 3 or (risco == 2 and conf == 1)


def chave_validacao(app, ref):
    # A coluna "chave" evita que o Excel converta alertRef como "6-5" em data.
    return f"{app}|{ref}"


def ler_validacao(caminho):
    decisoes, linhas = {}, []
    if not os.path.exists(caminho):
        return decisoes, linhas
    texto = None
    for codificacao in ("utf-8-sig", "cp1252"):  # o Excel pode salvar em ANSI
        try:
            with open(caminho, encoding=codificacao, newline="") as f:
                texto = f.read()
            break
        except UnicodeDecodeError:
            continue
    if texto is None:
        sys.exit("Nao foi possivel ler " + caminho + " (codificacao desconhecida).")
    try:
        dialeto = csv.Sniffer().sniff(texto[:4096], delimiters=";,")
    except csv.Error:
        dialeto = csv.excel
    for linha in csv.DictReader(texto.splitlines(), dialect=dialeto):
        linhas.append(linha)
        chave = (linha.get("chave") or "").strip()
        if "|" in chave:
            app, ref = chave.split("|", 1)
        else:
            app = (linha.get("app") or "").strip()
            ref = (linha.get("alertRef") or "").strip()
        dec = (linha.get("decisao") or "").strip().upper()
        dec = {"VERDADEIRO": "VP", "FALSO": "FP"}.get(dec, dec)
        if app and ref:
            decisoes[(app.strip(), ref.strip())] = (
                dec if dec in ("VP", "FP") else "",
                (linha.get("justificativa") or "").strip())
    return decisoes, linhas


def atualizar_validacao(caminho, novas, linhas_existentes, saida):
    """Acrescenta itens novos ao validacao.csv sem alterar o que ja existe."""
    if not novas:
        return 0
    cab = ["chave", "app", "alertRef", "alerta", "risco", "confianca", "cwe", "owasp_2025",
           "n_instancias", "exemplo_metodo", "exemplo_uri", "exemplo_param",
           "exemplo_ataque", "exemplo_evidencia", "decisao", "justificativa"]
    try:
        with open(caminho, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=cab, delimiter=saida.delim,
                               extrasaction="ignore")
            w.writeheader()
            for linha in linhas_existentes:
                registro = {k: (linha.get(k) or "") for k in cab}
                if not registro["chave"] and registro["app"] and registro["alertRef"]:
                    registro["chave"] = chave_validacao(registro["app"], registro["alertRef"])
                w.writerow(registro)
            for linha in novas:
                w.writerow(linha)
    except PermissionError:
        print("AVISO: nao foi possivel atualizar", caminho,
              "(arquivo aberto em outro programa?). Feche-o e rode de novo.")
        return 0
    return len(novas)


# ---------------------------------------------------------------------------
# Principal
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Consolida relatorios JSON do ZAP.")
    ap.add_argument("pasta", nargs="?", default="relatorios_zap")
    ap.add_argument("--excluir-pendentes", action="store_true")
    ap.add_argument("--confianca-minima", type=int, choices=[1, 2, 3], default=1)
    ap.add_argument("--excluir-cabecalhos", action="store_true")
    ap.add_argument("--csv-padrao", action="store_true")
    args = ap.parse_args()

    if not os.path.isdir(args.pasta):
        sys.exit("Pasta nao encontrada: " + args.pasta)
    arquivos = sorted(glob.glob(os.path.join(args.pasta, "*.json")))
    if not arquivos:
        sys.exit("Nenhum .json em " + args.pasta)

    pasta_saida = os.path.join(args.pasta, "consolidado")
    os.makedirs(pasta_saida, exist_ok=True)
    saida = Saida(pasta_saida, args.csv_padrao)
    caminho_validacao = os.path.join(args.pasta, "validacao.csv")
    decisoes, linhas_validacao = ler_validacao(caminho_validacao)

    apps = {}            # app -> {grupo, fonte, dominio, meta}
    achados = []         # um registro por app x alertRef
    nomes_por_ref = defaultdict(Counter)
    novas_validacoes = []
    nao_mapeados = defaultdict(lambda: {"alerta": "", "apps": set()})
    fora_padrao = []

    for arq in arquivos:
        app, grupo, fonte, dominio = identidade(arq)
        if not grupo:
            fora_padrao.append(os.path.basename(arq))
        try:
            meta, alertas = ler_relatorio(arq)
        except (OSError, ValueError) as e:
            print("ERRO ao ler", arq, "->", e)
            continue
        if app in apps:
            print("AVISO: relatorio duplicado para", app, "- usando", os.path.basename(arq))
            achados = [a for a in achados if a["app"] != app]
        apps[app] = {"grupo": grupo, "fonte": fonte, "dominio": dominio, "meta": meta}

        for ref, al in alertas.items():
            nomes_por_ref[ref][al["nome"]] += 1
            cwe = al["cwe"] if al["cwe"] > 0 else None
            cat = CWE_OWASP.get(cwe, "") if cwe else ""
            if cwe and not cat and al["risco"] > 0:
                nao_mapeados[cwe]["alerta"] = al["nome"]
                nao_mapeados[cwe]["apps"].add(app)
            if al["pluginid"] in REGRAS_CABECALHO:
                tipo = "cabecalho"
            elif al["pluginid"] in REGRAS_COOKIE:
                tipo = "cookie"
            else:
                tipo = "outro"

            decisao, justif = decisoes.get((app, ref), ("", ""))
            if decisao:
                validacao = decisao
            elif exige_validacao(al["risco"], al["conf"]):
                validacao = "pendente"
                if (app, ref) not in decisoes:
                    ex = al["instancias"][0] if al["instancias"] else {}
                    novas_validacoes.append({
                        "chave": chave_validacao(app, ref),
                        "app": app, "alertRef": ref, "alerta": al["nome"],
                        "risco": RISCO_NOME.get(al["risco"], al["risco"]),
                        "confianca": CONF_NOME.get(al["conf"], al["conf"]),
                        "cwe": cwe or "", "owasp_2025": cat,
                        "n_instancias": al["n_inst"],
                        "exemplo_metodo": ex.get("method", ""),
                        "exemplo_uri": ex.get("uri", ""),
                        "exemplo_param": ex.get("param", ""),
                        "exemplo_ataque": (ex.get("attack") or "")[:200],
                        "exemplo_evidencia": (ex.get("evidence") or "")[:200],
                        "decisao": "", "justificativa": ""})
            else:
                validacao = "nao_requerida"

            if al["risco"] == 0:
                incluido, motivo = False, "informativo"
            elif al["conf"] == 0:
                incluido, motivo = False, "falso positivo no ZAP"
            elif validacao == "FP":
                incluido, motivo = False, "falso positivo (validacao)"
            elif validacao == "VP":
                incluido, motivo = True, ""
            elif args.excluir_pendentes and validacao == "pendente":
                incluido, motivo = False, "validacao pendente"
            elif al["conf"] < args.confianca_minima:
                incluido, motivo = False, "confianca abaixo do minimo"
            elif args.excluir_cabecalhos and tipo == "cabecalho":
                incluido, motivo = False, "cabecalho excluido"
            else:
                incluido, motivo = True, ""

            achados.append({
                "app": app, "grupo": grupo, "fonte": fonte, "dominio": dominio,
                "ref": ref, "pluginid": al["pluginid"], "risco": al["risco"],
                "conf": al["conf"], "cwe": cwe, "cat": cat, "tipo": tipo,
                "n_inst": al["n_inst"], "validacao": validacao, "justif": justif,
                "incluido": incluido, "motivo": motivo})

    def nome_ref(ref):
        return nomes_por_ref[ref].most_common(1)[0][0] if nomes_por_ref[ref] else ref

    # ----- agregados por aplicacao (somente achados incluidos) -----
    por_app = defaultdict(lambda: {"risco": Counter(), "cat": Counter(), "total": 0})
    for a in achados:
        if a["incluido"]:
            r = por_app[a["app"]]
            r["risco"][a["risco"]] += 1
            r["total"] += 1
            if a["cat"]:
                r["cat"][a["cat"]] += 1

    def desfechos(app):
        r = por_app[app]
        d = {c: int(r["cat"][c] > 0) for c in CATEGORIAS}
        d["qualquer_achado"] = int(r["total"] > 0)
        d["medio_ou_mais"] = int(r["risco"][2] + r["risco"][3] > 0)
        d["alto"] = int(r["risco"][3] > 0)
        return d

    DESFECHOS = CATEGORIAS + ["qualquer_achado", "medio_ou_mais", "alto"]
    com_relatorio = sorted(apps)

    # ----- achados.csv -----
    saida.escrever("achados.csv",
        ["grupo", "fonte", "dominio", "app", "alertRef", "pluginid", "alerta",
         "risco", "risco_cod", "confianca", "confianca_cod", "cwe", "owasp_2025",
         "owasp_2025_nome", "tipo", "n_instancias", "validacao", "justificativa",
         "incluido_analise", "motivo_exclusao"],
        [[a["grupo"], a["fonte"], a["dominio"], a["app"], a["ref"], a["pluginid"],
          nome_ref(a["ref"]), RISCO_NOME.get(a["risco"], a["risco"]), a["risco"],
          CONF_NOME.get(a["conf"], a["conf"]), a["conf"], a["cwe"] or "",
          a["cat"], OWASP_2025_NOMES.get(a["cat"], ""), a["tipo"], a["n_inst"],
          a["validacao"], a["justif"], int(a["incluido"]), a["motivo"]]
         for a in sorted(achados, key=lambda x: (x["grupo"], x["fonte"],
                                                  x["dominio"], -x["risco"], x["ref"]))])

    # ----- presenca_owasp.csv e matriz_owasp.csv -----
    saida.escrever("presenca_owasp.csv",
        ["grupo", "fonte", "dominio", "app"] + DESFECHOS,
        [[apps[x]["grupo"], apps[x]["fonte"], apps[x]["dominio"], x]
         + [desfechos(x)[k] for k in DESFECHOS] for x in com_relatorio])
    saida.escrever("matriz_owasp.csv",
        ["grupo", "fonte", "dominio", "app"] + CATEGORIAS + ["total"],
        [[apps[x]["grupo"], apps[x]["fonte"], apps[x]["dominio"], x]
         + [por_app[x]["cat"][c] for c in CATEGORIAS]
         + [sum(por_app[x]["cat"].values())] for x in com_relatorio])

    # ----- resumo_apps.csv (inclui previstas sem relatorio) -----
    previstas = ["__".join((g, f, d)) for g, fs in FONTES_PREVISTAS.items()
                 for f in fs for d in DOMINIOS]
    linhas = []
    for x in sorted(set(previstas) | set(com_relatorio)):
        if x in apps:
            m, r = apps[x]["meta"], por_app[x]["risco"]
            g, f, d = apps[x]["grupo"], apps[x]["fonte"], apps[x]["dominio"]
            linhas.append([g, f, d, x, "sim", r[3], r[2], r[1], por_app[x]["total"],
                           m["endpoints"] if m["endpoints"] is not None else "NA",
                           m["pct_5xx"] if m["pct_5xx"] is not None else "NA",
                           m["versao_zap"], m["gerado"],
                           " ".join(sorted(m["hosts_externos"]))])
        else:
            g, f, d = x.split("__")
            linhas.append([g, f, d, x, "ausente"] + ["NA"] * 6 + ["", "", ""])
    saida.escrever("resumo_apps.csv",
        ["grupo", "fonte", "dominio", "app", "relatorio", "alto", "medio", "baixo",
         "total_achados", "endpoints", "pct_respostas_5xx", "versao_zap",
         "data_relatorio", "hosts_externos_descartados"], linhas)

    # ----- resumo_fontes.csv (por fonte e por grupo) -----
    def linha_resumo(rotulo_grupo, rotulo_fonte, lista):
        n = len(lista)
        totais = [por_app[x]["total"] for x in lista]
        prev = {k: sum(desfechos(x)[k] for x in lista) for k in DESFECHOS}
        return ([rotulo_grupo, rotulo_fonte, n, sum(totais),
                 saida.num(float(statistics.mean(totais))) if n else "NA",
                 saida.num(float(statistics.median(totais))) if n else "NA",
                 saida.num(float(statistics.stdev(totais))) if n > 1 else "NA",
                 min(totais) if n else "NA", max(totais) if n else "NA"]
                + [saida.num(100 * prev[k] / n, 1) if n else "NA"
                   for k in ["qualquer_achado", "medio_ou_mais", "alto"] + CATEGORIAS])

    linhas = []
    for g in sorted({apps[x]["grupo"] for x in com_relatorio}):
        for f in sorted({apps[x]["fonte"] for x in com_relatorio if apps[x]["grupo"] == g}):
            linhas.append(linha_resumo(g, f, [x for x in com_relatorio
                                              if apps[x]["grupo"] == g
                                              and apps[x]["fonte"] == f]))
        linhas.append(linha_resumo(g, "(total do grupo)",
                                   [x for x in com_relatorio if apps[x]["grupo"] == g]))
    linhas.append(linha_resumo("(todos)", "(todos)", com_relatorio))
    saida.escrever("resumo_fontes.csv",
        ["grupo", "fonte", "n_apps", "total_achados", "media_por_app",
         "mediana_por_app", "desvio_padrao", "minimo", "maximo",
         "pct_apps_qualquer_achado", "pct_apps_medio_ou_mais", "pct_apps_alto"]
        + ["pct_apps_" + c for c in CATEGORIAS], linhas)

    # ----- alertas_frequentes.csv -----
    apps_por_ref = defaultdict(set)
    risco_ref, cwe_ref, cat_ref, tipo_ref = {}, {}, {}, {}
    for a in achados:
        if a["incluido"]:
            apps_por_ref[a["ref"]].add(a["app"])
            risco_ref[a["ref"]] = max(risco_ref.get(a["ref"], 0), a["risco"])
            cwe_ref[a["ref"]], cat_ref[a["ref"]], tipo_ref[a["ref"]] = a["cwe"], a["cat"], a["tipo"]
    n_total = len(com_relatorio) or 1
    n_grupo = Counter(apps[x]["grupo"] for x in com_relatorio)
    linhas = []
    for ref, conj in sorted(apps_por_ref.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        por_g = Counter(apps[x]["grupo"] for x in conj)
        linhas.append([ref, nome_ref(ref), RISCO_NOME.get(risco_ref[ref]),
                       cwe_ref[ref] or "", cat_ref[ref], tipo_ref[ref], len(conj),
                       saida.num(100 * len(conj) / n_total, 1)]
                      + [por_g[g] for g in ("vibe", "lowcode")]
                      + [saida.num(100 * por_g[g] / n_grupo[g], 1) if n_grupo[g] else "NA"
                         for g in ("vibe", "lowcode")])
    saida.escrever("alertas_frequentes.csv",
        ["alertRef", "alerta", "risco", "cwe", "owasp_2025", "tipo", "n_apps",
         "pct_apps", "n_apps_vibe", "n_apps_lowcode", "pct_apps_vibe",
         "pct_apps_lowcode"], linhas)

    # ----- testes_hipoteses.csv -----
    exp = [x for x in com_relatorio if apps[x]["grupo"] == GRUPO_EXPOSTO]
    ref_ = [x for x in com_relatorio if apps[x]["grupo"] == GRUPO_REFERENCIA]
    linhas = []
    for k in DESFECHOS:
        a = sum(desfechos(x)[k] for x in exp)
        b = len(exp) - a
        c = sum(desfechos(x)[k] for x in ref_)
        d = len(ref_) - c
        ie_e = wilson(a, len(exp))
        ie_r = wilson(c, len(ref_))
        linha = [k, OWASP_2025_NOMES.get(k, ""), "H1" if k in ("A05", "A07") else "",
                 len(exp), a, saida.num(100 * a / len(exp), 1) if exp else "NA",
                 saida.num(100 * ie_e[0], 1) if exp else "NA",
                 saida.num(100 * ie_e[1], 1) if exp else "NA",
                 len(ref_), c, saida.num(100 * c / len(ref_), 1) if ref_ else "NA",
                 saida.num(100 * ie_r[0], 1) if ref_ else "NA",
                 saida.num(100 * ie_r[1], 1) if ref_ else "NA"]
        if exp and ref_:
            orr, li, ls, obs = odds_ratio(a, b, c, d)
            p_f = fisher_bilateral(a, b, c, d)
            estratos = []
            for dom in DOMINIOS:
                e_d = [x for x in exp if apps[x]["dominio"] == dom]
                r_d = [x for x in ref_ if apps[x]["dominio"] == dom]
                ae = sum(desfechos(x)[k] for x in e_d)
                cr = sum(desfechos(x)[k] for x in r_d)
                estratos.append((ae, len(e_d) - ae, cr, len(r_d) - cr))
            mh, mh_i, mh_s, p_mh, n_est = mantel_haenszel(estratos)
            linha += [saida.num(orr), saida.num(li), saida.num(ls), saida.num(p_f, 4),
                      saida.num(mh), saida.num(mh_i), saida.num(mh_s),
                      saida.num(p_mh, 4), n_est, obs]
        else:
            linha += ["NA"] * 8 + [0, "sem relatorios de um dos grupos"]
        linhas.append(linha)
    saida.escrever("testes_hipoteses.csv",
        ["desfecho", "categoria_owasp", "hipotese",
         "n_vibe", "casos_vibe", "pct_vibe", "ic95_inf_vibe", "ic95_sup_vibe",
         "n_lowcode", "casos_lowcode", "pct_lowcode", "ic95_inf_lowcode",
         "ic95_sup_lowcode", "or_bruto", "or_ic95_inf", "or_ic95_sup",
         "p_fisher", "or_mh", "or_mh_ic95_inf", "or_mh_ic95_sup", "p_cmh",
         "estratos_mh", "obs"], linhas)

    # ----- nao_mapeados.csv -----
    saida.escrever("nao_mapeados.csv", ["cwe", "alerta", "n_apps"],
        [[cwe, v["alerta"], len(v["apps"])]
         for cwe, v in sorted(nao_mapeados.items(), key=lambda kv: -len(kv[1]["apps"]))])

    # ----- validacao.csv (acrescenta itens novos) -----
    acrescentadas = atualizar_validacao(caminho_validacao, novas_validacoes,
                                        linhas_validacao, saida)

    # ----- resumo no console -----
    pendentes = sum(1 for a in achados if a["validacao"] == "pendente")
    ausentes = [x for x in previstas if x not in apps]
    print(f"Relatorios lidos: {len(apps)} | previstos: {len(previstas)}"
          f" | ausentes: {len(ausentes)} (ver resumo_apps.csv)")
    for g in ("vibe", "lowcode"):
        print(f"  {g}: {n_grupo[g]} aplicacoes com relatorio")
    print(f"Achados incluidos na analise: {sum(a['incluido'] for a in achados)}"
          f" (de {len(achados)} alertas; informativos e excluidos ficam em achados.csv)")
    filtros = [t for t, ativo in (("excluir-pendentes", args.excluir_pendentes),
                                  ("excluir-cabecalhos", args.excluir_cabecalhos),
                                  (f"confianca-minima={args.confianca_minima}",
                                   args.confianca_minima > 1)) if ativo]
    print("Filtros ativos:", ", ".join(filtros) if filtros else "nenhum")
    if pendentes:
        print(f"ATENCAO: {pendentes} alertas aguardam validacao manual em validacao.csv"
              f" ({acrescentadas} novos acrescentados nesta execucao). Enquanto houver"
              " pendencias, os resultados sao provisorios.")
    if nao_mapeados:
        print(f"CWEs fora do OWASP 2025: {len(nao_mapeados)} (ver nao_mapeados.csv)")
    if fora_padrao:
        print("Arquivos fora do padrao <grupo>__<fonte>__<dominio>:", ", ".join(fora_padrao))
    if GRUPO_CORRIGIDO:
        print(f"ATENCAO: {len(GRUPO_CORRIGIDO)} relatorios com prefixo de grupo errado no nome"
              " (contados no grupo certo pela fonte; renomeie os arquivos):")
        for c in sorted(set(GRUPO_CORRIGIDO)):
            print("  ", c)
    if not ref_:
        print("Testes vibe x low-code ainda nao calculados: nao ha relatorios low-code.")
    print("Saida em:", pasta_saida)


if __name__ == "__main__":
    main()
