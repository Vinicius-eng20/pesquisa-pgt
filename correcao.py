from gerar_app import corrigir_aplicacao

# Rodada de reparo: comente a linha gerar_aplicacao acima, cole o erro do
# terminal sem alterações e aponte para o resposta.txt da rodada anterior
# (a geração original ou o reparo anterior).

MODELO = 'kimi'
ERRO = """
Só veio o README
"""

corrigir_aplicacao(
    ERRO,
    MODELO,
    r"saidas/kimi/despesas_pessoais/20261007-210647/resposta.txt",
)