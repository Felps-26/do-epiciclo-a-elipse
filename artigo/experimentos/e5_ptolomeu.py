"""E5: controle com Ptolomeu. Compara Copérnico, o equante, o excêntrico simples e a
série de Fourier truncada com a órbita de Kepler, e mede o efeito de montar os modelos
de Copérnico em torno do centro da órbita da Terra (Sol médio) em vez do Sol."""
import json
import os

import numpy as np

from estilo import AQUI, OI, OUT, configurar, plt
import matplotlib.ticker
from fourier_lib import coef, elementos, orbita_tempo
from modelos_classicos import copernico, equante, erro_max, excentrico, fourier3
from nbody import NOMES, estado_inicial

A = 4096
M = 2 * np.pi * np.arange(A) / A
TERRA = 3

# Raios do Commentariolus em partes (raio da órbita da Terra = 25), os mesmos de e4_copernico.py,
# que os tirou de Farias (2016): (deferente R, primeiro epiciclo r1, segundo epiciclo r2).
COP = {1: (9 + 2/5, 1 + 41/60, 34/60), 2: (18, 3/4, 1/4), 4: (38, 5 + 34/60, 1 + 51/60),
       5: (130 + 5/12, 10 + 6/60, 3 + 22/60), 6: (230 + 1/6, 19 + 41/60, 6 + 34/60)}

# Almagesto, distância do Sol (da Terra, em Ptolomeu) ao centro do deferente, em partes do raio 60.
# O equante fica ao dobro dessa distância. Fonte: Toomer, Ptolemy's Almagest (1984), lido em
# https://archive.org/details/ptolemys-almagest-toomer
ALMAGESTO = {
    4: 6 / 60,              # Marte: X 7, p. 494 ("DK ≈ 12p" até o equante) e p. 495-498 ("DΘ = 6p")
    5: (2 + 45/60) / 60,    # Júpiter: XI 1, p. 515 (5;30p até o equante) e p. 516 ("ZD = 2;45p")
    6: (3 + 25/60) / 60,    # Saturno: XI 5, p. 533 (6;50p até o equante) e p. 534-536 ("DZ = 3;25p")
}

# Commentariolus, centro da órbita da Terra: "1/25 of the radius of the circle" do Sol, na seção
# sobre os movimentos aparentes do Sol. Fonte: transcrição da tradução inglesa em
# https://dbanach.com/copernicus-commentarilous.htm (a página não nomeia o tradutor).
# O texto fixa a linha Sol-centro a cerca de 10° a oeste de Pólux; não convertemos essa direção
# e usamos a do periélio moderno da Terra (o centro fica do lado do afélio).
D_SOL_MEDIO = 1 / 25        # em unidades do raio da órbita da Terra, isto é, UA


def longitude_perielio(i):
    """Longitude do periélio da órbita osculadora em 1/1/2026, projetada na eclíptica."""
    p, v, gm = estado_inicial()
    r, w, mu = p[i] - p[0], v[i] - v[0], gm[0] + gm[i]
    evec = np.cross(w, np.cross(r, w)) / mu - r / np.linalg.norm(r)
    return float(np.arctan2(evec[1], evec[0]))


def par(z, zk):
    ua, seg = erro_max(z, zk)
    return {'ua': ua, 'arcsec': seg}


