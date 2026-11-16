"""Levantamento (H2): credenciais citadas em .env* e README* das apps.

Uso: python h2_credenciais.py <raiz pesquisa-pgt> <pasta_saida>
Gera: h2_usuarios_senhas.csv, h2_senhas.csv, h2_tokens_segredos.csv, h2_por_app.csv
Cada credencial conta uma vez por aplicacao (fonte/dominio).
"""
import os, re, sys, csv
from collections import defaultdict

raiz, saida = sys.argv[1], sys.argv[2]
os.makedirs(saida, exist_ok=True)
IGNORAR = {"node_modules", ".git", "dist", "build", "__pycache__", ".venv", "venv", ".bolt", ".lovable"}
LOWCODE = {"bolt", "lovable"}

V = r"[`'\"*]*([^\s`'\"*|,;)]+)[`'\"*]*"
R_USER = re.compile(r"(?:e-?mail|usu[aá]rio|login|user(?:name)?)\s*(?:\*\*)?\s*[:=]\s*(?:\*\*)?\s*" + V, re.I)
R_SENHA = re.compile(r"(?:senha|password)\s*(?:\*\*)?\s*[:=]\s*(?:\*\*)?\s*" + V, re.I)
R_PAR = re.compile(r"usu[aá]rio\s*`([^`]+)`\s*/\s*senha\s*`([^`]+)`", re.I)
R_ENV = re.compile(r"^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*['\"]?([^'\"\s#]*)")
R_FALLBACK = re.compile(r"([A-Z][A-Z0-9_]*(?:SECRET|TOKEN|KEY)[A-Z0-9_]*)\s*=\s*process\.env\.[A-Z0-9_]+\s*\|\|\s*['\"]([^'\"]+)['\"]")
R_SEGREDO_CHAVE = re.compile(r"(SECRET|TOKEN|PASSWORD|PASSWD|API_?KEY|ANON_KEY|PUBLISHABLE_KEY|SERVICE_ROLE|PRIVATE)", re.I)
R_CONEXAO = re.compile(r"((?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql)://[^:\s/]+:[^@\s]+@[^\s'\"`]+)", re.I)
PLACEHOLDER = re.compile(r"^(<.*>|\.\.\.|x+|\*+|changeme)$", re.I)


def tipo_token(chave, valor):
    if valor.startswith("eyJ"):
        return "Chave anon do Supabase (JWT)" if "ANON" in chave.upper() else f"Token JWT ({chave})"
    if valor.startswith("sb_publishable_"):
        return "Chave publicavel do Supabase (sb_publishable_)"
    if valor.startswith("sb_secret_"):
        return "Chave secreta do Supabase (sb_secret_)"
    return None


usuarios_senhas = defaultdict(set)   # (usuario, senha) -> apps
senhas = defaultdict(set)            # senha -> apps
tokens = defaultdict(set)            # (tipo, variavel, valor_exibido) -> apps
por_app = defaultdict(lambda: {"senha_readme": 0, "segredo_fixo": 0, "chave_publica": 0})
apps_vistas = set()

