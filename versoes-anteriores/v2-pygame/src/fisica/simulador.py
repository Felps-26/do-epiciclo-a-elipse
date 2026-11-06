"""
Liga o relogio de parede ao relogio da simulacao, com honestidade.

O problema: o usuario pede "365 dias por segundo". A 60 quadros por segundo,
isso sao 6 dias por quadro, ou 12 passos de 0,5 dia. Tudo bem. Mas se ele
pedir 100 mil dias por segundo, nenhuma maquina da conta.

Ha tres jeitos errados de lidar com isso, e nenhum e usado aqui:

  1. Aumentar o passo de integracao para cobrir mais tempo. Isso degrada a
     fisica em silencio -- a orbita continua bonita e fica errada.
  2. Acumular a divida e tentar pagar depois. A simulacao trava tentando
     alcancar e a janela para de responder.
  3. Pular passos. A data na tela deixaria de corresponder ao estado fisico.

O que este modulo faz: entrega quantos passos couberem no orcamento,
DESCARTA o excedente e avisa (`atrasado=True`). A data mostrada e sempre
t0 + n * dt exatos, e a interface diz que a velocidade real esta abaixo da
pedida. Nada de errado acontece em silencio.
"""

import time
from dataclasses import dataclass

from src.fisica.integrador import PADRAO, PASSO_PADRAO_DIAS


@dataclass(frozen=True)
class RelatorioPasso:
    """O que aconteceu no ultimo avanco. A interface le isto para avisar."""

    passos: int
    dias_pedidos: float
    dias_dados: float
    atrasado: bool
    ms_gastos: float

    @property
    def fracao_entregue(self) -> float:
        if self.dias_pedidos <= 0:
            return 1.0
        return self.dias_dados / self.dias_pedidos


class Simulador:
    """Avanca o estado respeitando um orcamento de passos por quadro."""

    def __init__(self, estado, integrador=None, dt_dias=PASSO_PADRAO_DIAS,
                 passos_max_por_quadro=140):
        self.estado = estado
        self.integrador = integrador or PADRAO()
        self.dt_dias = float(dt_dias)
        self.passos_max_por_quadro = int(passos_max_por_quadro)
        self._residuo = 0.0          # fracao de passo que sobrou do quadro anterior

    @property
    def dias_por_segundo_maximo(self) -> float:
        """Teto que este orcamento sustenta a 60 quadros por segundo."""
        return self.passos_max_por_quadro * self.dt_dias * 60.0

    def reiniciar(self, estado):
        self.estado = estado
        self._residuo = 0.0

    def avancar(self, dt_real_s: float, dias_por_segundo: float) -> RelatorioPasso:
        """Avanca o tempo simulado correspondente a dt_real_s segundos reais."""
        pedidos = max(0.0, dt_real_s) * dias_por_segundo
        if pedidos <= 0.0:
            return RelatorioPasso(0, 0.0, 0.0, False, 0.0)

        # O residuo guarda a fracao de passo nao usada, para que velocidades
        # baixas (menos de um passo por quadro) ainda avancem suavemente.
        self._residuo += pedidos
        querido = int(self._residuo / self.dt_dias)
        passos = min(querido, self.passos_max_por_quadro)
        atrasado = passos < querido

        t0 = time.perf_counter()
        if passos:
            pos, vel = self.estado.pos, self.estado.vel
            gm = self.estado.gm
            for _ in range(passos):
                pos, vel = self.integrador.passo(pos, vel, gm, self.dt_dias)
            self.estado.pos, self.estado.vel = pos, vel
            self.estado.t_dias += passos * self.dt_dias
        ms = (time.perf_counter() - t0) * 1000.0

        if atrasado:
            self._residuo = 0.0       # descarta o excedente; nao acumula divida
        else:
            self._residuo -= passos * self.dt_dias

        return RelatorioPasso(passos, pedidos, passos * self.dt_dias, atrasado, ms)
