/**
 * O halo de atmosfera acende no limbo iluminado, e não no que está em sombra.
 *
 * A casca do halo é desenhada por dentro (`BackSide`), e nesse caso o three entrega
 * `normalWorld` já negada, apontando para o centro do planeta. Com essa normal o
 * fator de luz saía trocado: o arco azul aparecia grudado no limbo noturno e o lado
 * de dia ficava sem ar nenhum. Só se vê desenhado, então a medida é na imagem.
 */
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { abrir } from './preparar.ts';

function luminancia(r: number, g: number, b: number): number {
  const canal = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

async function fotografar(pagina: Page) {
  const onde = await pagina.evaluate(
    () => (window.__projecoes?.() ?? []).find((x) => x.chave === 'terra') ?? null,
  );
  expect(onde, 'a Terra não está na tela').not.toBeNull();
  expect(onde!.raioPx, 'a Terra está pequena demais para medir o limbo').toBeGreaterThan(150);
  const png = PNG.sync.read(await pagina.locator('canvas').screenshot({ animations: 'disabled' }));
  const lum = (x: number, y: number): number => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= png.width || yi >= png.height) return NaN;
    const i = 4 * (yi * png.width + xi);
    return luminancia(png.data[i]!, png.data[i + 1]!, png.data[i + 2]!);
  };
  return { cx: onde!.x, cy: onde!.y, r: onde!.raioPx, lum };
}

/** Média de `amostra(ângulo)` num setor de ±`meia` graus em torno de `centro`. */
function noSetor(centro: number, amostra: (a: number) => number, meia = 30): number {
  const valores: number[] = [];
  for (let d = -meia; d <= meia; d += 2) {
    const v = amostra(centro + (d * Math.PI) / 180);
    if (Number.isFinite(v)) valores.push(v);
  }
  expect(valores.length, 'o setor saiu da imagem').toBeGreaterThan(20);
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

test('o halo de atmosfera da Terra acende no limbo iluminado, não no limbo em sombra', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  // Sem rótulos e sem luas: o anel tracejado e a Lua não podem cair na faixa medida.
  await abrir(page, { luas: 'sem', opcoes: { rotulos: false } });
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForFunction(() => window.__camera !== undefined);
  await page.getByRole('button', { name: 'Pausar' }).click();

  await page.getByRole('option', { name: /^Terra/ }).click();
  await page.keyboard.press('4');
  await page.waitForFunction(() => window.__assentou?.() === true, undefined, { timeout: 60000 });
  // Sol de lado: noventa graus entre a câmera e a direção do Sol, meio disco aceso.
  await page.evaluate(() => window.__ladoIluminado?.(Math.PI / 2));
  await page.waitForTimeout(1500);

  const { cx, cy, r, lum } = await fotografar(page);

  // O lado de dia é o rumo, a partir do centro, em que o meio disco é mais claro.
  // Média ao longo do raio e em meio disco, para uma nuvem clara não decidir sozinha.
  const disco = (a: number): number => {
    let soma = 0;
    for (let f = 0.2; f <= 0.85; f += 0.05) soma += lum(cx + f * r * Math.cos(a), cy + f * r * Math.sin(a)) || 0;
    return soma;
  };
  let rumoDoDia = 0;
  let maisClaro = -1;
  for (let g = 0; g < 360; g += 10) {
    const a = (g * Math.PI) / 180;
    const v = noSetor(a, disco, 80);
    if (v > maisClaro) {
      maisClaro = v;
      rumoDoDia = a;
    }
  }
  const rumoDaNoite = rumoDoDia + Math.PI;
  const discoDeDia = maisClaro;
  const discoDeNoite = noSetor(rumoDaNoite, disco, 80);
  // A noite tem piso de luz e a exposição é alta, então a diferença é menor que a do
  // halo; basta para saber qual lado é o dia.
  expect(discoDeDia, 'o disco não tem um lado claramente aceso').toBeGreaterThan(discoDeNoite * 1.2);

  // Onde a imagem deixa de ser escura, andando do centro para fora. O halo alarga o
  // contorno do lado em que acende, em uns 1,5% do raio; comparar os dois lados
  // dispensa saber o raio do disco ao pixel.
  const borda = (a: number): number => {
    let d = 0.9 * r;
    while (d < 1.3 * r && (lum(cx + d * Math.cos(a), cy + d * Math.sin(a)) || 0) > 0.02) d += 0.5;
    return d;
  };
  const bordaDeDia = noSetor(rumoDoDia, borda);
  const bordaDeNoite = noSetor(rumoDaNoite, borda);
  expect(
    bordaDeDia - bordaDeNoite,
    `contorno do lado de dia a ${bordaDeDia.toFixed(1)} px, do lado de noite a ${bordaDeNoite.toFixed(1)} px`,
  ).toBeGreaterThan(0.006 * r);
});