for grupo_pasta in ("saidas_vibe_coding", "saidas_lowcode"):
    base = os.path.join(raiz, grupo_pasta)
    for fonte in sorted(os.listdir(base)):
        if not os.path.isdir(os.path.join(base, fonte)):
            continue
        for dominio in sorted(os.listdir(os.path.join(base, fonte))):
            pasta_dom = os.path.join(base, fonte, dominio)
            if not os.path.isdir(pasta_dom):
                continue
            app = f"{'lowcode' if fonte in LOWCODE else 'vibe'}__{fonte}__{dominio}"
            apps_vistas.add(app)
            por_app[app]
            for r, dirs, files in os.walk(pasta_dom):
                dirs[:] = [d for d in dirs if d not in IGNORAR]
                for f in files:
                    fl = f.lower()
                    eh_env, eh_readme = fl.startswith(".env"), fl.startswith("readme")
                    if not (eh_env or eh_readme):
                        continue
                    linhas = open(os.path.join(r, f), encoding="utf-8", errors="replace").read().splitlines()
                    ultimo_user, dist_user, cab_tabela = None, 99, False
                    for linha in linhas:
                        # variaveis KEY=valor (.env ou blocos de codigo no README)
                        m = R_ENV.match(linha)
                        if m and R_SEGREDO_CHAVE.search(m.group(1)) and m.group(2) and not PLACEHOLDER.match(m.group(2)):
                            chave, valor = m.group(1), m.group(2)
                            t = tipo_token(chave, valor)
                            if t:
                                tokens[(t, chave, "(valor diferente por app)")].add(app)
                                por_app[app]["chave_publica"] = 1
                            else:
                                tipo = "Senha de banco" if re.search(r"PASS", chave) else "Segredo de sessao/JWT" if re.search(r"SECRET|JWT", chave) else "Outra credencial"
                                tokens[(tipo, chave, valor)].add(app)
                                por_app[app]["segredo_fixo"] = 1
                            continue
                        for m in R_FALLBACK.finditer(linha):
                            tokens[("Segredo JWT fixo no codigo (fallback)", m.group(1), m.group(2))].add(app)
                            por_app[app]["segredo_fixo"] = 1
                        for m in R_CONEXAO.finditer(linha):
                            if not re.search(r"usuario:senha|user:pass", m.group(1), re.I):
                                tokens[("String de conexao com senha", "-", m.group(1))].add(app)
                                por_app[app]["segredo_fixo"] = 1
                        if not eh_readme:
                            continue
                        # pares usuario/senha
                        mp = R_PAR.search(linha)
                        if mp:
                            usuarios_senhas[(mp.group(1), mp.group(2))].add(app); senhas[mp.group(2)].add(app)
                            por_app[app]["senha_readme"] = 1
                            continue
                        if linha.strip().startswith("|"):
                            cels = [c.strip().strip("`*") for c in linha.strip().strip("|").split("|")]
                            baixo = [c.lower() for c in cels]
                            if any("senha" in c or "password" in c for c in baixo) and any(k in " ".join(baixo) for k in ("usu", "e-mail", "email", "login")):
                                cab_tabela = True
                                iu = next(i for i, c in enumerate(baixo) if any(k in c for k in ("usu", "mail", "login")))
                                isn = next(i for i, c in enumerate(baixo) if "senha" in c or "password" in c)
                                continue
                            if cab_tabela and not set(linha.replace("|", "").strip()) <= set("-: "):
                                if len(cels) > max(iu, isn) and cels[isn]:
                                    usuarios_senhas[(cels[iu], cels[isn])].add(app); senhas[cels[isn]].add(app)
                                    por_app[app]["senha_readme"] = 1
                            continue
                        cab_tabela = False
                        mu = R_USER.search(linha)
                        ms = R_SENHA.search(linha)
                        if mu and not ms:
                            ultimo_user, dist_user = mu.group(1), 0
                            continue
                        dist_user += 1
                        if ms:
                            s = ms.group(1)
                            if len(s) < 3 or PLACEHOLDER.match(s) or s.lower() in ("do", "da", "de", "e", "para"):
                                continue
                            u = mu.group(1) if mu else (ultimo_user if dist_user <= 4 else "(nao informado)")
                            usuarios_senhas[(u, s)].add(app); senhas[s].add(app)
                            por_app[app]["senha_readme"] = 1


def grava(nome, cab, linhas):
    with open(os.path.join(saida, nome), "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh, delimiter=";"); w.writerow(cab); w.writerows(linhas)


def grupos(apps):
    return sum(a.startswith("vibe") for a in apps), sum(a.startswith("lowcode") for a in apps)

grava("h2_usuarios_senhas.csv", ["usuario", "senha", "n_apps", "n_vibe", "n_lowcode"],
      sorted([[u, s, len(a), *grupos(a)] for (u, s), a in usuarios_senhas.items()], key=lambda x: (-x[2], x[0])))
grava("h2_senhas.csv", ["senha", "n_apps", "n_vibe", "n_lowcode"],
      sorted([[s, len(a), *grupos(a)] for s, a in senhas.items()], key=lambda x: (-x[1], x[0])))
grava("h2_tokens_segredos.csv", ["tipo", "variavel", "valor", "n_apps", "n_vibe", "n_lowcode"],
      sorted([[t, k, v, len(a), *grupos(a)] for (t, k, v), a in tokens.items()], key=lambda x: (-x[3], x[0])))
grava("h2_por_app.csv", ["app", "senha_readme", "segredo_fixo", "chave_publica"],
      [[a, d["senha_readme"], d["segredo_fixo"], d["chave_publica"]] for a, d in sorted(por_app.items())])
n_v = sum(a.startswith("vibe") for a in apps_vistas); n_l = len(apps_vistas) - n_v
print(f"apps: {len(apps_vistas)} (vibe {n_v}, lowcode {n_l})")
for k in ("senha_readme", "segredo_fixo", "chave_publica"):
    v = sum(d[k] for a, d in por_app.items() if a.startswith("vibe")); l = sum(d[k] for a, d in por_app.items() if a.startswith("lowcode"))
    print(f"{k}: vibe {v}/{n_v}, lowcode {l}/{n_l}")
