/**
 * Doze cenas canônicas, cada backend contra a própria imagem dourada.
 *
 * Pega a regressão que nenhum outro teste vê: a que não quebra número nenhum e deixa
 * a cena errada. Um `renderOrder` trocado põe o anel na frente do planeta, um sinal
 * invertido na orientação deita Urano para o outro lado, um `decay` religado ilumina
 * Netuno trinta vezes demais. Tudo isso passa por `precisao.spec.ts`,
 * `contraste.test.ts` e pelo núcleo, e aparece na tela.
 *
 * Cada backend é comparado com a própria dourada, nunca um com o outro. WGSL sobre
 * Metal e GLSL sobre ANGLE divergem em transcendentais e em ordem de redução, e
 * exigir o mesmo pixel dos dois seria exigir o que nenhum promete; um teste vermelho
 * por ruído acaba desligado. A comparação cruzada sai por SSIM, como relatório, e
 * nunca reprova.
 *
 * O plano pedia a comparação numa passada SDR pré-bloom, para apertar a tolerância.
 * Esse gancho não existe: a cena desenha em HDR num alvo só e a composição faz bloom
 * e tonemap por cima, sem saída intermediária. Medir depois do bloom inclui a parte
 * mais sensível ao driver, e a tolerância abaixo reflete isso: foi medida em
 * execuções repetidas do mesmo build. Abrir o gancho pré-bloom é como apertá-la.
 *
 * Gravar é explícito. Sem a dourada no disco o teste falha e diz como gerá-la
 * (`DOURADAS=gravar npx playwright test douradas`); um teste que cria a própria
 * referência quando não a acha aprova qualquer coisa na primeira execução depois de
 * uma regressão.
 */
