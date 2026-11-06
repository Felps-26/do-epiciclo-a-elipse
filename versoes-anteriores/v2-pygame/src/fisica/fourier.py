"""
Decomposição de uma órbita em série de Fourier.

A curva fechada x(t), y(t) é reescrita como soma de senos e cossenos:

    x(t) = a₀/2 + Σ [aₙ·cos(2πnt) + bₙ·sen(2πnt)]

Os coeficientes são calculados uma vez só, até TERMOS_MAX. Mostrar mais ou
menos harmônicos é apenas truncar a soma — não recalcula nada, e por isso o
controle na tela responde na hora.

Migrado de src/core/orbital_engine.py sem mudança de matemática.
"""

import numpy as np

TERMOS_MAX = 24
TERMOS_INICIAL = 3
PISO_RESIDUO_UA = 1e-12       # abaixo disto é ruído do float64, não erro


class SerieFourier:
    def __init__(self, curva, termos_max=TERMOS_MAX):
        self.curva = curva
        self.termos_max = termos_max

        n_amostras = len(curva)
        t = np.linspace(0.0, 1.0, n_amostras, endpoint=False)
        x, y = curva[:, 0], curva[:, 1]

        n = np.arange(termos_max + 1)[:, None]
        fase = 2.0 * np.pi * n * t[None, :]
        cos, sin = np.cos(fase), np.sin(fase)

        # Integrais de projeção, aproximadas por soma sobre amostras
        # igualmente espaçadas em t.
        self.ax = (2.0 / n_amostras) * (cos @ x)
        self.bx = (2.0 / n_amostras) * (sin @ x)
        self.ay = (2.0 / n_amostras) * (cos @ y)
        self.by = (2.0 / n_amostras) * (sin @ y)

    def posicao(self, t, termos):
        termos = int(np.clip(termos, 0, self.termos_max))
        t = np.asarray(t, dtype=float)
        x = np.full_like(t, self.ax[0] / 2.0)
        y = np.full_like(t, self.ay[0] / 2.0)
        for n in range(1, termos + 1):
            fase = 2.0 * np.pi * n * t
            c, s = np.cos(fase), np.sin(fase)
            x = x + self.ax[n] * c + self.bx[n] * s
            y = y + self.ay[n] * c + self.by[n] * s
        return x, y

    def curva_reconstruida(self, termos, n=None):
        n = n or len(self.curva)
        t = np.linspace(0.0, 1.0, n, endpoint=False)
        x, y = self.posicao(t, termos)
        return np.column_stack([x, y])

    def erro(self, termos):
        """(erro médio, erro máximo) em UA, ponto a ponto contra a elipse."""
        aprox = self.curva_reconstruida(termos, n=len(self.curva))
        d = np.linalg.norm(self.curva - aprox, axis=1)
        return float(d.mean()), float(d.max())

    def convergencia(self, n_max=None):
        """Erro para cada quantidade de harmônicos, de 1 até n_max."""
        n_max = n_max or self.termos_max
        ns = np.arange(1, n_max + 1)
        med = np.empty(n_max)
        mx = np.empty(n_max)
        for i, n in enumerate(ns):
            med[i], mx[i] = self.erro(int(n))
        return ns, med, mx

    def harmonicos_ate_o_piso(self, piso=PISO_RESIDUO_UA):
        """Quantos harmônicos bastam para o erro sumir no ruído do float64."""
        _, med, _ = self.convergencia()
        abaixo = np.flatnonzero(med <= piso)
        return int(abaixo[0]) + 1 if len(abaixo) else None
