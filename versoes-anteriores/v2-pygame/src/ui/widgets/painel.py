"""
Paineis: o "Mais opções" recolhivel e a lista que rola.

A ideia por tras do recolhivel e a de divulgacao progressiva: quem abre o
programa ve cinco controles, nao vinte. Quem quiser trilhas, rotulos, escala
comprimida e dados tecnicos abre o painel e acha tudo. Os cinco de cima
continuam no mesmo lugar o tempo todo.
"""

import pygame

from src.ui.desenho import caixa, seta_baixo, seta_cima
from src.ui.widgets.base import Container, Widget


class PainelRecolhivel(Widget):
    """Cabecalho clicavel com um conteudo que aparece e some."""

    def __init__(self, id_widget, titulo, itens=(), aberto=False, acao_alternar=None):
        super().__init__(id_widget)
        self.titulo = titulo
        self.conteudo = Container(id_widget + "_conteudo", itens)
        self.aberto = aberto
        self.acao_alternar = acao_alternar
        self.rect_cabecalho = pygame.Rect(0, 0, 0, 0)
        self.cabecalho_visivel = True

    def filhos(self):
        return (self.conteudo,) if self.aberto else ()

    def altura_cabecalho(self, ctx):
        return ctx.metricas.alvo_min

    def dispor(self, rect):
        super().dispor(rect)
        self.rect_cabecalho = pygame.Rect(rect.x, rect.y, rect.width, 0)

    def dispor_cabecalho(self, rect, altura):
        self.rect = pygame.Rect(rect)
        self.rect_cabecalho = pygame.Rect(rect.x, rect.y, rect.width, altura)

    def acerta(self, pos):
        return (self.visivel and self.cabecalho_visivel
                and self.rect_cabecalho.collidepoint(pos))

    def em(self, pos):
        """O painel responde pelo cabecalho e pelos filhos que ele mostra."""
        if self.aberto:
            achado = self.conteudo.em(pos)
            if achado is not None:
                return achado
        return self if self.acerta(pos) else None

    def ao_clique(self, pos):
        return self.acao_alternar

    def ao_tecla(self, tecla, mods):
        if tecla in (pygame.K_RETURN, pygame.K_KP_ENTER, pygame.K_SPACE):
            return self.acao_alternar
        return None

    def rotulo_acessivel(self):
        return f"{self.titulo}. {'Aberto' if self.aberto else 'Fechado'}."

    def desenhar(self, ctx):
        t, m = ctx.tema, ctx.metricas
        r = self.rect_cabecalho
        if self.cabecalho_visivel:
            hover = ctx.id_hover == self.id
            caixa(ctx.tela, r,
                  t.painel_alto if (hover or self.aberto) else t.painel,
                  t.borda, 1, raio=m.px(8))
            ctx.tipo.desenhar(ctx.tela, self.titulo, r.x + m.px(12),
                              r.centery - ctx.tipo.altura("corpo") // 2,
                              t.texto if (hover or self.aberto) else t.texto_fraco,
                              "corpo")
            seta = pygame.Rect(r.right - m.px(30), r.y, m.px(24), r.height)
            (seta_cima if self.aberto else seta_baixo)(
                ctx.tela, seta, t.texto_fraco)
            self.desenhar_foco(ctx)
        if self.aberto:
            self.conteudo.desenhar(ctx)


class Painel(Container):
    """Bloco com fundo, borda e titulo opcional."""

    def __init__(self, id_widget, titulo=None, itens=()):
        super().__init__(id_widget, itens)
        self.titulo = titulo

    def desenhar(self, ctx):
        caixa(ctx.tela, self.rect, ctx.tema.painel, ctx.tema.borda, 1,
              raio=ctx.metricas.px(10))
        if self.titulo:
            ctx.tipo.desenhar(ctx.tela, self.titulo,
                              self.rect.x + ctx.metricas.px(12),
                              self.rect.y + ctx.metricas.px(10),
                              ctx.tema.texto, "corpo")
        super().desenhar(ctx)
