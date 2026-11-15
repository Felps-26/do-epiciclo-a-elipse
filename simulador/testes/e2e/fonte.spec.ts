/**
 * A fonte declarada é a fonte carregada.
 *
 * O CSS pedia 'Inter Variable' e o pacote estava no package.json, mas nada o importava:
 * o programa caía na fonte do sistema, a Segoe UI no Windows e a DejaVu Sans no Linux,
 * mais larga, e a 320 px a barra de cima estourava 7 px só no Linux. O README dizia que
 * as fontes iam empacotadas.
 */
import { expect, test } from '@playwright/test';
import { abrir } from './preparar.ts';

test('a Inter vem empacotada e é a que desenha o texto, sem rede', async ({ page }) => {
  const externas: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:8731')) externas.push(r.url());
  });
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
  const carregadas = await page.evaluate(async () => {
    await document.fonts.ready;
    // Força o uso de um peso, para a face ser baixada mesmo se a página ainda não pediu.
    await document.fonts.load('600 16px "Inter Variable"');
    return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, ''));
  });
  expect(carregadas, 'nenhuma face da Inter carregada').toContain('Inter Variable');
  expect(externas, 'a fonte saiu para a rede').toEqual([]);
});
