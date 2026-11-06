"""
Compara as posicoes calculadas com a efemeride de referencia do JPL.

Roda offline: os pontos de referencia foram baixados do Horizons na hora de
gerar src/dados/*.json e ficam guardados la dentro.

    .venv/bin/python -m tests.test_efemeride

CRITERIO, definido antes de olhar os resultados:

    o erro de posicao de cada corpo deve ficar abaixo de 1% da distancia dele
    ao Sol, no intervalo de -100 a +100 anos em torno da epoca.

Um por cento e uma barra deliberadamente modesta. Ela diz que a simulacao
serve para mostrar como o sistema se move e onde os planetas estao, e nao que
ela substitui a efemeride do JPL. Mercurio e o caso mais dificil e chega a
cerca de 0,5% em 100 anos.

Por que sobra erro, em ordem de importancia:
  - truncamento do passo de 0,5 dia, que domina no caso de Mercurio;
  - a Lua entra como parte do baricentro Terra-Lua, nao como corpo proprio;
  - Plutao, asteroides e os demais corpos do DE441 nao existem neste modelo;
  - relatividade geral nao incluida (43"/seculo no perielio de Mercurio).

Nada disso desaparece integrando "com mais cuidado": sao limites do modelo de
nove corpos, e a documentacao diz isso.
"""

import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.dados.catalogo import carregar                        # noqa: E402
from src.fisica.efemerides import distancia_ao_sol_ua          # noqa: E402
from src.fisica.integrador import PASSO_PADRAO_DIAS, Yoshida4, avancar  # noqa: E402

UA_KM = 149597870.7
TOLERANCIA_RELATIVA = 0.01          # 1% da distancia ao Sol

falhas = []


def checar(cond, msg):
    print(("  [ok]    " if cond else "  [FALHA] ") + msg)
    if not cond:
        falhas.append(msg)


CORPOS, EST0, PROC, VALIDACAO = carregar()

print("=" * 78)
print("COMPARACAO COM A EFEMERIDE DE REFERENCIA (JPL)")
print("=" * 78)
print(f"epoca inicial   {PROC['epoca']['calendario_tdb']} "
      f"(JD {PROC['epoca']['jd_tdb']} {PROC['escala_de_tempo']})")
print(f"referencia      {PROC['vetores_de_estado']['fonte']}")
print(f"                efemeride citada: "
      f"{', '.join(PROC['vetores_de_estado']['efemeride_citada_pelo_horizons'])}")
print(f"integrador      Yoshida 4a ordem, passo fixo de {PASSO_PADRAO_DIAS} dia")
print(f"criterio        erro < {100 * TOLERANCIA_RELATIVA:.0f}% da distancia ao Sol")

if not VALIDACAO:
    print("\nA efemeride nao tem pontos de validacao. Regenere com:")
    print("    python ferramentas/gerar_efemeride.py --validacao")
    raise SystemExit(1)

for chave in sorted(VALIDACAO, key=lambda k: int(k)):
    ponto = VALIDACAO[chave]
    dias = ponto["dias_desde_a_epoca"]
    rotulo_anos = f"{int(chave):+d}"

    estado = carregar()[1]
    passos = int(round(abs(dias) / PASSO_PADRAO_DIAS))
    sinal = 1.0 if dias >= 0 else -1.0
    avancar(estado, Yoshida4(), sinal * PASSO_PADRAO_DIAS, passos)

    integrados = estado.t_dias
    assert abs(integrados - dias) < 1e-9, (
        f"desalinhamento de epoca: integrados {integrados} d, referencia {dias} d")

    print(f"\n{rotulo_anos:>4} anos -> {ponto['calendario_tdb']}  "
          f"({dias:.0f} dias integrados, {passos:,} passos)")
    print(f"   {'corpo':<9}{'|dr| (km)':>13}{'|dr| (UA)':>12}"
          f"{'% da dist. ao Sol':>20}")

    for i, corpo in enumerate(CORPOS):
        ref = np.array(ponto["corpos"][corpo.chave]["posicao_ua"])
        erro_ua = float(np.linalg.norm(estado.pos[i] - ref))

        if corpo.chave == "sol":
            # O Sol orbita o baricentro, entao "distancia ao Sol" nao serve de
            # escala para ele. Usa-se o raio do proprio Sol como referencia.
            escala = corpo.raio_ua
            rotulo = "% do raio solar"
        else:
            escala = distancia_ao_sol_ua(estado, i)
            rotulo = ""
        rel = erro_ua / escala

        print(f"   {corpo.nome:<9}{erro_ua * UA_KM:>13,.0f}{erro_ua:>12.2e}"
              f"{100 * rel:>19.3f}% {rotulo}")
        if corpo.chave != "sol":
            checar(rel < TOLERANCIA_RELATIVA,
                   f"{rotulo_anos:>4}a {corpo.nome:<9} desvio {100 * rel:.3f}% "
                   f"(limite {100 * TOLERANCIA_RELATIVA:.0f}%)")

    piores = sorted(
        ((float(np.linalg.norm(estado.pos[i] - np.array(ponto["corpos"][c.chave]["posicao_ua"])))
          / distancia_ao_sol_ua(estado, i), c.nome)
         for i, c in enumerate(CORPOS) if c.chave != "sol"), reverse=True)
    print(f"   pior caso: {piores[0][1]} com {100 * piores[0][0]:.3f}%")

print("\n" + "=" * 78)
if falhas:
    print(f"RESULTADO: {len(falhas)} falha(s):")
    for f in falhas:
        print("   - " + f)
else:
    print("RESULTADO: todos os corpos dentro do criterio em todos os pontos.")
    print("Isto NAO significa que a simulacao reproduz a efemeride do JPL por")
    print("tempo indefinido. Significa que, no intervalo avaliado, o desvio")
    print("fica abaixo do limite que definimos como aceitavel para o uso")
    print("educacional a que este programa se destina.")
print("=" * 78)
raise SystemExit(1 if falhas else 0)
