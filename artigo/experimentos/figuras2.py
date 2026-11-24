"""A mesma elipse (e = 0,5) amostrada em ângulo, como a versão original, e no tempo:
os coeficientes e o termo fixo c0 mudam (figura angulo_tempo.pdf)."""
from estilo import OI, OUT, W, configurar, plt
from fourier_lib import coef, orbita_angulo, orbita_tempo, reconstruir

import numpy as np


def main():
    configurar()
    el = {'a': 1.0, 'e': 0.5}
    fig, axs = plt.subplots(1, 2, figsize=(W, 2.9))
    for ax, f, tit in [(axs[0], orbita_angulo, '(a) amostragem em ângulo (versão original)'),
                       (axs[1], orbita_tempo, '(b) amostragem no tempo (versões 2D e 3D)')]:
        z = f(el['a'], el['e'], 1000)
        c = coef(z, 3)
        tt = np.linspace(0, 1, 1000)
        zr = reconstruir(c, 1, tt)
        zr3 = reconstruir(c, 3, tt)
        ax.plot(z.real, z.imag, color='0.6', lw=2.4, label='elipse de Kepler')
        ax.plot(zr.real, zr.imag, '--', color=OI[1], lw=1, label='$|n|\\leq1$')
        ax.plot(zr3.real, zr3.imag, ':', color=OI[0], lw=1.2, label='$|n|\\leq3$')
        ax.plot(0, 0, '*', color=OI[4], ms=9)
        ax.plot(c[0].real, c[0].imag, 's', color='k', ms=3)
        ax.annotate(f'$c_0={c[0].real:+.3f}\\,a$', (c[0].real, c[0].imag), xytext=(5, 8),
                    textcoords='offset points', fontsize=7.5)
        ax.set_aspect('equal'); ax.set_title(tit, fontsize=8.5); ax.set_xlabel('$x/a$'); ax.set_ylabel('$y/a$')
        ax.legend(fontsize=6.5, loc='lower left')
        print(tit, c[0], abs(c[1]), abs(c[-1]), abs(c[2]))
    fig.tight_layout(); fig.savefig(OUT + 'angulo_tempo.pdf'); plt.close(fig)


if __name__ == '__main__':
    main()
