"""
Invariantes de layout em muitos tamanhos de janela. Nao abre janela.

    .venv/bin/python -m tests.test_layout

O objetivo e garantir que nenhuma janela razoavel produza area negativa,
paineis sobrepostos por acidente, faixas de um pixel sobrando ou canvas
pequeno demais para a simulacao caber.
"""

import itertools
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pygame                                                   # noqa: E402

from src.ui.layout import (ALTURA_MIN, CANVAS_MIN_A, CANVAS_MIN_L,  # noqa: E402
                           LARGURA_MIN, Metricas, calcular,
                           retangulo_ficha)

pygame.init()

falhas = []


def checar(cond, msg):
    if not cond:
        falhas.append(msg)
    return cond


LARGURAS = [960, 1000, 1024, 1100, 1220, 1280, 1366, 1440, 1600, 1920, 2560, 3840]
ALTURAS = [600, 640, 680, 720, 768, 800, 900, 1080, 1440, 2160]
ESCALAS = [1.0, 1.25]

print("=" * 78)
print("INVARIANTES DE LAYOUT")
print("=" * 78)

combinacoes = list(itertools.product(LARGURAS, ALTURAS, ESCALAS, [True, False]))
print(f"conferindo {len(combinacoes)} combinacoes de "
      f"{len(LARGURAS)} larguras x {len(ALTURAS)} alturas x "
      f"{len(ESCALAS)} escalas x lateral aberta/fechada")

for w, h, esc, aberta in combinacoes:
    a = calcular(w, h, aberta, Metricas(esc))
    ctx = f"{w}x{h} escala {esc} lateral {'aberta' if aberta else 'fechada'}"

    checar(a.topo.height + a.canvas.height + a.rodape.height == h,
           f"{ctx}: alturas somam {a.topo.height + a.canvas.height + a.rodape.height}, nao {h}")
    checar(a.canvas.width >= CANVAS_MIN_L and a.canvas.height >= CANVAS_MIN_A,
           f"{ctx}: canvas {a.canvas.width}x{a.canvas.height} menor que o minimo")
    checar(a.topo.height >= a.metricas.alvo_min,
           f"{ctx}: barra de topo ({a.topo.height}px) nao cabe um botao "
           f"de {a.metricas.alvo_min}px")
    for nome, r in (("topo", a.topo), ("canvas", a.canvas),
                    ("lateral", a.lateral), ("rodape", a.rodape)):
        checar(r.width >= 0 and r.height >= 0, f"{ctx}: {nome} com tamanho negativo")
        checar(r.right <= w + 1 and r.bottom <= h + 1,
               f"{ctx}: {nome} vaza para fora da janela")

    checar(not a.topo.colliderect(a.canvas), f"{ctx}: topo invade o canvas")
    checar(not a.rodape.colliderect(a.canvas), f"{ctx}: rodape invade o canvas")
    if aberta and a.lateral.width and not a.lateral_sobreposta:
        checar(not a.lateral.colliderect(a.canvas),
               f"{ctx}: lateral invade o canvas sem estar marcada como sobreposta")

    # A ficha do planeta tem de caber dentro do canvas, ancorada onde for.
    for ancora in (None, (a.canvas.x + 5, a.canvas.y + 5),
                   (a.canvas.right - 5, a.canvas.bottom - 5),
                   (a.canvas.centerx, a.canvas.centery)):
        f = retangulo_ficha(a, ancora)
        checar(a.canvas.contains(f) or (f.width <= a.canvas.width
                                        and f.height <= a.canvas.height),
               f"{ctx}: ficha {f} nao cabe no canvas {a.canvas}")

print(f"\n{'janela':>12}{'classe':>20}{'topo':>7}{'canvas':>12}"
      f"{'lateral':>9}{'rodape':>8}")
print("-" * 78)
for w, h in ((960, 600), (1280, 800), (1440, 900), (1920, 1080), (1024, 640)):
    a = calcular(w, h, True)
    sob = " (sobreposta)" if a.lateral_sobreposta else ""
    print(f"{w:>7}x{h:<4}{a.classe_largura + '/' + a.classe_altura:>20}"
          f"{a.topo.height:>7}{f'{a.canvas.width}x{a.canvas.height}':>12}"
          f"{a.lateral.width:>9}{a.rodape.height:>8}{sob}")

print("\n" + "=" * 78)
if falhas:
    print(f"RESULTADO: {len(falhas)} falha(s) (mostrando ate 15):")
    for f in falhas[:15]:
        print("   - " + f)
else:
    print(f"RESULTADO: as {len(combinacoes)} combinacoes respeitam todos os invariantes.")
print("=" * 78)
raise SystemExit(1 if falhas else 0)
