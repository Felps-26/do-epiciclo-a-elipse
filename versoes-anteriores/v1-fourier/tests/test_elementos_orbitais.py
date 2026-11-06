#!/usr/bin/env python3
"""
Testa a correção de referencial em utils.lib._orbital_elements.

    .venv/bin/python -m tests.test_elementos_orbitais

O erro corrigido
----------------
A função calculava elementos orbitais heliocêntricos usando posição e
velocidade BARICÊNTRICAS -- medidas a partir do baricentro do Sistema Solar --
mas com μ = G·M_sol, a gravidade do Sol. São dois referenciais diferentes
misturados na mesma conta.

O Sol orbita o baricentro a cerca de 0,0077 UA, puxado sobretudo por Júpiter.
Para Vênus, cuja órbita tem 0,72 UA, ignorar esse deslocamento inflava a
excentricidade calculada em duas vezes e meia.

Critério deste teste
--------------------
Os planetas internos, cuja órbita é pouco perturbada, têm elementos
osculadores praticamente iguais aos elementos médios tabelados: exigimos 0,5%
no semi-eixo maior e 0,002 em excentricidade.

Os externos recebem tolerância maior (3% e 0,01) porque ali a diferença entre
elemento osculador e elemento médio é física e real, não erro de conta:
Saturno e Júpiter se perturbam mutuamente o bastante para que a elipse de um
instante difira da média de longo prazo.
"""

import os
import sys

import numpy as np
from astropy import constants as const
from astropy import units as u
from astropy.coordinates import get_body_barycentric_posvel, solar_system_ephemeris
from astropy.time import Time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.lib import _PLANET_NAMES, _orbital_elements    # noqa: E402

# Elementos médios em J2000. Fonte: NASA Planetary Fact Sheet.
REFERENCIA = {
    'Mercúrio': (0.38710, 0.20563, 87.969),
    'Vênus':    (0.72333, 0.00677, 224.701),
    'Terra':    (1.00000, 0.01671, 365.256),
    'Marte':    (1.52371, 0.09339, 686.980),
    'Júpiter':  (5.20288, 0.04839, 4332.589),
    'Saturno':  (9.53667, 0.05386, 10759.22),
    'Urano':    (19.18916, 0.04726, 30685.4),
    'Netuno':   (30.06992, 0.00859, 60189.0),
}
INTERNOS = ('Mercúrio', 'Vênus', 'Terra', 'Marte')

TOL_A_INTERNO, TOL_E_INTERNO = 0.005, 0.002
TOL_A_EXTERNO, TOL_E_EXTERNO = 0.03, 0.010

EPOCA = Time('J2000')

falhas = []


def checar(cond, msg):
    print(("  [ok]    " if cond else "  [FALHA] ") + msg)
    if not cond:
        falhas.append(msg)


def _elementos_com_o_erro_antigo(body):
    """Reproduz o cálculo errado, para medir de quanto era o erro."""
    with solar_system_ephemeris.set('builtin'):
        pos, vel = get_body_barycentric_posvel(body, EPOCA)
    r_vec = pos.xyz.to(u.m).value
    v_vec = vel.xyz.to(u.m / u.s).value
    mu = (const.G * const.M_sun).to(u.m**3 / u.s**2).value
    r, v = np.linalg.norm(r_vec), np.linalg.norm(v_vec)
    a_m = -mu / (v**2 - 2 * mu / r)
    h = np.cross(r_vec, v_vec)
    e = np.linalg.norm(np.cross(v_vec, h) / mu - r_vec / r)
    T = (2 * np.pi * np.sqrt(a_m**3 / mu) * u.s).to(u.day).value
    return (a_m * u.m).to(u.au).value, e, T


print("=" * 78)
print("ELEMENTOS ORBITAIS: REFERENCIAL BARICÊNTRICO x HELIOCÊNTRICO")
print("=" * 78)

# ---------------------------------------------------------------------------
print("\n1. O Sol de fato se desloca em relação ao baricentro")
with solar_system_ephemeris.set('builtin'):
    sol_pos, sol_vel = get_body_barycentric_posvel('sun', EPOCA)
d_sol = np.linalg.norm(sol_pos.xyz.to(u.au).value)
checar(d_sol > 0.001,
       f"na época J2000 o Sol está a {d_sol:.5f} UA do baricentro "
       f"({np.linalg.norm(sol_pos.xyz.to(u.km).value):,.0f} km) -- "
       "é isto que a correção leva em conta")

