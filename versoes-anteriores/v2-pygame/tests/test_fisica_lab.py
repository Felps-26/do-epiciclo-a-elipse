"""
Validacao da matematica do laboratorio: elipse de Kepler e serie de Fourier.

    .venv/bin/python -m tests.test_fisica_lab

Migrado do tests/test_fisica.py da versao anterior. A diferenca e que os
elementos orbitais nao vem mais de uma tabela fixa: sao calculados a partir do
estado da simulacao de nove corpos, como o laboratorio faz de verdade.

Cada bloco compara o resultado com algo que sabemos de forma independente --
geometria da elipse, 2a lei de Kepler e a solucao analitica de Fourier-Bessel
do problema de Kepler.
"""

import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.dados.catalogo import carregar                       # noqa: E402
from src.fisica.efemerides import elementos_osculadores        # noqa: E402
from src.fisica.fourier import PISO_RESIDUO_UA, SerieFourier   # noqa: E402
from src.fisica.kepler import OrbitaKepler                     # noqa: E402

PISO = 1e-13
falhas = []


def checar(cond, msg):
    print(("  [ok]    " if cond else "  [FALHA] ") + msg)
    if not cond:
        falhas.append(msg)


CORPOS, EST0, _, _ = carregar()
ORBITAS = [(c.nome, OrbitaKepler.de_elementos(elementos_osculadores(EST0, i), c.nome))
           for i, c in enumerate(CORPOS) if c.chave != "sol"]

print("=" * 78)
print("VALIDACAO DO LABORATORIO: KEPLER E FOURIER")
print("=" * 78)

# ---------------------------------------------------------------------------
print("\n1. Os elementos vem da simulacao, nao de uma tabela fixa")
checar(all(o.a > 0 and 0 <= o.e < 1 for _, o in ORBITAS),
       "as oito elipses sao validas (a > 0, 0 <= e < 1)")
checar(abs(ORBITAS[2][1].a - 1.0) < 0.01,
       f"a Terra sai com a = {ORBITAS[2][1].a:.5f} UA, como esperado")

# ---------------------------------------------------------------------------
print("\n2. Equacao de Kepler: residuo de E - e*sen(E) - M")
for nome, orb in ORBITAS:
    M = np.linspace(0, 2 * np.pi, 5000)
    E = orb._kepler(M)
    res = float(np.max(np.abs(E - orb.e * np.sin(E) - M)))
    checar(res < 1e-12, f"{nome:<9} e={orb.e:.5f}  residuo max = {res:.1e}")

# ---------------------------------------------------------------------------
print("\n3. Geometria: perielio em t=0, afelio em t=0,5")
for nome, orb in ORBITAS:
    r0 = float(np.hypot(*orb.posicao(0.0)))
    rh = float(np.hypot(*orb.posicao(0.5)))
    ok = abs(r0 - orb.r_perielio) < 1e-9 and abs(rh - orb.r_afelio) < 1e-9
    checar(ok, f"{nome:<9} r_peri={r0:9.6f}  r_afe={rh:9.6f} UA")

# ---------------------------------------------------------------------------
print("\n4. 2a lei de Kepler: 12 setores de mesmo dt tem a mesma area")
for nome, orb in ORBITAS:
    t = np.linspace(0, 1, 12001)
    x, y = orb.posicao(t)
    dA = 0.5 * (x[:-1] * np.diff(y) - y[:-1] * np.diff(x))
    setores = dA.reshape(12, -1).sum(axis=1)
    disp = float(np.std(setores) / np.mean(setores))
    checar(disp < 1e-4, f"{nome:<9} dispersao relativa = {disp:.1e}")

# ---------------------------------------------------------------------------
print("\n5. Simetria: perielio no eixo +x => x(t) par, y(t) impar")
print("   (logo os coeficientes bx e ay devem ser nulos)")
for nome, orb in ORBITAS:
    s = SerieFourier(orb.curva())
    m = max(np.max(np.abs(s.bx)), np.max(np.abs(s.ay)))
    checar(m < 1e-12, f"{nome:<9} max(|bx|, |ay|) = {m:.1e}")

