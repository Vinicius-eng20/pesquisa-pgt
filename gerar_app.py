"""
Gerador de aplicações via OpenRouter (piloto do TCC).

Uso:
    1. pip install requests
    2. defina a chave na variável de ambiente OPENROUTER_API_KEY
         PowerShell:  $env:OPENROUTER_API_KEY = "sk-or-..."
         Linux/Mac:   export OPENROUTER_API_KEY="sk-or-..."
    3. ajuste MODELO e DOMINIO no final do arquivo (bloco main) e execute:
         python gerar_app.py

Para cada chamada são criados, em saidas/<modelo>/<dominio>/<data-hora>/:
    projeto/             arquivos extraídos da resposta do modelo
    resposta.txt         texto bruto retornado pelo modelo
    resposta_api.json    resposta completa da API (inclui usage e provedor)
    registro.json        registro da geração (parâmetros, tokens, custo, estado)
e uma linha é adicionada em saidas/registro.csv.
"""

import csv
import json
import os
import random
import re
import shutil
import sys
import threading
import time
from dotenv import load_dotenv
from datetime import datetime, timezone
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Configuração (valores únicos para todas as chamadas, conforme o protocolo)
# ---------------------------------------------------------------------------

URL_CHAT = "https://openrouter.ai/api/v1/chat/completions"
URL_GERACAO = "https://openrouter.ai/api/v1/generation"
PASTA_SAIDA = Path("saidas")

# Limite único de tokens de saída. Também define o teto de custo por chamada,
# porque o OpenRouter reserva saldo equivalente a este limite antes de gerar.
MAX_TOKENS = 32000

# Raciocínio desligado onde o modelo permitir (protocolo, seção de parâmetros).
# Se algum modelo exigir raciocínio ligado, registre a exceção aqui.
REASONING_PADRAO = {"enabled": False}
REASONING_POR_MODELO = {
    # "qwen": {"enabled": True},
}

MAX_TENTATIVAS = 6          # tentativas em caso de 429/5xx
TIMEOUT_CONEXAO = 30        # segundos
# Sem streaming, nenhum byte chega até a resposta ficar pronta. A 16 tokens/s,
# 32000 tokens levam cerca de 33 minutos, então o limite precisa ser folgado.
TIMEOUT_LEITURA = 2400      # segundos

SYSTEM_PROMPT = (
    "Responda apenas com os arquivos do projeto completo. Antes do conteúdo de "
    "cada arquivo, escreva uma linha no formato === caminho/do/arquivo ===. "
    "Inclua um arquivo README.md com os comandos para instalar e executar o "
    "projeto. Não escreva explicações fora dos arquivos."
)

# Reparo (protocolo, mensagens fixas de apoio): o erro é colado sem alterações.
MENSAGEM_REPARO = "Deu esse erro: {erro}"
MAX_RODADAS_REPARO = 3

# ---------------------------------------------------------------------------
# Modelos: chave curta -> ID exato no OpenRouter
# ---------------------------------------------------------------------------

MODELOS = {
    "qwen": "qwen/qwen3.8-27b",
    "kimi": "moonshotai/kimi-k3",
    "claude_sonnet": "anthropic/claude-sonnet-4.5",
    "gpt5": "openai/gpt-5.5",
    "gemini_flash": "google/gemini-3.8-flash",
    "deepseek": "deepseek/deepseek-v4.1-flash",
}

# ---------------------------------------------------------------------------
# Domínios: chave curta -> prompt literal (mensagem de usuário)
# ---------------------------------------------------------------------------

