"""
Testes da camera e da escala visual. Nao abrem janela nem importam pygame.

    .venv/bin/python -m tests.test_projecao

O que estes testes protegem, em uma frase: que a tela seja uma leitura fiel do
estado fisico, e que a escala comprimida seja um efeito de desenho que nao
contamina nenhum numero.
"""

import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.dados.catalogo import carregar                              # noqa: E402
from src.fisica.efemerides import distancia_ao_sol_ua                # noqa: E402
from src.fisica.integrador import Yoshida4, avancar                  # noqa: E402
from src.projecao.camera import LIMITE_PX, Camera2D, Quadro          # noqa: E402
from src.projecao.enquadramento import MODOS, alvo_de_camera         # noqa: E402
from src.projecao.escala_visual import EscalaRaiz, EscalaReal        # noqa: E402

falhas = []


def checar(cond, msg):
    print(("  [ok]    " if cond else "  [FALHA] ") + msg)
    if not cond:
        falhas.append(msg)


QUADRO = Quadro(320, 56, 1000, 700)
CORPOS, EST0, _, _ = carregar()

print("=" * 78)
print("VALIDACAO DA PROJECAO 2D E DA CAMERA")
print("=" * 78)

# ---------------------------------------------------------------------------
print("\n1. Ida e volta entre pixels e UA")
cam = Camera2D(QUADRO, raio_ua=32.0)
pts = np.array([[0.0, 0.0], [1.0, -2.5], [-30.0, 17.0], [0.001, 0.001]])
volta = np.array([cam.tela_para_mundo(cam.mundo_para_tela(p)) for p in pts])
erro = float(np.max(np.abs(volta - pts)))
checar(erro < 1e-9, f"erro maximo na ida e volta: {erro:.2e} UA")

# ---------------------------------------------------------------------------
print("\n2. A projecao descarta z e nao mexe no estado")
est = EST0.copia()
antes = est.pos.copy()
tela3d = cam.mundo_para_tela(est.pos)
tela2d = cam.mundo_para_tela(est.pos[:, :2])
checar(np.array_equal(tela3d, tela2d), "projetar (N,3) e (N,2) da o mesmo resultado")
checar(np.array_equal(est.pos, antes), "o estado nao foi alterado ao projetar")

inclinado = est.copia()
inclinado.pos[:, 2] += 5.0                     # desloca tudo em z
checar(np.array_equal(cam.mundo_para_tela(inclinado.pos), tela3d),
       "mudar z nao muda a projecao 2D (a tela e o plano da ecliptica)")
z_max = float(np.max(np.abs(EST0.pos[:, 2])))
checar(z_max > 0.01,
       f"o estado guarda z de verdade: maior |z| = {z_max:.4f} UA "
       "(as orbitas sao inclinadas)")

# ---------------------------------------------------------------------------
print("\n3. Zoom no cursor deixa o ponto sob o cursor imovel")
for ancora in ((400, 200), (1200, 700), (820, 406)):
    cam = Camera2D(QUADRO, raio_ua=32.0)
    alvo = cam.tela_para_mundo(ancora)
    for f in (1.15, 1.15, 0.87, 1.4):
        cam.aplicar_zoom(f, ancora)
    depois = cam.mundo_para_tela(alvo)
    desvio = float(np.linalg.norm(np.array(depois) - np.array(ancora)))
    checar(desvio < 0.5, f"ancora {ancora}: deslocou {desvio:.3e} px")

# ---------------------------------------------------------------------------
print("\n4. Limites de zoom e enquadramento")
cam = Camera2D(QUADRO, raio_ua=32.0)
for _ in range(200):
    cam.aplicar_zoom(1.15, None)
checar(cam.raio_visivel_ua > 0 and np.isfinite(cam.px_por_ua),
       f"zoom maximo para num limite finito: campo de {cam.raio_visivel_ua:.4f} UA")
for _ in range(400):
    cam.aplicar_zoom(0.87, None)
checar(cam.raio_visivel_ua <= 61.0,
       f"zoom minimo limitado: campo de {cam.raio_visivel_ua:.1f} UA")

cam = Camera2D(QUADRO, raio_ua=32.0)
cam.enquadrar(31.5, animado=False)
canto = cam.mundo_para_tela([0.0, 31.5])
checar(QUADRO.y <= canto[1] <= QUADRO.y + QUADRO.height,
       f"enquadrar(31,5 UA) mantem Netuno dentro do quadro (y = {canto[1]:.0f})")

# ---------------------------------------------------------------------------
print("\n5. Redimensionar a janela preserva o campo de visao")
cam = Camera2D(QUADRO, raio_ua=12.0)
antes = cam.raio_visivel_ua
cam.definir_quadro(Quadro(0, 48, 620, 420))
checar(abs(cam.raio_visivel_ua - antes) / antes < 1e-9,
       f"campo antes {antes:.3f} UA, depois {cam.raio_visivel_ua:.3f} UA")