def main():
    w_terra = longitude_perielio(TERRA)
    saida = {'d_sol_medio_ua': D_SOL_MEDIO, 'e_terra': elementos(TERRA)['e'], 'planetas': []}
    for i, (R, r1, r2) in COP.items():
        el = elementos(i)
        a, e = el['a'], el['e']
        R, r1, r2 = R / 25, r1 / 25, r2 / 25
        zk = orbita_tempo(a, e, A)
        c = coef(zk, 4)
        # centro da órbita da Terra escrito no referencial deste planeta (periélio do planeta em +x)
        origem = -D_SOL_MEDIO * np.exp(1j * (w_terra - longitude_perielio(i)))
        linha = {
            'planeta': NOMES[i], 'a': a, 'e': e, 'c0': abs(c[0]),
            'ideal': {
                'excentrico_ae': par(excentrico(a, a * e, M), zk),
                'excentrico_2ae': par(excentrico(a, 2 * a * e, M), zk),
                'equante': par(equante(a, e, M), zk),
                'copernico': par(copernico(a, 1.5 * a * e, 0.5 * a * e, M), zk),
                # mesmo modelo com o deferente igual a |c1| = a(1 - e²/2 + ...) em vez de a
                'copernico_c1': par(copernico(abs(c[1]), 1.5 * a * e, 0.5 * a * e, M), zk),
                'fourier3': par(fourier3(c, M), zk),
            },
            'historico': {
                'copernico_sol': par(copernico(R, r1, r2, M), zk),
                'copernico_sol_medio': par(copernico(R, r1, r2, M, origem), zk),
            },
            # deslocamento do centro do modelo visto do Sol, com e sem o Sol médio, contra |c0|
            'desloc_sol': r1, 'desloc_sol_medio': abs(origem - r1),
            'e_impl_sol': r1 / (1.5 * R), 'e_impl_sol_medio': abs(origem - r1) / (1.5 * R),
            'angulo_origem_graus': float(np.degrees(np.angle(origem))),
        }
        if i == 2:
            # Vênus com a linha das apsides do excêntrico sobre a da Terra, no sentido em que r1 e o
            # Sol médio se cancelam. É uma hipótese: não conferimos o apogeu de Vênus no Commentariolus.
            linha['e_impl_alinhado_terra'] = abs(D_SOL_MEDIO - r1) / (1.5 * R)
        if i in ALMAGESTO:
            linha['e_almagesto'] = ALMAGESTO[i]
            linha['historico']['equante_almagesto'] = par(equante(a, ALMAGESTO[i], M), zk)
        # sensibilidade à direção do Sol médio: girar a origem 10° para cada lado
        linha['sol_medio_mais10'] = par(copernico(R, r1, r2, M, origem * np.exp(1j * np.radians(10))), zk)
        linha['sol_medio_menos10'] = par(copernico(R, r1, r2, M, origem * np.exp(-1j * np.radians(10))), zk)
        saida['planetas'].append(linha)

    with open(os.path.join(AQUI, 'e5.json'), 'w') as f:
        json.dump(saida, f, indent=1)

    for p in saida['planetas']:
        print(f"{p['planeta']:9s} e={p['e']:.4f} |c0|={p['c0']:.4f} r1={p['desloc_sol']:.4f} "
              f"|origem-r1|={p['desloc_sol_medio']:.4f} e_impl={p['e_impl_sol']:.4f}->{p['e_impl_sol_medio']:.4f} "
              f"ang={p['angulo_origem_graus']:.0f}°")
        for rodada in ('ideal', 'historico'):
            for k, v in p[rodada].items():
                print(f"    {rodada:9s} {k:20s} {v['ua']:.5f} UA {v['arcsec']:9.0f}\"")
        print(f"    Sol médio ±10°: {p['sol_medio_menos10']['ua']:.5f} / {p['sol_medio_mais10']['ua']:.5f} UA")

    # --- figura: erro de posição por planeta, um grupo de barras por modelo
    configurar()
    paineis = [
        ('(a) parâmetros ideais', 'ideal', [('excentrico_2ae', 'excêntrico, $d=2ae$'), ('excentrico_ae', 'excêntrico, $d=ae$'),
                                            ('copernico', 'Copérnico'), ('fourier3', 'Fourier $c_0,c_1,c_2$'),
                                            ('equante', 'equante')]),
        ('(b) parâmetros históricos', 'historico', [('copernico_sol', 'Copérnico, origem no Sol'),
                                                    ('copernico_sol_medio', 'Copérnico, origem no Sol médio'),
                                                    ('equante_almagesto', 'equante do Almagesto')]),
    ]
    nomes = [p['planeta'] for p in saida['planetas']]
    x = np.arange(len(nomes))
    limites = {'ideal': (1e-5, 30), 'historico': (1e-2, 3)}
    fig, axs = plt.subplots(2, 1, figsize=(6.0, 5.6), sharex=True)
    for ax, (titulo, rodada, modelos) in zip(axs, paineis):
        wb = 0.8 / len(modelos)
        for j, (k, rot) in enumerate(modelos):
            vals = [p[rodada].get(k, {}).get('ua', np.nan) for p in saida['planetas']]
            ax.bar(x + (j - (len(modelos) - 1) / 2) * wb, vals, wb, color=OI[j], label=rot)
        ax.set_yscale('log'); ax.set_ylabel('maior erro de posição [UA]')
        ax.set_ylim(*limites[rodada])
        ax.yaxis.set_minor_formatter(matplotlib.ticker.NullFormatter())
        ax.set_title(titulo, loc='left', fontsize=10)
        ax.legend(fontsize=7.5, ncol=3, loc='upper left')
    axs[1].set_xticks(x); axs[1].set_xticklabels(nomes)
    fig.tight_layout()
    fig.savefig(OUT + 'modelos_classicos.pdf'); plt.close(fig)


if __name__ == '__main__':
    main()
