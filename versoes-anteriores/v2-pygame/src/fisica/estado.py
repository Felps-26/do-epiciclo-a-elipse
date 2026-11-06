"""
Estado fisico do sistema: quem esta onde, com que velocidade, em que instante.

Este modulo -- como todo o pacote src/fisica -- trabalha em tres dimensoes e
nao sabe o que e um pixel, uma cor ou uma janela. A interface mostra hoje uma
projecao 2D do plano da ecliptica, mas o estado guardado aqui e sempre (x,y,z).
Trocar a visualizacao por uma 3D nao exige mexer em nada deste arquivo.

Unidades, sem excecao:
    posicao      UA
    velocidade   UA/dia
    GM           UA^3/dia^2
    tempo        dias na escala TDB, contados a partir da epoca inicial
"""

from dataclasses import dataclass

import numpy as np


@dataclass
class EstadoSistema:
    """Posicao, velocidade e massa de N corpos num mesmo instante.

    O ponto principal e esse "mesmo instante": todos os corpos compartilham um
    unico relogio. Nao existe um tempo por planeta.
    """

    pos: np.ndarray      # (N,3) UA
    vel: np.ndarray      # (N,3) UA/dia
    gm: np.ndarray       # (N,)  UA^3/dia^2
    t_dias: float = 0.0  # dias TDB desde a epoca inicial

    def __post_init__(self):
        self.pos = np.asarray(self.pos, dtype=float).reshape(-1, 3)
        self.vel = np.asarray(self.vel, dtype=float).reshape(-1, 3)
        self.gm = np.asarray(self.gm, dtype=float).reshape(-1)
        if not (len(self.pos) == len(self.vel) == len(self.gm)):
            raise ValueError("pos, vel e gm precisam ter o mesmo numero de corpos")
        self.t_dias = float(self.t_dias)

    @property
    def n(self) -> int:
        return len(self.gm)

    def copia(self) -> "EstadoSistema":
        return EstadoSistema(self.pos.copy(), self.vel.copy(),
                             self.gm.copy(), self.t_dias)

    # -- grandezas por corpo ------------------------------------------------

    def raio(self, i: int, relativo_a: int = 0) -> float:
        """Distancia do corpo i ao corpo `relativo_a` (por padrao o Sol), em UA.

        Calculada em 3D. Nao e a distancia projetada que aparece na tela.
        """
        return float(np.linalg.norm(self.pos[i] - self.pos[relativo_a]))

    def velocidade_relativa(self, i: int, relativo_a: int = 0) -> float:
        """Velocidade do corpo i em relacao ao corpo `relativo_a`, em UA/dia."""
        return float(np.linalg.norm(self.vel[i] - self.vel[relativo_a]))

    # -- grandezas conservadas ---------------------------------------------

    def energia(self) -> float:
        """Energia total por unidade de constante gravitacional (UA^2/dia^2 * GM).

        Cinetica + potencial. Num sistema isolado e integrada por um metodo
        simpletico, isto deve oscilar em torno de um valor fixo sem escapar.
        """
        cinetica = 0.5 * float(np.sum(self.gm * np.sum(self.vel ** 2, axis=1)))
        d = self.pos[None, :, :] - self.pos[:, None, :]
        dist = np.sqrt(np.einsum("ijk,ijk->ij", d, d))
        np.fill_diagonal(dist, np.inf)
        potencial = -0.5 * float(np.sum(self.gm[:, None] * self.gm[None, :] / dist))
        return cinetica + potencial

    def momento_angular(self) -> np.ndarray:
        """Momento angular total (3,). Deve se conservar ainda melhor que a energia."""
        return np.sum(self.gm[:, None] * np.cross(self.pos, self.vel), axis=0)

    def momento_linear(self) -> np.ndarray:
        """Momento linear total (3,). Fica proximo de zero num estado baricentrico."""
        return np.sum(self.gm[:, None] * self.vel, axis=0)

    def centro_de_massa(self) -> np.ndarray:
        """Centro de massa dos corpos simulados (3,), em UA.

        Nao e exatamente a origem: a origem e o baricentro do Sistema Solar
        inteiro, que inclui corpos que esta simulacao nao carrega.
        """
        return np.sum(self.gm[:, None] * self.pos, axis=0) / np.sum(self.gm)
