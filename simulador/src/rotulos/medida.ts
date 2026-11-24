/**
 * Quanto espaco um texto ocupa, sem LER LAYOUT.
 *
 * A regra dura do caminho por quadro e que nada nele pode chamar
 * `getBoundingClientRect`, `offsetWidth` ou `getComputedStyle`: qualquer uma
 * forca layout sincrono, e o posicionador de rotulos decide abreviar DENTRO do
 * quadro. E o equivalente exato, no DOM, do `font.render()` por quadro que o
 * projeto em pygame ja mediu — 4,4 us contra 0,17 us com cache — e resolveu.
 *
 * A saida e `measureText` num canvas 2D fora da tela, com cache por
 * `(texto, tamanho, peso)`. O cache e invalidado quando as fontes terminam de
 * carregar e quando a escala de texto muda, que sao as duas unicas coisas que
 * mudam a largura de um mesmo texto.
 */
let contexto: CanvasRenderingContext2D | null = null;
const cache = new Map<string, number>();

const FAMILIA = "'Inter Variable', system-ui, -apple-system, 'Helvetica Neue', sans-serif";

function obterContexto(): CanvasRenderingContext2D | null {
  if (contexto) return contexto;
  const canvas = document.createElement('canvas');
  contexto = canvas.getContext('2d');
  return contexto;
}

export function larguraDoTexto(texto: string, tamanhoPx: number, peso = 500): number {
  const chave = `${tamanhoPx}|${peso}|${texto}`;
  const guardada = cache.get(chave);
  if (guardada !== undefined) return guardada;

  const ctx = obterContexto();
  if (!ctx) return texto.length * tamanhoPx * 0.55;
  ctx.font = `${peso} ${tamanhoPx}px ${FAMILIA}`;
  const l = ctx.measureText(texto).width;
  cache.set(chave, l);
  return l;
}

/**
 * A placa inteira, e nao so o texto dela.
 *
 * O posicionador recebia `larguraDoTexto(nome, 13) + 10`, e a placa que o CSS desenha
 * e outra: o texto a 0,82rem (13,9 px, porque a raiz e 17 px), o padding de 0,4rem dos
 * dois lados, a barra de cor e o vao depois dela, e o distintivo A/B quando ha. Em
 * "Planetas internos" a conta ficava 11 px curta, e com "Texto maior" ligado mais
 * ainda, porque a escala nao entrava. Era essa folga que deixava a placa encostada no
 * painel entrar por baixo dele.
 *
 * Os numeros abaixo copiam `estilos/rotulos.css` e `estilos/sandbox.css`. Quem mudar
 * um la muda aqui; `e2e/rotulos.spec.ts` compara a conta com a placa do DOM.
 */
const RAIZ_PX = 17; // tokens.css: font-size: calc(17px * var(--escala-texto))
const PLACA = {
  fonteRem: 0.82,
  alturaDaLinha: 1.25,
  paddingXRem: 0.4,
  paddingYRem: 0.12,
  vaoRem: 0.3,
  barraPx: 2,
};
const MARCA = { margemRem: 0.3, paddingXRem: 0.22, fonteRem: 0.72, alturaDaLinha: 1.5 };
const MARCA_DO_ACOMPANHADO_REM = 0.86;
/** Arredondamento de subpixel e diferenca de hinting entre a medida e o desenho. */
const FOLGA_PX = 2;

let escala: number | null = null;

/**
 * Le o `--escala-texto` do estilo INLINE da raiz, que e onde `App.tsx` o escreve. Isto
 * nao e `getComputedStyle`: le um atributo, nao forca layout.
 */
function escalaDoTexto(): number {
  if (escala !== null) return escala;
  const v = Number.parseFloat(document.documentElement.style.getPropertyValue('--escala-texto'));
  escala = Number.isFinite(v) && v > 0 ? v : 1;
  return escala;
}

export function larguraDaPlaca(texto: string, papel: 'a' | 'b' | 'acompanhado' | null): number {
  const rem = RAIZ_PX * escalaDoTexto();
  let l =
    larguraDoTexto(texto, PLACA.fonteRem * rem, 400) +
    2 * PLACA.paddingXRem * rem +
    PLACA.barraPx +
    PLACA.vaoRem * rem;
  if (papel === 'acompanhado') {
    l += PLACA.vaoRem * rem + MARCA.margemRem * rem + larguraDoTexto('◎', MARCA_DO_ACOMPANHADO_REM * rem, 400);
  } else if (papel) {
    l +=
      PLACA.vaoRem * rem +
      MARCA.margemRem * rem +
      2 * MARCA.paddingXRem * rem +
      larguraDoTexto(papel.toUpperCase(), MARCA.fonteRem * rem, 700);
  }
  return l + FOLGA_PX;
}

export function alturaDaPlaca(): number {
  const rem = RAIZ_PX * escalaDoTexto();
  const linha = Math.max(PLACA.alturaDaLinha * PLACA.fonteRem, MARCA.alturaDaLinha * MARCA.fonteRem) * rem;
  return linha + 2 * PLACA.paddingYRem * rem + FOLGA_PX;
}

export function limparCache(): void {
  cache.clear();
  escala = null;
}

/** Liga a invalidacao aos dois eventos que mudam a largura de um mesmo texto. */
export function observarMudancasDeFonte(): () => void {
  const aoCarregarFontes = (): void => limparCache();
  void document.fonts?.ready.then(aoCarregarFontes);

  const observador = new MutationObserver(limparCache);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  return () => observador.disconnect();
}
