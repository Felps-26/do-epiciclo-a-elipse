/**
 * A casca de prova da suíte de precisão envolve cada corpo a 1,003 raio desenhado
 * (#22). Escalada em unidades de mundo, ela tinha 1,003 UA: ninguém a via, mas a
 * suíte que a usa media outra coisa.
 */
import { expect, test } from '@playwright/test';
import { abrir } from './preparar.ts';

test('a casca de prova tem 1,003 raio desenhado, em qualquer corpo', async ({ page }) => {
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForFunction(() => typeof window.__cascaEmRaios?.('terra') === 'number');
  const razoes = await page.evaluate(() =>
    ['sol', 'terra', 'jupiter', 'netuno', 'lua'].map((k) => [k, window.__cascaEmRaios!(k)] as const),
  );
  for (const [k, r] of razoes) expect(r, k).toBeCloseTo(1.003, 9);
});
