"""Estilo comum das figuras do artigo: pasta de saída, paleta, largura e rcParams.

Antes, cada roteiro de figura repetia este bloco, e figuras2.py e figuras3.py o
pegavam executando um pedaço de figuras.py com exec(). Agora todos importam daqui.
"""
import os

import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402  (o backend precisa vir antes)

AQUI = os.path.dirname(os.path.abspath(__file__))
# pasta das figuras, terminada em separador: os roteiros escrevem OUT + 'nome.pdf'
OUT = os.path.join(AQUI, '..', 'figuras', '')

# paleta de Okabe e Ito, segura para daltonismo
OI = ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#E69F00', '#56B4E9', '#F0E442', '#000000']
W = 6.0  # largura útil da página, em polegadas

BASE = {'font.family': 'serif', 'font.serif': ['DejaVu Serif'], 'mathtext.fontset': 'cm', 'font.size': 10}
GRAFICO = {'axes.spines.top': False, 'axes.spines.right': False, 'axes.grid': True, 'grid.alpha': .25,
           'savefig.bbox': 'tight', 'legend.frameon': False}


def configurar(grafico=True):
    """Aplica o estilo. `grafico=False` deixa só a fonte, para o desenho 3D dos elementos."""
    plt.rcParams.update(BASE)
    if grafico:
        plt.rcParams.update(GRAFICO)
