"""E3: tabela de convergência da série de Fourier e conferência da forma fechada (Bessel)."""
from fourier_lib import coef, coef_bessel, desvio, elementos, orbita_tempo
from nbody import NOMES, UA_KM


def main():
    print('Planeta  e  desvio medio (km) N=1,2,3  N ate 1e-12 UA')
    for i in range(1, 9):
        el = elementos(i)
        a, e = el['a'], el['e']
        z = orbita_tempo(a, e, 720)
        c = coef(z, 24)
        km = [desvio(z, c, N)[0] * UA_KM for N in (1, 2, 3)]
        Nmin = next((N for N in range(1, 25) if desvio(z, c, N)[0] < 1e-12), None)
        print(NOMES[i], round(e, 4), [round(x) for x in km], Nmin)

    # forma fechada contra a DFT: Mercúrio e órbitas hipotéticas com a = 1 UA
    el = elementos(1)
    a, e = el['a'], el['e']
    c = coef(orbita_tempo(a, e, 720), 24)
    print('Mercurio, max |DFT - Bessel|:', max(abs(c[n] - coef_bessel(a, e, n)) for n in range(-24, 25)))
    for e in (0.6, 0.9, 0.95):
        c = coef(orbita_tempo(1.0, e, 720), 24)
        print('a=1, e=%.2f:' % e, max(abs(c[n] - coef_bessel(1.0, e, n)) for n in range(-24, 25)))
    # c0 = -3/2 a e para os oito planetas
    rel = []
    for i in range(1, 9):
        el = elementos(i)
        c0 = coef(orbita_tempo(el['a'], el['e'], 720), 0)[0]
        rel.append(abs(c0 / (-1.5 * el['a'] * el['e']) - 1))
    print('c0, erro relativo max:', max(rel))


if __name__ == '__main__':
    main()
