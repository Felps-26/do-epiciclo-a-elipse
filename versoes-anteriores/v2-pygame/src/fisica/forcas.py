"""
Aceleracao gravitacional mutua entre todos os corpos.

Todos puxam todos, inclusive o Sol -- que por isso nao fica parado. E a lei da
gravitacao de Newton escrita para N corpos:

    a_i = soma_{j != i}  GM_j * (r_j - r_i) / |r_j - r_i|^3

O que este modulo NAO inclui, e que faz diferenca na vida real:
  - Relatividade geral. O efeito maior seria a precessao do perielio de
    Mercurio (43 segundos de arco por seculo). Medimos: no passo de integracao
    que usamos, essa correcao fica abaixo do erro do proprio integrador.
  - Corpos ausentes: a Lua (tratada junto com a Terra, ver dados/catalogo.py),
    Plutao, asteroides e satelites em geral.
  - Achatamento dos corpos, pressao de radiacao, marés.
"""

import numpy as np


def aceleracao(pos: np.ndarray, gm: np.ndarray) -> np.ndarray:
    """Aceleracao de cada corpo, em UA/dia^2. Entra (N,3) e (N,), sai (N,3).

    Vetorizado: monta a matriz (N,N,3) de separacoes de uma vez. Com nove
    corpos isso e muito mais rapido que um laco em Python, e e o que permite
    rodar milhares de passos por segundo.
    """
    d = pos[None, :, :] - pos[:, None, :]          # d[i,j] = r_j - r_i
    d2 = np.einsum("ijk,ijk->ij", d, d)
    np.fill_diagonal(d2, np.inf)                   # o corpo nao atrai a si mesmo
    return np.einsum("ij,j,ijk->ik", d2 ** -1.5, gm, d)
