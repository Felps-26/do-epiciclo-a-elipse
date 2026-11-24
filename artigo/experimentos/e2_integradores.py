"""E2: custo contra precisão dos três integradores (erro de Mercúrio em +10 anos) e a
energia em mil anos com passo de 2 dias. Grava e2.json, lido por figuras.py."""
import json
import os
import time

import numpy as np

from nbody import AQUI, AVALIACOES, UA_KM, energia, estado_inicial, integrar, momento_angular, validacao


def main():
    dias, ref = validacao('10')
    out = {'wp': [], 'energia': {}}
    # trabalho x precisão: erro de Mercúrio no ponto de +10 anos do Horizons (3652 dias)
    for met, dts in [('leapfrog', [0.5, 0.25, 0.125, 0.0625, 1 / 32]), ('yoshida4', [2, 1, 0.5, 0.25, 0.125]),
                     ('rk4', [2, 1, 0.5, 0.25, 0.125])]:
        for dt in dts:
            p, v, gm, _ = integrar(met, dt, dias)
            e = np.linalg.norm(p[1] - ref[1]) * UA_KM
            aval = int(round(dias / dt)) * AVALIACOES[met]
            out['wp'].append((met, dt, aval, e))
            print(met, dt, aval, f'{e:.3e}')
    # energia em 1000 anos, dt = 2 dias, registro a cada 100 passos
    p0, v0, gm0 = estado_inicial()
    E0 = energia(p0, v0, gm0)
    L0 = np.linalg.norm(momento_angular(p0, v0, gm0))

    def reg(k, p, v, gm):
        return (k, (energia(p, v, gm) - E0) / abs(E0), (np.linalg.norm(momento_angular(p, v, gm)) - L0) / L0)

    for met in ['leapfrog', 'yoshida4', 'rk4']:
        t = time.time()
        _, _, _, regs = integrar(met, 2.0, 365.25 * 1000, registrar=(100, reg))
        out['energia'][met] = regs
        print(met, 'energia', regs[-1], time.time() - t)
    with open(os.path.join(AQUI, 'e2.json'), 'w') as f:
        json.dump(out, f)


if __name__ == '__main__':
    main()
