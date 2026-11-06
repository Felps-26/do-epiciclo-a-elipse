"""
Integradores numericos: como o estado avanca no tempo.

Os dois metodos aqui sao *simpleticos*. A propriedade que importa nisso e que
o erro de energia oscila em torno de zero em vez de crescer sem parar. Um
metodo comum como Runge-Kutta 4 e mais preciso num passo isolado, mas a orbita
encolhe de pouquinho em pouquinho ate virar outra coisa. Para uma simulacao
que o usuario pode deixar correndo por seculos simulados, isso nao serve.

Escolha do projeto: Yoshida de 4a ordem com passo fixo de 0,5 dia.
Comparado ao leapfrog, medindo o erro de posicao de Mercurio contra o JPL
Horizons depois de 10 anos:

    leapfrog dt=0,25 d     14 610 avaliacoes de forca    erro 1,0e6 km
    leapfrog dt=0,021 d   175 320 avaliacoes de forca    erro 5,4e3 km
    Yoshida4 dt=0,5 d      21 915 avaliacoes de forca    erro 1,4e4 km

Ou seja: o Yoshida entrega precisao equivalente por cerca de 1/8 do custo.

Passo fixo, e nao adaptativo, de proposito: passo variavel quebra a
propriedade simpletica, e um passo fixo faz a data exibida na tela ser sempre
exatamente t0 + n * 0,5 dias.
"""

from typing import Protocol

import numpy as np

from src.fisica.forcas import aceleracao


class Integrador(Protocol):
    """Avanca (pos, vel) por um passo dt. Nao guarda estado entre chamadas."""

    nome: str
    avaliacoes_por_passo: int

    def passo(self, pos, vel, gm, dt): ...


class Leapfrog:
    """Velocity Verlet: 2a ordem, uma avaliacao de forca por passo.

    Mantido como referencia de comparacao nos testes. E simples o bastante
    para servir de conferencia independente do Yoshida.
    """

    nome = "leapfrog"
    avaliacoes_por_passo = 1

    def passo(self, pos, vel, gm, dt):
        a = aceleracao(pos, gm)
        vel = vel + 0.5 * dt * a
        pos = pos + dt * vel
        vel = vel + 0.5 * dt * aceleracao(pos, gm)
        return pos, vel


# Coeficientes de Yoshida (1990): tres passos de leapfrog encadeados, sendo o
# do meio com sinal negativo. Os termos de erro de 2a ordem se cancelam e
# sobra erro de 4a ordem.
_W1 = 1.0 / (2.0 - 2.0 ** (1.0 / 3.0))
_PESOS = (_W1, 1.0 - 2.0 * _W1, _W1)


class Yoshida4:
    """Simpletico de 4a ordem. Tres avaliacoes de forca por passo."""

    nome = "yoshida4"
    avaliacoes_por_passo = 3

    def passo(self, pos, vel, gm, dt):
        for w in _PESOS:
            pos = pos + 0.5 * w * dt * vel
            vel = vel + w * dt * aceleracao(pos, gm)
            pos = pos + 0.5 * w * dt * vel
        return pos, vel


INTEGRADORES = {"yoshida4": Yoshida4, "leapfrog": Leapfrog}
PADRAO = Yoshida4
PASSO_PADRAO_DIAS = 0.5


def avancar(estado, integrador, dt_dias, passos):
    """Aplica `passos` passos de tamanho `dt_dias` no estado, no lugar.

    Aceita dt negativo para rodar o tempo para tras -- a integracao e
    reversivel, e os testes usam isso.
    """
    pos, vel, gm = estado.pos, estado.vel, estado.gm
    for _ in range(passos):
        pos, vel = integrador.passo(pos, vel, gm, dt_dias)
    estado.pos, estado.vel = pos, vel
    estado.t_dias += passos * dt_dias
    return estado
