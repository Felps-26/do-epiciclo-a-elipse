/**
 * O caminho da cor, do arquivo ao fator de exposicao: espaco de cor por mapa
 * (#20, #29), uma carga por arquivo (#20), o nivel do fundo (#39) e a exposicao
 * que cobre Netuno (#30).
 */
import { describe, expect, it } from 'vitest';
import { Texture } from 'three';
import { Texturas, espacoDeCor, nivelDoFundo } from '@cena/texturas/carregador.ts';
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
