Biblioteca Digital — acervo, empréstimos e devoluções.

Site completo e autossuficiente: login, leitor e bibliotecário,
acervo, empréstimos, devoluções, bloqueios e histórico.
Os dados ficam no arquivo "dados.json" (ou na pasta DATA_DIR).
"""

import json
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import (FastAPI, Request, status, Cookie, Depends,
                     HTTPException, Form, Query)
from fastapi.responses import JSONResponse, RedirectResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Configuração básica
# ---------------------------------------------------------------------------

TITULO_SITE = "Biblioteca Digital"
PRIMEIRO_BIBLIOTECARIO = {"usuario": "admin", "senha": "admin123"}

RAIZ = Path(__file__).resolve().parent
PASTA_DADOS = Path(os.environ.get("DATA_DIR", str(RAIZ)))
PASTA_DADOS.mkdir(parents=True, exist_ok=True)
ARQ = PASTA_DADOS / "dados.json"

# ---------------------------------------------------------------------------
# Banco de dados simples em arquivo JSON (com "bloqueio" para não perder dados)
# ---------------------------------------------------------------------------

def _estrutura_vazia():
    return {
        "usuarios": [
            {
                "id": "u0",
                "nome": "Bibliotecária (inicial)",
                "usuario": PRIMEIRO_BIBLIOTECARIO["usuario"],
                "hash": _hash_senha(PRIMEIRO_BIBLIOTECARIO["senha"]),
                "papel": "bibliotecario",
                "ativo": True,
                "bloqueado": False,
                "criado_em": datetime.now(timezone.utc).isoformat(),
            }
        ],
        "itens": [],
        "emprestimos": [],
    }


def _carregar():
    if not ARQ.exists():
        dados = _estrutura_vazia()
        _gravar(dados)
        return dados
    with open(ARQ, encoding="utf-8") as f:
        return json.load(f)


def _gravar(dados):
    dados = _limpar(dados)
    tmp = ARQ.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)
    tmp.replace(ARQ)


# ---------------------------------------------------------------------------
# Segurança: senha com hash + bloqueio de sessão
# ---------------------------------------------------------------------------

def _hash_senha(senha: str) -> str:
    return secrets.hashlib_pbkdf2 = None  # placeholder (substituído abaixo)


def _hash_senha(senha: str) -> str:
    import hashlib
    salt = "biblio"
    return hashlib.pbkdf2_hmac("sha256", senha.encode("utf-8"), salt.encode("utf-8"), 120_000).hex()


def _chk_senha(senha: str, hash_: str) -> bool:
    return _hash_senha(senha) == hash_


# ---------------------------------------------------------------------------
# Modelos (Pydantic) — validação automática dos formulários
# ---------------------------------------------------------------------------

class ItemIn(BaseModel):
    titulo: str
    autor: str = ""
    tipo: str = "Livro"
    genero: str = ""
    isbn: str = ""
    ano: str = ""
    exemplares: int = 1
    prazo_dias: int = 14
    desc: str = ""


# ---------------------------------------------------------------------------
# Utilitários
# ---------------------------------------------------------------------------

def _esc(s: str) -> str:
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "&#39;"))


def _id() -> str:
    return secrets.token_hex(8)


def _hoje():
    return datetime.now(timezone.utc)


def _data_iso(s: str) -> datetime:
    return datetime.fromisoformat(s)


def _limpar(d):
    """Converte objetos com métodos (datetime, Decimal) para tipos JSON."""
    def o(obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        raise TypeError(f"Tipo não serializável: {type(obj)}")
    return json.loads(json.dumps(d, default=o, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Aplicação e templates
# ---------------------------------------------------------------------------

app = FastAPI(title=TITULO_SITE)
templates = Jinja2Templates(directory=str(RAIZ))

# Coerção de tipos nos parâmetros da query (FastAPI 0.115+)
app.dependency_overrides[Query] = {}


# ---------------------------------------------------------------------------
# Autenticação
# ---------------------------------------------------------------------------

def _user_por_cookie(request: Request):
    token = request.cookies.get("sessao")
    if not token:
        return None
    dados = _carregar()
    for u in dados["usuarios"]:
        if u.get("sessao") == token:
            return u
    return None


def _exigir_papel(request: Request, papel):
    u = _user_por_cookie(request)
    if not u or (papel == "bibliotecario" and u["papel"] != "bibliotecario"):
        raise RedirectResponse("/login", status_code=303)
    return u


def _limpar(dados):
    return _limpar_j(dados)


def _limpar_j(dados):
    return dados  # já são dados simples


def _set_cookie(res, u):
    res.set_cookie("sessao", u["sessao"], httponly=True, samesite="lax", max_age=60 * 60 * 24 * 30)
    return res


def _reset_sessao(u):
    dados = _carregar()
    for x in dados["usuarios"]:
        if x["id"] == u["id"]:
            x["sessao"] = _id()
    _gravar(dados)
    return x["sessao"]


# ---------------------------------------------------------------------------
# Lógica do acervo / empréstimos
# ---------------------------------------------------------------------------

def _resumo_emprestimo(em):
    return {
        "id": em["id"],
        "leitor": em["leitor_nome"],
        "titulo": em["titulo"],
        "estado": em["estado"],
        "emprestado_em": em["emprestado_em"],
        "previsto_devolucao": em["previsto_devolucao"],
    }


def _emprestimos_de(leitor_id):
    dados = _carregar()
    return [e for e in dados["emprestimos"] if e["leitor"] == leitor_id]


def _atrasado(em, agora=None):
    agora = agora or _hoje()
    if em["estado"] == "devolvido":
        return False
    return _data_iso(em["previsto_devolucao"]) < agora


def _leitor_atrasado(leitor_id):
    return any(_atrasado(e) for e in _emprestimos_de(leitor_id))


def _exemplares_disponiveis(item):
    dados = _carregar()
    em_uso = sum(1 for e in dados["emprestimos"]
                 if e["item"] == item["id"] and e["estado"] == "emprestado")
    return max(0, item["exemplares"] - em_uso)


def _validar_emprestimo(leitor, item):
    """Retorna (ok, mensagem)."""
    if not leitor.get("ativo", True):
        return False, "Sua conta está desativada. Fale com a biblioteca."
    if leitor.get("bloqueado"):
        return False, "Seu cadastro está bloqueado para novos empréstimos."
    if _leitor_atrasado(leitor["id"]):
        return False, "Você tem empréstimo em atraso. Devolva antes de pegar novo item."
    if _exemplares_disponiveis(item) <= 0:
        return False, "Não há exemplares disponíveis no momento."
    return True, ""


# ---------------------------------------------------------------------------
# Templates: páginas públicas
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    u = _user_por_cookie(request)
    if u:
        return RedirectResponse("/painel", status_code=303)
    return RedirectResponse("/login", status_code=303)


@app.get("/login", response_class=HTMLResponse)
def login_pagina(request: Request, erro: str = ""):
    return templates.TemplateResponse(request, "login.html", {
        "titulo": "Entrar", "erro": erro,
        "admin_user": PRIMEIRO_BIBLIOTECARIO["usuario"],
        "admin_pass": PRIMEIRO_BIBLIOTECARIO["senha"],
    })


@app.post("/login")
def login_post(request: Request,
               usuario: str = Form(...),
               senha: str = Form(...)):
    dados = _carregar()
    u = next((x for x in dados["usuarios"] if x["usuario"].lower() == usuario.lower()), None)
    if not u or not _chk_senha(senha, u["hash"]) or not u.get("ativo", True):
        return RedirectResponse("/login?erro=Usuário ou senha inválidos.", status_code=303)
    u["sessao"] = _id()
    _gravar(dados)
    res = RedirectResponse("/painel", status_code=303)
    res.set_cookie("sessao", u["sessao"], httponly=True, samesite="lax", max_age=60 * 60 * 24 * 30)
    return res


@app.get("/criar", response_class=HTMLResponse)
def criar_pagina(request: Request, erro: str = ""):
    return templates.TemplateResponse(request, "criar.html", {"titulo": "Criar conta", "erro": erro})


@app.post("/criar")
def criar_post(request: Request,
               nome: str = Form(...),
               usuario: str = Form(...),
               senha: str = Form(...),
               senha2: str = Form(...)):
    nome = nome.strip()
    usuario = usuario.strip()
    if not nome or not usuario or not senha:
        return RedirectResponse("/criar?erro=Preencha nome, usuário e senha.", status_code=303)
    if len(senha) < 4:
        return RedirectResponse("/criar?erro=A senha precisa ter pelo menos 4 caracteres.", status_code=303)
    if senha != senha2:
        return RedirectResponse("/criar?erro=As senhas não conferem.", status_code=303)
    dados = _carregar()
    if any(x["usuario"].lower() == usuario.lower() for x in dados["usuarios"]):
        return RedirectResponse("/criar?erro=Esse usuário já existe.", status_code=303)
    novo = {
        "id": _id(), "nome": nome, "usuario": usuario,
        "hash": _hash_senha(senha), "papel": "leitor",
        "ativo": True, "bloqueado": False, "sessao": _id(),
        "criado_em": _hoje().isoformat(),
    }
    dados["usuarios"].append(novo)
    _gravar(dados)
    res = RedirectResponse("/painel", status_code=303)
    res.set_cookie("sessao", novo["sessao"], httponly=True, samesite="lax", max_age=60 * 60 * 24 * 30)
    return res


@app.post("/logout")
def logout():
    dados = _carregar()
    for u in dados["usuarios"]:
        u["sessao"] = _id()
    _gravar(dados)
    res = RedirectResponse("/login", status_code=303)
    res.delete_cookie("sessao")
    return res


# ---------------------------------------------------------------------------
# Páginas: leitor / bibliotecário (painel e acervo)
# ---------------------------------------------------------------------------

def _dados_painel(u):
    meus = _emprestimos_de(u["id"])
    ativos = [e for e in meus if e["estado"] == "emprestado"]
    historico = [e for e in meus if e["estado"] == "devolvido"]
    atrasados = [e for e in ativos if _atrasado(e)]
    return {
        "meus": ativos, "historico": historico,
        "atrasados": atrasados, "tem_atraso": bool(atrasados),
    }


@app.get("/painel", response_class=HTMLResponse)
def painel(request: Request):
    u = _exigir_papel(request, "leitor")
    d = _dados_painel(u)
    if u["papel"] == "bibliotecario":
        d["total_itens"] = len(_carregar()["itens"])
    return templates.TemplateResponse(request, "painel.html", {
        "titulo": "Painel", "u": u, **d,
    })


@app.get("/acervo", response_class=HTMLResponse)
def acervo(request: Request, q: str = "", disponivel: bool = False, msg: str = ""):
    u = _exigir_papel(request, "leitor")
    dados = _carregar()
    itens = dados["itens"]
    q2 = q.strip().lower()
    if q2:
        itens = [i for i in itens
                 if q2 in i["titulo"].lower()
                 or q2 in i.get("autor", "").lower()
                 or q2 in i.get("genero", "").lower()
                 or q2 in i.get("isbn", "").lower()]
    if disponivel:
        itens = [i for i in itens if _exemplares_disponiveis(i) > 0]
    # ordena por título
    itens = sorted(itens, key=lambda i: i["titulo"].lower())
    # quais itens estão com exemplares emprestados (para "devolver" rápido)
    meus = _emprestimos_de(u["id"])
    meus_ids = {e["item"] for e in meus if e["estado"] == "emprestado"}
    return templates.TemplateResponse(request, "acervo.html", {
        "titulo": "Acervo", "u": u, "itens": itens,
        "q": q, "disponivel": disponivel, "msg": msg, "meus_ids": meus_ids,
    })


@app.post("/emprestar/{item_id}")
def emprestar(item_id: str, request: Request):
    u = _exigir_papel(request, "leitor")
    dados = _carregar()
    item = next((i for i in dados["itens"] if i["id"] == item_id), None)
    if not item:
        return RedirectResponse("/acervo?msg=Item não encontrado.", status_code=303)
    ok, msg = _validar_emprestimo(u, item)
    if not ok:
        return RedirectResponse("/acervo?msg=" + msg, status_code=303)
    em = {
        "id": _id(), "item": item["id"], "titulo": item["titulo"],
        "leitor": u["id"], "leitor_nome": u["nome"],
        "estado": "emprestado", "emprestado_em": _hoje().isoformat(),
        "previsto_devolucao": (_hoje() + timedelta(days=max(1, item.get("prazo_dias", 14)))).isoformat(),
        "devolvido_em": None,
    }
    dados["emprestimos"].append(em)
    _gravar(dados)
    return RedirectResponse("/acervo?msg=Item emprestado. Bom leitura!", status_code=303)


@app.post("/devolver/{em_id}")
def devolver(em_id: str, request: Request):
    u = _exigir_papel(request, "leitor")
    dados = _carregar()
    em = next((e for e in dados["emprestimos"] if e["id"] == em_id), None)
    if not em:
        return RedirectResponse("/painel?msg=Empréstimo não encontrado.", status_code=303)
    if em["leitor"] != u["id"] and u["papel"] != "bibliotecario":
        return RedirectResponse("/painel?msg=Você não pode devolver este item.", status_code=303)
    em["estado"] = "devolvido"
    em["devolvido_em"] = _hoje().isoformat()
    _gravar(dados)
    return RedirectResponse("/painel?msg=Devolução registrada. Obrigado!", status_code=303)


# ---------------------------------------------------------------------------
# Admin (bibliotecário)
# ---------------------------------------------------------------------------

@app.get("/admin", response_class=HTMLResponse)
def admin(request: Request, msg: str = ""):
    u = _exigir_papel(request, "bibliotecario")
    dados = _carregar()
    itens = sorted(dados["itens"], key=lambda i: i["titulo"].lower())
    usuarios = dados["usuarios"]
    # estatísticas de atraso por usuário
    atraso = {}
    for e in dados["emprestimos"]:
        if e["estado"] == "emprestado" and _atrasado(e):
            atraso[e["leitor"]] = atraso.get(e["leitor"], 0) + 1
    return templates.TemplateResponse(request, "admin.html", {
        "titulo": "Administração", "u": u, "itens": itens,
        "usuarios": usuarios, "atraso": atraso, "msg": msg,
    })


@app.post("/admin/item")
def admin_item(request: Request, acao: str = Form(...),
               item_id: str = Form(""), **campos):
    u = _exigir_papel(request, "bibliotecario")
    dados = _carregar()
    # converte números
    try:
        exemplares = int(campos.get("exemplares") or 1)
        prazo = int(campos.get("prazo_dias") or 14)
    except ValueError:
        return RedirectResponse("/admin?msg=Quantidade de exemplares ou prazo inválido.", status_code=303)
    titulo = (campos.get("titulo") or "").strip()
    if not titulo:
        return RedirectResponse("/admin?msg=O título é obrigatório.", status_code=303)
    item = {
        "titulo": titulo,
        "autor": (campos.get("autor") or "").strip(),
        "tipo": (campos.get("tipo") or "Livro").strip() or "Livro",
        "genero": (campos.get("genero") or "").strip(),
        "isbn": (campos.get("isbn") or "").strip(),
        "ano": (campos.get("ano") or "").strip(),
        "exemplares": max(1, exemplares),
        "prazo_dias": max(1, prazo),
        "desc": (campos.get("desc") or "").strip(),
    }
    if acao == "novo":
        item["id"] = _id()
        item["criado_em"] = _hoje().isoformat()
        dados["itens"].append(item)
        msg = "Item cadastrado."
    else:
        novo = next((i for i in dados["itens"] if i["id"] == item_id), None)
        if not novo:
            return RedirectResponse("/admin?msg=Item não encontrado.", status_code=303)
        # não deixar exemplares menores que o total emprestado
        em_uso = sum(1 for e in dados["emprestimos"]
                     if e["item"] == item_id and e["estado"] == "emprestado")
        item["exemplares"] = max(em_uso, item["exemplares"])
        novo.update(item)
        msg = "Item atualizado."
    _gravar(dados)
    return RedirectResponse("/admin?msg=" + msg, status_code=303)


@app.post("/admin/item/remove/{item_id}")
def admin_item_remove(item_id: str, request: Request):
    u = _exigir_papel(request, "bibliotecario")
    dados = _carregar()
    em_uso = sum(1 for e in dados["emprestimos"]
                 if e["item"] == item_id and e["estado"] == "emprestado")
    if em_uso > 0:
        return RedirectResponse("/admin?msg=Não é possível remover: há exemplares emprestados.", status_code=303)
    dados["itens"] = [i for i in dados["itens"] if i["id"] != item_id]
    _gravar(dados)
    return RedirectResponse("/admin?msg=Item removido.", status_code=303)


@app.post("/admin/user/ativar/{user_id}")
def admin_user_ativar(user_id: str, request: Request):
    u = _exigir_papel(request, "bibliotecario")
    dados = _carregar()
    x = next((y for y in dados["usuarios"] if y["id"] == user_id), None)
    if not x:
        return RedirectResponse("/admin?msg=Usuário não encontrado.", status_code=303)
    x["ativo"] = True
    _gravar(dados)
    return RedirectResponse("/admin?msg=Conta reativada.", status_code=303)


@app.post("/admin/user/desativar/{user_id}")
def admin_user_desativar(user_id: str, request: Request):
    u = _exigir_papel(request, "bibliotecario")
    dados = _carregar()
    x = next((y for y in dados["usuarios"] if y["id"] == user_id), None)
    if not x:
        return RedirectResponse("/admin?msg=Usuário não encontrado.", status_code=303)
    x["ativo"] = False
    _gravar(dados)
    return RedirectResponse("/admin?msg=Conta desativada.", status_code=303)


@app.post("/admin/user/bloquear/{user_id}")
def admin_user_bloquear(user_id: str, request: Request):
    u = _exigir_papel(request, "bibliotecario")
    dados = _carregar()
    x = next((y for y in dados["usuarios"] if y["id"] == user_id), None)
    if not x:
        return RedirectResponse("/admin?msg=Usuário não encontrado.", status_code=303)
    x["bloqueado"] = not x.get("bloqueado", False)
    _gravar(dados)
    msg = "Bloqueio de empréstimos removido." if not x["bloqueado"] else "Novos empréstimos bloqueados."
    return RedirectResponse("/admin?msg=" + msg, status_code=303)


@app.post("/admin/user/papel/{user_id}")
def admin_user_papel(user_id: str, request: Request):
    u = _exigir_papel(request, "bibliotecario")
    dados = _carregar()
    x = next((y for y in dados["usuarios"] if y["id"] == user_id), None)
    if not x:
        return RedirectResponse("/admin?msg=Usuário não encontrado.", status_code=303)
    x["papel"] = "leitor" if x["papel"] != "leitor" else "bibliotecario"
    _gravar(dados)
    msg = "Agora é bibliotecário." if x["papel"] == "bibliotecario" else "Agora é leitor."
    return RedirectResponse("/admin?msg=" + msg, status_code=303)


@app.get("/admin/historico", response_class=HTMLResponse)
def admin_historico(request: Request, q: str = "", estado: str = ""):
    u = _exigir_papel(request, "bibliotecario")
    dados = _carregar()
    ems = list(dados["emprestimos"])
    q2 = q.strip().lower()
    if q2:
        ems = [e for e in ems
               if q2 in e["titulo"].lower()
               or q2 in e["leitor_nome"].lower()]
    if estado in ("emprestado", "devolvido"):
        ems = [e for e in ems if e["estado"] == estado]
    ems = sorted(ems, key=lambda e: e["emprestado_em"], reverse=True)
    return templates.TemplateResponse(request, "historico.html", {
        "titulo": "Histórico de empréstimos", "u": u, "ems": ems,
        "q": q, "estado": estado,
    })


@app.get("/admin/leitor/{user_id}", response_class=HTMLResponse)
def admin_leitor(user_id: str, request: Request):
    u = _exigir_papel(request, "bibliotecario")
    dados = _carregar()
    x = next((y for y in dados["usuarios"] if y["id"] == user_id), None)
    if not x:
        return RedirectResponse("/admin", status_code=303)
    ems = [e for e in dados["emprestimos"] if e["leitor"] == user_id]
    ems = sorted(ems, key=lambda e: e["emprestado_em"], reverse=True)
    return templates.TemplateResponse(request, "leitor.html", {
        "titulo": f"Histórico de {x['nome']}", "u": u, "x": x, "ems": ems,
    })


# ---------------------------------------------------------------------------
# API de status (opcional, para checar no navegador: /status)
# ---------------------------------------------------------------------------

@app.get("/status")
def status_ep():
    d = _carregar()
    return {
        "ok": True,
        "usuarios": len(d["usuarios"]),
        "itens": len(d["itens"]),
        "emprestimos": len(d["emprestimos"]),
    }


# ---------------------------------------------------------------------------
# Ponto de entrada
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
