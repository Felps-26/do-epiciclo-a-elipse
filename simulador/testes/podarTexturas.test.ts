/**
 * O manifesto de texturas entra no build só com os níveis que existem no disco.
 *
 * O git traz só o 2K. Num clone, o manifesto listava 4K e 8K, o programa pedia, o
 * servidor devolvia 404 e o console registrava o erro, mesmo com o carregador descendo
 * para o 2K depois.
 */
import { describe, expect, it } from 'vitest';
import { podarNiveis } from '../ferramentas/podarTexturas.ts';

const manifesto = {
  mapas: [
    { corpo: 'terra', papel: 'albedo', niveis: { '2k': 'texturas/2k/t.jpg', '4k': 'texturas/4k/t.jpg', '8k': 'texturas/8k/t.jpg' } },
    { corpo: 'ceu', papel: 'viaLactea', niveis: { '2k': 'texturas/2k/c.jpg', '8k': 'texturas/8k/c.jpg' } },
  ],
};

describe('níveis que não estão no disco', () => {
  it('saem do manifesto, e o 2K fica', () => {
    const podado = podarNiveis(manifesto, (caminho: string) => caminho.includes('/2k/'));
    expect(podado.mapas[0]!.niveis).toEqual({ '2k': 'texturas/2k/t.jpg' });
    expect(podado.mapas[1]!.niveis).toEqual({ '2k': 'texturas/2k/c.jpg' });
  });

  it('com tudo no disco, nada muda', () => {
    expect(podarNiveis(manifesto, () => true)).toEqual(manifesto);
  });

  it('não mexe no objeto de entrada', () => {
    podarNiveis(manifesto, () => false);
    expect(manifesto.mapas[0]!.niveis['8k']).toBe('texturas/8k/t.jpg');
  });
});
