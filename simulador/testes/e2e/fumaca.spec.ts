/**
 * Fumaça: o caminho principal do programa, para rodar em outros navegadores.
 *
 * `NAVEGADORES=todos npx playwright test fumaca` roda também no Edge e no Firefox
 * (ver `playwright.config.ts`). Cada teste registra o backend que o navegador escolheu,
 * e uma tela preta reprova: o programa aberto sem imagem é o pior defeito que há.
 */
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { abrir, assentar } from './preparar.ts';

async function variacaoDoCanvas(page: Page): Promise<number> {
  const png = PNG.sync.read(await page.locator('canvas').screenshot());
  let min = 255;
  let max = 0;
  for (let i = 0; i < png.data.length; i += 4 * 61) {
    const l = (png.data[i]! + png.data[i + 1]! + png.data[i + 2]!) / 3;
    min = Math.min(min, l);
    max = Math.max(max, l);
  }
  return max - min;
}

async function abrirPausado(page: Page): Promise<void> {
  test.setTimeout(120_000);
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForFunction(() => window.__camera !== undefined);
  await page.getByRole('button', { name: 'Pausar' }).click();
  await page.waitForTimeout(1500);
}

test('abre com imagem, e registra o backend', async ({ page }, info) => {
  await abrirPausado(page);
  const backend = await page.evaluate(() => window.__backend?.() ?? '?');
  info.annotations.push({ type: 'backend', description: `${info.project.name}: ${backend}` });
  console.log(`BACKEND ${info.project.name}: ${backend}`);
  expect(await variacaoDoCanvas(page), 'tela preta').toBeGreaterThan(30);
});

test('chega perto da Terra', async ({ page }) => {
  await abrirPausado(page);
  await page.getByRole('option', { name: /^Terra/ }).click();
  await page.getByRole('button', { name: 'Ver de perto' }).click();
  await assentar(page);
  const raio = await page.evaluate(() => window.__projecoes!().find((p) => p.chave === 'terra')?.raioPx ?? 0);
  expect(raio).toBeGreaterThan(60);
  expect(await variacaoDoCanvas(page)).toBeGreaterThan(30);
});

test('abre o laboratório de Fourier', async ({ page }) => {
  await abrirPausado(page);
  await page.getByRole('button', { name: 'Epiciclos de Fourier' }).click();
  await expect(page.locator('.lab')).toBeVisible();
  await expect(page.locator('.lab__grafico')).toBeVisible();
});

test('cria um corpo no sandbox', async ({ page }) => {
  await abrirPausado(page);
  await page.getByRole('radio', { name: 'Criar', exact: true }).click();
  const caixa = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(caixa.x + caixa.width / 2 + 160, caixa.y + caixa.height / 2);
  await page.getByRole('button', { name: /Criar asteroide/ }).click();
  await expect(page.getByRole('option', { name: /Asteroide 1/ })).toBeVisible();
});
