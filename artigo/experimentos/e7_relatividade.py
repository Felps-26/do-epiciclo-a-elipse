"""E7: o termo pós-newtoniano do Sol, primeiro conferido, depois medido em Mercúrio.

1. Dois corpos isolados (Sol e Mercúrio no periélio): com o termo, o periélio tem de
   avançar 42,98" por século, com erro abaixo de 1%. É o mesmo teste de
   simulador/testes/nucleo/relatividade.test.ts.
2. Sistema inteiro contra a DE440s, de 1/1/2026 até +100 e -100 anos, com e sem o
   termo, nos passos de 0,5 e 0,05 dia. Grava o erro de posição de Mercúrio em km
   (a cada 10 anos) em e7.json.
"""
import json
import os
import time

import numpy as np

from nbody import AQUI, ORDEM, UA_KM, estado_inicial, integrar
from referencia_jpl import posicoes_jpl

SEG = 180 / np.pi * 3600
MER = ORDEM.index('mercurio')
DIAS = 36525.0


def avanco_do_perielio(metodo, dt=0.05):
    """Avanço do periélio de Mercúrio em um século, em segundos de arco, só com o Sol."""
    _, _, gm0 = estado_inicial()
    gm = np.array([gm0[0], gm0[MER]])
    mu = gm.sum()
    a, e = 0.387098, 0.205630
    rp = a * (1 - e)
    p = np.array([[0.0, 0, 0], [rp, 0, 0]])
    v = np.array([[0.0, 0, 0], [0, np.sqrt(mu * (1 + e) / rp), 0]])

    def angulo(p, v):
        r, u = p[1] - p[0], v[1] - v[0]
        ev = np.cross(u, np.cross(r, u)) / mu - r / np.linalg.norm(r)
        return np.arctan2(ev[1], ev[0])

    antes = angulo(p, v)
    p, v, _, _ = integrar(metodo, dt, DIAS, p, v, gm)
    d = angulo(p, v) - antes
    return np.arctan2(np.sin(d), np.cos(d)) * SEG


def mercurio_contra_jpl(metodo, dt, sentido):
    """Erro de posição de Mercúrio em km, a cada 10 anos, de 2026 até sentido * 100 anos."""
    cada = int(round(CADA_DIAS / dt))
    regs = []
    integrar(metodo, dt, sentido * DIAS,
             registrar=(cada, lambda k, p, v, gm: regs.append((sentido * k * dt, p[MER].copy()))))
    dias = np.array([d for d, _ in regs])
    mod = np.array([x for _, x in regs])
    km = np.linalg.norm(mod - posicoes_jpl(dias)[:, MER], axis=1) * UA_KM
    return {'dias': dias.tolist(), 'erro_km': km.tolist()}


CADA_DIAS = 3652.5
CONFIGS = [(m, dt) for dt in (0.5, 0.05) for m in ('yoshida4', 'yoshida4_pn')]

if __name__ == '__main__':
    t0 = time.time()
    teste = {m: float(avanco_do_perielio(m)) for m in ('yoshida4_pn', 'yoshida4')}
    print(f'dois corpos, dt = 0,05 d: com o termo {teste["yoshida4_pn"]:.3f}", '
          f'sem {teste["yoshida4"]:.4f}"  ({time.time() - t0:.0f} s)', flush=True)
    assert abs(teste['yoshida4_pn'] - 42.98) < 0.43, 'o termo não dá os 43"/século'
    assert abs(teste['yoshida4']) < 0.5, 'o integrador sozinho já precessa demais'

    resultados, segundos = {}, {}
    for m, dt in CONFIGS:
        chave = f'{m}_dt{dt}'
        resultados[chave] = {}
        for sentido, nome in ((1, 'mais'), (-1, 'menos')):
            t = time.time()
            resultados[chave][nome] = mercurio_contra_jpl(m, dt, sentido)
            segundos[f'{chave}_{nome}'] = round(time.time() - t, 1)
            print(f'{chave:22s} {sentido * 100:+4d} anos: {resultados[chave][nome]["erro_km"][-1]:12.1f} km'
                  f'  ({time.time() - t0:.0f} s)', flush=True)

    erros = {k: {'mais_100_anos_km': r['mais']['erro_km'][-1],
                 'menos_100_anos_km': r['menos']['erro_km'][-1]} for k, r in resultados.items()}
    with open(os.path.join(AQUI, 'e7.json'), 'w') as f:
        json.dump({'perielio_dois_corpos_seg_por_seculo': teste, 'passo_teste_dias': 0.05,
                   'mercurio_100_anos': erros, 'segundos_por_integracao': segundos, 'series': resultados},
                  f, indent=1)
    print(f'\n{"":22s} {"+100 anos":>12s} {"-100 anos":>12s}')
    for k, e in erros.items():
        print(f'{k:22s} {e["mais_100_anos_km"]:12.1f} {e["menos_100_anos_km"]:12.1f}')
    print(f'e7.json gravado; {time.time() - t0:.0f} s')
