"""
Botoes: texto sempre, icone nunca sozinho.

Requisito do projeto e boa pratica: o controle precisa dizer por escrito o que
faz. Um icone de engrenagem exige que a pessoa ja conheca a convencao. "Mais
opções" nao exige.

O estado ligado tambem nao e so cor -- ha o "v" desenhado no alternavel e uma
barra sob o item escolhido no grupo segmentado, alem da mudanca de cor.
"""

import pygame

from src.ui.desenho import caixa, marca_selecao
from src.ui.widgets.base import Widget

ALTURA_PADRAO = 40
PADDING_X = 14


class Rotulo(Widget):
    """Texto com largura maxima obrigatoria.

    A largura maxima nao e opcional de proposito: e o que garante que nenhum
    texto da interface apareca cortado pela metade. Quem nao cabe e encurtado
    com reticencias, e o texto inteiro fica na dica.
    """

    def __init__(self, id_widget, texto="", papel="corpo", cor=None,
                 ancora="esquerda"):
        super().__init__(id_widget, focavel=False)
        self.texto = texto
        self.papel = papel
        self.cor = cor
        self.ancora = ancora

    def medir(self, ctx):
        return (ctx.tipo.largura(self.texto, self.papel),
                ctx.tipo.entrelinha(self.papel))

    def desenhar(self, ctx):
        if not self.texto:
            return
        cor = self.cor or ctx.tema.texto
        texto = ctx.tipo.encurtar(self.texto, self.papel, self.rect.width) \
            if self.rect.width else self.texto
        x = {"esquerda": self.rect.x, "centro": self.rect.centerx,
             "direita": self.rect.right}[self.ancora]
        y = self.rect.y + (self.rect.height - ctx.tipo.altura(self.papel)) // 2
        ctx.tipo.desenhar(ctx.tela, texto, x, y, cor, self.papel, self.ancora)


class Botao(Widget):
    """Botao de texto, opcionalmente com um ponto colorido a esquerda."""

    def __init__(self, id_widget, texto, acao=None, dica="", papel="corpo",
                 cor_ponto=None, primario=False, ativo=False):
        super().__init__(id_widget, dica)
        self.texto = texto
        self.acao = acao
        self.papel = papel
        self.cor_ponto = cor_ponto
        self.primario = primario
        self.ativo = ativo

    def medir(self, ctx):
        m = ctx.metricas
        largura = ctx.tipo.largura(self.texto, self.papel) + 2 * m.px(PADDING_X)
        if self.cor_ponto is not None:
            largura += m.px(18)
        altura = m.alvo_primario if self.primario else m.alvo_min
        return (max(largura, m.px(64)), altura)

    def ao_clique(self, pos):
        return self.acao

    def ao_tecla(self, tecla, mods):
        if tecla in (pygame.K_RETURN, pygame.K_KP_ENTER, pygame.K_SPACE):
            return self.acao
        return None

    def rotulo_acessivel(self):
        estado = " (ativo)" if self.ativo else ""
        return f"{self.texto}{estado}. Botão."

    def desenhar(self, ctx):
        t, m = ctx.tema, ctx.metricas
        hover = ctx.id_hover == self.id
        pressionado = ctx.id_pressionado == self.id

        if not self.habilitado:
            fundo, borda, cor_texto = t.painel, t.borda, t.texto_apagado
        elif self.ativo:
            fundo, borda, cor_texto = t.painel_alto, t.acento, t.texto
        elif pressionado:
            fundo, borda, cor_texto = t.painel_alto, t.separador, t.texto
        elif hover:
            fundo, borda, cor_texto = t.painel_alto, t.separador, t.texto
        else:
            fundo, borda, cor_texto = t.painel, t.borda, t.texto

        caixa(ctx.tela, self.rect, fundo, borda, 1, raio=m.px(8))

        x = self.rect.x + m.px(PADDING_X)
        if self.cor_ponto is not None:
            cy = self.rect.centery
            pygame.draw.circle(ctx.tela, self.cor_ponto, (x + m.px(4), cy), m.px(5))
            x += m.px(18)

        largura_texto = self.rect.right - m.px(PADDING_X) - x
        texto = ctx.tipo.encurtar(self.texto, self.papel, max(0, largura_texto))
        y = self.rect.centery - ctx.tipo.altura(self.papel) // 2
        ctx.tipo.desenhar(ctx.tela, texto, x, y, cor_texto, self.papel)

        if self.ativo:
            # Barra na base: o estado ativo nao depende so da cor da borda.
            pygame.draw.rect(ctx.tela, t.acento,
                             (self.rect.x + m.px(8), self.rect.bottom - m.px(3),
                              self.rect.width - m.px(16), m.px(3)),
                             border_radius=m.px(2))
        self.desenhar_foco(ctx)