# ---------------------------------------------------------------------------
print("\n6. Coordenadas extremas nao viram NaN, infinito nem numero gigante")
cam = Camera2D(QUADRO, raio_ua=0.002)          # colado num planeta
cam.ir_para([0.39, 0.0], animado=False)
bruto = cam.mundo_para_tela(EST0.pos)          # Netuno fica a milhoes de px
limpo = Camera2D.sanear(bruto)
checar(np.all(np.isfinite(limpo)), "todos os pontos saneados sao finitos")
checar(np.max(np.abs(limpo)) <= LIMITE_PX,
       f"maior coordenada apos sanear: {np.max(np.abs(limpo)):,.0f} px "
       f"(limite {LIMITE_PX:,.0f})")
estranho = Camera2D.sanear(np.array([[np.nan, np.inf], [-np.inf, 1e30]]))
checar(np.all(np.isfinite(estranho)), f"NaN e infinito viram numero: {estranho.tolist()}")
checar(all(isinstance(int(v), int) for v in estranho.ravel()),
       "o resultado pode virar int sem estourar")

# ---------------------------------------------------------------------------
print("\n7. Escala comprimida: preserva angulo, comprime raio, nao toca a fisica")
real, raiz = EscalaReal(), EscalaRaiz()
sol = EST0.pos[0][:2]
xy = EST0.pos[:, :2]

checar(np.array_equal(real.aplicar(xy), xy), "a escala real nao altera nada")

comp = raiz.aplicar(xy, origem=sol)
ang_antes = np.arctan2(xy[1:, 1] - sol[1], xy[1:, 0] - sol[0])
ang_depois = np.arctan2(comp[1:, 1] - sol[1], comp[1:, 0] - sol[0])
checar(float(np.max(np.abs(ang_antes - ang_depois))) < 1e-12,
       "o angulo de cada planeta e preservado (a posicao angular continua certa)")

r_antes = np.linalg.norm(xy[1:] - sol, axis=1)
r_depois = np.linalg.norm(comp[1:] - sol, axis=1)
checar(np.all(np.diff(r_depois) > 0) and np.all(np.diff(r_antes) > 0),
       "a ordem dos planetas e mantida (transformacao monotonica)")
razao_antes = r_antes.max() / r_antes.min()
razao_depois = r_depois.max() / r_depois.min()
checar(razao_depois < razao_antes / 5,
       f"razao Netuno/Mercurio cai de {razao_antes:.1f}:1 para {razao_depois:.1f}:1")

centro = raiz.aplicar(np.array([sol]), origem=sol)
checar(np.all(np.isfinite(centro)), f"r = 0 nao explode: {centro.tolist()}")

est_copia = EST0.copia()
raiz.aplicar(est_copia.pos[:, :2], origem=sol)
checar(np.array_equal(est_copia.pos, EST0.pos),
       "aplicar a compressao nao escreveu de volta no estado")
d_real = distancia_ao_sol_ua(EST0, 8)
checar(abs(d_real - 29.88) < 0.1,
       f"a distancia informada de Netuno continua a real: {d_real:.3f} UA "
       f"(comprimida seria {r_depois[-1]:.3f})")

# ---------------------------------------------------------------------------
print("\n8. Modos de exploracao mudam a camera, nao a fisica")
est = EST0.copia()
avancar(est, Yoshida4(), 0.5, 200)
antes_pos, antes_t = est.pos.copy(), est.t_dias
cam = Camera2D(QUADRO, raio_ua=32.0)
for modo in MODOS:
    idx = 3 if modo.precisa_de_alvo else None
    centro, raio = alvo_de_camera(modo.chave, est, idx, afelio_ua=1.017)
    cam.ir_para(centro, animado=False)
    cam.enquadrar(raio, animado=False)
    checar(np.isfinite(cam.px_por_ua) and cam.px_por_ua > 0,
           f"{modo.rotulo:<20} campo de {cam.raio_visivel_ua:7.3f} UA")
checar(np.array_equal(est.pos, antes_pos) and est.t_dias == antes_t,
       "trocar de modo nao mexeu em nenhuma posicao nem no relogio")

centro_sistema, _ = alvo_de_camera("sistema", est)
checar(np.allclose(centro_sistema, est.pos[0][:2]),
       "a visao geral centra no Sol de agora, nao na origem fixa")

# ---------------------------------------------------------------------------
print("\n9. Acompanhar um planeta mantem ele parado na tela")
est = EST0.copia()
cam = Camera2D(QUADRO, raio_ua=2.0)
cam.seguir(4)                                   # Marte
cam.atualizar(1.0, est.pos, suave=False)
centro_tela = np.array([QUADRO.x + QUADRO.width / 2, QUADRO.y + QUADRO.height / 2])
desvios = []
for _ in range(60):
    avancar(est, Yoshida4(), 0.5, 20)
    cam.atualizar(1.0, est.pos, suave=False)
    desvios.append(float(np.linalg.norm(cam.mundo_para_tela(est.pos[4]) - centro_tela)))
checar(max(desvios) < 0.01,
       f"Marte fica no centro do quadro por 600 dias (desvio max {max(desvios):.1e} px)")

print("\n" + "=" * 78)
if falhas:
    print(f"RESULTADO: {len(falhas)} falha(s):")
    for f in falhas:
        print("   - " + f)
else:
    print("RESULTADO: todos os testes passaram.")
print("=" * 78)
raise SystemExit(1 if falhas else 0)
