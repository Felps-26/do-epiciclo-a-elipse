/**
 * Abrir a pagina num estado conhecido.
 *
 * Existe por causa de um acoplamento real: as preferencias do programa moram
 * num ARQUIVO ao lado de `dist/`, e nao no navegador. Isso e deliberado — o
 * `localStorage` e particionado por origem, e a origem inclui a porta —, mas
 * tem a consequencia de que o estado sobrevive entre testes e entre execucoes.
 *
 * Sem esta funcao, o resultado de um teste passaria a depender do arquivo que
 * o teste ANTERIOR deixou no disco, e a primeira vitima seria a orientacao de
 * primeira abertura: ela aparece quando `tutorialVisto` e falso, e esconderia
 * a tela principal de metade da suite dependendo da ordem de execucao.
 *
 * Quem QUER testar a primeira abertura pede `{ tutorialVisto: false }`, e a
 * intencao fica escrita na chamada.
 */
import type { Page } from '@playwright/test';

export const PREFERENCIAS_PADRAO = {
  versao: 1,
  tutorialVisto: true,
} as const;

export async function abrir(
  pagina: Page,
  preferencias: Record<string, unknown> = {},
  caminho = '/',
): Promise<void> {
  // Descarregar a pagina ANTES de gravar.
  //
  // `gravarPreferencias` grava com 400 ms de atraso, para que alternar tres
  // opcoes seguidas nao vire tres requisicoes. Sem descarregar primeiro, um
  // temporizador armado pela pagina anterior dispara DEPOIS deste PUT e grava
  // por cima dele — e o teste seguinte abre com a preferencia do teste
  // anterior. Foi assim que o teste da orientacao de primeira abertura passou
  // sozinho e falhou na suite. Navegar mata os temporizadores da pagina velha.
  await pagina.goto('about:blank');
  await pagina.request.put('/preferencias.json', {
    headers: { 'content-type': 'application/json' },
    data: { ...PREFERENCIAS_PADRAO, ...preferencias },
  });
  await pagina.goto(caminho);
}

/**
 * Espera a cena parar de mudar: transicao de camera, texturas chegando e exposicao
 * andando. Com renderizacao por software um tempo fixo nao basta; `__assentou`
 * responde pelo estado, e nao pelo relogio.
 */
export async function assentar(pagina: Page, folgaMs = 300): Promise<void> {
  await pagina.waitForTimeout(150);
  await pagina.waitForFunction(() => window.__assentou?.() === true, undefined, { timeout: 90_000 });
  await pagina.waitForTimeout(folgaMs);
}


/** Espera dois quadros desenhados: entre eles o laço do programa rodou ao menos uma vez. */
export async function doisQuadros(pagina: Page): Promise<void> {
  await pagina.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

/**
 * Clica na cena perto do deslocamento pedido a partir do centro, num ponto em que o
 * proprio canvas recebe o clique. Uma placa de rotulo por cima dele engole o clique, e
 * onde as placas caem depende da fonte do sistema: no Linux elas ficam noutro lugar.
 */
export async function clicarNaCena(pagina: Page, dx = 0, dy = 0): Promise<void> {
  const ponto = await pagina.evaluate(
    ([ox, oy]) => {
      const r = document.querySelector('canvas')!.getBoundingClientRect();
      const cx = r.left + r.width / 2 + ox!;
      const cy = r.top + r.height / 2 + oy!;
      for (let raio = 0; raio <= 48; raio += 6) {
        const passos = raio === 0 ? 1 : 16;
        for (let k = 0; k < passos; k++) {
          const a = (2 * Math.PI * k) / passos;
          const x = cx + raio * Math.cos(a);
          const y = cy + raio * Math.sin(a);
          if (document.elementFromPoint(x, y)?.tagName === 'CANVAS') return { x, y };
        }
      }
      return null;
    },
    [dx, dy],
  );
  if (!ponto) throw new Error(`nenhum ponto livre do canvas perto de (${dx}, ${dy})`);
  await pagina.mouse.click(ponto.x, ponto.y);
  await pagina.waitForTimeout(120);
}
