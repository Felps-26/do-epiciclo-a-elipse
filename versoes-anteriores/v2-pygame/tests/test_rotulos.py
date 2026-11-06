"""
Rotulos nunca se sobrepoem, nunca invadem os paineis, e o selecionado nunca
e rebaixado.

    .venv/bin/python -m tests.test_rotulos

Sorteia muitas configuracoes de planetas na tela, inclusive os casos ruins de
proposito: todos amontoados no centro (que e a visao geral em escala real) e
todos empilhados no mesmo ponto.
"""

import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pygame                                                    # noqa: E402

from src.projecao.rotulos import (Candidato,                     # noqa: E402
                                  PosicionadorRotulos)

pygame.init()

NOMES = [("mercurio", "Mercúrio", "Mer."), ("venus", "Vênus", "Vên."),
         ("terra", "Terra", "Ter."), ("marte", "Marte", "Mar."),
         ("jupiter", "Júpiter", "Júp."), ("saturno", "Saturno", "Sat."),
         ("urano", "Urano", "Ura."), ("netuno", "Netuno", "Net.")]

QUADRO = pygame.Rect(0, 56, 973, 712)
PAINEIS = [pygame.Rect(0, 0, 1280, 56), pygame.Rect(973, 56, 307, 712),
           pygame.Rect(0, 768, 1280, 32)]

falhas = []


def checar(cond, msg):
    if not cond:
        falhas.append(msg)
    return cond


def medir(texto):
    return (7 * len(texto) + 6, 18)


def cenario(rng, tipo):
    cands = []
    for i, (chave, nome, abrev) in enumerate(NOMES):
        if tipo == "amontoado":          # visao geral em escala real
            p = (QUADRO.centerx + rng.randint(-14, 14) * (1 if i < 4 else 12),
                 QUADRO.centery + rng.randint(-14, 14) * (1 if i < 4 else 12))
        elif tipo == "mesmo_ponto":      # o pior caso possivel
            p = (QUADRO.centerx, QUADRO.centery)
        elif tipo == "borda":            # colados na borda e sob os paineis
            p = (rng.choice([QUADRO.x + 3, QUADRO.right - 3, 960]),
                 rng.randint(QUADRO.y, QUADRO.bottom))
        else:                            # espalhado
            p = (rng.randint(QUADRO.x, QUADRO.right),
                 rng.randint(QUADRO.y, QUADRO.bottom))
        cands.append(Candidato(chave, nome, abrev, p,
                               raio=rng.choice([3, 4, 6, 9]),
                               prioridade=rng.random()))
    return cands


print("=" * 78)
print("POSICIONAMENTO DE ROTULOS")
print("=" * 78)

rng = random.Random(20260101)
pos = PosicionadorRotulos()
total = 0
contagem = {"completo": 0, "abreviado": 0, "ponto": 0}

for tipo in ("espalhado", "amontoado", "mesmo_ponto", "borda"):
    for _ in range(50):
        cands = cenario(rng, tipo)
        escolhido = rng.randrange(len(cands))
        cands[escolhido].selecionado = True
        cands[escolhido].prioridade = 10.0

        colocados = pos.posicionar(cands, medir, QUADRO, PAINEIS)
        total += 1
        for c in colocados:
            contagem[c.modo] += 1

        reais = [c for c in colocados if c.modo != "ponto"]
        for i, a in enumerate(reais):
            for b in reais[i + 1:]:
                checar(not a.rect.colliderect(b.rect),
                       f"{tipo}: '{a.texto}' e '{b.texto}' se sobrepoem")
            for p in PAINEIS:
                checar(not a.rect.colliderect(p),
                       f"{tipo}: '{a.texto}' invade um painel da interface")
            checar(QUADRO.contains(a.rect) or a.chave == cands[escolhido].chave,
                   f"{tipo}: '{a.texto}' saiu da area de desenho")

        sel = next(c for c in colocados if c.chave == cands[escolhido].chave)
        checar(sel.modo == "completo",
               f"{tipo}: o planeta selecionado foi rebaixado para {sel.modo}")

print(f"{total} cenarios, {sum(contagem.values())} rotulos colocados")
for modo, n in contagem.items():
    print(f"   {modo:<11}{n:>6}  ({100 * n / sum(contagem.values()):.1f}%)")

print("\nHisterese: o rotulo nao pula de lado quando o planeta anda devagar")
pos2 = PosicionadorRotulos()
cands = [Candidato(c, n, a, (300 + i * 80, 400), 5, 1.0 - i * 0.1)
         for i, (c, n, a) in enumerate(NOMES)]
lados = {c.chave: [] for c in cands}
for passo in range(40):
    for i, c in enumerate(cands):
        c.ponto = (300 + i * 80 + passo, 400 + passo // 4)
    for r in pos2.posicionar(cands, medir, QUADRO, PAINEIS):
        if r.modo != "ponto":
            lados[r.chave].append(1 if r.rect.centerx > r.ancora[0] else -1)
trocas = {k: sum(1 for a, b in zip(v, v[1:]) if a != b) for k, v in lados.items()}
pior = max(trocas.values()) if trocas else 0
print(f"   trocas de lado em 40 quadros: {trocas}")
checar(pior <= 2, f"rotulo trocou de lado {pior} vezes em 40 quadros (limite 2)")

print("\n" + "=" * 78)
if falhas:
    print(f"RESULTADO: {len(falhas)} falha(s) (mostrando ate 10):")
    for f in falhas[:10]:
        print("   - " + f)
else:
    print("RESULTADO: nenhuma sobreposicao em nenhum cenario.")
print("=" * 78)
raise SystemExit(1 if falhas else 0)
