/**
 * O caminho da cor, do arquivo ao fator de exposicao: espaco de cor por mapa
 * (#20, #29), uma carga por arquivo (#20), o nivel do fundo (#39) e a exposicao
 * que cobre Netuno (#30).
 */
import { describe, expect, it } from 'vitest';
import { Texture } from 'three';
import { Texturas, espacoDeCor, nivelDoFundo, tetoDaBusca } from '@cena/texturas/carregador.ts';
import { EXPOSICAO_MAXIMA, exposicaoAssentou, exposicaoQuerida, suavizarExposicao } from '@cena/iluminacao/exposicao.ts';
import { TEXTURAS } from '@dados/corposVisuais.ts';

describe('espaço de cor por mapa', () => {
  it('cor que se vê é sRGB; máscara é linear', () => {
    for (const m of TEXTURAS) {
      const esperado =
        m.papel === 'nuvens' ? (m.corpo === 'venus' ? 'srgb' : 'linear') : m.papel === 'relevo' ? 'linear' : 'srgb';
      expect(espacoDeCor(m.corpo, m.papel), `${m.corpo}/${m.papel}`).toBe(esperado);
    }
  });

  it('o anel de Saturno é lido como sRGB', () => {
    expect(espacoDeCor('saturno', 'anel')).toBe('srgb');
  });
});

describe('nível que falta no disco', () => {
  // O git só traz o 2K. Num clone, ou no CI, os pedidos de 4K e 8K davam 404, o
  // carregador tentava o mesmo arquivo a cada quadro e a cena nunca assentava.
  it('um 404 desce para o nível de baixo, e não tenta de novo o mesmo arquivo', () => {
    const pedidos: string[] = [];
    const tex = new Texturas({ initTexture() {} } as never, (url, ok, _p, erro) => {
      pedidos.push(url);
      if (url.includes('/2k/')) ok(new Texture());
      else erro?.();
    });
    tex.obter('terra', 'albedo', [80, 100, 140]);
    for (let q = 0; q < 20; q++) {
      tex.pedir('terra', 'albedo', 3);
      tex.aplicarUmaPorQuadro();
    }
    expect(pedidos.filter((u) => u.includes('/8k/'))).toHaveLength(1);
    expect(pedidos.filter((u) => u.includes('/4k/'))).toHaveLength(1);
    expect(pedidos.at(-1)).toContain('/2k/');
    expect(tex.baixando).toBe(0);
    expect(tex.pendentes).toBe(0);
  });

  it('com teto de 2K, nem o corpo de perto nem o fundo pedem acima disso', () => {
    // As imagens de referência pedem `?texturas=2k`: o git só traz o 2K, e a
    // imagem tem de ser a mesma num clone e numa máquina com o 8K baixado.
    const pedidos: string[] = [];
    const tex = new Texturas({ initTexture() {} } as never, (url, ok) => {
      pedidos.push(url);
      ok(new Texture());
    }, '2k');
    tex.obter('terra', 'albedo', [80, 100, 140]);
    for (let q = 0; q < 5; q++) {
      tex.pedir('terra', 'albedo', 3);
      tex.aplicarUmaPorQuadro();
    }
    expect(pedidos).toEqual(['texturas/2k/earth_daymap.jpg']);
    expect(nivelDoFundo({ '2k': 'a', '8k': 'c' }, new Set(), '2k')).toBe('2k');
    expect(tetoDaBusca('?texturas=2k')).toBe('2k');
    expect(tetoDaBusca('?render=webgl2')).toBe('8k');
  });

  it('o fundo desce de nível quando o maior não existe', () => {
    const niveis = { '2k': 'a', '4k': 'b', '8k': 'c' };
    expect(nivelDoFundo(niveis, new Set(['c']))).toBe('4k');
    expect(nivelDoFundo(niveis, new Set(['c', 'b']))).toBe('2k');
    expect(nivelDoFundo(niveis, new Set(['c', 'b', 'a']))).toBeNull();
  });
});

describe('uma carga por arquivo', () => {
  it('subir de 2K a 8K num mapa com um arquivo só não recarrega a imagem', () => {
    const pedidos: string[] = [];
    const tex = new Texturas({ initTexture() {} } as never, (url, ok) => {
      pedidos.push(url);
      ok(new Texture());
    });
    tex.obter('saturno', 'anel', [180, 170, 150]);
    for (const raios of [100, 30, 10, 3, 10, 50, 3]) {
      tex.pedir('saturno', 'anel', raios);
      tex.aplicarUmaPorQuadro();
    }
    expect(pedidos).toEqual(['texturas/2k/saturn_ring_alpha.png']);
  });

  it('um mapa com três arquivos carrega cada nível uma vez', () => {
    const pedidos: string[] = [];
    const tex = new Texturas({ initTexture() {} } as never, (url, ok) => {
      pedidos.push(url);
      ok(new Texture());
    });
    tex.obter('terra', 'albedo', [80, 100, 140]);
    for (const raios of [100, 10, 3, 3]) {
      tex.pedir('terra', 'albedo', raios);
      tex.aplicarUmaPorQuadro();
    }
    expect(new Set(pedidos).size).toBe(pedidos.length);
    expect(pedidos.length).toBe(3);
  });
});

describe('fundo e exposição', () => {
  it('a Via Láctea usa o maior nível que existe', () => {
    expect(nivelDoFundo({ '2k': 'a', '4k': 'b', '8k': 'c' })).toBe('8k');
    expect(nivelDoFundo({ '2k': 'a', '4k': 'b' })).toBe('4k');
  });

  it('Netuno no afélio recebe a exposição inteira que a fórmula pede', () => {
    expect(exposicaoQuerida(30.33)).toBeCloseTo(30.33 ** 2, 9);
    expect(EXPOSICAO_MAXIMA).toBeGreaterThanOrEqual(30.33 ** 2);
  });

  it('a suavização chega ao alvo e para, em vez de se aproximar para sempre', () => {
    let atual = 1;
    let quadros = 0;
    while (atual !== 904 && quadros < 1000) {
      atual = suavizarExposicao(atual, 904);
      quadros++;
    }
    expect(atual).toBe(904);
    expect(quadros).toBeLessThan(200);
  });

  it('assentada quer dizer parada: o próximo quadro não mexe mais na exposição', () => {
    // O "assentou" aceitava 0,3% e o encosto era a 0,2%: entre os dois a cena se dizia
    // parada e ainda mudava, e o teste de z-fighting no WebGL2 lia isso como disputa.
    for (const alvo of [1, 0.02, 904, EXPOSICAO_MAXIMA]) {
      let atual = alvo * 40;
      for (let q = 0; q < 400; q++) {
        if (exposicaoAssentou(atual, alvo)) expect(suavizarExposicao(atual, alvo)).toBe(atual);
        atual = suavizarExposicao(atual, alvo);
      }
      expect(exposicaoAssentou(atual, alvo)).toBe(true);
    }
  });
});
