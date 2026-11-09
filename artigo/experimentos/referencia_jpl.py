"""Posições da efeméride DE440s do JPL no mesmo referencial do simulador.

Precisa do pacote jplephem e do arquivo de440s.bsp nesta pasta (ver LEIAME.md).
Rodado direto, confere a DE440s contra os cinco pontos de validação do JSON,
que vieram do Horizons.
"""
import os
import numpy as np
from jplephem.spk import SPK
from nbody import EF, ORDEM, UA_KM, AQUI, validacao

assert EF['procedencia']['escala_de_tempo'] == 'TDB', 'a DE440s usa TDB'
JD_EPOCA = EF['procedencia']['epoca']['jd_tdb']

# ICRF equatorial -> eclíptica J2000, obliquidade de 84381,448" (a do Horizons)
_EPS = np.radians(84381.448 / 3600.0)
_ROT = np.array([[1.0, 0.0, 0.0],
                 [0.0, np.cos(_EPS), np.sin(_EPS)],
                 [0.0, -np.sin(_EPS), np.cos(_EPS)]])

# cada corpo é uma soma de segmentos do kernel (centro, alvo)
_SEGMENTOS = {'sol': [(0, 10)]}
for _i, _k in enumerate(ORDEM[1:], start=1):
    _SEGMENTOS[_k] = [(0, _i)]
if str(EF['corpos']['terra']['id_horizons']) == '399':
    _SEGMENTOS['terra'] = [(0, 3), (3, 399)]

_kernel = None


def _abrir():
    global _kernel
    if _kernel is None:
        _kernel = SPK.open(os.path.join(AQUI, 'de440s.bsp'))
    return _kernel


def posicoes_jpl(dias_desde_epoca):
    """Posições em UA, forma (len(dias), 9, 3), na ordem de nbody.ORDEM,
    origem no baricentro, eclíptica e equinócio J2000."""
    k = _abrir()
    jd = JD_EPOCA + np.atleast_1d(np.asarray(dias_desde_epoca, float))
    saida = np.empty((len(jd), len(ORDEM), 3))
    for j, nome in enumerate(ORDEM):
        km = sum(k[c, a].compute(jd) for c, a in _SEGMENTOS[nome])  # (3, n)
        saida[:, j, :] = (_ROT @ km).T / UA_KM
    return saida


if __name__ == '__main__':
    pior = np.zeros(len(ORDEM))
    for ch in EF['validacao']:
        dias, ref = validacao(ch)
        d = np.linalg.norm(posicoes_jpl([dias])[0] - ref, axis=1) * UA_KM
        pior = np.maximum(pior, d)
        print(f'{ch:>5}: ' + ' '.join(f'{x:8.3f}' for x in d))
    print('maior desvio (km) por corpo:')
    for nome, x in zip(ORDEM, pior):
        print(f'  {nome:9s} {x:8.3f}')
    assert pior.max() < 50, f'desvio de {pior.max():.1f} km: referencial ou escala de tempo errados'
    print('ok: DE440s reproduz os pontos do Horizons abaixo de 50 km')
