from gerar_app import corrigir_aplicacao, continuar_aplicacao, reenviar_pedido

action = "reenviar"
MODELO = 'qwen'
CONTEXTO = r"saidas\qwen\agendamento_servicos\20261008-002233\resposta.txt"

if action == 'corrigir':
    ERRO = """
    Erro
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