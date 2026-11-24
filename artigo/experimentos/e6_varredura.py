"""E6: o integrador do simulador contra a DE440s, de -100 a +100 anos, a cada 10 dias.

Por planeta e por instante: erro de longitude heliocêntrica, ângulo entre a direção
Terra->planeta do modelo e a do JPL (para a Terra, a direção do Sol) e erro de posição
dividido pela distância ao Sol. Grava os máximos em e6.json e a figura varredura.pdf.
"""
import datetime
import json
import os
import time

import numpy as np

from estilo import OI, configurar, plt
from nbody import AQUI, NOMES, ORDEM, UA_KM, estado_inicial, integrar
from referencia_jpl import posicoes_jpl

DT, DIAS, CADA = 0.5, 36525.0, 20          # passo do programa; 100 anos; registro a cada 10 dias
CRUZADA = {'1': 365.0, '10': 3652.0, '100': 36525.0, '-10': -3652.0, '-100': -36525.0}
SEG = 180 / np.pi * 3600
TER, SOL = ORDEM.index("terra"), 0


def varrer(sentido):
    alvo = {int(round(abs(d) / DT)) for d in CRUZADA.values() if np.sign(d) == sentido}
    regs = {}
    def guarda(k, p, v, gm):
        if k % CADA == 0 or k in alvo:
            regs[k * DT * sentido] = p.copy()
    integrar('yoshida4', DT, sentido * DIAS, registrar=(1, guarda))
    return regs


def lon(x):
    return np.arctan2(x[..., 1], x[..., 0])

def angulo(a, b):
    return np.arctan2(np.linalg.norm(np.cross(a, b), axis=-1), (a * b).sum(-1))

def data(d):
    return (datetime.date(2026, 1, 1) + datetime.timedelta(days=float(d))).isoformat()

