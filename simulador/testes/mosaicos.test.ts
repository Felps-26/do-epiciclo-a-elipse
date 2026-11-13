/**
 * O pipeline de texturas sem o `sips`: reduz, ajusta a longitude e pinta buracos em
 * qualquer sistema. Uma imagem sintética de 8 x 4 basta para ver cada passo.
 */
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error a ferramenta é JavaScript puro, sem declarações de tipo
import { ajustarLongitude, gerarNivel, larguraDe, preencherSemDado } from '../ferramentas/mosaicos.mjs';

/** Faixas verticais: a coluna x tem cinza 20 + 25x, menos a coluna 3, preta ("sem dado"). */
function faixas(): Buffer {
  const L = 8;
  const A = 4;
  const d = Buffer.alloc(L * A * 3);
  for (let y = 0; y < A; y++) {
    for (let x = 0; x < L; x++) {
      const v = x === 3 ? 0 : 20 + 25 * x;
      d.fill(v, 3 * (y * L + x), 3 * (y * L + x) + 3);
    }
  }
  return d;
}

describe('pipeline de texturas', () => {
  it('girar meia volta leva a coluna 0 para o meio, e espelhar inverte', () => {
    const girada = ajustarLongitude(faixas(), 8, 4, 3, { espelhar: false, girar: 0.5 }) as Buffer;
    expect(girada[3 * 4]).toBe(20);
    const espelhada = ajustarLongitude(faixas(), 8, 4, 3, { espelhar: true, girar: 0 }) as Buffer;
    expect(espelhada[0]).toBe(20 + 25 * 7);
  });

  it('o buraco preto vira a cor média, sem pixel preto sobrando', () => {
    const d = faixas();
    preencherSemDado(d, 8, 4, 3);
    expect([...d].every((v) => v >= 10)).toBe(true);
  });

  it('gerarNivel reduz sem ampliar e grava JPEG', async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'mosaico-'));
    try {
      const origem = join(pasta, 'fonte.png');
      await sharp(faixas(), { raw: { width: 8, height: 4, channels: 3 } }).png().toFile(origem);
      const pequeno = join(pasta, 'pequeno.jpg');
      const grande = join(pasta, 'grande.jpg');
      await gerarNivel(origem, pequeno, 4, { preencher: true });
      await gerarNivel(origem, grande, 2048);
      expect(await larguraDe(pequeno)).toBe(4);
      // A fonte tem 8 px: pedir 2048 não amplia.
      expect(await larguraDe(grande)).toBe(8);
      expect((await sharp(grande).metadata()).format).toBe('jpeg');
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  });
});
