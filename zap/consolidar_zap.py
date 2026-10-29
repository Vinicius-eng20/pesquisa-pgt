#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Consolida os relatorios JSON do OWASP ZAP (template traditional-json) do
experimento do TCC em poucas planilhas prontas para analise.

Uso (no Windows, dentro da pasta pesquisa-pgt):
    python zap\\consolidar_zap.py relatorios_zap

Argumento opcional: pasta com os arquivos .json do ZAP (padrao: relatorios_zap).

Gera, na mesma pasta, dentro de "consolidado\\":
    achados.csv          - um achado por linha (dado mestre)
    matriz_owasp.csv     - aplicacao x categoria OWASP 2025 (contagem)
    resumo_apps.csv      - por aplicacao: total e contagem por risco
    resumo_fontes.csv    - por fonte (modelo/plataforma): medias e totais
    nao_mapeados.csv     - CWEs sem categoria definida (revisar a mao)

Convencao de nome dos arquivos .json (ver plano-zap.yaml):
    <grupo>__<fonte>__<dominio>.json
Se o nome nao seguir o padrao, o arquivo e processado mesmo assim, com
grupo/fonte/dominio em branco e o nome do arquivo como identificador.

Observacoes de integridade:
- Conta apenas alertas dos hosts no escopo (localhost / 127.0.0.1). Ruido de
  dominios externos (ex.: *.azureedge.net) e descartado.
- O mapa CWE -> OWASP Top 10:2025 abaixo e baseado na categoria de cada CWE e
  DEVE ser revisado. CWEs fora do mapa aparecem em nao_mapeados.csv e nao sao
  classificados automaticamente (nunca sao "chutados").
- Alertas informativos (risco 0) sao contados a parte e NAO entram na matriz
  OWASP, que considera risco Baixo ou maior.
