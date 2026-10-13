from gerar_app import gerar_aplicacao
from time import sleep
# Modelos: qwen, kimi, claude_sonnet, gpt5, gemini_flash, deepseek
# Domínios:
#   - loja_departamentos, restaurante_pedidos, despesas_pessoais
#   - agendamento_serviços, cursos_online, reservas_hotel, biblioteca_digital
#   - marketplace_freelance, inscricao_eventos, tarefas_equipe

MODELO = "gpt5"

DOMINIOS = ['loja_departamentos', 'despesas_pessoais', 'restaurante_pedidos', 'agendamento_servicos', 'cursos_online', 'reservas_hotel', 'biblioteca_digital', 'marketplace_freelance', 'inscricao_eventos', 'tarefas_equipe']

for dominio in DOMINIOS:
    print(f'\nDomínio: {dominio}')
    gerar_aplicacao(MODELO, dominio)
    sleep(3)
    print('---')