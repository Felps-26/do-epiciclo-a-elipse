"""
Modos de exploracao: posicoes de camera com nome.

Um modo muda SO a camera e o que aparece escrito. Nao muda o relogio, nao
muda a fisica, nao muda a velocidade do tempo. Trocar de "Sistema completo"
para "Planetas internos" e o mesmo que chegar mais perto da mesma maquete: os
planetas continuam exatamente onde estavam.
"""

from dataclasses import dataclass

# Raios de enquadramento em UA. Sao um pouco maiores que o afelio do corpo mais
# externo de cada grupo, para a orbita nao encostar na borda.
RAIO_SISTEMA_UA = 31.5        # Netuno chega a 30,4 UA
RAIO_INTERNOS_UA = 1.75       # Marte chega a 1,67 UA
FOLGA_ACOMPANHAR = 1.25       # afelio do corpo x isto
RAIO_FOCO_SOL_UA = 1.0         # mostra o Sol e as orbitas mais proximas


@dataclass(frozen=True)
class Modo:
    chave: str
    rotulo: str
    explicacao: str
    precisa_de_alvo: bool = False


MODOS = (
    Modo("sistema", "Sistema completo",
         "Os oito planetas e o Sol. Os quatro primeiros ficam apertados no "
         "centro: é assim que as distâncias são de verdade."),
    Modo("internos", "Planetas internos",
         "Mercúrio, Vênus, Terra e Marte, de perto. Júpiter e os outros "
         "continuam se movendo fora da tela."),
    Modo("acompanhar", "Acompanhar planeta",
         "A câmera fica junto de um planeta e viaja com ele.",
         precisa_de_alvo=True),
)

MODOS_POR_CHAVE = {m.chave: m for m in MODOS}
MODO_INICIAL = "sistema"


def alvo_de_camera(chave_modo, estado=None, indice=None, afelio_ua=None):
    """Devolve (centro_ua, raio_ua) para o modo pedido.

    O centro nunca e a origem fixa: e a posicao ATUAL do Sol, que tambem se
    move. Assim a vista nao escorrega ao longo dos seculos.
    """
    centro_sol = estado.pos[0][:2] if estado is not None else (0.0, 0.0)

    if chave_modo == "internos":
        return centro_sol, RAIO_INTERNOS_UA
    if chave_modo == "acompanhar" and indice is not None:
        raio = (RAIO_FOCO_SOL_UA if indice == 0 else
                (afelio_ua or 1.0) * FOLGA_ACOMPANHAR)
        return estado.pos[indice][:2], raio
    return centro_sol, RAIO_SISTEMA_UA
