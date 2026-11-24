"""E4: os raios do Commentariolus contra os coeficientes de Fourier da órbita moderna.
Grava e4.json, lido por figuras.py."""
import json
import os

import numpy as np

from fourier_lib import coef, elementos, orbita_tempo
from nbody import AQUI, NOMES

# Raios em partes (raio da órbita da Terra = 25): (deferente R, primeiro epiciclo r1, segundo r2)
COP = {1: (9 + 2/5, 1 + 41/60, 34/60), 2: (18, 3/4, 1/4), 4: (38, 5 + 34/60, 1 + 51/60),
       5: (130 + 5/12, 10 + 6/60, 3 + 22/60), 6: (230 + 1/6, 19 + 41/60, 6 + 34/60)}


def main():
    out = []
    for i, (R, r1, r2) in COP.items():
        el = elementos(i)
        a, e = el['a'], el['e']
        R, r1, r2 = R / 25, r1 / 25, r2 / 25
        z = orbita_tempo(a, e, 4096)
        c = coef(z, 4)
        M = 2 * np.pi * np.arange(4096) / 4096
        zc = R * np.exp(1j * M) - r1 + r2 * np.exp(2j * M)                    # frequências (1, 0, 2)
        z3 = c[1] * np.exp(1j * M) + c[0] + c[2] * np.exp(2j * M)            # Fourier nos mesmos três termos
        ztcc = R * np.exp(1j * M) + r1 * np.exp(-1j * M) + r2 * np.exp(2j * M)  # frequências (1, -1, 2)
        zmod = R * np.exp(1j * M) + r1 * np.exp(2j * M) + r2 * np.exp(3j * M)   # frequências (1, 2, 3)
        errs = [np.abs(x - z).max() for x in (zc, z3, ztcc, zmod)]
        row = dict(planeta=NOMES[i], a=a, e=e, R=R, r1=r1, r2=r2, c1=abs(c[1]), c0=abs(c[0]), c2=abs(c[2]),
                   cm1=abs(c[-1]), e_r1=r1 / (1.5 * R), e_r2=r2 / (0.5 * R), razao=r1 / r2, err_cop=errs[0],
                   err_f3=errs[1], err_tcc=errs[2], err_mod=errs[3])
        out.append(row)
        print({k: (round(v, 5) if isinstance(v, float) else v) for k, v in row.items()})
    with open(os.path.join(AQUI, 'e4.json'), 'w') as f:
        json.dump(out, f)


if __name__ == '__main__':
    main()
