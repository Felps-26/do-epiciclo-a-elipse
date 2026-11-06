"""
Base do conjunto de widgets: o contrato que todo controle da tela obedece.

Uma decisao que evita uma classe inteira de defeitos: o widget NAO guarda se
esta sob o cursor, se tem o foco ou se esta pressionado. Esses tres estados
vivem no Contexto, que e montado do zero a cada quadro. Guardar hover dentro
do widget e o caminho conhecido para botoes que ficam iluminados para sempre
depois que o painel fecha ou a janela muda de tamanho.
"""

from dataclasses import dataclass, field

import pygame


@dataclass
class Contexto:
    """Tudo o que desenhar precisa e o widget nao guarda."""

    tela: pygame.Surface
    tema: object
    tipo: object                     # Tipografia
    metricas: object
    mouse: tuple = (0, 0)
    id_hover: str | None = None
    id_foco: str | None = None
    id_pressionado: str | None = None
    foco_visivel: bool = False
    dt: float = 0.0
    dados: dict = field(default_factory=dict)   # estado que os widgets leem


class Widget:
    """Um controle na tela.

    `medir` diz o tamanho preferido, `dispor` recebe o retangulo definitivo do
    layout, `desenhar` pinta. Eventos viram Acao; nada muda estado aqui.
    """

    def __init__(self, id_widget, dica="", focavel=True):
        self.id = id_widget
        self.rect = pygame.Rect(0, 0, 0, 0)
        self.dica = dica
        self.visivel = True
        self.habilitado = True
        self.focavel = focavel

    # -- layout ------------------------------------------------------------

    def medir(self, ctx):
        return (0, 0)

    def dispor(self, rect):
        self.rect = pygame.Rect(rect)

    def filhos(self):
        return ()

    def alcancaveis(self):
        """Este widget e os filhos dele, em ordem de leitura."""
        saida = [self] if self.focavel else []
        for f in self.filhos():
            saida.extend(f.alcancaveis())
        return saida

    # -- interacao ---------------------------------------------------------

    def acerta(self, pos):
        return self.visivel and self.habilitado and self.rect.collidepoint(pos)

    def ao_clique(self, pos):
        return None

    def ao_tecla(self, tecla, mods):
        return None

    def ao_roda(self, delta, pos):
        return None

    def rotulo_acessivel(self):
        return self.id

    # -- desenho -----------------------------------------------------------

    def desenhar(self, ctx):
        raise NotImplementedError

    def desenhar_foco(self, ctx):
        from src.ui.desenho import anel_foco
        if ctx.foco_visivel and ctx.id_foco == self.id:
            anel_foco(ctx.tela, self.rect, ctx.tema.foco, ctx.tema.fundo)


class Container(Widget):
    """Agrupa widgets. Nao desenha nada proprio alem dos filhos."""

    def __init__(self, id_widget, itens=()):
        super().__init__(id_widget, focavel=False)
        self.itens = list(itens)
        self.recorte = None

    def filhos(self):
        return tuple(i for i in self.itens if i.visivel)

    def desenhar(self, ctx):
        for item in self.filhos():
            item.desenhar(ctx)

    def em(self, pos):
        """Widget sob o ponto, do mais acima para o mais abaixo.

        Desce em qualquer filho que saiba responder `em`, nao so em Container.
        O PainelRecolhivel nao e um Container, e com o teste por isinstance os
        alternaveis dentro dele nunca recebiam clique nenhum.
        """
        if self.recorte is not None and not self.recorte.collidepoint(pos):
            return None
        for item in reversed(self.filhos()):
            achado = item.em(pos) if hasattr(item, "em") else None
            if achado is not None:
                return achado
            if not hasattr(item, "em") and item.acerta(pos):
                return item
        return None
