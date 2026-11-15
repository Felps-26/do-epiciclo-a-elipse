/**
 * Quanto brilha um ponto iluminado de um corpo, visto da câmera.
 *
 * O programa desenhava um degrau: todo o hemisfério de dia com o mesmo brilho e uma
 * penumbra de ±0,27° no terminador. Faltava a lei do cosseno: a luz que chega a um
 * elemento de superfície cai com cos i, e o terminador de uma esfera é uma rampa.
 */
import { describe, expect, it } from 'vitest';
import { brilhoRefletido, irradianciaComPenumbra } from '@cena/iluminacao/fotometria.ts';

const S = 0.00465; // meio ângulo do Sol visto de 1 UA

describe('irradiância com a penumbra do disco solar', () => {
  it('fora da penumbra é o cosseno da incidência, e zero na noite', () => {
    for (const x of [0.01, 0.2, 0.5, 0.9, 1]) expect(irradianciaComPenumbra(x, S)).toBeCloseTo(x, 12);
    for (const x of [-1, -0.5, -0.01]) expect(irradianciaComPenumbra(x, S)).toBe(0);
  });

  it('é contínua e sem quina nas duas bordas da penumbra', () => {
    const h = 1e-9;
    for (const borda of [-S, S]) {
      const antes = irradianciaComPenumbra(borda - h, S);
      const depois = irradianciaComPenumbra(borda + h, S);
      expect(Math.abs(depois - antes)).toBeLessThan(1e-8);
      const derivadaAntes = (antes - irradianciaComPenumbra(borda - 2 * h, S)) / h;
      const derivadaDepois = (irradianciaComPenumbra(borda + 2 * h, S) - depois) / h;
      expect(Math.abs(derivadaDepois - derivadaAntes)).toBeLessThan(1e-3);
    }
  });

  it('cresce com a incidência: o meio-dia é o ponto mais claro', () => {
    let anterior = -1;
    for (let x = -0.02; x <= 1; x += 0.001) {
      const v = irradianciaComPenumbra(x, S);
      expect(v).toBeGreaterThanOrEqual(anterior);
      anterior = v;
    }
  });
});

describe('brilho visto da câmera', () => {
  it('Lambert: só depende da incidência', () => {
    expect(brilhoRefletido('lambert', 1, 1)).toBeCloseTo(1, 12);
    expect(brilhoRefletido('lambert', 0.3, 0.9)).toBeCloseTo(0.3, 12);
    expect(brilhoRefletido('lambert', 0.3, 0.1)).toBeCloseTo(0.3, 12);
  });

  it('Lommel–Seeliger: a Lua cheia não escurece na borda', () => {
    // Fase zero: incidência igual à emissão em todo o disco.
    for (const mu of [1, 0.6, 0.2, 0.05]) expect(brilhoRefletido('lommelSeeliger', mu, mu)).toBeCloseTo(1, 12);
  });

  it('as duas leis valem 1 no ponto subsolar visto de frente, e zero no terminador', () => {
    for (const lei of ['lambert', 'lommelSeeliger'] as const) {
      expect(brilhoRefletido(lei, 1, 1)).toBeCloseTo(1, 12);
      expect(brilhoRefletido(lei, 0, 0.7)).toBe(0);
    }
  });

  it('nenhuma das duas passa de 2 nem fica negativa, nem na borda do disco', () => {
    for (const lei of ['lambert', 'lommelSeeliger'] as const) {
      for (let mu0 = 0; mu0 <= 1; mu0 += 0.05) {
        for (let mu = 0; mu <= 1; mu += 0.05) {
          const v = brilhoRefletido(lei, mu0, mu);
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(2);
        }
      }
    }
  });
});
