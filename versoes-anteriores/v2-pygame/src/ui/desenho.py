"""
Primitivas de desenho sobre uma Surface.

Tudo o que precisa saber sobre desempenho e seguranca do pygame esta
concentrado aqui, medido neste projeto:

- `aalines` corta sozinho o que esta fora da tela: uma curva com coordenada de
  1e8 pixels custa os mesmos 0,006 ms que uma na tela. Ja `lines(width=2)` nao
  corta: a mesma curva custa 196 ms, o que derrubaria a taxa de quadros para
  cinco por segundo. Por isso orbitas e trilhas usam `aalines`.
- O que de fato quebra e `int()`: `int(float('inf'))` levanta OverflowError.
  Toda coordenada passa por Camera2D.sanear antes de virar inteiro.
- Halo de estrela gerado a cada quadro custa 0,008 ms por corpo; guardado em
  cache, 0,001 ms. Como o halo so depende de (cor, raio), da para guardar.
"""

import pygame

from src.projecao.camera import Camera2D

_cache_halo = {}


def limpar_caches():
    _cache_halo.clear()


def caixa(tela, rect, fundo, borda=None, espessura=1, raio=0):
    if fundo is not None:
        pygame.draw.rect(tela, fundo, rect, border_radius=raio)
    if borda is not None:
        pygame.draw.rect(tela, borda, rect, espessura, border_radius=raio)


def linha(tela, p1, p2, cor, espessura=1):
    pygame.draw.line(tela, cor, p1, p2, espessura)


def curva(tela, pontos_px, cor, fechada=False):
    """Desenha uma polilinha ja em pixels. Aceita ndarray ou lista.

    Converte para lista de tuplas antes de entregar ao pygame: medimos que
    passar um ndarray direto e cerca de duas vezes mais lento que converter.
    """
    p = Camera2D.sanear(pontos_px)
    if len(p) < 2:
        return
    pygame.draw.aalines(tela, cor, fechada, [(float(x), float(y)) for x, y in p])


def _halo(cor, raio, intensidade=70):
    chave = (cor, raio, intensidade)
    s = _cache_halo.get(chave)
    if s is None:
        if len(_cache_halo) > 128:
            _cache_halo.clear()
        s = pygame.Surface((raio * 2, raio * 2), pygame.SRCALPHA)
        for i in range(raio, 0, -1):
            alpha = int(intensidade * (1.0 - i / raio) ** 2)
            if alpha > 0:
                pygame.draw.circle(s, (*cor, alpha), (raio, raio), i)
        _cache_halo[chave] = s
    return s


def disco(tela, centro_px, cor, raio, halo=0, contorno=None):
    """Um corpo celeste. `halo` em pixels desenha o brilho em volta."""
    p = Camera2D.sanear([centro_px])[0]
    x, y = int(p[0]), int(p[1])
    if halo > raio:
        s = _halo(tuple(cor), int(halo))
        tela.blit(s, (x - int(halo), y - int(halo)))
    pygame.draw.circle(tela, cor, (x, y), max(1, int(raio)))
    if contorno:
        pygame.draw.circle(tela, contorno, (x, y), max(1, int(raio)) + 1, 1)


def anel(tela, centro_px, cor, raio, espessura=1):
    p = Camera2D.sanear([centro_px])[0]
    r = int(raio)
    if r <= 0 or r > 8000:
        return
    pygame.draw.circle(tela, cor, (int(p[0]), int(p[1])), r, espessura)


def anel_tracejado(tela, centro_px, cor, raio, traços=16, espessura=2):
    """Anel de tracinhos. Usado para marcar o corpo que a camera acompanha.

    E tracejado e nao so colorido de proposito: informacao que so existe como
    cor some para quem nao distingue aquelas cores.
    """
    import math
    p = Camera2D.sanear([centro_px])[0]
    cx, cy = float(p[0]), float(p[1])
    r = float(raio)
    if r <= 0 or r > 8000:
        return
    passo = 2 * math.pi / traços
    for i in range(traços):
        a0 = i * passo
        a1 = a0 + passo * 0.55
        pygame.draw.line(
            tela, cor,
            (cx + r * math.cos(a0), cy + r * math.sin(a0)),
            (cx + r * math.cos(a1), cy + r * math.sin(a1)), espessura)


def anel_foco(tela, rect, cor_foco, cor_fundo, raio=6):
    """Anel de foco do teclado: duas linhas, uma clara e uma escura.

    A linha dupla e o que faz o foco continuar visivel tanto sobre o painel
    quanto sobre o fundo estrelado, sem precisar de uma cor por superficie.
    """
    fora = rect.inflate(6, 6)
    pygame.draw.rect(tela, cor_fundo, fora.inflate(2, 2), 1, border_radius=raio + 2)
    pygame.draw.rect(tela, cor_foco, fora, 2, border_radius=raio + 1)


def seta_cima(tela, rect, cor):
    """Triangulo pequeno. Substitui a seta tipografica, que nao existe nas
    fontes que usamos e sairia como quadradinho."""
    cx, cy = rect.centerx, rect.centery
    d = max(3, rect.height // 5)
    pygame.draw.polygon(tela, cor, [(cx, cy - d), (cx - d, cy + d), (cx + d, cy + d)])


def seta_baixo(tela, rect, cor):
    cx, cy = rect.centerx, rect.centery
    d = max(3, rect.height // 5)
    pygame.draw.polygon(tela, cor, [(cx, cy + d), (cx - d, cy - d), (cx + d, cy - d)])


def marca_selecao(tela, rect, cor):
    """Um "v" desenhado, para o estado ligado nao depender so da cor."""
    x, y, w, h = rect
    pygame.draw.lines(tela, cor, False,
                      [(x + w * 0.20, y + h * 0.52),
                       (x + w * 0.42, y + h * 0.74),
                       (x + w * 0.80, y + h * 0.26)], 2)
