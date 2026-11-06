/**
 * O layout, medido na tela e nao num objeto que o programa nao usa.
 *
 * Havia `src/interface/layout.ts` (131 linhas que calculavam retangulos e emitiam
 * variaveis CSS) e `testes/layout.test.ts`, que percorria 560 combinacoes de tamanho
 * contra elas. O modulo so era importado pelo proprio teste: nada no programa chamava
 * `medirLayout` nem `aplicarVariaveis`, `--altura-barra` e `--largura-lateral` nunca
 * eram definidas e todo `var(--x, fallback)` do CSS resolvia para o fallback. O
 * cabecalho do modulo dizia que ele existia para o porte das combinacoes nao virar
 * "um teste sobre um objeto que ninguem usa", e virou. E o erro catalogado em
 * `ARQUITETURA.md` (teste que mede o proprio teste), que aqui custava 560 asserções.
 *
 * O layout que existe de verdade e o CSS, entao e ele que se mede: as mesmas larguras
 * e alturas, lidas do DOM montado, com as mesmas perguntas (area negativa,
 * sobreposicao indevida, canvas pequeno demais) mais duas que so a tela real responde:
 * rolagem horizontal e a barra passando por cima do canvas.
 */
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { abrir } from './preparar.ts';

/**
 * As mesmas quatorze larguras e dez alturas do teste que este substitui. 320 e 360 px
 * estao pelo criterio 1.4.10 da WCAG 2.2 (Reflow), e 3024 e a tela do computador em
 * que o programa foi escrito. As 140 combinacoes custam tempo real no navegador, entao
 * se dividem em tres testes por escala de texto em vez de 560 casos; o que se mede e
 * o mesmo.
 */
const LARGURAS = [320, 360, 480, 640, 800, 960, 1000, 1100, 1220, 1280, 1440, 1920, 2560, 3024];
const ALTURAS = [400, 600, 720, 900, 1080];

interface Caixas {
  janela: { largura: number; altura: number };
  barra: { x: number; y: number; largura: number; altura: number } | null;
  painel: { x: number; y: number; largura: number; altura: number } | null;
  canvas: { x: number; y: number; largura: number; altura: number };
  rolagemHorizontal: number;
  /** `scrollWidth - clientWidth` da própria barra. Ver `conferir`. */
  rolagemDaBarra: number;
  painelSobreposto: boolean;
}

async function medir(p: Page): Promise<Caixas> {
  return p.evaluate(() => {
    const caixa = (sel: string): { x: number; y: number; largura: number; altura: number } | null => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, largura: r.width, altura: r.height };
    };
    const painel = document.querySelector('.lateral');
    return {
      janela: { largura: window.innerWidth, altura: window.innerHeight },
      barra: caixa('header.barra'),
      painel: caixa('.lateral'),
      canvas: caixa('canvas')!,
      // `scrollWidth > clientWidth` é o teste de refluxo: a página não pode
      // rolar de lado em largura nenhuma.
      rolagemHorizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      rolagemDaBarra: (() => {
        const b = document.querySelector('header.barra');
        return b ? b.scrollWidth - b.clientWidth : 0;
      })(),
      // Abaixo do ponto de quebra o painel SOBREPÕE em vez de sumir — sumir
      // tiraria a única lista de corpos navegável por teclado.
      painelSobreposto: painel ? getComputedStyle(painel).position === 'absolute' : false,
    };
  });
}

