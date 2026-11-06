"""
Validacao do motor gravitacional de nove corpos.

Roda sem abrir janela e sem internet.

    .venv/bin/python -m tests.test_fisica_nbody

Cada bloco compara o resultado com algo que sabemos de forma independente:
leis de conservacao, reversibilidade da integracao, e os periodos orbitais
conhecidos dos planetas.
"""

import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.dados.catalogo import carregar, indice_de                    # noqa: E402
from src.fisica.efemerides import (angulo_heliocentrico,               # noqa: E402
                                   distancia_ao_sol_ua,
                                   elementos_osculadores)
from src.fisica.integrador import Leapfrog, Yoshida4, avancar          # noqa: E402
from src.fisica.simulador import Simulador                            # noqa: E402

UA_KM = 149597870.7
falhas = []


def checar(cond, msg):
    print(("  [ok]    " if cond else "  [FALHA] ") + msg)
    if not cond:
        falhas.append(msg)


def estado_novo():
    return carregar()[1]


CORPOS, EST0, PROC, VALIDACAO = carregar()
NOMES = [c.nome for c in CORPOS]

print("=" * 78)
print("VALIDACAO DO MOTOR GRAVITACIONAL DE NOVE CORPOS")
print("=" * 78)
print(f"epoca      {PROC['epoca']['calendario_tdb']} (JD {PROC['epoca']['jd_tdb']} {PROC['escala_de_tempo']})")
print(f"referencial {PROC['vetores_de_estado']['referencial']}")
print(f"origem      {PROC['vetores_de_estado']['centro']}")

# ---------------------------------------------------------------------------
print("\n1. Inicializacao simultanea: todos os corpos na MESMA epoca")
checar(EST0.t_dias == 0.0, f"relogio comeca em t = {EST0.t_dias} dias")
checar(EST0.n == 9, f"{EST0.n} corpos carregados")
checar(EST0.pos.shape == (9, 3) and EST0.vel.shape == (9, 3),
       f"estado em 3D: pos {EST0.pos.shape}, vel {EST0.vel.shape}")
checar(np.all(np.isfinite(EST0.pos)) and np.all(np.isfinite(EST0.vel)),
       "nenhum valor infinito ou NaN no estado inicial")
p = np.linalg.norm(EST0.momento_linear()) / np.sum(EST0.gm)
checar(p < 1e-10, f"momento linear total ~ 0 (estado baricentrico): {p:.2e} UA/dia")
d_cm = np.linalg.norm(EST0.centro_de_massa()) * UA_KM
checar(d_cm < 1000.0,
       f"centro de massa dos 9 corpos a {d_cm:.0f} km da origem "
       "(o resto e dos corpos que o modelo omite)")

# ---------------------------------------------------------------------------
print("\n2. Conservacao de energia e momento angular (Yoshida4, dt = 0,5 dia)")
for anos in (1, 10, 100):
    e = estado_novo()
    E0, L0 = e.energia(), e.momento_angular()
    avancar(e, Yoshida4(), 0.5, int(anos * 365.25 * 2))
    dE = abs((e.energia() - E0) / E0)
    dL = np.linalg.norm(e.momento_angular() - L0) / np.linalg.norm(L0)
    checar(dE < 1e-8 and dL < 1e-12,
           f"{anos:>3} anos: dE/E = {dE:.1e}   dL/L = {dL:.1e}")

# ---------------------------------------------------------------------------
print("\n3. O Sol tambem se move (nao e um ponto fixo sem massa)")
e = estado_novo()
avancar(e, Yoshida4(), 0.5, 365 * 2 * 12)      # 12 anos, ~1 volta de Jupiter
desloc = np.linalg.norm(e.pos[0] - EST0.pos[0]) * UA_KM
r_sol = CORPOS[0].raio_km
checar(desloc > r_sol,
       f"o Sol andou {desloc:,.0f} km em 12 anos, mais que o proprio raio "
       f"({r_sol:,.0f} km)")