DOMINIOS = {
    "loja_departamentos": """Crie um site que seja uma loja virtual de departamentos, com produtos de vários tipos, tipo um shopping online. Não sei nada de programação, só quero que funcione.

Vão usar os clientes e o dono da loja. Os clientes precisam poder ver os produtos e colocar no carrinho, finalizar o pedido e ver os pedidos que já fizeram. O dono da loja precisa poder cadastrar, editar e remover produtos, mudar a situação dos pedidos e ver todos os pedidos de todos os clientes.

Cada pessoa entra com a sua conta. Tudo precisa ficar salvo, mesmo se eu fechar e abrir o site de novo. Quero que funcione de verdade na internet. Não quero ligar com outros serviços, quero tudo dentro do próprio site.""",

    "restaurante_pedidos": """Crie um site que seja um sistema de pedidos para um restaurante. Não sei nada de programação, só quero que funcione.

Vão usar os clientes e o gerente do restaurante. Os clientes precisam poder ver o cardápio, fazer um pedido e acompanhar os pedidos que já fizeram. O gerente do restaurante precisa poder cadastrar, editar e remover pratos do cardápio, mudar a situação dos pedidos e ver todos os pedidos de todos os clientes.

Cada pessoa entra com a sua conta. Tudo precisa ficar salvo, mesmo se eu fechar e abrir o site de novo. Quero que funcione de verdade na internet. Não quero ligar com outros serviços, quero tudo dentro do próprio site.""",

    "despesas_pessoais": """Crie um site que seja um controle de despesas pessoais. Não sei nada de programação, só quero que funcione.

Vão usar as pessoas que controlam seus gastos e o administrador do sistema. As pessoas que controlam seus gastos precisam poder registrar seus gastos, organizar os gastos por categoria e ver quanto gastaram no mês. O administrador do sistema precisa poder cadastrar as categorias de gasto disponíveis, desativar contas de usuários e ver o total de gastos de todos os usuários.

Cada pessoa entra com a sua conta. Tudo precisa ficar salvo, mesmo se eu fechar e abrir o site de novo. Quero que funcione de verdade na internet. Não quero ligar com outros serviços, quero tudo dentro do próprio site.""",

    "agendamento_servicos": """Crie um site que seja um sistema de agendamento de serviços. Não sei nada de programação, só quero que funcione.

Vão usar os clientes e o responsável pelo negócio. Os clientes precisam poder ver os serviços e os horários livres, marcar um horário e ver ou cancelar os horários que marcaram. O responsável pelo negócio precisa poder cadastrar e editar os serviços e os horários disponíveis, confirmar ou recusar agendamentos e ver todos os agendamentos de todos os clientes.

Cada pessoa entra com a sua conta. Tudo precisa ficar salvo, mesmo se eu fechar e abrir o site de novo. Quero que funcione de verdade na internet. Não quero ligar com outros serviços, quero tudo dentro do próprio site.""",

    "cursos_online": """Crie um site que seja uma plataforma de cursos online com matrícula. Não sei nada de programação, só quero que funcione.

Vão usar os alunos e o administrador da plataforma. Os alunos precisam poder ver os cursos disponíveis, se matricular em um curso e ver os cursos em que estão matriculados. O administrador da plataforma precisa poder cadastrar, editar e remover cursos, cancelar matrículas e ver todas as matrículas de todos os alunos.

Cada pessoa entra com a sua conta. Tudo precisa ficar salvo, mesmo se eu fechar e abrir o site de novo. Quero que funcione de verdade na internet. Não quero ligar com outros serviços, quero tudo dentro do próprio site.""",

    "reservas_hotel": """Crie um site que seja um sistema de reservas de hotel. Não sei nada de programação, só quero que funcione.

Vão usar os hóspedes e o gerente do hotel. Os hóspedes precisam poder ver os quartos disponíveis nas datas que escolherem, reservar um quarto e ver ou cancelar as reservas que fizeram. O gerente do hotel precisa poder cadastrar, editar e remover quartos, confirmar ou recusar reservas e ver todas as reservas de todos os hóspedes.

Cada pessoa entra com a sua conta. Tudo precisa ficar salvo, mesmo se eu fechar e abrir o site de novo. Quero que funcione de verdade na internet. Não quero ligar com outros serviços, quero tudo dentro do próprio site.""",

    "biblioteca_digital": """Crie um site que seja uma biblioteca digital com empréstimo de itens. Não sei nada de programação, só quero que funcione.

Vão usar os leitores e o bibliotecário. Os leitores precisam poder buscar e ver os itens do acervo, pegar um item emprestado e devolver os itens que pegaram. O bibliotecário precisa poder cadastrar, editar e remover itens do acervo, bloquear novos empréstimos de leitores com atraso e ver o histórico de empréstimos de todos os leitores.

Cada pessoa entra com a sua conta. Tudo precisa ficar salvo, mesmo se eu fechar e abrir o site de novo. Quero que funcione de verdade na internet. Não quero ligar com outros serviços, quero tudo dentro do próprio site.""",

    "marketplace_freelance": """Crie um site que seja um marketplace de serviços freelance. Não sei nada de programação, só quero que funcione.

Vão usar as pessoas que oferecem ou contratam serviços e o administrador da plataforma. As pessoas que oferecem ou contratam serviços precisam poder publicar um serviço que oferecem, contratar o serviço de outra pessoa e ver os contratos de que participam. O administrador da plataforma precisa poder aprovar ou remover serviços publicados, suspender contas de usuários e ver todos os serviços e contratos de todos os usuários.

Cada pessoa entra com a sua conta. Tudo precisa ficar salvo, mesmo se eu fechar e abrir o site de novo. Quero que funcione de verdade na internet. Não quero ligar com outros serviços, quero tudo dentro do próprio site.""",

    "inscricao_eventos": """Crie um site que seja um portal de inscrição para eventos. Não sei nada de programação, só quero que funcione.

Vão usar os participantes e o organizador. Os participantes precisam poder ver os eventos disponíveis, se inscrever em um evento e ver ou cancelar as inscrições que fizeram. O organizador precisa poder criar, editar e cancelar eventos, confirmar a presença dos inscritos e ver todas as inscrições de todos os participantes.

Cada pessoa entra com a sua conta. Tudo precisa ficar salvo, mesmo se eu fechar e abrir o site de novo. Quero que funcione de verdade na internet. Não quero ligar com outros serviços, quero tudo dentro do próprio site.""",

    "tarefas_equipe": """Crie um site que seja um sistema de gestão de tarefas de equipe. Não sei nada de programação, só quero que funcione.

Vão usar os membros da equipe e o gerente da equipe. Os membros da equipe precisam poder ver as tarefas que receberam, mudar a situação das suas tarefas e criar tarefas para si mesmos. O gerente da equipe precisa poder criar e distribuir tarefas para os membros, editar e remover tarefas e ver todas as tarefas de todos os membros.

Cada pessoa entra com a sua conta. Tudo precisa ficar salvo, mesmo se eu fechar e abrir o site de novo. Quero que funcione de verdade na internet. Não quero ligar com outros serviços, quero tudo dentro do próprio site.""",
}

