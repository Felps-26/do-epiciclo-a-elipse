/**
 * "Ver de perto" chega com o terminador à vista (B4): a fração iluminada do disco,
 * medida na imagem, fica entre 0,4 e 0,8, e não perto de 1 como na chegada pelo
 * lado do Sol.
 */
import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { abrir } from './preparar.ts';

test('depois do voo até a Terra, a fração iluminada do disco fica entre 0,4 e 0,8', async ({ page }) => {
  test.setTimeout(120_000);
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForFunction(() => window.__projecoes !== undefined);
  await page.getByRole('button', { name: 'Pausar' }).click();
  await page.getByRole('option', { name: /^Terra/ }).click();
  await page.getByRole('button', { name: 'Ver de perto' }).click();
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => window.__assentou?.() === true, undefined, { timeout: 90_000 });

  const disco = await page.evaluate(() => {
    const p = window.__projecoes!().find((x) => x.chave === 'terra')!;
    const c = document.querySelector('canvas')!.getBoundingClientRect();
    return { x: c.left + p.x, y: c.top + p.y, r: p.raioPx };
  });
  expect(disco.r).toBeGreaterThan(60);
  const lado = Math.floor(disco.r * 2);
  const png = PNG.sync.read(
    await page.screenshot({ clip: { x: disco.x - disco.r, y: disco.y - disco.r, width: lado, height: lado } }),
  );

  // O lado noturno tem piso de luz e nuvens; um limiar de brilho o confunde com o dia.
  // O terminador, porém, é um degrau: acha-se a coluna em que o brilho médio da
  // faixa central muda mais, e dela sai a fração iluminada de uma esfera.
  const r = png.width / 2;
  const colunas: number[] = [];
  for (let x = 0; x < png.width; x++) {
    let soma = 0;
    let n = 0;
    for (let y = Math.floor(r - 0.3 * r); y < r + 0.3 * r; y++) {
      if (Math.hypot(x - r, y - r) > 0.95 * r) continue;
      const k = 4 * (y * png.width + x);
      soma += 0.2126 * png.data[k]! + 0.7152 * png.data[k + 1]! + 0.0722 * png.data[k + 2]!;
      n++;
    }
    colunas.push(n ? soma / n : 0);
  }
  const janela = 12;
  let melhor = 0;
  let degrau = 0;
  for (let x = Math.ceil(0.1 * r) + janela; x < png.width - Math.ceil(0.1 * r) - janela; x++) {
    let antes = 0;
    let depois = 0;
    for (let k = 1; k <= janela; k++) {
      antes += colunas[x - k]!;
      depois += colunas[x + k]!;
    }
    const d = (depois - antes) / janela;
    if (Math.abs(d) > Math.abs(degrau)) {
      degrau = d;
      melhor = x;
    }
  }
  // Degrau positivo: o dia está à direita. t é a posição do terminador em raios.
  const t = (melhor - r) / r;
  const iluminada = degrau > 0 ? (1 - t) / 2 : (1 + t) / 2;
  expect(iluminada, `fração iluminada ${iluminada.toFixed(2)}`).toBeGreaterThan(0.4);
  expect(iluminada).toBeLessThan(0.8);
});