# ---------------------------------------------------------------------------
print("\n6. Convergencia: desvio medio como % do semieixo maior")
ns = [1, 2, 3, 4, 5, 6, 8, 10]
cab = f"   {'planeta':<9}{'e':>8}  " + "".join(f"{n:>9}" for n in ns)
print(cab)
print("   " + "-" * (len(cab) - 3))
for nome, orb in ORBITAS:
    s = SerieFourier(orb.curva())
    linha = f"   {nome:<9}{orb.e:>8.4f}  "
    for n in ns:
        med, _ = s.erro(n)
        rel = 100 * med / orb.a
        linha += f"{rel:>8.4f}%" if rel >= 1e-4 else f"{'~0':>9}"
    print(linha)

print("\n   o desvio so cresce se ja estiver no piso do float64 (1e-13):")
for nome, orb in ORBITAS:
    s = SerieFourier(orb.curva())
    erros = [s.erro(n)[0] for n in range(1, 21)]
    ok = all(erros[i + 1] <= erros[i]
             for i in range(len(erros) - 1) if erros[i] > PISO)
    n_piso = s.harmonicos_ate_o_piso(PISO_RESIDUO_UA)
    nota = (f"atinge o piso com {n_piso} ondas" if n_piso
            else "ainda convergindo em 24")
    checar(ok, f"{nome:<9} {nota}")

# ---------------------------------------------------------------------------
print("\n7. Primeiro harmonico: quase-circulo de raio a(1 - 3e^2/8)")
print("   (NAO e um circulo exato -- so vira circulo no limite e -> 0)")
for nome, orb in ORBITAS:
    s = SerieFourier(orb.curva())
    a1, b1 = s.ax[1] / orb.a, s.by[1] / orb.a
    checar(abs(a1 - (1 - 3 * orb.e ** 2 / 8)) < 5e-3,
           f"{nome:<9} a1/a={a1:.6f}  b1/a={b1:.6f}  "
           f"achatamento={abs(a1 - b1):.1e}")

# ---------------------------------------------------------------------------
print("\n8. Coeficientes vs solucao analitica de Fourier-Bessel")
print("   a0/2 = -3ea/2      an = a*(2/n)*J'n(ne)      bn = a*2*sqrt(1-e^2)/(ne)*Jn(ne)")
try:
    from scipy.special import jv, jvp

    for nome, orb in ORBITAS:
        s = SerieFourier(orb.curva())
        n = np.arange(1, s.termos_max + 1)
        an = orb.a * (2.0 / n) * jvp(n, n * orb.e)
        bn = orb.a * 2.0 * np.sqrt(1 - orb.e ** 2) / (n * orb.e) * jv(n, n * orb.e)
        e0 = abs(s.ax[0] / 2 + 1.5 * orb.e * orb.a)
        ea = float(np.max(np.abs(s.ax[1:] - an)))
        eb = float(np.max(np.abs(s.by[1:] - bn)))
        pior = max(e0, ea, eb)
        checar(pior < 1e-12, f"{nome:<9} erro max nos coeficientes = {pior:.1e}")
except ImportError:
    print("  [pulado] scipy nao instalado (opcional -- so este bloco usa)")

# ---------------------------------------------------------------------------
print("\n9. Marcas de tempo igual: o espacamento reflete a velocidade orbital")
print("   razao maior/menor espacamento deve tender a (1+e)/(1-e)")
for nome, orb in ORBITAS:
    c = orb.curva(1024)
    d = np.linalg.norm(np.diff(np.vstack([c, c[:1]]), axis=0), axis=1)
    medido = float(d.max() / d.min())
    previsto = (1 + orb.e) / (1 - orb.e)
    checar(abs(medido - previsto) / previsto < 2e-3,
           f"{nome:<9} medido {medido:.4f}  previsto {previsto:.4f}")

print("\n" + "=" * 78)
if falhas:
    print(f"RESULTADO: {len(falhas)} falha(s):")
    for f in falhas:
        print("   - " + f)
else:
    print("RESULTADO: todos os testes passaram.")
print("=" * 78)
raise SystemExit(1 if falhas else 0)
