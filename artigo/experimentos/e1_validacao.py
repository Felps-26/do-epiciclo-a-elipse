"""E1: o integrador contra os cinco pontos do JPL Horizons (tabela de validação).

Grava o erro de posição de cada corpo, em km e em fração da distância ao Sol, em e1.json.
"""
import json
import os
import time

import numpy as np

from nbody import AQUI, UA_KM, integrar, validacao


def main():
    res = {}
    t0 = time.time()
    for ch in ['1', '10', '-10', '100', '-100']:
        dias, ref = validacao(ch)
        p, v, gm, _ = integrar('yoshida4', 0.5, dias)
        err = np.linalg.norm(p - ref, axis=1) * UA_KM
        rsol = np.linalg.norm(ref - ref[0], axis=1) * UA_KM
        res[ch] = {'erro_km': err.tolist(), 'frac': (err / np.where(rsol > 0, rsol, np.nan)).tolist()}
        print(ch, ' '.join(f'{e:,.1f}' for e in err), f'{time.time() - t0:.0f}s')
    with open(os.path.join(AQUI, 'e1.json'), 'w') as f:
        json.dump(res, f)


if __name__ == '__main__':
    main()