# ---------------------------------------------------------------------------
print("\n4. Relogio compartilhado: Mercurio da mais voltas que Netuno")
print("   (mesmo intervalo de tempo para todos -- nada de 6 s por orbita)")
e = estado_novo()
ang0 = np.array([angulo_heliocentrico(e, i) for i in range(1, 9)])
voltas = np.zeros(8)
ant = ang0.copy()
passos_por_ano = int(365.25 * 2)
for _ in range(5):                                    # 5 anos, em fatias
    for _ in range(passos_por_ano // 10):
        avancar(e, Yoshida4(), 0.5, 10)
        atual = np.array([angulo_heliocentrico(e, i) for i in range(1, 9)])
        d = np.unwrap(np.stack([ant, atual]), axis=0)[1] - ant
        voltas += d / (2 * np.pi)
        ant = atual
voltas = np.abs(voltas)
print(f"   {'planeta':<9}{'voltas em 5 anos':>18}{'esperado (T real)':>20}")
esperado = []
for k, i in enumerate(range(1, 9)):
    T = elementos_osculadores(EST0, i)["periodo_dias"]
    esperado.append(5 * 365.25 / T)
    print(f"   {NOMES[i]:<9}{voltas[k]:>18.3f}{esperado[k]:>20.3f}")
checar(np.all(np.diff(voltas) < 0),
       "o numero de voltas cai de Mercurio a Netuno, sem excecao")
checar(voltas[0] > 20 * voltas[4],
       f"Mercurio deu {voltas[0]:.1f} voltas e Jupiter {voltas[4]:.2f}")
# Para quem completa varias voltas, a taxa media vale e o confronto e direto.
# Para Jupiter e os de fora, que nao fecham nem uma volta em 5 anos, comparar
# com a taxa MEDIA seria errado: pela 2a lei de Kepler o corpo varre angulo
# mais depressa perto do perielio, entao um trecho de orbita nao anda na
# media. Nao e erro de conta -- e a orbita nao ser um circulo.
completam_volta = [k for k in range(8) if esperado[k] >= 2.0]
checar(all(abs(voltas[k] - esperado[k]) / esperado[k] < 0.02 for k in completam_volta),
       "para quem completa 2+ voltas, o angulo varrido bate com o periodo (2%): "
       + ", ".join(NOMES[k + 1] for k in completam_volta))
checar(all(voltas[k] > 0 for k in range(8)),
       "os corpos de fora avancam no mesmo relogio, sem fechar uma volta em 5 anos")

# ---------------------------------------------------------------------------
print("\n5. Elementos osculadores heliocentricos vs elementos medios conhecidos")
print("   (usa posicao e velocidade RELATIVAS AO SOL -- ver efemerides.py)")
# Elementos medios em J2000. Fonte: NASA Planetary Fact Sheet.
# As chaves seguem os nomes da efemeride, com acento.
REF = {"Mercúrio": (0.38710, 0.20563), "Vênus": (0.72333, 0.00677),
       "Terra": (1.00000, 0.01671), "Marte": (1.52371, 0.09339),
       "Júpiter": (5.20288, 0.04839), "Saturno": (9.53667, 0.05386),
       "Urano": (19.18916, 0.04726), "Netuno": (30.06992, 0.00859)}
assert set(REF) == {c.nome for c in CORPOS if c.chave != "sol"}, (
    "os nomes de REF nao batem com os da efemeride: "
    f"{set(REF) ^ {c.nome for c in CORPOS if c.chave != 'sol'}}")
for i in range(1, 9):
    el = elementos_osculadores(EST0, i)
    a_ref, e_ref = REF[NOMES[i]]
    erro = abs(el["a"] - a_ref) / a_ref
    # Internos: osculador e medio quase coincidem. Externos: divergem de
    # verdade, por perturbacao mutua -- e fisica real, nao erro de conta.
    tol = 0.005 if i <= 4 else 0.02
    checar(erro < tol,
           f"{NOMES[i]:<9} a = {el['a']:9.5f} UA (ref {a_ref:8.5f}, "
           f"desvio {100 * erro:.2f}%, limite {100 * tol:.1f}%)")

# ---------------------------------------------------------------------------
print("\n6. Reversibilidade: ir 20 anos e voltar devolve o estado inicial")
e = estado_novo()
n = int(20 * 365.25 * 2)
avancar(e, Yoshida4(), 0.5, n)
avancar(e, Yoshida4(), -0.5, n)
erro = float(np.max(np.linalg.norm(e.pos - EST0.pos, axis=1))) * UA_KM
checar(erro < 1.0, f"erro maximo ao voltar: {erro:.3e} km")
checar(abs(e.t_dias) < 1e-9, f"relogio volta a zero: t = {e.t_dias:.1e} dias")

# ---------------------------------------------------------------------------
print("\n7. Yoshida4 e mais preciso que leapfrog pelo mesmo custo")
print("   (leapfrog com dt 3x menor = mesmo numero de avaliacoes de forca)")
ref = VALIDACAO.get("10")
if ref:
    # Integrar ate o numero EXATO de dias do ponto de referencia. Usar
    # 10*365,25 erraria por meio dia, e meio dia de Terra ja sao 1,3 milhao
    # de km -- o erro do calendario abafaria o erro do integrador.
    alvo_dias = ref["dias_desde_a_epoca"]
    a = estado_novo()
    avancar(a, Yoshida4(), 0.5, int(round(alvo_dias / 0.5)))
    b = estado_novo()
    avancar(b, Leapfrog(), 0.5 / 3.0, int(round(alvo_dias / (0.5 / 3.0))))
    pos_ref = np.array([ref["corpos"][c.chave]["posicao_ua"] for c in CORPOS])
    ey = np.linalg.norm(a.pos - pos_ref, axis=1) * UA_KM
    el_ = np.linalg.norm(b.pos - pos_ref, axis=1) * UA_KM
    checar(ey.max() < el_.max(),
           f"pior erro em {alvo_dias:.0f} dias: Yoshida4 {ey.max():,.0f} km  x  "
           f"leapfrog {el_.max():,.0f} km")
else:
    print("  [pulado] efemeride sem pontos de validacao")

# ---------------------------------------------------------------------------
print("\n8. Estabilidade: nenhum planeta escapa nem cai no Sol em 200 anos")
e = estado_novo()
r_min = np.full(9, np.inf)
r_max = np.zeros(9)
for _ in range(200):
    avancar(e, Yoshida4(), 0.5, int(365.25 * 2))
    r = np.array([distancia_ao_sol_ua(e, i) for i in range(9)])
    r_min, r_max = np.minimum(r_min, r), np.maximum(r_max, r)
for i in range(1, 9):
    el = elementos_osculadores(EST0, i)
    ok = (r_min[i] > 0.7 * el["perielio"]) and (r_max[i] < 1.3 * el["afelio"])
    checar(ok, f"{NOMES[i]:<9} r entre {r_min[i]:8.4f} e {r_max[i]:8.4f} UA "
               f"(perielio {el['perielio']:.4f}, afelio {el['afelio']:.4f})")
checar(all(elementos_osculadores(e, i)["ligada"] for i in range(1, 9)),
       "todas as orbitas continuam ligadas (energia negativa) apos 200 anos")

# ---------------------------------------------------------------------------
print("\n9. O simulador nunca mente sobre o tempo que entregou")
e = estado_novo()
s = Simulador(e, Yoshida4(), dt_dias=0.5, passos_max_por_quadro=10)
r = s.avancar(1 / 60, 1_000_000)
checar(r.atrasado, "velocidade impossivel e marcada como atrasada")
checar(r.passos == 10, f"entregou exatamente o orcamento: {r.passos} passos")
checar(abs(r.dias_dados - 5.0) < 1e-12,
       f"avancou {r.dias_dados} dias, que e 10 passos x 0,5 dia")
checar(abs(e.t_dias - 5.0) < 1e-12,
       f"o relogio marca {e.t_dias} dias, igual ao que a fisica andou")

e2 = estado_novo()
s2 = Simulador(e2, Yoshida4(), dt_dias=0.5, passos_max_por_quadro=140)
entregue = sum(s2.avancar(1 / 60, 365.0).dias_dados for _ in range(600))
checar(abs(entregue - 3650.0) <= 0.5,
       f"em 10 s a 365 d/s entregou {entregue} dias (defasagem <= 1 passo)")
checar(not s2.avancar(1 / 60, 365.0).atrasado,
       "365 dias/s nao marca atraso nesta maquina")

# ---------------------------------------------------------------------------
print("\n" + "=" * 78)
if falhas:
    print(f"RESULTADO: {len(falhas)} falha(s):")
    for f in falhas:
        print("   - " + f)
else:
    print("RESULTADO: todos os testes passaram.")
print("=" * 78)
raise SystemExit(1 if falhas else 0)
