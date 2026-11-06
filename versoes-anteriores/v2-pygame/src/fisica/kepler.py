"""
Elipse de Kepler: o problema de dois corpos resolvido de forma analítica.

Usado só pelo laboratório. A visão geral do Sistema Solar não passa por aqui:
lá as posições saem da integração numérica de nove corpos, em src/fisica/.

O cálculo tem três passos:

    1. anomalia média      M = 2π·t          (cresce linear no tempo)
    2. equação de Kepler   M = E − e·sen(E)  (resolvida por Newton-Raphson)
    3. geometria           posição (x, y) na elipse

O passo 2 não tem solução algébrica. Para as excentricidades dos planetas
(todas abaixo de 0,21) o método de Newton converge em umas quatro iterações.

Este módulo veio de src/core/orbital_engine.py da versão anterior, com uma
diferença: os elementos não vêm mais de uma tabela fixa, e sim do estado da
simulação no instante em que o laboratório é aberto.
"""

import numpy as np

PONTOS_ORBITA = 720


class OrbitaKepler:
    """Elipse com o corpo central em um dos focos."""

    def __init__(self, a, e, periodo_dias=None, nome=""):
        self.a = float(a)               # semieixo maior [UA]
        self.e = float(e)               # excentricidade
        self.periodo_dias = periodo_dias
        self.nome = nome

    # -- equação de Kepler -------------------------------------------------

    def _kepler(self, M, tol=1e-12, max_iter=50):
        """Resolve E − e·sen(E) = M por Newton-Raphson.

        Derivada: f'(E) = 1 − e·cos(E). Aceita escalar ou array.
        """
        M = np.asarray(M, dtype=float)
        E = M.copy()
        for _ in range(max_iter):
            f = E - self.e * np.sin(E) - M
            df = 1.0 - self.e * np.cos(E)
            passo = -f / df
            E = E + passo
            if np.max(np.abs(passo)) < tol:
                break
        return E

    def posicao(self, t):
        """Posição (x, y) em UA no instante t.

        t é a fração da órbita: 0 no periélio, 0,5 no afélio, 1 na volta
        completa.
        """
        M = 2.0 * np.pi * np.asarray(t, dtype=float)
        E = self._kepler(M)
        r = self.a * (1.0 - self.e * np.cos(E))
        theta = 2.0 * np.arctan2(
            np.sqrt(1.0 + self.e) * np.sin(E / 2.0),
            np.sqrt(1.0 - self.e) * np.cos(E / 2.0),
        )
        return r * np.cos(theta), r * np.sin(theta)

    def curva(self, n=PONTOS_ORBITA):
        """Órbita completa com n pontos igualmente espaçados NO TEMPO.

        O espaçamento temporal, e não angular, é o que faz a 2ª lei de Kepler
        aparecer sozinha no desenho: os pontos ficam juntos perto do Sol, onde
        o planeta corre, e espalhados longe dele, onde ele se arrasta.
        """
        t = np.linspace(0.0, 1.0, n, endpoint=False)
        x, y = self.posicao(t)
        return np.column_stack([x, y])

    @property
    def r_perielio(self):
        return self.a * (1.0 - self.e)

    @property
    def r_afelio(self):
        return self.a * (1.0 + self.e)

    @classmethod
    def de_elementos(cls, elementos, nome=""):
        """Constrói a partir do dicionário de src.fisica.efemerides."""
        return cls(elementos["a"], elementos["e"],
                   elementos.get("periodo_dias"), nome)
