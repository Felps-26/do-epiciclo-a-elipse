"""
Conferencia de contraste da paleta, pela formula da WCAG 2.2.

    .venv/bin/python -m tests.test_tema

Limite de 4,5:1 para texto normal e 3:1 para elemento grafico. Cobre tambem a
regra de que cor de planeta nunca vira cor de texto: o teste mostra quais
reprovariam se alguem tentasse.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.ui.tema import PARES_PARA_CONFERIR, TEMA, contraste    # noqa: E402

falhas = []

print("=" * 78)
print("CONTRASTE DA PALETA (WCAG 2.2)")
print("=" * 78)
print(f"{'par':<40}{'medido':>9}{'minimo':>9}   veredito")
print("-" * 78)

for nome, frente, fundo, minimo in PARES_PARA_CONFERIR:
    r = contraste(frente, fundo)
    ok = r >= minimo
    print(f"{nome:<40}{r:>8.2f}:1{minimo:>8.1f}:1   {'ok' if ok else 'REPROVA'}")
    if not ok:
        falhas.append(f"{nome}: {r:.2f}:1, precisa de {minimo}:1")

print("\nPor que cor de planeta nao serve como cor de texto")
print("(limite 4,5:1 -- as duas ultimas reprovariam):")
for chave, cor in sorted(TEMA.corpos.items(), key=lambda kv: contraste(kv[1], TEMA.painel)):
    r = contraste(cor, TEMA.painel)
    print(f"   {chave:<9}{r:>7.2f}:1   {'serviria' if r >= 4.5 else 'REPROVARIA como texto'}")

print("\n" + "=" * 78)
if falhas:
    print(f"RESULTADO: {len(falhas)} par(es) abaixo do limite:")
    for f in falhas:
        print("   - " + f)
else:
    print(f"RESULTADO: os {len(PARES_PARA_CONFERIR)} pares usados pela interface passam.")
print("=" * 78)
raise SystemExit(1 if falhas else 0)
