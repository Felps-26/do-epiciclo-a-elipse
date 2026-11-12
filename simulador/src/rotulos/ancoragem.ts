/**
 * Os rotulos acompanham a camera por quadro, e o desvio deles e suavizado.
 *
 * `camada.tsx` dizia que "so `transform` muda por quadro" e `principal.ts` que "a
 * ancoragem acompanha o quadro", e nenhum dos dois era verdade: o unico caminho dos
 * rotulos ate o DOM era a publicacao do estado, a 8 Hz. Os nomes andavam aos saltos
 * de 125 ms com a cena a 60, um tremor que parecia do posicionador e era do relogio.
 *
 * Suaviza-se o desvio e nunca a posicao. A placa fica a um deslocamento do corpo ("a
 * direita e um pouco acima") e o corpo se move a cada quadro; suavizar a posicao
 * absoluta faria a placa perseguir o corpo com atraso, a licao mais cara do projeto
 * em escala menor (amortecimento exponencial nunca alcanca um alvo em movimento).
 * Suavizando so o desvio, a placa e rigida em relacao ao corpo, com erro de
 * acompanhamento zero, e o que desliza e a escolha de lado, a unica coisa que salta.
 *
 * Ha prazo fixo: depois de `PRAZO_S` a placa e posta no lugar de uma vez. Sem ele, uma
 * transicao lenta o bastante nunca chega e o nome fica entre dois lugares, o mesmo
 * remendo que a camera usa nas transicoes.
 */
import type { RotuloColocado } from './posicionador.ts';

/** Constante de tempo. Em 0,08 s a placa cobre 63% do caminho. */
export const TAU_S = 0.08;
/** Depois disto, vai de uma vez. */
export const PRAZO_S = 0.2;
/** Abaixo de meio pixel, considera-se que o alvo nao mudou. */
const FOLGA_PX = 0.5;

export interface Ancora {
  x: number;
  y: number;
  /** Raio do corpo na tela neste quadro. Sem ele, vale o da ultima colocacao. */
  raioPx?: number;
}

/**
 * O desvio guardado e o RESIDUO: o deslocamento da placa menos a parte que vem do
 * raio do disco. Durante um voo o raio cresce a cada quadro e a colocacao (30 Hz)
 * fica sempre atrasada; guardando o residuo, o alvo nao muda com o zoom, o prazo
 * fixo dispara, e a placa e reposta na borda do disco com o raio do proprio quadro.
 */
interface Desvio {
  dx: number;
  dy: number;
  alvoX: number;
  alvoY: number;
  /** Quando este alvo passou a valer, em segundos. */
  desde: number;
}

export interface PosicaoNoQuadro {
  x: number;
  y: number;
  centroX: number;
  centroY: number;
  raioPx: number;
  largura: number;
  altura: number;
}

/** Acima deste vao entre o disco e a placa, desenha-se uma linha ligando os dois. */
export const LIMIAR_DA_LIGACAO_PX = 12;

/**
 * A linha da borda do disco ate o ponto mais proximo da placa, ou `null` quando a
 * placa esta encostada no corpo. Sem ela, nomes desempilhados ficam numa coluna
 * ao lado do Sol e nao se sabe de quem e cada um.
 */
export function segmentoDeLigacao(
  cx: number,
  cy: number,
  raioPx: number,
  placa: { x: number; y: number; largura: number; altura: number },
): { x1: number; y1: number; x2: number; y2: number } | null {
  const x2 = Math.min(Math.max(cx, placa.x), placa.x + placa.largura);
  const y2 = Math.min(Math.max(cy, placa.y), placa.y + placa.altura);
  const d = Math.hypot(x2 - cx, y2 - cy);
  if (d - raioPx <= LIMIAR_DA_LIGACAO_PX) return null;
  return { x1: cx + ((x2 - cx) / d) * raioPx, y1: cy + ((y2 - cy) / d) * raioPx, x2, y2 };
}

export type MemoriaDoDesvio = Map<string, Desvio>;

export const criarMemoriaDoDesvio = (): MemoriaDoDesvio => new Map();

/**
 * Onde cada placa deve estar agora, em pixels CSS. Pura: recebe a colocacao do
 * ultimo calculo e onde os corpos estao neste quadro, e devolve a posicao suavizada.
 * Quem escreve no DOM e quem chama.
 */