def envelope(e, n=81):
    """máximo em janelas de 810 dias, mais que o período sinódico de Marte (780 dias)"""
    pad = np.pad(e, n // 2, mode='edge')
    return np.lib.stride_tricks.sliding_window_view(pad, n).max(-1)


def main():
    t0 = time.time()
    regs = {0.0: estado_inicial()[0]}
    for s in (1, -1):
        regs.update(varrer(s))
        print(f'sentido {s:+d}: {time.time() - t0:.0f} s')
    dias = np.array(sorted(regs))
    mod = np.array([regs[d] for d in dias])                 # (n, 9, 3)
    jpl = posicoes_jpl(dias)

    # conferência cruzada com o E1 (modelo contra o Horizons nas cinco datas): o erro em km
    # tem de bater até 1 km. Usa o e1.json gerado por e1_validacao.py; sem ele, pula.
    cruzada = {}
    arq = os.path.join(AQUI, 'e1.json')
    if os.path.exists(arq):
        with open(arq) as f:
            base = json.load(f)
    else:
        base = None
        print('sem e1.json: conferência cruzada pulada')
    for ch, d in CRUZADA.items():
        i = np.searchsorted(dias, d)
        km = np.linalg.norm(mod[i] - jpl[i], axis=1) * UA_KM
        cruzada[ch] = {'erro_km': km.tolist()}
        if base:
            dif = np.abs(km - np.array(base[ch]['erro_km']))
            cruzada[ch]['dif_e1_km'] = dif.tolist()
            print(f'{ch:>5} anos: maior diferença para o E1 {dif.max():.2e} km')
            assert dif.max() < 1.0, 'E6 não bate com o E1'


    hm, hj = mod - mod[:, SOL:SOL + 1], jpl - jpl[:, SOL:SOL + 1]   # heliocêntricas
    gm_, gj = mod - mod[:, TER:TER + 1], jpl - jpl[:, TER:TER + 1]  # geocêntricas
    gm_[:, TER], gj[:, TER] = -hm[:, TER], -hj[:, TER]              # da Terra: direção do Sol
    err_lon = np.abs((lon(hm) - lon(hj) + np.pi) % (2 * np.pi) - np.pi) * SEG
    err_geo = angulo(gm_, gj) * SEG
    with np.errstate(divide='ignore', invalid='ignore'):                 # coluna do Sol: 0/0
        err_rel = np.linalg.norm(mod - jpl, axis=-1) / np.linalg.norm(hj, axis=-1)


    maximos = {}
    for j, nome in enumerate(ORDEM[1:], start=1):
        maximos[nome] = {}
        for chave, e in (('longitude_helio_seg', err_lon), ('direcao_geo_seg', err_geo), ('relativo', err_rel)):
            i = int(np.argmax(e[:, j]))
            maximos[nome][chave] = {'max': float(e[i, j]), 'dia': float(dias[i]), 'data': data(dias[i])}
        i = int(np.argmax(err_rel[:, j]))
        maximos[nome]['km_no_max_relativo'] = float(np.linalg.norm(mod[i, j] - jpl[i, j]) * UA_KM)
        for anos_ in (1, 10):                                          # janelas menores
            perto = np.abs(dias) <= anos_ * 365.25
            maximos[nome][f'direcao_geo_seg_{anos_}anos'] = float(err_geo[perto, j].max())

    with open(os.path.join(AQUI, 'e6.json'), 'w') as f:
        json.dump({'passo_dias': DT, 'registro_dias': CADA * DT, 'n_instantes': len(dias),
                   'maximos': maximos, 'cruzada': cruzada}, f, indent=1)
    print(f'{"":10s} {"lon(\")":>9s} {"data":>11s} {"geo(\")":>9s} {"data":>11s} {"rel(%)":>9s} {"data":>11s}')
    for nome, m in maximos.items():
        a, b, c = m['longitude_helio_seg'], m['direcao_geo_seg'], m['relativo']
        print(f'{nome:10s} {a["max"]:9.2f} {a["data"]:>11s} {b["max"]:9.2f} {b["data"]:>11s} '
              f'{100 * c["max"]:9.2e} {c["data"]:>11s} {m["km_no_max_relativo"]:10.0f} km')

    # figura: erro de direção visto da Terra no tempo
    OUT = os.path.join(AQUI, '..', 'figuras', 'varredura.pdf')
    configurar()
    anos = 2026 + dias / 365.25


    fig, axs = plt.subplots(2, 2, figsize=(6.0, 4.4), sharex=True)
    for ax, nome, tit in [(axs[0, 0], 'mercurio', '(a) Mercúrio'), (axs[0, 1], 'venus', '(b) Vênus'),
                          (axs[1, 0], 'marte', '(c) Marte')]:
        e = err_geo[:, ORDEM.index(nome)]
        ax.plot(anos, e, color=OI[5], lw=.3)
        ax.plot(anos, envelope(e), color=OI[0], lw=1)
        ax.set_title(tit, fontsize=9); ax.set_ylim(e.max() / 1e3, e.max() * 2)
    ax = axs[1, 1]
    for k, nome in enumerate(['jupiter', 'saturno', 'urano', 'netuno']):
        ax.plot(anos, envelope(err_geo[:, ORDEM.index(nome)]), color=OI[k + 1], lw=1, label=NOMES[ORDEM.index(nome)])
    ax.set_title('(d) planetas externos', fontsize=9); ax.legend(fontsize=7, ncol=2)
    ax.set_ylim(err_geo[:, 5].max() / 1e3, err_geo[:, 5].max() * 2)
    for ax in axs.flat:
        ax.set_yscale('log')
    for ax in axs[:, 0]:
        ax.set_ylabel('erro de direção ["]')
    for ax in axs[1]:
        ax.set_xlabel('ano')
    fig.tight_layout(); fig.savefig(OUT); plt.close(fig)
    print(f'figura em {OUT}; {time.time() - t0:.0f} s')


if __name__ == '__main__':
    main()