# ---------------------------------------------------------------------------
# Utilitários
# ---------------------------------------------------------------------------

CAMPOS_CSV = [
    "data_hora_utc", "modelo", "modelo_id", "provedor", "dominio", "rodada",
    "gratuito",
    "tokens_entrada", "tokens_saida", "tokens_raciocinio", "tokens_total",
    "custo_usd", "motivo_termino", "tentativas_api", "duracao_s",
    "duracao_api_s", "tokens_por_s", "n_arquivos", "tem_readme", "cercas_removidas", "estado", "pasta", "erro",
]

MARCADOR_ARQUIVO = re.compile(r"^===\s*(.+?)\s*===\s*$", re.MULTILINE)
CODIGOS_RECUPERAVEIS = {408, 429, 500, 502, 503, 504, "conexao"}


class ErroAPI(Exception):
    pass


def formatar_tempo(segundos):
    """Formata segundos como mm:ss (ou h:mm:ss a partir de uma hora)."""
    segundos = int(round(segundos))
    horas, resto = divmod(segundos, 3600)
    minutos, seg = divmod(resto, 60)
    if horas:
        return f"{horas}:{minutos:02d}:{seg:02d}"
    return f"{minutos:02d}:{seg:02d}"


class Relogio:
    """Cronômetro que mostra o tempo decorrido enquanto a API não responde.

    Em terminal atualiza a mesma linha a cada segundo. Se a saída estiver
    redirecionada para arquivo, imprime uma linha a cada 30 segundos.
    Depois do bloco `with`, o atributo `duracao` guarda o tempo total.
    """

    def __init__(self, rotulo, intervalo=1.0, intervalo_sem_terminal=30.0):
        self.rotulo = rotulo
        self.tty = sys.stdout.isatty()
        self.intervalo = intervalo if self.tty else intervalo_sem_terminal
        self.duracao = 0.0

    def _rodar(self):
        while not self._parar.wait(self.intervalo):
            decorrido = formatar_tempo(time.monotonic() - self._t0)
            if self.tty:
                print(f"\r  {self.rotulo}: {decorrido}", end="", flush=True)
            else:
                print(f"  {self.rotulo}: {decorrido}", flush=True)

    def __enter__(self):
        self._t0 = time.monotonic()
        self._parar = threading.Event()
        self._thread = threading.Thread(target=self._rodar, daemon=True)
        self._thread.start()
        return self

    def __exit__(self, *_):
        self._parar.set()
        self._thread.join()
        self.duracao = time.monotonic() - self._t0
        if self.tty:
            print("\r" + " " * 79 + "\r", end="", flush=True)
        return False