# ---------------------------------------------------------------------------
print("\n2. Elementos corrigidos batem com os valores tabelados")
print(f"   {'planeta':<10}{'a calc.':>10}{'a ref.':>10}{'desvio':>9}"
      f"{'e calc.':>10}{'e ref.':>10}{'desvio':>9}")
print("   " + "-" * 68)
for nome, body in _PLANET_NAMES.items():
    a, e, T = _orbital_elements(body, EPOCA)
    a_ref, e_ref, T_ref = REFERENCIA[nome]
    interno = nome in INTERNOS
    tol_a = TOL_A_INTERNO if interno else TOL_A_EXTERNO
    tol_e = TOL_E_INTERNO if interno else TOL_E_EXTERNO

    da = abs(a - a_ref) / a_ref
    de = abs(e - e_ref)
    print(f"   {nome:<10}{a:>10.5f}{a_ref:>10.5f}{100 * da:>8.2f}%"
          f"{e:>10.5f}{e_ref:>10.5f}{de:>9.5f}")
    checar(da < tol_a and de < tol_e,
           f"{nome:<9} dentro da tolerância "
           f"({100 * tol_a:.1f}% em a, {tol_e} em e)")

# ---------------------------------------------------------------------------
print("\n3. A correção melhora de verdade os planetas internos")
print("   (se não melhorasse, ela não estaria fazendo nada)")
print(f"   {'planeta':<10}{'erro antes':>12}{'erro depois':>13}{'melhora':>10}")
print("   " + "-" * 45)
for nome in INTERNOS:
    body = _PLANET_NAMES[nome]
    a_ref = REFERENCIA[nome][0]
    a_antes = _elementos_com_o_erro_antigo(body)[0]
    a_depois = _orbital_elements(body, EPOCA)[0]
    erro_antes = abs(a_antes - a_ref) / a_ref
    erro_depois = abs(a_depois - a_ref) / a_ref
    fator = erro_antes / erro_depois if erro_depois > 1e-9 else float("inf")
    print(f"   {nome:<10}{100 * erro_antes:>11.2f}%{100 * erro_depois:>12.2f}%"
          f"{fator:>9.0f}x")
    checar(erro_depois < erro_antes / 5,
           f"{nome:<9} erro em a cai de {100 * erro_antes:.2f}% "
           f"para {100 * erro_depois:.2f}%")

# ---------------------------------------------------------------------------
print("\n4. O caso mais grave: a excentricidade de Vênus")
e_antes = _elementos_com_o_erro_antigo('venus')[1]
e_depois = _orbital_elements('venus', EPOCA)[1]
e_ref = REFERENCIA['Vênus'][1]
print(f"   com o erro: {e_antes:.5f}   corrigido: {e_depois:.5f}   "
      f"referência: {e_ref:.5f}")
checar(e_antes / e_ref > 2.0,
       f"o erro inflava a excentricidade em {e_antes / e_ref:.1f} vezes")
checar(abs(e_depois - e_ref) < 0.0005,
       f"corrigida, bate com a referência (diferença de {abs(e_depois - e_ref):.5f})")

# ---------------------------------------------------------------------------
print("\n5. Invariante: o resultado não pode depender do referencial de origem")
print("   (o mesmo planeta visto do Sol dá o mesmo resultado, sempre)")
for nome, body in list(_PLANET_NAMES.items())[:3]:
    with solar_system_ephemeris.set('builtin'):
        p, v = get_body_barycentric_posvel(body, EPOCA)
        ps, vs = get_body_barycentric_posvel('sun', EPOCA)
    r = (p - ps).xyz.to(u.m).value
    vv = (v - vs).xyz.to(u.m / u.s).value
    mu = (const.G * const.M_sun).to(u.m**3 / u.s**2).value
    a_direto = (-mu / (vv @ vv - 2 * mu / np.linalg.norm(r)) * u.m).to(u.au).value
    a_funcao = _orbital_elements(body, EPOCA)[0]
    checar(abs(a_direto - a_funcao) < 1e-12,
           f"{nome:<9} a função usa mesmo o estado relativo ao Sol")

# ---------------------------------------------------------------------------
print("\n6. Todos os oito planetas são suportados")
checar(len(_PLANET_NAMES) == 8,
       f"{len(_PLANET_NAMES)} planetas: {', '.join(_PLANET_NAMES)}")
checar('Terra' in _PLANET_NAMES,
       "a Terra está incluída (entra como baricentro Terra-Lua)")

print("\n" + "=" * 78)
if falhas:
    print(f"RESULTADO: {len(falhas)} falha(s):")
    for f in falhas:
        print("   - " + f)
else:
    print("RESULTADO: todos os testes passaram.")
print("=" * 78)
raise SystemExit(1 if falhas else 0)