"""

import sys, os, json, csv, re, glob
from collections import defaultdict, Counter

# ----------------------------------------------------------------------------
# OWASP Top 10:2025 (lancado em nov/2025)
# ----------------------------------------------------------------------------
OWASP_2025 = {
    "A01": "Broken Access Control",
    "A02": "Security Misconfiguration",
    "A03": "Software Supply Chain Failures",
    "A04": "Cryptographic Failures",
    "A05": "Injection",
    "A06": "Insecure Design",
    "A07": "Authentication Failures",
    "A08": "Software or Data Integrity Failures",
    "A09": "Logging & Alerting Failures",
    "A10": "Mishandling of Exceptional Conditions",
}

# Mapa CWE -> categoria OWASP 2025. Revise conforme o criterio do seu trabalho.
CWE_OWASP = {
    # A01 Broken Access Control (inclui path traversal, CSRF, SSRF, CORS, info exposure por acesso)
    22:"A01",23:"A01",35:"A01",59:"A01",200:"A01",201:"A01",219:"A01",264:"A01",
    275:"A01",276:"A01",284:"A01",285:"A01",352:"A01",359:"A01",425:"A01",441:"A01",
    538:"A01",540:"A01",548:"A01",566:"A01",601:"A01",639:"A01",651:"A01",862:"A01",
    863:"A01",913:"A01",918:"A01",
    # A02 Security Misconfiguration (cabecalhos, cookies, CSP, fingerprint, comentarios)
    2:"A02",11:"A02",13:"A02",15:"A02",16:"A02",260:"A02",315:"A02",497:"A02",520:"A02",
    525:"A02",526:"A02",537:"A02",541:"A02",547:"A02",611:"A02",614:"A02",615:"A02",
    693:"A02",756:"A02",776:"A02",933:"A02",942:"A02",1004:"A02",1021:"A02",1032:"A02",
    1174:"A02",1275:"A02",
    # A03 Software Supply Chain Failures (componentes desatualizados/vulneraveis)
    937:"A03",1035:"A03",1104:"A03",1352:"A03",
    # A04 Cryptographic Failures (cripto fraca, transporte em claro, HSTS)
    261:"A04",296:"A04",310:"A04",319:"A04",321:"A04",322:"A04",323:"A04",324:"A04",
    325:"A04",326:"A04",327:"A04",328:"A04",329:"A04",330:"A04",331:"A04",335:"A04",
    336:"A04",337:"A04",338:"A04",340:"A04",347:"A04",523:"A04",757:"A04",759:"A04",
    760:"A04",780:"A04",818:"A04",916:"A04",
    # A05 Injection (SQLi, XSS, comando, LDAP, etc.)
    20:"A05",74:"A05",75:"A05",77:"A05",78:"A05",79:"A05",80:"A05",83:"A05",87:"A05",
    88:"A05",89:"A05",90:"A05",91:"A05",93:"A05",94:"A05",95:"A05",96:"A05",97:"A05",
    98:"A05",99:"A05",113:"A05",116:"A05",138:"A05",184:"A05",470:"A05",471:"A05",
    564:"A05",610:"A05",643:"A05",644:"A05",652:"A05",917:"A05",1236:"A05",
    # A06 Insecure Design
    209:"A10",  # (deslocado para A10; aqui so para lembrar que nao e A06)
    501:"A06",602:"A06",657:"A06",799:"A06",840:"A06",1173:"A06",
    # A07 Authentication Failures
    255:"A07",259:"A07",287:"A07",288:"A07",290:"A07",294:"A07",295:"A07",297:"A07",
    300:"A07",302:"A07",304:"A07",306:"A07",307:"A07",346:"A07",384:"A07",521:"A07",
    522:"A07",613:"A07",620:"A07",640:"A07",798:"A07",940:"A07",1216:"A07",
    # A08 Software or Data Integrity Failures
    345:"A08",353:"A08",426:"A08",494:"A08",502:"A08",565:"A08",784:"A08",829:"A08",
    830:"A08",915:"A08",
    # A09 Logging & Alerting Failures
    117:"A09",223:"A09",532:"A09",778:"A09",
    # A10 Mishandling of Exceptional Conditions (tratamento de erro/estados de falha)
    210:"A10",211:"A10",248:"A10",388:"A10",390:"A10",391:"A10",392:"A10",459:"A10",
    550:"A10",600:"A10",755:"A10",
}

HOSTS_ESCOPO = ("localhost", "127.0.0.1", "[::1]")

RISCO_NOME = {0:"Informativo", 1:"Baixo", 2:"Medio", 3:"Alto"}


def limpar_html(txt):
    if not txt:
        return ""
    txt = re.sub(r"<[^>]+>", " ", txt)
    return re.sub(r"\s+", " ", txt).strip()


def identidade(nome_arquivo):
    base = os.path.splitext(os.path.basename(nome_arquivo))[0]
    partes = base.split("__")
    if len(partes) == 3:
        return base, partes[0], partes[1], partes[2]
    return base, "", "", ""


def carregar(caminho):
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


def main():
    pasta = sys.argv[1] if len(sys.argv) > 1 else "relatorios_zap"
    if not os.path.isdir(pasta):
        print("Pasta nao encontrada:", pasta)
        sys.exit(1)

    arquivos = sorted(glob.glob(os.path.join(pasta, "*.json")))
    if not arquivos:
        print("Nenhum .json em", pasta)
        sys.exit(1)

    saida = os.path.join(pasta, "consolidado")
    os.makedirs(saida, exist_ok=True)

    achados = []            # linhas do achados.csv
    nao_mapeados = Counter()
    # matriz[app][categoria] = contagem de alertas distintos (risco >= 1)
    matriz = defaultdict(lambda: Counter())
    # resumo por app: contagem por risco
    por_app = defaultdict(lambda: Counter())
    meta_app = {}           # app -> (grupo, fonte, dominio)

    for arq in arquivos:
        app, grupo, fonte, dominio = identidade(arq)
        meta_app[app] = (grupo, fonte, dominio)
        try:
            dados = carregar(arq)
        except Exception as e:
            print("ERRO ao ler", arq, "->", e)
            continue

        for site in dados.get("site", []):
            host = site.get("@host", "")
            if host not in HOSTS_ESCOPO:
                continue  # descarta ruido de dominios externos
            for al in site.get("alerts", []):
                try:
                    risco = int(al.get("riskcode", "0"))
                except ValueError:
                    risco = 0
                try:
                    conf = int(al.get("confidence", "0"))
                except ValueError:
                    conf = 0
                try:
                    cwe = int(al.get("cweid", "-1"))
                except ValueError:
                    cwe = -1
                n_inst = al.get("count") or len(al.get("instances", []) or [])
                try:
                    n_inst = int(n_inst)
                except ValueError:
                    n_inst = len(al.get("instances", []) or [])

                cat = CWE_OWASP.get(cwe, "")
                if cwe >= 0 and not cat:
                    nao_mapeados[(cwe, al.get("name", ""))] += 1
                cat_nome = OWASP_2025.get(cat, "")

                achados.append({
                    "grupo": grupo, "fonte": fonte, "dominio": dominio, "app": app,
                    "alerta": al.get("name", ""),
                    "risco": RISCO_NOME.get(risco, risco),
                    "risco_cod": risco,
                    "confianca": conf,
                    "cwe": cwe if cwe >= 0 else "",
                    "owasp_2025": cat,
                    "owasp_2025_nome": cat_nome,
                    "n_instancias": n_inst,
                    "pluginid": al.get("pluginid", ""),
                })

                por_app[app][risco] += 1
                if risco >= 1 and cat:
                    matriz[app][cat] += 1

    # ----- achados.csv -----
    with open(os.path.join(saida, "achados.csv"), "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["grupo","fonte","dominio","app","alerta",
            "risco","risco_cod","confianca","cwe","owasp_2025","owasp_2025_nome",
            "n_instancias","pluginid"])
        w.writeheader()
        for row in sorted(achados, key=lambda r:(r["grupo"],r["fonte"],r["dominio"],-r["risco_cod"])):
            w.writerow(row)

    # ----- matriz_owasp.csv -----
    cats = list(OWASP_2025.keys())
    with open(os.path.join(saida, "matriz_owasp.csv"), "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["grupo","fonte","dominio","app"] + cats + ["total"])
        for app in sorted(matriz.keys() | por_app.keys()):
            g,fo,do = meta_app.get(app, ("","",""))
            linha = [matriz[app][c] for c in cats]
            w.writerow([g,fo,do,app] + linha + [sum(linha)])

    # ----- resumo_apps.csv -----
    with open(os.path.join(saida, "resumo_apps.csv"), "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["grupo","fonte","dominio","app","alto","medio","baixo","informativo","total_vuln"])
        for app in sorted(por_app.keys()):
            g,fo,do = meta_app.get(app, ("","",""))
            c = por_app[app]
            total_vuln = c[1]+c[2]+c[3]
            w.writerow([g,fo,do,app,c[3],c[2],c[1],c[0],total_vuln])

    # ----- resumo_fontes.csv -----
    fontes = defaultdict(lambda: {"apps":set(),"alto":0,"medio":0,"baixo":0,"info":0,"cat":Counter()})
    for app, c in por_app.items():
        g,fo,do = meta_app.get(app, ("","",""))
        chave = (g, fo)
        fontes[chave]["apps"].add(app)
        fontes[chave]["alto"] += c[3]
        fontes[chave]["medio"] += c[2]
        fontes[chave]["baixo"] += c[1]
        fontes[chave]["info"] += c[0]
        for cat, n in matriz[app].items():
            fontes[chave]["cat"][cat] += n
    with open(os.path.join(saida, "resumo_fontes.csv"), "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["grupo","fonte","n_apps","vuln_total","vuln_por_app",
                    "alto","medio","baixo","informativo"] + cats)
        for (g,fo), d in sorted(fontes.items()):
            n = len(d["apps"]) or 1
            vt = d["alto"]+d["medio"]+d["baixo"]
            w.writerow([g,fo,len(d["apps"]),vt,round(vt/n,2),
                        d["alto"],d["medio"],d["baixo"],d["info"]] +
                       [d["cat"][c] for c in cats])

    # ----- nao_mapeados.csv -----
    if nao_mapeados:
        with open(os.path.join(saida, "nao_mapeados.csv"), "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["cwe","alerta","ocorrencias"])
            for (cwe, nome), n in nao_mapeados.most_common():
                w.writerow([cwe, nome, n])

    # ----- resumo no console -----
    print("Aplicacoes processadas:", len(por_app))
    print("Achados (linhas):", len(achados))
    tot = Counter()
    for c in por_app.values():
        tot.update(c)
    print("  Alto: %d | Medio: %d | Baixo: %d | Informativo: %d" %
          (tot[3], tot[2], tot[1], tot[0]))
    if nao_mapeados:
        print("CWEs sem mapeamento (ver nao_mapeados.csv):", len(nao_mapeados))
    print("Saida em:", saida)


if __name__ == "__main__":
    main()
