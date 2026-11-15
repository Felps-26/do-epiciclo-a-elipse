/**
 * O terminador é uma rampa, e não um degrau.
 *
 * Com o Sol de lado, a luz que chega a cada ponto do disco cai com o cosseno da
 * incidência: perto do terminador o Sol está rasante e quase não ilumina. O programa
 * desenhava um degrau, com todo o hemisfério de dia no mesmo brilho e uma linha dura
 * na borda da noite (achado #41). Aqui se mede o brilho do lado de dia em duas
 * distâncias do terminador, ao longo do rumo do Sol na tela.
 */
import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { abrir, assentar } from './preparar.ts';

function luminancia(r: number, g: number, b: number): number {
  const canal = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

for (const corpo of [
  // Marte e não a Terra: na Terra, nuvem perto do terminador e oceano perto do limbo
  // misturam o albedo da textura com o efeito da luz.
  { chave: 'marte', nome: /^Marte/, lei: 'Lambert' },
  { chave: 'lua', nome: /^Lua/, lei: 'Lommel–Seeliger' },
]) {
  test(`de lado, o dia de ${corpo.chave} escurece rumo ao terminador (${corpo.lei})`, async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 860 });
    await abrir(page, { diasPorSegundo: 1e-6, opcoes: { rotulos: false } });
    await page.waitForFunction(() => window.__camera !== undefined);
    await page.getByRole('button', { name: 'Pausar' }).click();
    if (corpo.chave === 'lua') await page.getByRole('option', { name: /^Terra/ }).click();
    await page.getByRole('option', { name: corpo.nome }).click();
    await page.keyboard.press('4');
    await page.waitForFunction(() => (window.__camera?.raio ?? 1) < 1e-3 && window.__assentou?.() === true, undefined, {
      timeout: 90_000,
    });
    // Noventa graus entre a câmera e o Sol: o terminador passa pelo centro do disco.
    await page.evaluate(() => window.__ladoIluminado?.(Math.PI / 2));
    await assentar(page);

    const onde = await page.evaluate((c) => (window.__projecoes?.() ?? []).find((x) => x.chave === c) ?? null, corpo.chave);
    expect(onde).not.toBeNull();
    expect(onde!.raioPx).toBeGreaterThan(150);
    const png = PNG.sync.read(await page.locator('canvas').screenshot({ animations: 'disabled' }));
    const lum = (x: number, y: number): number => {
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= png.width || yi >= png.height) return NaN;
      const i = 4 * (yi * png.width + xi);
      return luminancia(png.data[i]!, png.data[i + 1]!, png.data[i + 2]!);
    };
    const { x: cx, y: cy, raioPx: r } = onde!;
    // Média num setor de ±25° em torno de um rumo, numa fração do raio.
    const noAnel = (rumo: number, f: number): number => {
      let soma = 0;
      let n = 0;
      for (let d = -25; d <= 25; d += 1) {
        const a = rumo + (d * Math.PI) / 180;
        const v = lum(cx + f * r * Math.cos(a), cy + f * r * Math.sin(a));
        if (Number.isFinite(v)) {
          soma += v;
          n++;
        }
      }
      return soma / Math.max(1, n);
    };
    // O rumo do dia é o mais claro a 0,6 do raio.
    let rumo = 0;
    let maior = -1;
    for (let g = 0; g < 360; g += 5) {
      const v = noAnel((g * Math.PI) / 180, 0.6);
      if (v > maior) {
        maior = v;
        rumo = (g * Math.PI) / 180;
      }
    }
    const pertoDoTerminador = noAnel(rumo, 0.2);
    const pertoDoLimbo = noAnel(rumo, 0.8);
    // Pela lei do cosseno a razão é ~3 antes do mapeamento de tons, que a comprime.
    // O degrau antigo dava ~1, com o dia inteiro no mesmo brilho.
    expect(
      pertoDoLimbo / pertoDoTerminador,
      `luminância ${pertoDoLimbo.toFixed(3)} a 0,8 do raio contra ${pertoDoTerminador.toFixed(3)} a 0,2`,
    ).toBeGreaterThan(1.5);
  });
}