import { expect, test, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { abrir } from './preparar.ts';

const PASTA = fileURLToPath(new URL('./douradas/', import.meta.url));
const GRAVAR = process.env['DOURADAS'] === 'gravar';
/**
 * `DOURADAS=medir` imprime a fração de cada cena em vez de só reprovar. É como se
 * achou cada teto da tabela abaixo e como se acha o de uma cena nova: rodar o arquivo
 * algumas vezes contra a mesma dourada e olhar o espalhamento. Fica no código porque
 * um procedimento que exige editar o teste para ser seguido ninguém segue.
 */
const MEDIR = process.env['DOURADAS'] === 'medir';

/**
 * Quanto um pixel precisa mudar para contar como mudado.
 *
 * Com 0,12, o ruído entre duas execuções do mesmo build chegava a 0,69% dos pixels, e
 * um Sol desenhado 18% maior mexia em 0,047%: a regressão era quinze vezes menor que
 * o ruído, e nenhum limite único pegava uma sem reprovar a outra.
 *
 * A causa é o antialiasing de linha fina: órbitas e estrelas cobrem meio pixel, que
 * arredonda para um lado ou outro conforme a ordem de redução do driver, e cada um
 * desses pixels muda pouco. Um disco que cresce muda pixels de preto para claro, que
 * é muito. Com 0,35 o ruído do webgpu na visão geral caiu a zero e a mesma regressão
 * do Sol continuou medindo 0,023%.
 */
const LIMIAR_POR_PIXEL = 0.35;

/**
 * Teto de cada cena, em porcentagem de pixels, medido cena a cena.
 *
 * Um teto único não serve: `saturno-e-os-aneis` tem 0,28% de ruído próprio (anel
 * fino em vista oblíqua, o caso mais hostil que o programa desenha) e `visao-geral`
 * no webgpu tem zero. Um número que coubesse nos dois seria o do pior, e a cena
 * limpa deixaria de fiscalizar.
 *
 * `ruidoMedido` é o pior de três execuções do mesmo build, escrito ao lado do teto
 * para se saber de onde ele veio. O teto é três vezes isso, com piso de 0,01% (setenta
 * pixels em setecentos mil, folga para um artefato isolado).
 *
 * `anel-rasante` é exceção por geometria: um anel de um a dois pixels de espessura
 * visto quase de perfil muda quase inteiro quando a câmera assenta meio pixel
 * diferente (427 pixels de uma vez, num quadro em que três medições davam zero). Não
 * é ruído de driver e repetir a captura não adianta. O teto dela é 0,5%, o que pega o
 * anel sumir, dobrar de espessura ou trocar de lado, e nada além disso.
 *
 * Com a captura ancorada em `tDias = 0`, vinte e três das vinte e quatro cenas dão
 * zero pixel de diferença em três execuções, e o teto caiu para o piso de 0,01%. Antes,
 * as douradas eram fotografadas em datas de simulação diferentes e os tetos mediam o
 * deslocamento dos corpos entre duas fotos. Seguem sem pegar regressão de sub-pixel,
 * que depende do gancho pré-bloom.
 *
 * Para re-medir depois de uma mudança legítima: grave as douradas, rode o arquivo
 * três vezes com `console.log` da fração e recalcule.
 */
const TETOS: Record<string, Record<string, { ruidoMedido: number; teto: number }>> = {
  // Regravadas depois que a esfera foi consertada: a geometria tinha os polos em ±Y e o
  // resto do programa trata +Z como polo, e as vinte e quatro imagens travavam esse
  // erro de noventa graus em vez de acusá-lo. Todas mudaram, inclusive `urano-deitado`,
  // que existe para pegar eixo errado. O ruído subiu um pouco em algumas cenas, porque
  // com o polo no lugar há mais detalhe de textura perto do limbo, onde o antialiasing
  // decide de um jeito ou de outro. Continua medido em três execuções, com teto no
  // triplo.
  webgpu: {
    'anel-rasante': { ruidoMedido: 0.0000, teto: 0.0100 },
    'jupiter-e-as-galileanas': { ruidoMedido: 0.0000, teto: 0.0100 },
    'maquete': { ruidoMedido: 0.0005, teto: 0.0100 },
    'marte-em-orbita-baixa': { ruidoMedido: 0.0000, teto: 0.0100 },
    'ortografica': { ruidoMedido: 0.0000, teto: 0.0100 },
    'plano-de-cima': { ruidoMedido: 0.0061, teto: 0.0183 },
    'saturno-e-os-aneis': { ruidoMedido: 0.0000, teto: 0.0100 },
    'sol-de-perto': { ruidoMedido: 0.0000, teto: 0.0100 },
    'tamanho-real': { ruidoMedido: 0.0000, teto: 0.0100 },
    'terra-e-a-lua': { ruidoMedido: 0.1007, teto: 0.3021 },
    'urano-deitado': { ruidoMedido: 0.0000, teto: 0.0100 },
    'visao-geral': { ruidoMedido: 0.0106, teto: 0.0318 },
  },
  webgl2: {
    'anel-rasante': { ruidoMedido: 0.0000, teto: 0.0100 },
    'jupiter-e-as-galileanas': { ruidoMedido: 0.0550, teto: 0.1650 },
    'maquete': { ruidoMedido: 0.0036, teto: 0.0108 },
    'marte-em-orbita-baixa': { ruidoMedido: 0.0175, teto: 0.0525 },
    'ortografica': { ruidoMedido: 0.0000, teto: 0.0100 },
    'plano-de-cima': { ruidoMedido: 0.0000, teto: 0.0100 },
    'saturno-e-os-aneis': { ruidoMedido: 0.0000, teto: 0.0100 },
    'sol-de-perto': { ruidoMedido: 0.0000, teto: 0.0100 },
    'tamanho-real': { ruidoMedido: 0.0001, teto: 0.0100 },
    'terra-e-a-lua': { ruidoMedido: 0.0861, teto: 0.2583 },
    'urano-deitado': { ruidoMedido: 0.0000, teto: 0.0100 },
    'visao-geral': { ruidoMedido: 0.0000, teto: 0.0100 },
  },
};

const tetoDe = (render: string, cena: string): number =>
  (TETOS[render]?.[cena]?.teto ?? 0.01) / 100;

/** O tamanho é fixo: uma dourada de outro tamanho não é comparável. */
const LARGURA = 1000;
const ALTURA = 700;

interface Cena {
  nome: string;
  /** O que a cena mostra, e por que ela está na lista. */
  porque: string;
  preparar: (p: Page) => Promise<void>;
}

/**
 * Põe a câmera junto de um corpo pelo caminho que o programa usa: escolher na lista,
 * acompanhar, e só então fixar raio e ângulos. Escrever o pivô à mão mediria outra
 * coisa, porque o pivô do acompanhamento é a posição desenhada do corpo (passa pela
 * origem flutuante e pela escala visual), e recalculá-la no teste faria a dourada
 * depender de uma segunda conta que pode divergir da primeira sem ninguém notar.
 */
async function junto(
  p: Page,
  nome: RegExp,
  raioUa: number,
  elevacao = 0.3,
  azimute = -1.2,
): Promise<void> {
  await p.getByRole('option', { name: nome }).click();
  await p.getByRole('button', { name: /^Acompanhar/ }).click();
  // A transição tem prazo fixo de 0,45 s. Esperar por ela e só então fixar os
  // ângulos: fixá-los antes seria escrever por cima de uma animação em curso.
  await p.waitForTimeout(900);
  await p.evaluate(
    ({ r, el, az }) => {
      window.__camera!.raio = r;
      window.__camera!.elevacao = el;
      window.__camera!.azimute = az;
    },
    { r: raioUa, el: elevacao, az: azimute },
  );
}

const alternar = async (p: Page, nome: RegExp): Promise<void> => {
  await p.locator('summary', { hasText: 'Mais opções' }).click();
  await p.getByRole('checkbox', { name: nome }).click();
  await p.locator('summary', { hasText: 'Mais opções' }).click();
};

const CENAS: Cena[] = [
  {
    nome: 'visao-geral',
    porque: 'o enquadramento de partida: oito órbitas, o Sol e o céu',
    preparar: async () => {},
  },
  {
    nome: 'plano-de-cima',
    porque: 'a eclíptica de frente — pega uma inclinação de câmera trocada de sinal',
    preparar: async (p) => {
      await p.getByRole('button', { name: /Alinhar ao plano/ }).click();
      await p.waitForTimeout(900);
    },
  },
  {
    nome: 'ortografica',
    porque: 'sem ponto de fuga: pega a projeção ortográfica montada com a altura errada',
    preparar: async (p) => {
      await p.getByRole('button', { name: /Vista de cima/ }).click();
    },
  },
  {
    nome: 'saturno-e-os-aneis',
    porque: 'as divisões do anel e a sombra do planeta sobre ele',
    preparar: async (p) => junto(p, /^Saturno/, 0.004, 0.35),
  },
  {
    nome: 'anel-rasante',
    porque: 'o anel quase de perfil: pega o antialiasing por derivada de tela',
    preparar: async (p) => junto(p, /^Saturno/, 0.004, 0.02),
  },
  {
    nome: 'terra-e-a-lua',
    porque: 'a Terra fora do baricentro, a Lua no lugar, e o terminador com penumbra',
    preparar: async (p) => junto(p, /^Terra/, 0.004, 0.2),
  },
  {
    nome: 'jupiter-e-as-galileanas',
    porque: 'quatro luas separadas do disco do pai, com a regra de separação mínima valendo',
    preparar: async (p) => junto(p, /^Júpiter/, 0.02, 0.1),
  },
  {
    nome: 'urano-deitado',
    porque: 'a obliquidade de 98°: pega o Rx(−eps) esquecido na matriz de orientação',
    preparar: async (p) => junto(p, /^Urano/, 0.003, 0.15),
  },
  {
    nome: 'marte-em-orbita-baixa',
    porque: 'a aproximação máxima que o programa promete, com a superfície texturizada',
    preparar: async (p) => junto(p, /^Marte/, 0.00005, 0.05),
  },
  {
    nome: 'sol-de-perto',
    porque: 'o fundo mais claro que o programa produz — o bloom no limite',
    preparar: async (p) => junto(p, /^Sol/, 0.06, 0.3),
  },
  {
    nome: 'maquete',
    porque: 'as distâncias comprimidas, com a luz ainda medindo as reais',
    preparar: async (p) => alternar(p, /Modo maquete/),
  },
  {
    nome: 'tamanho-real',
    porque: 'sem exagero de raio os planetas somem — e é essa a lição',
    preparar: async (p) => alternar(p, /Corpos no tamanho real/),
  },
];

/** Deixa a cena pronta e parada, e devolve o PNG do canvas. */
async function retratar(p: Page, cena: Cena, render: string): Promise<PNG> {
  await p.setViewportSize({ width: LARGURA + 340, height: ALTURA + 120 });
  await abrir(p, {}, render === 'webgl2' ? '/?render=webgl2' : '/');
  await expect(p.getByRole('banner')).toBeVisible();
  await p.waitForFunction(() => window.__camera !== undefined);
  // Pausar ANTES de mexer na câmera: com o tempo correndo, o instante do
  // retrato depende de quando a máquina terminou de carregar as texturas.
  await p.getByRole('button', { name: 'Pausar' }).click();
  await p.waitForTimeout(300);

  // Voltar ao início é o que torna a dourada uma dourada.
  //
  // Pausar sozinho não fixa data: entre o programa subir e o Playwright clicar o botão
  // passam segundos, e a 30 dias por segundo são dezenas de dias de simulação, um
  // número diferente a cada execução. Os planetas quase não se mexem nisso, e por isso
  // o defeito passou na visão geral. A Lua dá uma volta em 27 dias, e meio dia a move
  // duzentos pixels na cena de perto: a imagem da diferença mostrava dois marcadores da
  // Lua em lugares distintos. As trilhas também cresciam com o tempo e eram a faixa
  // horizontal do diff.
  //
  // Voltar ao início restaura `tDias = 0` exato e limpa as trilhas. O passo da física é
  // discreto (meio dia), e por isso as medidas se repetiam em valores exatos como
  // 0,1304% quatro vezes: não era ruído, era a cena parada num número inteiro de passos
  // diferente.
  await p.keyboard.press('r');
  await p.waitForTimeout(700);

  await cena.preparar(p);
  // `assentou` é o que torna a dourada reproduzível: ele diz que nenhuma
  // textura está baixando e que a exposição automática parou de andar. Sem
  // isso, o retrato pega o meio de uma transição e nunca bate duas vezes.
  await p.waitForFunction(() => window.__assentou?.() === true, undefined, { timeout: 20_000 });
  // Mais 1,2 s depois de `assentou`, e não 0,4. `assentou` aceita a exposição a 0,3% do
  // alvo, folga generosa para "a imagem parou de mudar sozinha" e apertada demais para
  // uma dourada: num planeta que enche a tela, 0,3% de exposição move centenas de
  // pixels através do limiar, e a cena volta diferente sem o código ter mudado. Isso
  // fazia duas ou três cenas falharem por execução. A suavização é exponencial, então
  // 1,2 s a mais leva o erro restante muito abaixo de um bit de cor. É espera e não
  // folga no limite, e por isso não esconde regressão.
  await p.waitForTimeout(1200);
  const bruto = await p.locator('canvas').screenshot();
  return PNG.sync.read(bruto);
}

function comparar(a: PNG, b: PNG): { diferentes: number; total: number; fracao: number; diff: PNG } {
  expect(a.width, 'a dourada tem outro tamanho: regrave').toBe(b.width);
  expect(a.height, 'a dourada tem outro tamanho: regrave').toBe(b.height);
  const saida = new PNG({ width: a.width, height: a.height });
  const diferentes = pixelmatch(a.data, b.data, saida.data, a.width, a.height, {
    threshold: LIMIAR_POR_PIXEL,
  });
  const total = a.width * a.height;
  return { diferentes, total, fracao: diferentes / total, diff: saida };
}

for (const render of ['webgpu', 'webgl2']) {
  test.describe(`douradas · ${render}`, () => {
    for (const cena of CENAS) {
      test(`${cena.nome} — ${cena.porque}`, async ({ page }) => {
        test.setTimeout(90_000);
        const atual = await retratar(page, cena, render);
        const caminho = `${PASTA}${render}/${cena.nome}.png`;

        if (GRAVAR) {
          mkdirSync(`${PASTA}${render}`, { recursive: true });
          writeFileSync(caminho, PNG.sync.write(atual));
          test.info().annotations.push({ type: 'dourada', description: `gravada: ${caminho}` });
          return;
        }

        expect(
          existsSync(caminho),
          `sem dourada para ${render}/${cena.nome}. Gere com: DOURADAS=gravar npx playwright test douradas`,
        ).toBe(true);

        const dourada = PNG.sync.read(readFileSync(caminho));
        let melhor = comparar(dourada, atual);
        let ultimo = atual;

        // Repete a captura em vez de afrouxar o limite. Com os limites apertados, duas cenas
        // falhavam uma vez a cada duas execuções da suíte inteira e passavam sozinhas, um
        // artefato de um quadro (provavelmente uma textura que terminou de subir depois de
        // `assentou` dizer que não havia pendência). Subir o teto até o artefato caber faria
        // dele o teto, e a cena deixaria de fiscalizar o que existe para fiscalizar. Uma
        // segunda captura, do zero, separa os casos: um artefato de um quadro não se repete,
        // e uma regressão de verdade reprova as duas vezes porque está no código e não no
        // instante.
        const TENTATIVAS = 3;
        for (let k = 1; !MEDIR && k < TENTATIVAS && melhor.fracao > tetoDe(render, cena.nome); k++) {
          ultimo = await retratar(page, cena, render);
          const outra = comparar(dourada, ultimo);
          if (outra.fracao < melhor.fracao) melhor = outra;
        }
        const { diferentes, total, fracao } = melhor;
        const atualParaAGuarda = ultimo;

        // A guarda contra a dourada vazia: se a cena saísse preta, ela bateria
        // com uma dourada também preta e o teste aprovaria uma tela em branco.
        const variacao = (png: PNG): number => {
          let min = 255;
          let max = 0;
          for (let i = 0; i < png.data.length; i += 4 * 97) {
            const l = (png.data[i]! + png.data[i + 1]! + png.data[i + 2]!) / 3;
            if (l < min) min = l;
            if (l > max) max = l;
          }
          return max - min;
        };
        expect(variacao(atualParaAGuarda), `${cena.nome} saiu sem imagem`).toBeGreaterThan(8);

        const teto = tetoDe(render, cena.nome);
        if (MEDIR) {
          console.log(`MEDIDA ${render}/${cena.nome} ${(100 * melhor.fracao).toFixed(4)}`);
          // Em modo medir, grava a diferenca sempre que houver QUALQUER pixel
          // trocado — e nao so quando reprova. Uma medicao que so guarda a
          // imagem do caso que estoura o teto nao serve para entender por que o
          // teto e aquele.
          if (melhor.diferentes > 0) {
            writeFileSync(`${PASTA}${render}/_diff-${cena.nome}.png`, PNG.sync.write(melhor.diff));
          }
        }

        // A imagem da diferenca, gravada quando reprova.
        //
        // Sem ela, uma dourada vermelha dá um número e mais nada — e um número
        // não diz se mudaram mil pixels espalhados (ruído) ou mil pixels num
        // retângulo de sessenta por dezesseis (um rótulo que trocou de lado).
        // Foram duas hipóteses erradas sobre uma falha destas antes de alguém
        // pensar em olhar onde os pixels estavam.
        if (melhor.fracao > teto) {
          const ondeVai = `${PASTA}${render}/_diff-${cena.nome}.png`;
          writeFileSync(ondeVai, PNG.sync.write(melhor.diff));
          test.info().annotations.push({ type: 'diferença', description: ondeVai });
        }

        expect(
          fracao,
          `${render}/${cena.nome}: ${diferentes} de ${total} pixels (${(100 * fracao).toFixed(4)}%), ` +
            `teto ${(100 * teto).toFixed(4)}% — melhor de ${TENTATIVAS} capturas`,
        ).toBeLessThanOrEqual(teto);
      });
    }
  });
}