def _chave_api():
    load_dotenv()
    chave = os.getenv("OPENROUTER_API_KEY")
    if not chave:
        raise RuntimeError(
            "Defina a variável de ambiente OPENROUTER_API_KEY antes de executar."
        )
    return chave


def _chamar_api(corpo):
    """Faz a chamada com tentativas para 429/5xx.
    Devolve (dados, tentativas, duração em segundos da tentativa que deu certo)."""
    cabecalhos = {
        "Authorization": f"Bearer {_chave_api()}",
        "Content-Type": "application/json",
    }
    ultimo_erro = "sem resposta"

    for tentativa in range(1, MAX_TENTATIVAS + 1):
        espera_servidor = None
        try:
            with Relogio(f"Aguardando resposta (tentativa {tentativa}/{MAX_TENTATIVAS})") as relogio:
                resp = requests.post(
                    URL_CHAT,
                    headers=cabecalhos,
                    json=corpo,
                    timeout=(TIMEOUT_CONEXAO, TIMEOUT_LEITURA),
                )
        except requests.ReadTimeout as e:
            # A geração pode ter sido processada (e cobrada): não repetir.
            raise ErroAPI(f"Tempo de leitura esgotado após "
                          f"{formatar_tempo(TIMEOUT_LEITURA)}, sem repetir a chamada: {e}")
        except requests.ConnectionError as e:
            codigo, ultimo_erro = "conexao", str(e)
        else:
            try:
                dados = resp.json()
            except ValueError:
                dados = {"error": {"code": resp.status_code, "message": resp.text[:500]}}

            erro = dados.get("error")
            if resp.ok and not erro and dados.get("choices"):
                return dados, tentativa, relogio.duracao

            codigo = (erro or {}).get("code", resp.status_code)
            ultimo_erro = json.dumps(erro or dados, ensure_ascii=False)[:800]
            espera_servidor = resp.headers.get("Retry-After")

        if codigo not in CODIGOS_RECUPERAVEIS:
            raise ErroAPI(f"Erro não recuperável ({codigo}): {ultimo_erro}")

        if tentativa == MAX_TENTATIVAS:
            break
        try:
            espera = float(espera_servidor) if espera_servidor else min(2 ** tentativa, 60)
        except ValueError:
            espera = min(2 ** tentativa, 60)
        espera += random.uniform(0, 2)
        print(f"  [tentativa {tentativa}/{MAX_TENTATIVAS}] erro {codigo}; "
              f"nova tentativa em {espera:.0f}s")
        time.sleep(espera)

    raise ErroAPI(f"Tentativas esgotadas. Último erro: {ultimo_erro}")


def _buscar_custo(id_geracao):
    """Plano B: consulta o custo da geração caso o usage não traga o campo cost."""
    if not id_geracao:
        return None
    for _ in range(3):
        time.sleep(2)
        try:
            r = requests.get(
                URL_GERACAO,
                params={"id": id_geracao},
                headers={"Authorization": f"Bearer {_chave_api()}"},
                timeout=30,
            )
            if r.ok:
                custo = (r.json().get("data") or {}).get("total_cost")
                if custo is not None:
                    return custo
        except requests.RequestException:
            pass
    return None


def _remover_cerca(conteudo):
    """Remove uma cerca de código que envolva o arquivo inteiro. Devolve (texto, removida)."""
    linhas = conteudo.split("\n")
    if (len(linhas) >= 2 and linhas[0].lstrip().startswith("```")
            and linhas[-1].strip() == "```"):
        return "\n".join(linhas[1:-1]), True
    return conteudo, False


def extrair_arquivos(texto):
    """Separa a resposta em arquivos pelas linhas '=== caminho ==='.
    Devolve (dict caminho->conteúdo, quantidade de cercas removidas)."""
    marcas = list(MARCADOR_ARQUIVO.finditer(texto))
    arquivos, cercas = {}, 0
    for i, m in enumerate(marcas):
        fim = marcas[i + 1].start() if i + 1 < len(marcas) else len(texto)
        bruto = texto[m.end():fim].strip("\n")
        conteudo, removida = _remover_cerca(bruto)
        cercas += int(removida)
        arquivos[m.group(1).strip().strip("`")] = conteudo
    return arquivos, cercas


