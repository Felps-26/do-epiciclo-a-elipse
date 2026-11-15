/**
 * "Ver de perto" chega com o terminador à vista (B4): a fração iluminada do disco
 * fica entre 0,4 e 0,8, e não perto de 1 como na chegada pelo lado do Sol.
 */
import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { abrir } from './preparar.ts';

/** Luminância relativa (linear), a mesma das outras specs: em sRGB a noite com piso parece clara demais. */
function luminancia(r: number, g: number, b: number): number {
  const canal = (c: number): number => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

test('depois do voo até a Terra, a fração iluminada do disco fica entre 0,4 e 0,8', async ({ page }) => {
  test.setTimeout(120_000);
  await abrir(page, { diasPorSegundo: 1e-6 });
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForFunction(() => window.__projecoes !== undefined);
  await page.getByRole('button', { name: 'Pausar' }).click();
  await page.getByRole('option', { name: /^Terra/ }).click();
  await page.getByRole('button', { name: 'Ver de perto' }).click();
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => window.__assentou?.() === true, undefined, { timeout: 90_000 });

  // A fase, na geometria: o ângulo, visto da Terra, entre a câmera e o Sol. A fração
  // iluminada de uma esfera é (1 + cos fase)/2. Medir na imagem pela coluna de maior
  // salto deixou de servir quando o terminador virou rampa (achado #41): a coluna de
  // maior salto passou a ser a borda de uma nuvem.
  const geo = await page.evaluate(() => {
    const c = window.__camera!;
    const t = window.__posicaoNaCena!('terra')!;
    const cam = [Math.cos(c.elevacao) * Math.cos(c.azimute), Math.cos(c.elevacao) * Math.sin(c.azimute), Math.sin(c.elevacao)];
    const sol = [-t.x, -t.y, -t.z];
    const n = Math.hypot(sol[0]!, sol[1]!, sol[2]!);
    const cosFase = (cam[0]! * sol[0]! + cam[1]! * sol[1]! + cam[2]! * sol[2]!) / n;
    const p = window.__projecoes!().find((x) => x.chave === 'terra')!;
    const k = document.querySelector('canvas')!.getBoundingClientRect();
    return { cosFase, x: k.left + p.x, y: k.top + p.y, r: p.raioPx };
  });
  const iluminada = (1 + geo.cosFase) / 2;
  expect(iluminada, `fração iluminada ${iluminada.toFixed(2)}`).toBeGreaterThan(0.4);
  expect(iluminada).toBeLessThan(0.8);

  // E na tela o terminador está à vista: o rumo mais claro do disco é claramente mais
  // claro que o oposto. Chegando pelo lado do Sol, os dois sairiam claros.
  expect(geo.r).toBeGreaterThan(60);
  const png = PNG.sync.read(await page.screenshot());
  const brilho = (rumo: number): number => {
    let soma = 0;
    let n = 0;
    for (let d = -30; d <= 30; d += 2) {
      for (const f of [0.55, 0.65, 0.75]) {
        const a = rumo + (d * Math.PI) / 180;
        const x = Math.round(geo.x + f * geo.r * Math.cos(a));
        const y = Math.round(geo.y + f * geo.r * Math.sin(a));
        if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
        const i = 4 * (y * png.width + x);
        soma += luminancia(png.data[i]!, png.data[i + 1]!, png.data[i + 2]!);
        n++;
      }
    }
    return soma / Math.max(1, n);
  };
  let rumo = 0;
  let dia = -1;
  for (let g = 0; g < 360; g += 10) {
    const v = brilho((g * Math.PI) / 180);
    if (v > dia) {
      dia = v;
      rumo = (g * Math.PI) / 180;
    }
  }
  const noite = brilho(rumo + Math.PI);
  // Medido no Linux: 1,50 na chegada e 1,18 com a câmera do lado do Sol. A noite não
  // é preta (piso de 14 %, luzes de cidade), e por isso a razão não é maior.
  expect(dia, `lado claro ${dia.toFixed(3)}, lado oposto ${noite.toFixed(3)}`).toBeGreaterThan(noite * 1.3);
});
