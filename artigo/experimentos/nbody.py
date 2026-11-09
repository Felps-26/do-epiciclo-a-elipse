"""Reimplementacao em numpy do nucleo fisico do simulador (forcas.ts, integrador.ts),
usada so para gerar as figuras e tabelas do artigo."""
import json
import numpy as np

UA_KM = 149597870.7
import os
AQUI = os.path.dirname(os.path.abspath(__file__))
# o arquivo de condicoes iniciais do proprio simulador (copiado byte a byte do JPL Horizons)
EF = json.load(open(os.path.join(AQUI, '..', '..', 'simulador', 'src', 'dados', 'efemeride_2026-01-01.json'), encoding='utf-8'))
ORDEM = EF['ordem']
NOMES = [EF['corpos'][k]['nome'] for k in ORDEM]


def estado_inicial():
    pos = np.array([EF['corpos'][k]['posicao_ua'] for k in ORDEM], float)
    vel = np.array([EF['corpos'][k]['velocidade_ua_dia'] for k in ORDEM], float)
    gm = np.array([EF['corpos'][k]['gm_au3_dia2'] for k in ORDEM], float)
    return pos, vel, gm


def validacao(chave):
    v = EF['validacao'][chave]
    pos = np.array([v['corpos'][k]['posicao_ua'] for k in ORDEM], float)
    return v['dias_desde_a_epoca'], pos


def acel(pos, gm):
    d = pos[None, :, :] - pos[:, None, :]          # d[i,j] = r_j - r_i
    r2 = (d ** 2).sum(-1)
    np.fill_diagonal(r2, 1.0)
    inv = r2 ** -1.5
    np.fill_diagonal(inv, 0.0)
    return (gm[None, :, None] * inv[:, :, None] * d).sum(1)


W1 = 1.0 / (2.0 - 2.0 ** (1.0 / 3.0))
W0 = 1.0 - 2.0 * W1


def passo_leapfrog(p, v, gm, dt):
    v = v + 0.5 * dt * acel(p, gm)
    p = p + dt * v
    v = v + 0.5 * dt * acel(p, gm)
    return p, v


def passo_yoshida(p, v, gm, dt):
    for w in (W1, W0, W1):
        p = p + 0.5 * w * dt * v
        v = v + w * dt * acel(p, gm)
        p = p + 0.5 * w * dt * v
    return p, v


# velocidade da luz em UA/dia, a mesma conta de unidades.ts
C_UA_POR_DIA = 299792.458 * 86400.0 / UA_KM


def acel_pn(p, v, gm):
    """Termo pos-newtoniano de primeira ordem do Sol (corpo 0) em cada planeta, so ele:
    a = mu/(c^2 r^3) [(4 mu/r - v^2) r + 4 (r.v) v], com r e v em torno do Sol.
    Igual ao somarCorrecaoRelativistica de forcas.ts."""
    mu = gm[0]
    r = p - p[0]
    u = v - v[0]
    r1 = np.sqrt((r ** 2).sum(-1))
    r1[0] = 1.0                                     # o Sol nao recebe o termo
    v2 = (u ** 2).sum(-1)
    rv = (r * u).sum(-1)
    k = mu / (C_UA_POR_DIA ** 2 * r1 ** 3)
    a = k[:, None] * ((4 * mu / r1 - v2)[:, None] * r + 4 * rv[:, None] * u)
    a[0] = 0.0
    return a


def passo_yoshida_pn(p, v, gm, dt):
    # A forca depende de v, entao o kick deixa de ser exato e o metodo deixa de ser
    # exatamente simpletico. Avaliar o termo com a v do comeco do kick da um erro de ordem dt
    # que nao e reversivel e se acumula (Mercurio errava 8e6 km num seculo a 0,5 dia). Com
    # a v do meio do kick o metodo volta a ter erro de quarta ordem.
    for w in (W1, W0, W1):
        p = p + 0.5 * w * dt * v
        a = acel(p, gm)
        meio = v + 0.5 * w * dt * (a + acel_pn(p, v, gm))
        v = v + w * dt * (a + acel_pn(p, meio, gm))
        p = p + 0.5 * w * dt * v
    return p, v


def passo_rk4(p, v, gm, dt):
    k1p, k1v = v, acel(p, gm)
    k2p, k2v = v + 0.5 * dt * k1v, acel(p + 0.5 * dt * k1p, gm)
    k3p, k3v = v + 0.5 * dt * k2v, acel(p + 0.5 * dt * k2p, gm)
    k4p, k4v = v + dt * k3v, acel(p + dt * k3p, gm)
    p = p + dt / 6 * (k1p + 2 * k2p + 2 * k3p + k4p)
    v = v + dt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v)
    return p, v


# custo do metodo, nao desta implementacao: o leapfrog pode reaproveitar a aceleracao do fim
# do passo no comeco do seguinte (aqui e no integrador.ts ela e recalculada)
AVALIACOES = {'leapfrog': 1, 'yoshida4': 3, 'rk4': 4, 'yoshida4_pn': 3}
PASSOS = {'leapfrog': passo_leapfrog, 'yoshida4': passo_yoshida, 'rk4': passo_rk4,
          'yoshida4_pn': passo_yoshida_pn}


def energia(p, v, gm):
    # GM no lugar de massa: a energia sai dividida por G, o que nao muda o desvio relativo
    cin = 0.5 * (gm[:, None] * v ** 2).sum()
    pot = 0.0
    n = len(gm)
    for i in range(n):
        for j in range(i + 1, n):
            pot -= gm[i] * gm[j] / np.linalg.norm(p[i] - p[j])
    return cin + pot


def momento_angular(p, v, gm):
    return (gm[:, None] * np.cross(p, v)).sum(0)


def integrar(metodo, dt, dias, p=None, v=None, gm=None, registrar=None):
    if p is None:
        p, v, gm = estado_inicial()
    n = int(round(abs(dias) / abs(dt)))
    dt = np.sign(dias) * abs(dt)
    f = PASSOS[metodo]
    regs = []
    for k in range(n):
        p, v = f(p, v, gm, dt)
        if registrar and (k + 1) % registrar[0] == 0:
            regs.append(registrar[1](k + 1, p, v, gm))
    return p, v, gm, regs
