from gerar_app import corrigir_aplicacao, continuar_aplicacao, reenviar_pedido

action = "corrigir"
MODELO = 'qwen'
CONTEXTO = r"saidas_vibe_coding\qwen\agendamento_servicos\20261026-111649\resposta.txt"

if action == 'corrigir':
    ERRO = r""" npm notice run agenda-servicos@1.0.0 start
npm notice run node server.js
Servidor rodando em http://localhost:3000
<anonymous_script>:0


[Error: SQLITE_ERROR: near "REFERENCES": syntax error
Emitted 'error' event on Statement instance at:
] {
  errno: 1,
  code: 'SQLITE_ERROR'
}

Node.js v24.21.0
    """

    corrigir_aplicacao(
        ERRO,
        MODELO,
        CONTEXTO,
    )
elif action == 'continuar':
    continuar_aplicacao(
        MODELO,
        CONTEXTO
    )
elif action == 'reenviar':
    reenviar_pedido(
        MODELO,
        CONTEXTO
    )