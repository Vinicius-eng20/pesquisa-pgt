from gerar_app import gerar_aplicacao, corrigir_aplicacao

MODELO = "deepseek"
DOMINIO = "loja_departamentos"

gerar_aplicacao(MODELO, DOMINIO)

# Rodada de reparo: comente a linha gerar_aplicacao acima, cole o erro do
# terminal sem alterações e aponte para o resposta.txt da rodada anterior
# (a geração original ou o reparo anterior).

# ERRO = """
# cole aqui o erro
# """
# corrigir_aplicacao(
#     ERRO,
#     MODELO,
#     r"saidas\deepseek\loja_departamentos\20261006-165818\resposta.txt",
# )