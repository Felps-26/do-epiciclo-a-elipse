/**
 * Os mosaicos das luas, olhados na imagem entregue: a convenção de longitude (#6)
 * e os buracos de "sem dado" (#19).
 */
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEXTURAS = join(dirname(fileURLToPath(import.meta.url)), '..', 'publico', 'texturas', '2k');

async function cinza(arquivo: string): Promise<{ data: Buffer; L: number; A: number }> {
  const { data, info } = await sharp(await readFile(join(TEXTURAS, arquivo)))
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, L: info.width, A: info.height };
}

describe('mosaicos das luas', () => {
  it('a cratera Valhalla, em Calisto, cai perto de 56° O, e não espelhada a leste', async () => {
    const { data, L, A } = await cinza('callisto.jpg');
    // Faixa de 10° a 26° N; a coluna mais clara, com média de 12° de largura.
    const y0 = Math.round(((90 - 26) / 180) * A);
    const y1 = Math.round(((90 - 10) / 180) * A);
    const coluna = new Float64Array(L);
    for (let x = 0; x < L; x++) {
      let s = 0;
      for (let y = y0; y < y1; y++) s += data[y * L + x]!;
      coluna[x] = s;
    }
    const w = Math.round((L * 6) / 360);
    let melhor = -1;
    let onde = 0;
    for (let x = 0; x < L; x++) {
      let s = 0;
      for (let k = -w; k <= w; k++) s += coluna[(x + k + L) % L]!;
      if (s > melhor) {
        melhor = s;
        onde = x;
      }
    }
    // Convenção do programa: longitude 0 no meio, leste à direita.
    const longitude = (onde / L - 0.5) * 360;
    expect(longitude).toBeGreaterThan(-70);
    expect(longitude).toBeLessThan(-45);
  });

  it('nenhum mosaico tem buraco preto de "sem dado"', async () => {
    for (const arquivo of ['io.jpg', 'europa.jpg', 'ganymede.jpg', 'callisto.jpg', 'enceladus.jpg']) {
      const { data } = await cinza(arquivo);
      let pretos = 0;
      for (const v of data) if (v < 6) pretos++;
      expect(pretos / data.length, arquivo).toBeLessThan(0.0005);
    }
  });
});
