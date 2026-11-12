/**
 * A Lua pela serie de Meeus, conferida pelos exemplos resolvidos do livro.
 *
 * O exemplo 47.a soma os 120 termos numa data so; um coeficiente errado, que
 * nao caia num zero do seno, muda a soma na sexta casa. A conferencia contra o
 * Horizons (`ferramentas/conferir_luas.mjs`) e a que mede o erro de verdade.
 */
import { describe, expect, it } from 'vitest';
import { equatorialDaDataParaJ2000, luaNaDataMedia, posicaoDaLuaMeeus } from '@nucleo/luaMeeus.ts';
import { UA_KM } from '@nucleo/unidades.ts';

const GRAU = Math.PI / 180;

describe('série de Meeus', () => {
  it('reproduz o exemplo 47.a: 12 de abril de 1992, 0h TD', () => {
    const c = luaNaDataMedia(2448724.5);
    expect(c.longitudeGraus).toBeCloseTo(133.162655, 6);
    expect(c.latitudeGraus).toBeCloseTo(-3.229126, 6);
    expect(c.distanciaKm).toBeCloseTo(368409.7, 1);
  });

  it('a precessão reproduz o exemplo 21.b, de trás para a frente', () => {
    // Theta Persei em 2028-11-13,19 TD, equinócio da data, e o mesmo ponto em J2000.
    const alfaData = (2 + 46 / 60 + 11.331 / 3600) * 15 * GRAU;
    const deltaData = (49 + 20 / 60 + 54.54 / 3600) * GRAU;
    const v: [number, number, number] = [
      Math.cos(deltaData) * Math.cos(alfaData),
      Math.cos(deltaData) * Math.sin(alfaData),
      Math.sin(deltaData),
    ];
    const j = equatorialDaDataParaJ2000(2462088.69, v);
    const alfa = Math.atan2(j[1], j[0]) / GRAU / 15;
    const delta = Math.asin(j[2]) / GRAU;
    // 2h44m12,975s e +49°13'39,90", com o movimento próprio já somado no livro.
    expect(Math.abs(alfa - (2 + 44 / 60 + 12.975 / 3600)) * 3600 * 15 * Math.cos(delta * GRAU)).toBeLessThan(0.1);
    expect(Math.abs(delta - (49 + 13 / 60 + 39.9 / 3600)) * 3600).toBeLessThan(0.1);
  });

  it('em 2026 a eclíptica J2000 está a uns 0,36° da eclíptica da data, na longitude', () => {
    const jd = 2461041.5;
    const c = luaNaDataMedia(jd);
    const v: [number, number, number] = [0, 0, 0];
    posicaoDaLuaMeeus(jd, v);
    expect(Math.hypot(...v) * UA_KM).toBeCloseTo(c.distanciaKm, 3);
    let dl = c.longitudeGraus - Math.atan2(v[1], v[0]) / GRAU;
    dl = ((dl % 360) + 540) % 360 - 180;
    expect(dl).toBeGreaterThan(0.35);
    expect(dl).toBeLessThan(0.38);
  });

  it('a distância fica entre o perigeu e o apogeu reais em vinte anos', () => {
    let menor = Infinity;
    let maior = 0;
    for (let k = 0; k < 20 * 365; k++) {
      const r = luaNaDataMedia(2458850 + k).distanciaKm;
      menor = Math.min(menor, r);
      maior = Math.max(maior, r);
    }
    expect(menor).toBeGreaterThan(356000);
    expect(menor).toBeLessThan(357500);
    expect(maior).toBeGreaterThan(406000);
    expect(maior).toBeLessThan(406800);
  });
});