function conferir(c: Caixas, onde: string): void {
  expect(c.canvas.largura, `${onde}: canvas sem largura`).toBeGreaterThan(0);
  expect(c.canvas.altura, `${onde}: canvas sem altura`).toBeGreaterThan(0);

  for (const [nome, r] of [
    ['barra', c.barra],
    ['painel', c.painel],
    ['canvas', c.canvas],
  ] as const) {
    if (!r) continue;
    expect(r.largura, `${onde}: ${nome} com largura negativa`).toBeGreaterThan(0);
    expect(r.altura, `${onde}: ${nome} com altura negativa`).toBeGreaterThan(0);
    expect(r.x, `${onde}: ${nome} começa fora da tela`).toBeGreaterThanOrEqual(-1);
    expect(r.y, `${onde}: ${nome} começa acima da tela`).toBeGreaterThanOrEqual(-1);
    expect(r.x + r.largura, `${onde}: ${nome} estoura a largura da janela`)
      .toBeLessThanOrEqual(c.janela.largura + 1);
  }

  // A barra fica ACIMA do canvas, sempre. Uma barra por cima esconderia a cena.
  if (c.barra) {
    expect(c.barra.y + c.barra.altura, `${onde}: a barra invade o canvas`)
      .toBeLessThanOrEqual(c.canvas.y + 1);
  }

  // Painel e canvas só podem se sobrepor quando o painel é sobreposição
  // declarada — que é o comportamento abaixo do ponto de quebra.
  if (c.painel && !c.painelSobreposto) {
    expect(c.painel.x, `${onde}: painel e canvas se sobrepõem sem ser sobreposição`)
      .toBeGreaterThanOrEqual(c.canvas.x + c.canvas.largura - 1);
  }

  expect(c.rolagemHorizontal, `${onde}: a página rola de lado`).toBeLessThanOrEqual(1);

  // A barra tambem nao rola de lado, pergunta separada. `.barra` tem `overflow-y: auto`
  // para ceder altura, e o navegador computa `overflow-x: auto` junto. A 320 px o botao
  // de acelerar o tempo e a data escorriam para fora, atras de uma rolagem horizontal
  // dentro da barra, onde ninguem procura. A pagina nao rolava, entao a asserção acima
  // passava verde o tempo todo.
  expect(c.rolagemDaBarra, `${onde}: a barra rola de lado e esconde controle`)
    .toBeLessThanOrEqual(1);
}

for (const escalaTexto of [1, 1.25]) {
  test(`o layout aguenta 70 tamanhos de janela, com texto ${escalaTexto === 1 ? 'normal' : 'maior'}`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await abrir(page, escalaTexto === 1 ? {} : { opcoes: { textoMaior: true } });
    await expect(page.getByRole('banner')).toBeVisible();

    for (const L of LARGURAS) {
      for (const A of ALTURAS) {
        await page.setViewportSize({ width: L, height: A });
        // Um quadro para o refluxo assentar. Sem isto, mede-se o tamanho
        // anterior — que é o defeito que o teste original nasceu para pegar.
        await page.waitForTimeout(60);
        conferir(await medir(page), `${L}x${A} @${escalaTexto}`);
      }
    }
  });
}

test('abaixo do ponto de quebra o painel SOBREPÕE, e não some', async ({ page }) => {
  // Sumir tiraria de quem usa teclado a única forma de escolher um corpo.
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(80);
  const amplo = await medir(page);
  expect(amplo.painelSobreposto, 'a 1280 px o painel divide espaço').toBe(false);
  expect(amplo.canvas.largura).toBeLessThan(1280);

  await page.setViewportSize({ width: 800, height: 700 });
  await page.waitForTimeout(80);
  const estreito = await medir(page);
  expect(estreito.painelSobreposto, 'a 800 px o painel sobrepõe').toBe(true);
  expect(estreito.painel!.largura, 'o painel continua visível').toBeGreaterThan(0);
  expect(estreito.canvas.largura, 'o canvas fica com a janela inteira').toBeCloseTo(800, 0);
});

test('"Texto maior" cresce a barra e o painel de verdade', async ({ page }) => {
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(80);
  const antes = await medir(page);

  await page.locator('summary', { hasText: 'Leitura' }).click();
  await page.getByRole('checkbox', { name: /Texto maior/ }).click();
  await page.waitForTimeout(150);
  const depois = await medir(page);

  expect(depois.barra!.altura, 'a barra não cresceu').toBeGreaterThan(antes.barra!.altura);
  expect(depois.painel!.largura, 'o painel não cresceu').toBeGreaterThan(antes.painel!.largura);
  // E a escala chegou ao CSS, que é por onde ela age.
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--escala-texto').trim()),
  ).toBe('1.25');
});

