"""Identidade fisica de um corpo: o que ele e, alem de onde ele esta.

Nao guarda cor nem nada de desenho -- isso mora em src/ui/tema.py, ligado pela
mesma `chave`. Assim o motor de fisica continua util para qualquer interface.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Corpo:
    """Dados que nao mudam enquanto a simulacao corre.

    `e_baricentro` marca os corpos que representam o baricentro de um sistema
    planetario, e nao o centro do planeta. Vale para os oito planetas aqui, e
    so importa de verdade para a Terra: o baricentro Terra-Lua fica a cerca de
    4670 km do centro do planeta.
    """

    chave: str
    nome: str
    gm: float              # UA^3/dia^2
    raio_km: float         # raio medio real; a tela desenha ampliado
    id_horizons: str       # corpo usado na integracao (baricentro do sistema)
    e_baricentro: bool

    @property
    def raio_ua(self) -> float:
        return self.raio_km / 149597870.7