def _gravar_arquivos(arquivos, pasta_projeto):
    """Grava os arquivos recusando caminhos que saiam da pasta do projeto."""
    base = pasta_projeto.resolve()
    gravados, recusados = [], []
    for caminho, conteudo in arquivos.items():
        relativo = caminho.replace("\\", "/").lstrip("/")
        destino = (base / relativo).resolve()
        if destino == base or base not in destino.parents:
            recusados.append(caminho)
            continue
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(conteudo + "\n", encoding="utf-8")
        gravados.append(relativo)
    return gravados, recusados


def _acrescentar_csv(linha):
    PASTA_SAIDA.mkdir(parents=True, exist_ok=True)
    arquivo = PASTA_SAIDA / "registro.csv"
    if arquivo.exists():
        with arquivo.open(newline="", encoding="utf-8") as f:
            leitor = csv.DictReader(f)
            colunas_antigas = leitor.fieldnames or []
            linhas_antigas = list(leitor)
        if colunas_antigas != CAMPOS_CSV:
            if set(colunas_antigas) <= set(CAMPOS_CSV):
                # Colunas novas foram acrescentadas: reescreve com o cabeçalho
                # atual, deixando vazias as colunas que não existiam antes.
                with arquivo.open("w", newline="", encoding="utf-8") as f:
                    escritor = csv.DictWriter(f, fieldnames=CAMPOS_CSV)
                    escritor.writeheader()
                    for antiga in linhas_antigas:
                        escritor.writerow({c: antiga.get(c, "") for c in CAMPOS_CSV})
            else:
                # Formato incompatível: guarda o arquivo antigo à parte.
                arquivo.rename(PASTA_SAIDA /
                               f"registro_anterior_{datetime.now():%Y%m%d-%H%M%S}.csv")
    novo = not arquivo.exists()
    with arquivo.open("a", newline="", encoding="utf-8") as f:
        escritor = csv.DictWriter(f, fieldnames=CAMPOS_CSV)
        if novo:
            escritor.writeheader()
        escritor.writerow({c: linha.get(c, "") for c in CAMPOS_CSV})


# ---------------------------------------------------------------------------
# Função principal
# ---------------------------------------------------------------------------