export function posicoesSuavizadas(
  rotulos: readonly RotuloColocado[],
  ancoras: ReadonlyMap<string, Ancora>,
  memoria: MemoriaDoDesvio,
  dtS: number,
  agoraS: number,
): Map<string, PosicaoNoQuadro> {
  const saida = new Map<string, PosicaoNoQuadro>();
  const vivos = new Set<string>();

  // `dt` preso a um teto: voltar de uma aba escondida traz um `dt` de minutos,
  // e `1 − exp(−dt/tau)` daria 1 — o que ate acerta, mas por acidente. Com
  // teto, o comportamento e o mesmo em qualquer quadro longo.
  const k = 1 - Math.exp(-Math.min(dtS, 0.25) / TAU_S);

  for (const r of rotulos) {
    vivos.add(r.chave);
    const ancora = ancoras.get(r.chave);
    // Sem ancora neste quadro, a placa fica onde a colocacao a pos. Acontece
    // no quadro em que um corpo sai de vista e a colocacao ainda nao soube.
    const centroX = ancora?.x ?? r.centroX;
    const centroY = ancora?.y ?? r.centroY;
    const raioPx = ancora?.raioPx ?? r.raioPx;
    const [dirX, dirY] = r.direcao ?? [0, 0];
    const alvoX = r.x - r.centroX - dirX * r.raioPx;
    const alvoY = r.y - r.centroY - dirY * r.raioPx;

    let d = memoria.get(r.chave);
    if (!d) {
      // Placa nova entra JA no lugar. Deslizar a partir do zero faria todo nome
      // que aparece voar do centro do corpo ate a posicao dele.
      d = { dx: alvoX, dy: alvoY, alvoX, alvoY, desde: agoraS };
      memoria.set(r.chave, d);
    } else {
      if (Math.abs(alvoX - d.alvoX) > FOLGA_PX || Math.abs(alvoY - d.alvoY) > FOLGA_PX) {
        d.alvoX = alvoX;
        d.alvoY = alvoY;
        d.desde = agoraS;
      }
      if (agoraS - d.desde >= PRAZO_S) {
        d.dx = d.alvoX;
        d.dy = d.alvoY;
      } else {
        d.dx += (d.alvoX - d.dx) * k;
        d.dy += (d.alvoY - d.dy) * k;
      }
    }

    saida.set(r.chave, {
      x: centroX + d.dx + dirX * raioPx,
      y: centroY + d.dy + dirY * raioPx,
      centroX,
      centroY,
      raioPx,
      largura: r.largura,
      altura: r.altura,
    });
  }

  // Esquecer quem saiu. Sem isto o mapa cresce com cada corpo criado e apagado
  // no sandbox, e um corpo que volta com a mesma chave reapareceria com o
  // desvio de quando sumiu.
  for (const chave of memoria.keys()) if (!vivos.has(chave)) memoria.delete(chave);
  return saida;
}

/**
 * Escreve as posicoes nos nos da camada, so `transform`. Escrever `transform` toca so
 * a camada de composicao do navegador; mexer em `left`/`top` forcaria layout, e ler
 * qualquer coisa aqui (`getBoundingClientRect`, `offsetWidth`) forcaria layout
 * sincrono dentro do laco de quadro, que o lint do nucleo existe para impedir.
 */
/**
 * Os nos de uma camada, relidos so quando a camada muda. `escrever` roda a cada
 * quadro, e as duas consultas custavam duas varreduras do DOM a 60 Hz para um
 * conjunto que muda a 8 Hz, a taxa em que a arvore Preact e republicada.
 *
 * A invalidacao e um `MutationObserver` e nao a contagem de filhos. A contagem parece
 * bastar, porque as placas sao filhas diretas da camada, mas tem um buraco: um corpo
 * que troca de `forma` (de placa para ponto) faz o Preact substituir o elemento sem
 * mudar o numero deles. O cache ficaria com um no fora do documento, e a placa nova
 * voltaria a saltar a 8 Hz sem nada acusando. O observador custa zero enquanto nada
 * muda.
 */
interface NosDaCamada {
  sujo: boolean;
  rotulo: HTMLElement[];
  anel: HTMLElement[];
  linha: HTMLElement[];
}

const CACHE = new WeakMap<HTMLElement, NosDaCamada>();

function nosDe(raiz: HTMLElement, qual: 'rotulo' | 'anel' | 'linha'): HTMLElement[] {
  let c = CACHE.get(raiz);
  if (!c) {
    c = { sujo: true, rotulo: [], anel: [], linha: [] };
    const registro = c;
    new MutationObserver(() => {
      registro.sujo = true;
    }).observe(raiz, { childList: true });
    CACHE.set(raiz, c);
  }
  if (c.sujo) {
    c.sujo = false;
    c.rotulo = [...raiz.querySelectorAll<HTMLElement>('[data-rotulo]')];
    c.anel = [...raiz.querySelectorAll<HTMLElement>('[data-anel]')];
    c.linha = [...raiz.querySelectorAll<HTMLElement>('[data-linha]')];
  }
  return c[qual];
}

export function escrever(raiz: HTMLElement, posicoes: ReadonlyMap<string, PosicaoNoQuadro>): void {
  for (const no of nosDe(raiz, 'rotulo')) {
    const p = posicoes.get(no.dataset['rotulo'] ?? '');
    // Uma placa que a colocacao derrubou (teto, foco) sai NESTE quadro. Esperar a
    // proxima publicacao a deixava congelada no lugar por ate 125 ms.
    if (!p) {
      no.style.visibility = 'hidden';
      continue;
    }
    no.style.visibility = '';
    no.style.transform = `translate(${p.x}px, ${p.y}px)`;
  }
  for (const no of nosDe(raiz, 'anel')) {
    const p = posicoes.get(no.dataset['anel'] ?? '');
    if (!p) continue;
    // O anel e centrado no CORPO, e nao na placa: ele marca o corpo. Nao e
    // suavizado, e o tamanho vem do raio deste quadro: durante o voo o disco
    // cresce a 60 Hz, e o anel crescia aos saltos da publicacao.
    const raio = Math.max(p.raioPx + 8, 16);
    no.style.width = `${2 * raio}px`;
    no.style.height = `${2 * raio}px`;
    no.style.transform = `translate(${p.centroX - raio}px, ${p.centroY - raio}px)`;
  }
  for (const no of nosDe(raiz, 'linha')) {
    const p = posicoes.get(no.dataset['linha'] ?? '');
    const s = p ? segmentoDeLigacao(p.centroX, p.centroY, p.raioPx, p) : null;
    if (!s) {
      no.style.visibility = 'hidden';
      continue;
    }
    // Um elemento de 1x1 px, esticado e girado: so `transform`, sem layout.
    const comprimento = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    const angulo = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
    no.style.visibility = '';
    no.style.transform = `translate(${s.x1}px, ${s.y1}px) rotate(${angulo}rad) scaleX(${comprimento})`;
  }
}
