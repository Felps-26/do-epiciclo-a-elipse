"""
Uma frase sobre cada corpo, para a ficha que abre ao clicar.

São descrições, não dados: os números da ficha (distância, velocidade,
período) vêm sempre do estado da simulação, calculados na hora. O que está
aqui é só o contexto que ajuda a entender o que se está vendo.
"""

FICHAS = {
    "sol": {
        "frase": "Concentra 99,8% de toda a massa do Sistema Solar — é a "
                 "gravidade dele que segura todo o resto.",
        "curiosidade": "Mesmo assim ele não fica parado: Júpiter o balança o "
                       "suficiente para que os dois girem em torno de um ponto "
                       "fora da superfície solar.",
    },
    "mercurio": {
        "frase": "O mais próximo do Sol e o mais rápido: completa uma volta "
                 "em 88 dias.",
        "curiosidade": "A órbita dele é a mais alongada dos oito. A distância "
                       "até o Sol varia quase 50% entre o ponto mais próximo e "
                       "o mais distante.",
    },
    "venus": {
        "frase": "O planeta de órbita mais circular — a distância dele ao Sol "
                 "quase não muda ao longo do ano.",
        "curiosidade": "É o vizinho mais próximo da Terra e o objeto mais "
                       "brilhante do céu depois do Sol e da Lua.",
    },
    "terra": {
        "frase": "Leva 365 dias para dar uma volta — é essa volta que define "
                 "o nosso ano.",
        "curiosidade": "Nesta simulação o ponto marcado como Terra é o centro "
                       "de massa da Terra e da Lua juntas. Ele fica a uns "
                       "4.700 km do centro do planeta, o que nesta escala é "
                       "menos de um milésimo de pixel.",
    },
    "marte": {
        "frase": "Leva quase dois anos para dar uma volta no Sol.",
        "curiosidade": "A órbita é bem alongada: Marte chega a 1,38 UA do Sol "
                       "e se afasta até 1,67 UA, uma variação de 20%.",
    },
    "jupiter": {
        "frase": "O maior planeta: tem mais massa que todos os outros sete "
                 "somados.",
        "curiosidade": "É ele quem mais perturba as órbitas dos vizinhos e "
                       "quem faz o Sol balançar de forma perceptível.",
    },
    "saturno": {
        "frase": "Leva cerca de 29 anos para completar uma volta.",
        "curiosidade": "Os anéis não aparecem aqui: esta é uma vista de cima "
                       "do plano das órbitas, e cada corpo é desenhado como um "
                       "disco simples.",
    },
    "urano": {
        "frase": "Está 19 vezes mais longe do Sol que a Terra e leva 84 anos "
                 "para dar uma volta.",
        "curiosidade": "Foi o primeiro planeta descoberto com telescópio, em "
                       "1781 — os outros seis são visíveis a olho nu.",
    },
    "netuno": {
        "frase": "O mais distante dos oito: uma volta leva cerca de 165 anos.",
        "curiosidade": "Desde que foi descoberto, em 1846, ele completou "
                       "pouco mais de uma volta em torno do Sol.",
    },
}


def ficha(chave):
    return FICHAS.get(chave, {"frase": "", "curiosidade": ""})