def gerar_aplicacao(modelo, dominio):
    """Gera a aplicação de um domínio com um modelo e registra tokens e custo.

    modelo:  chave de MODELOS  (ex.: "qwen")
    dominio: chave de DOMINIOS (ex.: "loja_departamentos")
    Retorna o dicionário de registro da geração.
    """
    if modelo not in MODELOS:
        raise KeyError(f"Modelo '{modelo}' não existe. Opções: {list(MODELOS)}")
    if dominio not in DOMINIOS:
        raise KeyError(f"Domínio '{dominio}' não existe. Opções: {list(DOMINIOS)}")

    modelo_id = MODELOS[modelo]
    gratuito = modelo_id.endswith(":free")
    if gratuito:
        print("AVISO: modelo gratuito (:free). Use apenas para depurar o pipeline, "
              "nunca para os dados da pesquisa.")

    reasoning = REASONING_POR_MODELO.get(modelo, REASONING_PADRAO)
    corpo = {
        "model": modelo_id,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": DOMINIOS[dominio]},
        ],
        "max_tokens": MAX_TOKENS,
        "reasoning": reasoning,
    }

    inicio = datetime.now(timezone.utc)
    pasta = PASTA_SAIDA / modelo / dominio / inicio.strftime("%Y%m%d-%H%M%S")
    pasta.mkdir(parents=True, exist_ok=True)

    registro = {
        "data_hora_utc": inicio.isoformat(timespec="seconds"),
        "modelo": modelo,
        "modelo_id": modelo_id,
        "dominio": dominio,
        "rodada": 0,
        "gratuito": gratuito,
        "parametros": {"max_tokens": MAX_TOKENS, "reasoning": reasoning},
        "pasta": str(pasta),
        "prompt_sistema": SYSTEM_PROMPT,
        "prompt_usuario": DOMINIOS[dominio],
    }

    t0 = time.monotonic()
    print(f"[{datetime.now():%H:%M:%S}] Gerando '{dominio}' com '{modelo}' ({modelo_id})...")
    try:
        dados, tentativas, duracao_api = _chamar_api(corpo)
    except ErroAPI as e:
        total = time.monotonic() - t0
        registro.update(estado="erro_api", erro=str(e), duracao_s=round(total, 1))
        (pasta / "registro.json").write_text(
            json.dumps(registro, ensure_ascii=False, indent=2), encoding="utf-8")
        _acrescentar_csv(registro)
        print(f"FALHA após {formatar_tempo(total)}: {e}")
        return registro
    duracao = round(time.monotonic() - t0, 1)

    escolha = dados["choices"][0]
    texto = (escolha.get("message") or {}).get("content") or ""
    uso = dados.get("usage") or {}
    detalhes = uso.get("completion_tokens_details") or {}
    custo = uso.get("cost")
    if custo is None:
        custo = _buscar_custo(dados.get("id"))

    # Vazão = tokens gerados / tempo da chamada que deu certo. Como a chamada não
    # usa streaming, o tempo inclui a espera até o primeiro token; por isso o valor
    # tende a ficar abaixo da velocidade real de geração do provedor.
    tokens_saida = uso.get("completion_tokens")
    tokens_por_s = (round(tokens_saida / duracao_api, 1)
                    if tokens_saida and duracao_api > 0 else None)

    arquivos, cercas = extrair_arquivos(texto)
    gravados, recusados = _gravar_arquivos(arquivos, pasta / "projeto")
    tem_readme = any(Path(c).name.lower() == "readme.md" for c in gravados)

    motivo = escolha.get("finish_reason")
    if motivo == "length":
        estado = "truncada"
    elif not gravados:
        estado = "sem_arquivos"
    else:
        estado = "gerada"

    registro.update(
        provedor=dados.get("provider"),
        id_geracao=dados.get("id"),
        modelo_servido=dados.get("model"),
        tokens_entrada=uso.get("prompt_tokens"),
        tokens_saida=uso.get("completion_tokens"),
        tokens_raciocinio=detalhes.get("reasoning_tokens"),
        tokens_total=uso.get("total_tokens"),
        custo_usd=custo,
        motivo_termino=motivo,
        tentativas_api=tentativas,
        duracao_s=duracao,
        duracao_api_s=round(duracao_api, 1),
        tokens_por_s=tokens_por_s,
        n_arquivos=len(gravados),
        arquivos=gravados,
        caminhos_recusados=recusados,
        tem_readme=tem_readme,
        cercas_removidas=cercas,
        estado=estado,
        erro="",
    )

    (pasta / "resposta.txt").write_text(texto, encoding="utf-8")
    (pasta / "resposta_api.json").write_text(
        json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8")
    (pasta / "registro.json").write_text(
        json.dumps(registro, ensure_ascii=False, indent=2), encoding="utf-8")
    _acrescentar_csv(registro)

    print(f"[{datetime.now():%H:%M:%S}] Concluído em {formatar_tempo(duracao)} "
          f"(chamada à API: {formatar_tempo(duracao_api)}; vazão: "
          f"{tokens_por_s if tokens_por_s is not None else 'n/d'} tokens/s)")
    print(f"Estado: {estado} | arquivos: {len(gravados)} | "
          f"tokens (entrada/saída/raciocínio): {registro['tokens_entrada']}/"
          f"{registro['tokens_saida']}/{registro['tokens_raciocinio']} | "
          f"custo: US$ {custo} | provedor: {registro['provedor']}")
    if recusados:
        print(f"AVISO: caminhos recusados por saírem da pasta do projeto: {recusados}")
    if estado != "gerada":
        print("ATENÇÃO: confira resposta.txt, a geração não está completa.")
    return registro


# ---------------------------------------------------------------------------
# Rodadas de reparo
# ---------------------------------------------------------------------------

def _localizar_contexto(contexto):
    """Aceita o caminho do resposta.txt ou da pasta da rodada anterior."""
    caminho = Path(contexto)
    pasta = caminho.parent if caminho.is_file() else caminho
    if not (pasta / "resposta.txt").exists() or not (pasta / "registro.json").exists():
        raise FileNotFoundError(
            f"Não achei resposta.txt e registro.json em '{pasta}'. Passe o caminho "
            "do resposta.txt (ou da pasta) da geração ou do reparo anterior.")
    return pasta


def _dialogo_anterior(pasta, registro_anterior):
    """Reconstrói a conversa até a última resposta do modelo."""
    arquivo_dialogo = pasta / "dialogo.json"
    if arquivo_dialogo.exists():
        return json.loads(arquivo_dialogo.read_text(encoding="utf-8"))
    return [
        {"role": "system", "content": registro_anterior["prompt_sistema"]},
        {"role": "user", "content": registro_anterior["prompt_usuario"]},
        {"role": "assistant",
         "content": (pasta / "resposta.txt").read_text(encoding="utf-8")},
    ]


def corrigir_aplicacao(mensagem_erro, modelo, contexto):
    """Executa uma rodada de reparo, no mesmo diálogo da geração.

    mensagem_erro: texto do erro copiado do terminal, sem alterações. A função
                   monta a mensagem fixa do protocolo: "Deu esse erro: <erro>".
    modelo:        chave de MODELOS; precisa ser o mesmo modelo da geração.
    contexto:      caminho do resposta.txt (ou da pasta) da rodada anterior, seja
                   a geração original ou um reparo anterior.

    O projeto corrigido fica em <pasta da geração>/reparo_<n>/projeto: os
    arquivos da rodada anterior são copiados e os arquivos devolvidos pelo
    modelo os substituem. Retorna o registro da rodada, com o texto da
    resposta na chave "resposta".
    """
    if modelo not in MODELOS:
        raise KeyError(f"Modelo '{modelo}' não existe. Opções: {list(MODELOS)}")
    if not mensagem_erro or not mensagem_erro.strip():
        raise ValueError("Informe o texto do erro.")

    pasta_ant = _localizar_contexto(contexto)
    registro_ant = json.loads((pasta_ant / "registro.json").read_text(encoding="utf-8"))

    if registro_ant.get("modelo") != modelo:
        raise ValueError(
            f"O contexto foi gerado por '{registro_ant.get('modelo')}', não por "
            f"'{modelo}'. O reparo deve usar o mesmo modelo da geração.")
    if registro_ant.get("estado") == "erro_api":
        raise ValueError("A rodada indicada falhou na API e não tem resposta para corrigir.")

    rodada = int(registro_ant.get("rodada", 0)) + 1
    if rodada > MAX_RODADAS_REPARO:
        raise ValueError(
            f"Limite de {MAX_RODADAS_REPARO} rodadas de reparo atingido "
            "(protocolo). Registre a aplicação como não executável.")

    pasta_geracao = pasta_ant if rodada == 1 else pasta_ant.parent
    pasta = pasta_geracao / f"reparo_{rodada}"
    if pasta.exists():
        raise FileExistsError(
            f"'{pasta}' já existe. Para refazer esta rodada, apague ou renomeie a pasta.")

    modelo_id = MODELOS[modelo]
    if modelo_id != registro_ant.get("modelo_id"):
        print(f"AVISO: o ID do modelo mudou desde a geração "
              f"({registro_ant.get('modelo_id')} -> {modelo_id}).")

    parametros = registro_ant.get("parametros") or {
        "max_tokens": MAX_TOKENS,
        "reasoning": REASONING_POR_MODELO.get(modelo, REASONING_PADRAO),
    }
    mensagem = MENSAGEM_REPARO.format(erro=mensagem_erro.strip("\n"))
    dialogo = _dialogo_anterior(pasta_ant, registro_ant) + [
        {"role": "user", "content": mensagem}]
    corpo = {"model": modelo_id, "messages": list(dialogo), **parametros}

    pasta.mkdir(parents=True)
    inicio = datetime.now(timezone.utc)
    registro = {
        "data_hora_utc": inicio.isoformat(timespec="seconds"),
        "modelo": modelo,
        "modelo_id": modelo_id,
        "dominio": registro_ant.get("dominio"),
        "rodada": rodada,
        "gratuito": modelo_id.endswith(":free"),
        "parametros": parametros,
        "pasta": str(pasta),
        "pasta_geracao": str(pasta_geracao),
        "contexto": str(pasta_ant),
        "prompt_sistema": registro_ant.get("prompt_sistema"),
        "prompt_usuario": registro_ant.get("prompt_usuario"),
        "mensagem_reparo": mensagem,
    }

    t0 = time.monotonic()
    print(f"[{datetime.now():%H:%M:%S}] Reparo {rodada}/{MAX_RODADAS_REPARO} de "
          f"'{registro['dominio']}' com '{modelo}' ({modelo_id})...")
    try:
        dados, tentativas, duracao_api = _chamar_api(corpo)
    except ErroAPI as e:
        total = time.monotonic() - t0
        registro.update(estado="erro_api", erro=str(e), duracao_s=round(total, 1))
        (pasta / "registro.json").write_text(
            json.dumps(registro, ensure_ascii=False, indent=2), encoding="utf-8")
        _acrescentar_csv(registro)
        print(f"FALHA após {formatar_tempo(total)}: {e}")
        return registro
    duracao = round(time.monotonic() - t0, 1)

    escolha = dados["choices"][0]
    texto = (escolha.get("message") or {}).get("content") or ""
    uso = dados.get("usage") or {}
    detalhes = uso.get("completion_tokens_details") or {}
    custo = uso.get("cost")
    if custo is None:
        custo = _buscar_custo(dados.get("id"))
    tokens_saida = uso.get("completion_tokens")
    tokens_por_s = (round(tokens_saida / duracao_api, 1)
                    if tokens_saida and duracao_api > 0 else None)

    # Monta o projeto da rodada: arquivos anteriores + arquivos devolvidos agora.
    # Só são copiados os arquivos que vieram do modelo (nada de node_modules,
    # package-lock.json ou dados criados ao executar o projeto).
    projeto_ant = pasta_ant / "projeto"
    projeto = pasta / "projeto"
    projeto.mkdir()
    herdados = []
    for relativo in registro_ant.get("arquivos", []):
        origem = projeto_ant / relativo
        if origem.is_file():
            destino = projeto / relativo
            destino.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(origem, destino)
            herdados.append(relativo)

    arquivos, cercas = extrair_arquivos(texto)
    alterados, recusados = _gravar_arquivos(arquivos, projeto)
    todos = sorted(set(herdados) | set(alterados))
    tem_readme = any(Path(c).name.lower() == "readme.md" for c in todos)

    motivo = escolha.get("finish_reason")
    if motivo == "length":
        estado = "truncada"
    elif not alterados:
        estado = "sem_arquivos"
    else:
        estado = "gerada"

    registro.update(
        provedor=dados.get("provider"),
        id_geracao=dados.get("id"),
        modelo_servido=dados.get("model"),
        tokens_entrada=uso.get("prompt_tokens"),
        tokens_saida=tokens_saida,
        tokens_raciocinio=detalhes.get("reasoning_tokens"),
        tokens_total=uso.get("total_tokens"),
        custo_usd=custo,
        motivo_termino=motivo,
        tentativas_api=tentativas,
        duracao_s=duracao,
        duracao_api_s=round(duracao_api, 1),
        tokens_por_s=tokens_por_s,
        n_arquivos=len(todos),
        arquivos=todos,
        arquivos_alterados=alterados,
        arquivos_herdados=sorted(set(herdados) - set(alterados)),
        caminhos_recusados=recusados,
        tem_readme=tem_readme,
        cercas_removidas=cercas,
        estado=estado,
        erro="",
    )

    dialogo.append({"role": "assistant", "content": texto})
    (pasta / "dialogo.json").write_text(
        json.dumps(dialogo, ensure_ascii=False, indent=2), encoding="utf-8")
    (pasta / "resposta.txt").write_text(texto, encoding="utf-8")
    (pasta / "resposta_api.json").write_text(
        json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8")
    (pasta / "registro.json").write_text(
        json.dumps(registro, ensure_ascii=False, indent=2), encoding="utf-8")
    _acrescentar_csv(registro)

    print(f"[{datetime.now():%H:%M:%S}] Concluído em {formatar_tempo(duracao)} "
          f"(chamada à API: {formatar_tempo(duracao_api)}; vazão: "
          f"{tokens_por_s if tokens_por_s is not None else 'n/d'} tokens/s)")
    print(f"Estado: {estado} | arquivos alterados: {len(alterados)} "
          f"| herdados: {len(registro['arquivos_herdados'])} | tokens "
          f"(entrada/saída/raciocínio): {registro['tokens_entrada']}/"
          f"{tokens_saida}/{registro['tokens_raciocinio']} | custo: US$ {custo}")
    print(f"Projeto corrigido em: {projeto}")
    if recusados:
        print(f"AVISO: caminhos recusados por saírem da pasta do projeto: {recusados}")
    if estado != "gerada":
        print("ATENÇÃO: o modelo não devolveu arquivos; confira resposta.txt.")
    return {**registro, "resposta": texto}


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    MODELO = "deepseek"
    DOMINIO = "loja_departamentos"

    gerar_aplicacao(MODELO, DOMINIO)

    # Rodada de reparo: comente a linha gerar_aplicacao acima, cole o erro do
    # terminal sem alterações e aponte para o resposta.txt da rodada anterior
    # (a geração original ou o reparo anterior).
    #
    # ERRO = """
    # cole aqui o erro
    # """
    # corrigir_aplicacao(
    #     ERRO,
    #     MODELO,
    #     r"saidas\deepseek\loja_departamentos\20261006-165818\resposta.txt",
    # )
