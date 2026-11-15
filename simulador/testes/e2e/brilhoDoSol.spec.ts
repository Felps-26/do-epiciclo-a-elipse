/**
 * Na visão geral, o Sol desenhado e o brilho dele não podem lavar os planetas
 * internos (B3). Mede-se o pixel onde a própria cena diz que Mercúrio está.
 */
import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { abrir, assentar } from './preparar.ts';

test('na câmera padrão, o pixel de Mercúrio não é saturado pelo brilho do Sol', async ({ page }) => {
  // Quase parado: a 30 dias por segundo, onde Mercúrio estava na pausa dependia da
  // velocidade da máquina, e no CI ele aparecia quase atrás do Sol.
  await abrir(page, { diasPorSegundo: 1e-6 });
  await expect(page.getByRole('banner')).toBeVisible();
  test.setTimeout(90_000);
  await page.waitForFunction(() => window.__projecoes !== undefined);
  await page.getByRole('button', { name: 'Pausar' }).click();
  await assentar(page);

  const alvo = await page.evaluate(() => {
    const p = window.__projecoes!().find((x) => x.chave === 'mercurio')!;
    const sol = window.__projecoes!().find((x) => x.chave === 'sol')!;
    const c = document.querySelector('canvas')!.getBoundingClientRect();
    const m = window.__posicaoNaCena!('mercurio')!;
    return {
      x: c.left + p.x,
      y: c.top + p.y,
      // Em 3D e nao na tela: a camera inclinada encurta a distancia projetada conforme o
      // ponto da orbita, e o limite do B3 (0,4 da distancia de Mercurio) e espacial.
      dMercurio: Math.hypot(m.x, m.y, m.z),
      raioDoSol: window.__raioAparente!('sol') * sol.distanciaUa,
    };
  });
  expect(alvo.raioDoSol).toBeLessThanOrEqual(alvo.dMercurio * 0.4 * 1.000001);

  const png = PNG.sync.read(await page.screenshot({ clip: { x: alvo.x - 1, y: alvo.y - 1, width: 3, height: 3 } }));
  let maior = 0;
  for (let k = 0; k < png.data.length; k += 4) maior = Math.max(maior, png.data[k]!, png.data[k + 1]!, png.data[k + 2]!);
  expect(maior, 'o pixel de Mercúrio está estourado').toBeLessThan(250);
});
