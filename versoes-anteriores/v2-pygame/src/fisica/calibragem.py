"""
Mede a velocidade desta maquina para definir um teto honesto.

Nao ha numero magico que sirva para todo computador. Em vez de chutar, o
programa roda a integracao por uma fracao de segundo no inicio e usa o
resultado para decidir quanto de tempo simulado consegue entregar por segundo
sem engasgar a interface.
"""

import time

from src.fisica.integrador import PASSO_PADRAO_DIAS

# Fracao do quadro que a fisica pode ocupar. O resto fica para desenhar a tela.
FRACAO_CPU = 0.25
QUADROS_POR_SEGUNDO = 60.0


def medir_passos_por_segundo(estado, integrador, duracao_s: float = 0.12) -> float:
    """Roda o integrador num estado descartavel e mede passos por segundo."""
    pos, vel, gm = estado.pos.copy(), estado.vel.copy(), estado.gm
    dt = PASSO_PADRAO_DIAS

    for _ in range(5):                       # aquece caches do numpy
        pos, vel = integrador.passo(pos, vel, gm, dt)

    passos, t0 = 0, time.perf_counter()
    while time.perf_counter() - t0 < duracao_s:
        for _ in range(20):
            pos, vel = integrador.passo(pos, vel, gm, dt)
        passos += 20
    return passos / (time.perf_counter() - t0)


def passos_max_por_quadro(passos_por_segundo: float) -> int:
    """Quantos passos cabem num quadro usando so a fracao reservada de CPU."""
    return max(1, int(passos_por_segundo * FRACAO_CPU / QUADROS_POR_SEGUNDO))


def teto_dias_por_segundo(passos_por_segundo: float,
                          dt_dias: float = PASSO_PADRAO_DIAS) -> float:
    """Maior velocidade que esta maquina sustenta de verdade."""
    return passos_max_por_quadro(passos_por_segundo) * dt_dias * QUADROS_POR_SEGUNDO
