/**
 * Na visão geral, o Sol desenhado e o brilho dele não podem lavar os planetas
 * internos (B3). Mede-se o pixel onde a própria cena diz que Mercúrio está.
 */
import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { abrir } from './preparar.ts';

test('na câmera padrão, o pixel de Mercúrio não é saturado pelo brilho do Sol', async ({ page }) => {
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
  test.setTimeout(90_000);
  await page.waitForFunction(() => window.__projecoes !== undefined);
  await page.getByRole('button', { name: 'Pausar' }).click();
  await page.waitForFunction(() => window.__assentou?.() === true, undefined, { timeout: 60_000 });

  const alvo = await page.evaluate(() => {
    const p = window.__projecoes!().find((x) => x.chave === 'mercurio')!;
    const sol = window.__projecoes!().find((x) => x.chave === 'sol')!;
    const c = document.querySelector('canvas')!.getBoundingClientRect();
    return { x: c.left + p.x, y: c.top + p.y, distancia: Math.hypot(p.x - sol.x, p.y - sol.y), raioDoSol: sol.raioPx };
  });
  // O disco do Sol fica dentro da órbita desenhada de Mercúrio.
  expect(alvo.raioDoSol).toBeLessThan(alvo.distancia * 0.5);

  const png = PNG.sync.read(await page.screenshot({ clip: { x: alvo.x - 1, y: alvo.y - 1, width: 3, height: 3 } }));
  let maior = 0;
  for (let k = 0; k < png.data.length; k += 4) maior = Math.max(maior, png.data[k]!, png.data[k + 1]!, png.data[k + 2]!);
  expect(maior, 'o pixel de Mercúrio está estourado').toBeLessThan(250);
});
