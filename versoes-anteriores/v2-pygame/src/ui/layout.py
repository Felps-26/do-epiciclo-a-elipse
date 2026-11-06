"""
Divisao da janela em areas. Funcao pura: entram numeros, saem retangulos.

Nao desenha nada, nao guarda estado, nao depende de haver uma janela aberta --
por isso tests/test_layout.py consegue conferir dezenas de tamanhos de tela
sem abrir uma janela sequer.

Esta era a causa raiz de a versao anterior nao redimensionar: os retangulos da
interface eram calculados no topo do modulo, a partir das constantes LARGURA e
ALTURA, e portanto uma vez so. A regra agora e simples e sem excecao:

    NENHUM pygame.Rect em escopo de modulo.

Tudo o que ocupa espaco na tela nasce aqui dentro, a cada recalculo.
"""

from dataclasses import dataclass

import pygame

LARGURA_MIN, ALTURA_MIN = 960, 600
CANVAS_MIN_L, CANVAS_MIN_A = 460, 300

# Larguras a partir das quais o layout muda de comportamento.
LARGURA_AMPLA = 1220
LARGURA_MEDIA = 1000
ALTURA_BAIXA = 680


@dataclass(frozen=True)
class Metricas:
    """Escala de tudo o que e medida. Uma opcao "Texto maior" mexe so aqui."""

    escala: float = 1.0

    @property
    def u(self):
        """Unidade de espacamento. Margens e respiros sao multiplos dela."""
        return max(4, int(round(8 * self.escala)))

    @property
    def alvo_min(self):
        """Altura minima de um alvo de clique. Abaixo disso fica dificil acertar."""
        return int(round(40 * self.escala))

    @property
    def alvo_primario(self):
        return int(round(44 * self.escala))

    def px(self, valor):
        return int(round(valor * self.escala))


@dataclass(frozen=True)
class Areas:
    """Onde cada parte da interface mora, nesta janela, neste instante."""

    janela: pygame.Rect
    topo: pygame.Rect            # controles principais, sempre visiveis
    canvas: pygame.Rect          # a simulacao
    lateral: pygame.Rect         # painel de informacao
    rodape: pygame.Rect          # estado, escala, aviso
    lateral_sobreposta: bool     # em tela estreita a lateral flutua sobre o canvas
    classe_largura: str          # "estreito" | "medio" | "amplo"
    classe_altura: str           # "baixo" | "normal"
    metricas: Metricas

    @property
    def compacto(self):
        return self.classe_largura == "estreito" or self.classe_altura == "baixo"


def _classe_largura(largura):
    if largura >= LARGURA_AMPLA:
        return "amplo"
    if largura >= LARGURA_MEDIA:
        return "medio"
    return "estreito"


def calcular(largura, altura, lateral_aberta=True, metricas=None):
    """Divide uma janela de `largura` x `altura` nas areas da interface.

    A ordem de prioridade quando o espaco aperta e: primeiro o canvas (a
    simulacao e o assunto), depois os controles do topo, e a lateral e a
    primeira a sair do caminho -- vira sobreposicao em vez de sumir.
    """
    m = metricas or Metricas()
    largura = max(LARGURA_MIN // 2, int(largura))
    altura = max(ALTURA_MIN // 2, int(altura))

    cl = _classe_largura(largura)
    ca = "baixo" if altura < ALTURA_BAIXA else "normal"

    h_topo = m.px(48 if (cl == "estreito" or ca == "baixo") else 56)
    h_topo = max(h_topo, m.alvo_min + m.u)          # sempre cabe um botao
    # A faixa inferior foi devolvida ao canvas. Mantemos o campo rodape
    # vazio para os consumidores de Areas (inclusive o laboratório).
    h_rodape = 0
    h_meio = max(1, altura - h_topo)

    if cl == "amplo":
        w_lateral = min(max(int(round(0.24 * largura)), m.px(280)), m.px(360))
    elif cl == "medio":
        w_lateral = m.px(260)
    else:
        w_lateral = min(m.px(300), largura - m.px(64))

    sobreposta = False
    if not lateral_aberta:
        w_lateral = 0
    elif cl == "estreito" or largura - w_lateral < CANVAS_MIN_L:
        sobreposta = True

    janela = pygame.Rect(0, 0, largura, altura)
    topo = pygame.Rect(0, 0, largura, h_topo)
    rodape = pygame.Rect(0, h_topo + h_meio, largura, h_rodape)

    if w_lateral and not sobreposta:
        canvas = pygame.Rect(0, h_topo, largura - w_lateral, h_meio)
        lateral = pygame.Rect(largura - w_lateral, h_topo, w_lateral, h_meio)
    else:
        canvas = pygame.Rect(0, h_topo, largura, h_meio)
        lateral = pygame.Rect(largura - w_lateral, h_topo, w_lateral, h_meio) \
            if w_lateral else pygame.Rect(largura, h_topo, 0, h_meio)

    return Areas(janela=janela, topo=topo, canvas=canvas, lateral=lateral,
                 rodape=rodape, lateral_sobreposta=bool(w_lateral and sobreposta),
                 classe_largura=cl, classe_altura=ca, metricas=m)


def retangulo_ficha(areas, ancora_px=None):
    """Onde desenhar a ficha do planeta.

    Em tela larga e um cartao flutuante perto do planeta clicado; em tela
    estreita vira uma faixa presa embaixo, que e o que cabe.
    """
    m = areas.metricas
    c = areas.canvas
    if areas.classe_largura == "estreito":
        h = max(m.px(180), int(0.42 * c.height))
        return pygame.Rect(c.x + m.u, c.bottom - h - m.u, c.width - 2 * m.u, h)

    largura = m.px(300)
    altura = min(m.px(320), c.height - 2 * m.u)
    x = c.x + m.u
    y = c.y + m.u
    if ancora_px is not None:
        x = int(ancora_px[0]) + m.px(18)
        y = int(ancora_px[1]) - altura // 2
        # Vira para o outro lado se nao couber a direita, e prende na area.
        if x + largura > c.right - m.u:
            x = int(ancora_px[0]) - largura - m.px(18)
        x = max(c.x + m.u, min(x, c.right - largura - m.u))
        y = max(c.y + m.u, min(y, c.bottom - altura - m.u))
    return pygame.Rect(x, y, largura, altura)
