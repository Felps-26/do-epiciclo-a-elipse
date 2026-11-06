"""
Modal: uma caixa que toma a frente e prende o foco enquanto estiver aberta.

Prender o foco importa para quem navega por teclado: sem isso, o Tab passeia
pelos botoes atras da caixa, que estao visualmente escondidos. ESC sempre
fecha e devolve o foco a quem abriu.
"""

import pygame

from src.ui.desenho import caixa
from src.ui.widgets.base import Container, Widget


class Modal(Container):
    def __init__(self, id_widget, titulo, itens=(), largura=520, altura=None,
                 acao_fechar=None):
        super().__init__(id_widget, itens)
        self.titulo = titulo
        self.largura_pedida = largura
        self.altura_pedida = altura
        self.acao_fechar = acao_fechar
        self.rect_conteudo = pygame.Rect(0, 0, 0, 0)
        self.rolagem = 0.0
        self.altura_conteudo = 0
        self.rolagem_maxima = 0.0
        self.rect_barra = pygame.Rect(0, 0, 0, 0)
        self.rect_alca = pygame.Rect(0, 0, 0, 0)
        self._arrasto_barra = None
        self._passo_rolagem = 48

    def medir_rolagem(self, altura, ctx):
        self.altura_conteudo = altura
        self.rolagem_maxima = max(0, altura - self.rect_conteudo.height)
        self._passo_rolagem = ctx.metricas.px(48)
        self.rolar(0)
        r = self.rect_conteudo
        self.rect_barra = pygame.Rect(r.right + ctx.metricas.px(6), r.y,
                                      ctx.metricas.px(12), r.height)
        self._atualizar_alca()

    def _atualizar_alca(self):
        r = self.rect_barra
        h = min(r.height, max(28, int(r.height * r.height /
                                    max(1, self.altura_conteudo))))
        y = r.y + int((r.height - h) * self.rolagem /
                      max(1, self.rolagem_maxima))
        self.rect_alca = pygame.Rect(r.x, y, r.width, h)

    def rolar(self, pixels):
        self.rolagem = max(0.0, min(self.rolagem_maxima, self.rolagem + pixels))
        self._atualizar_alca()

    def iniciar_barra(self, pos):
        if not self.rolagem_maxima or not self.rect_barra.collidepoint(pos):
            return False
        if self.rect_alca.collidepoint(pos):
            self._arrasto_barra = pos[1] - self.rect_alca.y
        else:
            self.rolar(self.rect_conteudo.height *
                       (-1 if pos[1] < self.rect_alca.y else 1))
        return True

    def mover_barra(self, pos):
        if self._arrasto_barra is not None:
            curso = max(1, self.rect_barra.height - self.rect_alca.height)
            destino = (pos[1] - self.rect_barra.y - self._arrasto_barra) / curso
            self.rolar(destino * self.rolagem_maxima - self.rolagem)

    def ao_roda(self, delta, pos):
        self.rolar(-delta * self._passo_rolagem)

    def desenhar_barra(self, ctx):
        if self.rolagem_maxima > 0:
            caixa(ctx.tela, self.rect_barra, ctx.tema.fundo, raio=4)
            caixa(ctx.tela, self.rect_alca, ctx.tema.separador, raio=4)

    def dispor_em(self, areas, ctx):
        """Centraliza na janela, sem passar das bordas nem ficar minusculo."""
        m = areas.metricas
        j = areas.janela
        largura = min(m.px(self.largura_pedida), j.width - m.px(48))
        altura = min(m.px(self.altura_pedida or 420), j.height - m.px(64))
        self.rect = pygame.Rect(0, 0, largura, altura)
        self.rect.center = j.center
        cab = max(m.px(52), ctx.tipo.altura_do_bloco(
            self.titulo, "titulo", largura - m.px(40)) + m.px(26))
        self._altura_cabecalho = cab
        self.rect_conteudo = pygame.Rect(
            self.rect.x + m.px(20), self.rect.y + cab,
            self.rect.width - m.px(58), self.rect.height - cab - m.px(16))

    def ao_tecla(self, tecla, mods):
        if tecla == pygame.K_ESCAPE:
            return self.acao_fechar
        passos = {pygame.K_UP: -self._passo_rolagem,
                  pygame.K_DOWN: self._passo_rolagem,
                  pygame.K_PAGEUP: -self.rect_conteudo.height * .9,
                  pygame.K_PAGEDOWN: self.rect_conteudo.height * .9,
                  pygame.K_HOME: -self.rolagem_maxima,
                  pygame.K_END: self.rolagem_maxima}
        if tecla in passos:
            self.rolar(passos[tecla])
        return None

    def desenhar_fundo(self, ctx, areas):
        """Escurece o que esta atras, para a caixa se destacar."""
        # Escurece o suficiente para a caixa se destacar, mas nao tanto que
        # a simulacao suma: a primeira coisa que a orientacao inicial pede e
        # "observe os oito planetas".
        veu = pygame.Surface(areas.janela.size, pygame.SRCALPHA)
        veu.fill((*ctx.tema.sobreposicao, 140))
        ctx.tela.blit(veu, (0, 0))

    def desenhar(self, ctx):
        t, m = ctx.tema, ctx.metricas
        caixa(ctx.tela, self.rect, t.painel, t.separador, 1, raio=m.px(12))
        ctx.tipo.desenhar_bloco(ctx.tela, self.titulo, self.rect.x + m.px(20),
                                self.rect.y + m.px(14), self.rect.width - m.px(40),
                                t.texto, "titulo")
        pygame.draw.line(ctx.tela, t.borda,
                         (self.rect.x + m.px(16), self.rect.y + self._altura_cabecalho - m.px(4)),
                         (self.rect.right - m.px(16), self.rect.y + self._altura_cabecalho - m.px(4)))
        super().desenhar(ctx)
