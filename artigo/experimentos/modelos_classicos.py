"""Modelos pré-keplerianos no referencial heliocêntrico, para comparar com a órbita de Kepler.

Convenções de todas as funções: M é a anomalia média contada a partir do periélio,
o Sol fica na origem, o periélio no eixo +x, e o retorno é a posição complexa em UA.
"""
import numpy as np

ARCSEC = 180 / np.pi * 3600


def excentrico(a, d, M):
    """Círculo de raio a com centro a d do Sol, do lado do afélio, percorrido com velocidade uniforme."""
    return -d + a * np.exp(1j * M)


def equante(a, e, M):
    """Modelo de Ptolomeu: centro do deferente C em -a·e, equante Q em -2·a·e.

    O planeta fica no círculo de raio a em torno de C, na direção que, vista de Q,
    faz o ângulo M com o eixo das apsides. A distância s de Q ao planeta é a raiz
    positiva de |w + s·u|² = a², com u = e^{iM} e w = Q - C.
    """
    C, Q = -a * e, -2 * a * e
    u = np.exp(1j * M)
    w = Q - C
    p = np.real(np.conj(w) * u)
    s = -p + np.sqrt(p * p - abs(w) ** 2 + a * a)
    return Q + s * u


def copernico(R, r1, r2, M, origem=0):
    """Commentariolus lido com frequências (0, 1, 2): excêntrico fixo r1, deferente R, epiciclo r2.

    origem é o centro em torno do qual o modelo foi montado; 0 é o Sol, e o centro da
    órbita da Terra (Sol médio) entra aqui já escrito no referencial do planeta.
    """
    return origem - r1 + R * np.exp(1j * M) + r2 * np.exp(2j * M)


def fourier3(c, M):
    """Série de Fourier truncada nos três termos que o modelo de Copérnico tem."""
    return c[0] + c[1] * np.exp(1j * M) + c[2] * np.exp(2j * M)


def erro_max(z_modelo, z_kepler):
    """(maior erro de posição em UA, maior erro de longitude heliocêntrica em segundos de arco)."""
    dpos = np.abs(z_modelo - z_kepler).max()
    dlon = np.abs(np.angle(z_modelo / z_kepler)).max()
    return float(dpos), float(dlon * ARCSEC)


if __name__ == '__main__':
    from fourier_lib import orbita_tempo, coef

    A = 4096
    M = 2 * np.pi * np.arange(A) / A

    def erros(e):
        zk = orbita_tempo(1.0, e, A)
        c = coef(zk, 4)
        return {
            'excentrico': erro_max(excentrico(1.0, 2 * e, M), zk)[0],
            'equante': erro_max(equante(1.0, e, M), zk)[0],
            'copernico': erro_max(copernico(1.0, 1.5 * e, 0.5 * e, M), zk)[0],
            'fourier3': erro_max(fourier3(c, M), zk)[0],
        }

    e1, e2 = erros(0.1), erros(0.05)
    faixa = {'excentrico': (1.8, 2.2), 'equante': (3.5, 4.5), 'copernico': (3.5, 4.5), 'fourier3': (3.5, 4.5)}
    for nome, (lo, hi) in faixa.items():
        razao = e1[nome] / e2[nome]
        print(f'{nome:11s} erro(e=0,1) = {e1[nome]:.3e} UA  erro(e=0,05) = {e2[nome]:.3e} UA  razão = {razao:.3f}')
        assert lo <= razao <= hi, f'{nome}: razão {razao:.3f} fora de [{lo}, {hi}]'
    print('verificações de ordem em e: ok')
