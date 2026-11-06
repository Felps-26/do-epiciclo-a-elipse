"""
Rastro deixado por cada corpo: por onde ele passou de verdade.

A trilha e diferente da elipse osculadora. A elipse e "o caminho que ele
seguiria se so o Sol existisse"; a trilha e "o caminho que ele percorreu nesta
simulacao". Em escala humana as duas coincidem, e e bom que coincidam -- serve
de conferencia visual.

Guardada em 3D, como todo o resto, e por amostragem no tempo: um ponto a cada
tantos dias simulados. Amostrar por quadro seria errado, porque a trilha
mudaria de aparencia so por mudar a velocidade do tempo ou o FPS.
"""

import numpy as np


class Trilha:
    """Buffer circular de posicoes passadas de um corpo."""

    def __init__(self, capacidade=400, intervalo_dias=1.0):
        self.capacidade = int(capacidade)
        self.intervalo_dias = float(intervalo_dias)
        self._buf = np.zeros((self.capacidade, 3))
        self._n = 0                 # quantos pontos validos
        self._i = 0                 # proxima posicao a escrever
        self._t_ultimo = None

    def limpar(self):
        self._n = 0
        self._i = 0
        self._t_ultimo = None

    def registrar(self, pos_xyz, t_dias):
        """Guarda um ponto se ja passou tempo simulado suficiente."""
        if self._t_ultimo is not None and abs(t_dias - self._t_ultimo) < self.intervalo_dias:
            return False
        self._buf[self._i] = pos_xyz
        self._i = (self._i + 1) % self.capacidade
        self._n = min(self._n + 1, self.capacidade)
        self._t_ultimo = t_dias
        return True

    def pontos(self) -> np.ndarray:
        """(n,3) do mais antigo para o mais recente."""
        if self._n < self.capacidade:
            return self._buf[:self._n]
        return np.concatenate((self._buf[self._i:], self._buf[:self._i]))

    def __len__(self):
        return self._n


class ConjuntoTrilhas:
    """Uma trilha por corpo, com o intervalo de amostragem ajustado a orbita.

    Netuno leva 165 anos para dar uma volta e Mercurio, 88 dias. Um intervalo
    unico deixaria a trilha de Mercurio um borrao e a de Netuno um tracinho.
    O intervalo e uma fracao do periodo de cada corpo.
    """

    def __init__(self, periodos_dias, capacidade=400, fracao_da_orbita=0.0025):
        self.trilhas = [
            Trilha(capacidade, max(0.25, (p or 365.0) * fracao_da_orbita))
            for p in periodos_dias
        ]

    def registrar(self, pos, t_dias):
        for i, t in enumerate(self.trilhas):
            t.registrar(pos[i], t_dias)

    def limpar(self):
        for t in self.trilhas:
            t.limpar()

    def pontos(self, i) -> np.ndarray:
        return self.trilhas[i].pontos()

    def __len__(self):
        return len(self.trilhas)
