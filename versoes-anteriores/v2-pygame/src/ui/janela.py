"""
A janela: criacao, redimensionamento e tela de alta densidade.

Tres detalhes do pygame que valem estar escritos, porque cada um ja custou
tempo de alguem:

1. `set_mode` devolve uma Surface NOVA a cada chamada, inclusive ao
   redimensionar. Guardar a superficie em qualquer outro lugar da um objeto
   morto depois do primeiro resize. Aqui so a Janela guarda, e quem desenha
   recebe por parametro.

2. Arrastar a borda no macOS dispara dezenas de eventos de redimensionamento
   por segundo. Recalcular o layout em cada um trava a janela. Entao o evento
   so marca sujo, e o recalculo acontece uma vez, antes do proximo desenho.

3. `pygame.SCALED` nao e usado de proposito: ele fixa uma resolucao logica e
   briga com um layout que se reorganiza sozinho. Em tela Retina detectamos a
   densidade e aumentamos as medidas, que e o caminho que preserva o reflow.
"""

import pygame

from src.ui.layout import ALTURA_MIN, LARGURA_MIN, Metricas, calcular

TITULO = "Sistema Solar - simulação gravitacional"


class Janela:
    """Dona da superficie de desenho e do tamanho atual."""

    def __init__(self, largura=None, altura=None, escala_texto=1.0):
        pygame.init()
        pygame.display.set_caption(TITULO)

        largura, altura = self._tamanho_inicial(largura, altura)
        self.tela = pygame.display.set_mode((largura, altura), pygame.RESIZABLE)
        self._fixar_tamanho_minimo()

        self.escala_texto = float(escala_texto)
        self._densidade = self._detectar_densidade()
        self._layout_sujo = True
        self.areas = None
        self.lateral_aberta = True
        self.atualizar_layout()

    # -- criacao -----------------------------------------------------------

    @staticmethod
    def _tamanho_inicial(largura, altura):
        """Escolhe um tamanho que caiba na tela do usuario.

        1400x800, o tamanho fixo da versao anterior, nao cabe confortavelmente
        num notebook de 1440x900 depois da barra de menu e da dock.
        """
        if largura and altura:
            return max(LARGURA_MIN, largura), max(ALTURA_MIN, altura)
        try:
            dw, dh = pygame.display.get_desktop_sizes()[0]
        except Exception:                                    # noqa: BLE001
            dw, dh = 1440, 900
        return (max(LARGURA_MIN, min(1280, dw - 120)),
                max(ALTURA_MIN, min(800, dh - 160)))

    @staticmethod
    def _fixar_tamanho_minimo():
        """Pede ao SDL que impeca o encolhimento abaixo do minimo utilizavel."""
        try:
            pygame.Window.from_display_module().minimum_size = (LARGURA_MIN, ALTURA_MIN)
        except Exception:                                    # noqa: BLE001
            pass       # versao de pygame sem a API; o layout ainda se defende

    def _detectar_densidade(self):
        """Razao entre pixels de desenho e pontos da janela (Retina = 2)."""
        try:
            sw, sh = self.tela.get_size()
            ww, wh = pygame.display.get_window_size()
            if ww:
                return max(1.0, sw / ww)
        except Exception:                                    # noqa: BLE001
            pass
        return 1.0

    # -- ciclo de vida -----------------------------------------------------

    @property
    def tamanho(self):
        return self.tela.get_size()

    def metricas(self):
        escala = self.escala_texto * (2.0 if self._densidade >= 1.5 else 1.0)
        return Metricas(escala)

    def tratar_evento(self, evento):
        """Marca o layout como sujo. Nao recalcula aqui -- ver o item 2 acima."""
        if evento.type in (pygame.VIDEORESIZE, pygame.WINDOWRESIZED,
                           pygame.WINDOWSIZECHANGED):
            self._layout_sujo = True
            return True
        return False

    def definir_lateral(self, aberta):
        if aberta != self.lateral_aberta:
            self.lateral_aberta = bool(aberta)
            self._layout_sujo = True

    def definir_escala_texto(self, escala):
        if abs(escala - self.escala_texto) > 1e-9:
            self.escala_texto = float(escala)
            self._layout_sujo = True

    def atualizar_layout(self, forcar=False):
        """Recalcula as areas se preciso. Devolve True se recalculou."""
        if not (self._layout_sujo or forcar):
            return False
        w, h = self.tela.get_size()
        self.areas = calcular(w, h, self.lateral_aberta, self.metricas())
        self._layout_sujo = False
        return True

    def apresentar(self):
        pygame.display.flip()

    def encerrar(self):
        pygame.quit()