class BotaoAlternavel(Widget):
    """Liga e desliga. Mostra [v] ou [ ], alem de mudar de cor."""

    def __init__(self, id_widget, texto, acao=None, ligado=False, dica="",
                 papel="pequeno"):
        super().__init__(id_widget, dica)
        self.texto = texto
        self.acao = acao
        self.ligado = ligado
        self.papel = papel

    def medir(self, ctx):
        m = ctx.metricas
        return (ctx.tipo.largura(self.texto, self.papel) + m.px(42),
                m.alvo_min)

    def ao_clique(self, pos):
        return self.acao

    def ao_tecla(self, tecla, mods):
        if tecla in (pygame.K_RETURN, pygame.K_KP_ENTER, pygame.K_SPACE):
            return self.acao
        return None

    def rotulo_acessivel(self):
        return f"{self.texto}. {'Ligado' if self.ligado else 'Desligado'}."

    def desenhar(self, ctx):
        t, m = ctx.tema, ctx.metricas
        hover = ctx.id_hover == self.id
        pressionado = ctx.id_pressionado == self.id
        caixa(ctx.tela, self.rect,
              t.painel_alto if (hover or pressionado or self.ligado) else t.painel,
              t.separador if (hover or pressionado) else t.borda, 1, raio=m.px(8))
        lado = m.px(18)
        quadro = pygame.Rect(self.rect.x + m.px(8),
                             self.rect.centery - lado // 2, lado, lado)
        caixa(ctx.tela, quadro,
              t.painel_alto if (self.ligado or hover) else t.painel,
              t.acento if self.ligado else t.separador, 1, raio=m.px(4))
        if self.ligado:
            marca_selecao(ctx.tela, quadro, t.acento)

        x = quadro.right + m.px(10)
        cor = t.texto if (self.ligado or hover) else t.texto_fraco
        texto = ctx.tipo.encurtar(self.texto, self.papel,
                                  max(0, self.rect.right - x - m.px(8)))
        ctx.tipo.desenhar(ctx.tela, texto, x,
                          self.rect.centery - ctx.tipo.altura(self.papel) // 2,
                          cor, self.papel)
        self.desenhar_foco(ctx)


class GrupoSegmentado(Widget):
    """Escolha exclusiva entre poucas opcoes, lado a lado.

    Usado para os modos de exploracao. Mostra as opcoes todas ao mesmo tempo,
    o que e melhor que um menu suspenso para quem nao sabe o que procurar.
    """

    def __init__(self, id_widget, opcoes, escolhida=None, fabrica_acao=None,
                 papel="pequeno", dica=""):
        super().__init__(id_widget, dica)
        self.opcoes = list(opcoes)             # [(chave, rotulo), ...]
        self.escolhida = escolhida
        self.fabrica_acao = fabrica_acao
        self.papel = papel
        self._rects = []

    def medir(self, ctx):
        m = ctx.metricas
        largura = sum(ctx.tipo.largura(r, self.papel) + m.px(24)
                      for _, r in self.opcoes) + m.px(6)
        return (largura, m.alvo_min)

    def dispor(self, rect):
        super().dispor(rect)
        m = 3
        interno = self.rect.inflate(-2 * m, -2 * m)
        total = sum(len(r) for _, r in self.opcoes) or 1
        x = interno.x
        self._rects = []
        for i, (_, rotulo) in enumerate(self.opcoes):
            w = (interno.width - x + interno.x) if i == len(self.opcoes) - 1 \
                else int(interno.width * len(rotulo) / total)
            self._rects.append(pygame.Rect(x, interno.y, w, interno.height))
            x += w

    def _indice_em(self, pos):
        for i, r in enumerate(self._rects):
            if r.collidepoint(pos):
                return i
        return None

    def ao_clique(self, pos):
        i = self._indice_em(pos)
        if i is not None and self.fabrica_acao:
            return self.fabrica_acao(self.opcoes[i][0])
        return None

    def ao_tecla(self, tecla, mods):
        chaves = [c for c, _ in self.opcoes]
        if self.escolhida in chaves:
            i = chaves.index(self.escolhida)
        else:
            i = 0
        if tecla == pygame.K_LEFT:
            i = max(0, i - 1)
        elif tecla == pygame.K_RIGHT:
            i = min(len(chaves) - 1, i + 1)
        else:
            return None
        return self.fabrica_acao(chaves[i]) if self.fabrica_acao else None

    def rotulo_acessivel(self):
        atual = dict(self.opcoes).get(self.escolhida, "nenhum")
        return f"Modo de exploração: {atual}. Use esquerda e direita."

    def desenhar(self, ctx):
        t, m = ctx.tema, ctx.metricas
        caixa(ctx.tela, self.rect, t.painel, t.borda, 1, raio=m.px(8))
        for (chave, rotulo), r in zip(self.opcoes, self._rects):
            escolhida = chave == self.escolhida
            hover = ctx.id_hover == self.id and r.collidepoint(ctx.mouse)
            if escolhida:
                caixa(ctx.tela, r, t.painel_alto, None, raio=m.px(6))
                pygame.draw.rect(ctx.tela, t.acento,
                                 (r.x + m.px(6), r.bottom - m.px(3),
                                  r.width - m.px(12), m.px(3)),
                                 border_radius=m.px(2))
            elif hover:
                caixa(ctx.tela, r, t.painel_alto, None, raio=m.px(6))
            cor = t.texto if (escolhida or hover) else t.texto_fraco
            texto = ctx.tipo.encurtar(rotulo, self.papel, r.width - m.px(8))
            ctx.tipo.desenhar(ctx.tela, texto, r.centerx,
                              r.centery - ctx.tipo.altura(self.papel) // 2,
                              cor, self.papel, "centro")
        self.desenhar_foco(ctx)