test('escolher um corpo NAO move a cena', async ({ page }) => {
  /**
   * `.corpo` era `flex: 1 1 auto`, e base `auto` mede o conteudo, que e um `<canvas>`
   * cujo tamanho intrinseco sao os atributos `width`/`height` que o programa escreve
   * depois de medir a caixa. Um laco fechado, estavel por acidente. Escolher Jupiter
   * mudava o rotulo de um botao da barra, ela caia de 97,5 px para 82 e a cena inteira
   * subia 15,5 px.
   *
   * A consequencia visivel nao era o salto, que passa por piscada: o duplo clique na
   * cena nunca funcionava, porque os dois cliques chegavam com `y` 15,5 px diferente
   * contra 4 px de folga e o segundo virava um clique novo.
   */
  await page.setViewportSize({ width: 1280, height: 820 });
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForTimeout(200);

  const antes = await medir(page);
  // Guarda: se a barra nao existisse ou o canvas tivesse altura zero, as
  // comparacoes abaixo passariam sem medir nada.
  expect(antes.barra, 'sem barra nao ha o que medir').not.toBeNull();
  expect(antes.canvas.altura).toBeGreaterThan(100);

  await page.getByRole('option', { name: /^Júpiter/ }).click();
  await page.waitForTimeout(300);
  const depois = await medir(page);

  expect(depois.barra!.altura, 'a barra mudou de altura ao escolher um corpo')
    .toBeCloseTo(antes.barra!.altura, 1);
  expect(depois.canvas.y, 'a cena subiu ou desceu ao escolher um corpo')
    .toBeCloseTo(antes.canvas.y, 1);
  expect(depois.canvas.altura).toBeCloseTo(antes.canvas.altura, 1);

  // E o mesmo vale para acompanhar, que troca "Focar X" por "Soltar X" — o
  // rotulo mais longo que a barra chega a mostrar.
  await page.keyboard.press('3');
  await page.waitForTimeout(300);
  const acompanhando = await medir(page);
  await expect(page.getByRole('button', { name: 'Soltar', exact: true })).toBeVisible();
  expect(acompanhando.canvas.y, 'a cena se mexeu ao acompanhar')
    .toBeCloseTo(antes.canvas.y, 1);
});

/** Brilho médio do canvas, em 0..255. Uma tela preta dá zero. */
async function brilhoDaCena(pagina: Page): Promise<number> {
  const png = PNG.sync.read(await pagina.locator('canvas').screenshot({ animations: 'disabled' }));
  let soma = 0;
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4 * 17) {
    soma += png.data[i]! + png.data[i + 1]! + png.data[i + 2]!;
    n++;
  }
  expect(n, 'o canvas saiu vazio').toBeGreaterThan(500);
  return soma / n / 3;
}

test('a CENA sobrevive a um redimensionamento — e ela não sobrevivia', async ({ page }) => {
  /**
   * `RenderTarget.setSize` descarta o recurso de GPU do alvo HDR, e o `RenderPipeline`
   * que compoe esse alvo na tela lia o que nao existia mais: o canvas ficava preto.
   * Medido na cena de partida, brilho medio 5,9 antes e 0,76 depois, sem voltar ao
   * mostrar o painel de novo; so um redimensionamento de janela devolvia imagem. Um
   * clique em "Esconder painel" redimensiona o canvas, entao um botao da barra, ao lado
   * da Ajuda, apagava a simulacao.
   *
   * Nada pegava: `e2e/precisao.spec.ts` esconde e mostra o painel mas mede
   * `__projecoes`, que vem da CPU e segue certa com a tela preta, e as douradas nunca
   * redimensionam. Este teste olha os pixels depois de mudar de tamanho, e so isso.
   */
  await page.setViewportSize({ width: 1000, height: 820 });
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForFunction(() => window.__camera !== undefined);
  await page.getByRole('button', { name: 'Pausar' }).click();
  await page.waitForTimeout(600);

  const antes = await brilhoDaCena(page);
  expect(antes, 'a cena já estava preta: o teste não mede nada').toBeGreaterThan(2);

  // 1. Esconder o painel — o caminho que apagava tudo.
  await page.getByRole('button', { name: 'Esconder painel' }).click();
  await page.waitForTimeout(1200);
  const semPainel = await brilhoDaCena(page);
  expect(semPainel, 'a cena apagou ao esconder o painel').toBeGreaterThan(antes * 0.4);

  // 2. E volta ao mostrar.
  await page.getByRole('button', { name: 'Mostrar painel' }).click();
  await page.waitForTimeout(1200);
  expect(await brilhoDaCena(page), 'a cena não voltou ao mostrar o painel')
    .toBeGreaterThan(antes * 0.7);

  // 3. E aguenta um redimensionamento de janela, que é o outro caminho.
  await page.setViewportSize({ width: 760, height: 700 });
  await page.waitForTimeout(1200);
  expect(await brilhoDaCena(page), 'a cena apagou ao redimensionar a janela')
    .toBeGreaterThan(antes * 0.4);
});
