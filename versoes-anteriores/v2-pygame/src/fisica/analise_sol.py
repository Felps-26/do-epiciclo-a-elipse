"""Grandezas do Sol relativas ao centro de massa dos nove corpos simulados.

O Sol nao tem elementos keplerianos heliocentricos: ele e o centro da
referencia heliocentrica. Seu movimento neste modelo vem da soma das
atracoes gravitacionais dos oito sistemas planetarios.
"""

import numpy as np


def analisar_sol(estado):
    """Devolve vetores 3D em UA, UA/dia e UA/dia² no instante atual."""
    gm = estado.gm
    centro = estado.centro_de_massa()
    velocidade_cm = estado.momento_linear() / np.sum(gm)
    separacoes = estado.pos[1:] - estado.pos[0]
    distancias = np.linalg.norm(separacoes, axis=1)
    parcelas = gm[1:, None] * separacoes / distancias[:, None] ** 3
    return {
        "posicao_relativa_ua": estado.pos[0] - centro,
        "velocidade_relativa_ua_d": estado.vel[0] - velocidade_cm,
        "aceleracao_ua_d2": np.sum(parcelas, axis=0),
        "parcelas_ua_d2": parcelas,
    }
