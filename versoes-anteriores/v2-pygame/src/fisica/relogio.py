"""
O relogio unico da simulacao.

Todos os corpos compartilham este relogio. Nao existe "tempo do Mercurio" e
"tempo do Netuno": existe uma data, e as posicoes de todos os nove corpos
naquela data. E por isso que Mercurio completa voltas mais rapido que Netuno
na tela -- nao porque a animacao dele seja mais rapida, mas porque a orbita
dele leva 88 dias e a de Netuno leva 60 mil.

A velocidade e expressa em DIAS SIMULADOS POR SEGUNDO REAL, que e uma unidade
que da para explicar a qualquer pessoa: "1 segundo aqui = 30 dias la".
"""

from dataclasses import dataclass, field
from datetime import date, timedelta

MESES = ("janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho",
         "agosto", "setembro", "outubro", "novembro", "dezembro")

# Escala de velocidades oferecida na interface, em dias simulados por segundo.
# O topo real e cortado pela calibragem da maquina, nao por esta lista.
VELOCIDADES = (1.0, 5.0, 30.0, 100.0, 365.0, 1825.0, 3650.0, 7300.0)
VELOCIDADE_INICIAL = 30.0


def rotulo_velocidade(dias_por_segundo: float) -> str:
    """Texto curto e honesto para a velocidade atual."""
    d = dias_por_segundo
    if d <= 0:
        return "pausado"
    if d < 2:
        return "1 dia por segundo"
    if d < 45:
        return f"{d:.0f} dias por segundo"
    if d < 300:
        meses = d / 30.44
        return f"{meses:.0f} {'mes' if meses < 1.5 else 'meses'} por segundo"
    anos = d / 365.25
    return f"{anos:.0f} {'ano' if anos < 1.5 else 'anos'} por segundo"


def texto_periodo(dias):
    """Periodo orbital em linguagem comum."""
    if dias != dias:
        return "—"
    if dias < 400:
        return f"cerca de {dias:.0f} dias"
    return f"cerca de {dias / 365.25:.0f} anos"


@dataclass
class Relogio:
    """Converte entre dias decorridos e data civil, e guarda a velocidade."""

    epoca: date
    t_dias: float = 0.0
    dias_por_segundo: float = VELOCIDADE_INICIAL
    pausado: bool = False
    teto_dias_por_segundo: float = field(default=float("inf"))

    @property
    def data(self) -> date:
        return self.epoca + timedelta(days=self.t_dias)

    def data_formatada(self) -> str:
        d = self.data
        return f"{d.day} de {MESES[d.month - 1]} de {d.year}"

    def data_curta(self) -> str:
        d = self.data
        return f"{d.day:02d}/{d.month:02d}/{d.year}"

    @property
    def anos_decorridos(self) -> float:
        return self.t_dias / 365.25

    def equivalencia(self) -> str:
        """A frase que fica na tela enquanto o tempo corre."""
        if self.pausado:
            return "pausado - o tempo nao esta correndo"
        return f"1 segundo = {rotulo_velocidade(self.dias_por_segundo)[:-len(' por segundo')]}"

    # -- controles ---------------------------------------------------------

    def velocidades_disponiveis(self):
        """Velocidades da escala que esta maquina consegue entregar de verdade."""
        v = [x for x in VELOCIDADES if x <= self.teto_dias_por_segundo]
        return tuple(v) if v else (VELOCIDADES[0],)

    def acelerar(self, passo: int = 1):
        disp = self.velocidades_disponiveis()
        try:
            i = disp.index(self.dias_por_segundo)
        except ValueError:
            i = min(range(len(disp)),
                    key=lambda k: abs(disp[k] - self.dias_por_segundo))
        self.dias_por_segundo = disp[max(0, min(len(disp) - 1, i + passo))]

    def no_maximo(self) -> bool:
        return self.dias_por_segundo >= self.velocidades_disponiveis()[-1]

    def no_minimo(self) -> bool:
        return self.dias_por_segundo <= self.velocidades_disponiveis()[0]
