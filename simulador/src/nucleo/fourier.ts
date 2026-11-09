/**
 * A orbita decomposta em serie de Fourier, e a cadeia de epiciclos que ela e.
 *
 * Vem do TCC "Copernico estava certo? Uma analise de epiciclos e series de
 * Fourier" (UnB Planaltina, 2016): a serie de Fourier de uma orbita fechada e uma
 * cadeia de epiciclos. Cada termo e um circulo de raio |c_n| girando a n vezes a
 * frequencia da volta, e acrescentar um harmonico e acrescentar um epiciclo.
 *
 * A serie e complexa, de `z(t) = x(t) + i·y(t)` com n tambem negativo. Decompor
 * x e y separadamente em cossenos e senos reais reconstroi a curva, mas cada par
 * vira uma elipse alinhada aos eixos e nao um circulo. Na serie complexa, cada
 * termo `c_n·e^(i·2πnt)` e um ponteiro de comprimento fixo girando a velocidade
 * constante, como Ptolomeu desenhava.
 *
 * Amostragem: a curva entra igualmente espacada no tempo, e nao em angulo, porque
 * sao funcoes diferentes com coeficientes diferentes. So no tempo "girar a
 * velocidade constante" descreve o epiciclo, e a segunda lei de Kepler aparece no
 * espacamento dos pontos.
 *
 * Aliasing: com `A` amostras, so |n| < A/2 e recuperavel; acima disso um harmonico
 * alto aparece disfarcado de baixo, e o construtor recusa a combinacao. O que
 * protege de fato e o espectro da elipse morrer antes de A/2, mais devagar quanto
 * mais alongada a orbita. Com 720 amostras e 24 harmonicos, o erro de coeficiente
 * contra a solucao fechada e 3e-16 UA em e = 0,6, 1,4e-14 em e = 0,9 e 2,2e-8 em
 * e = 0,95. Para os oito planetas (e maximo 0,21, em Mercurio) a folga e grande;
 * para um cometa do sandbox com e acima de 0,9 nao, e o laboratorio escreve o
 * desvio medido, nao um limite prometido.
 */

/** Ate onde a serie e calculada. Alem disso a orbita ja esta no ruido do float64. */
export const TERMOS_MAX = 24;
export const TERMOS_INICIAL = 3;
/** Abaixo disto o residuo e ruido de arredondamento, e nao erro da serie. */
export const PISO_RESIDUO_UA = 1e-12;

const DOIS_PI = 2 * Math.PI;

/**
 * Coeficientes complexos, com `n` de −N a +N. Ficam em dois arrays de tamanho
 * `2N+1` indexados por `n + N`: um objeto por harmonico seriam 49 alocacoes
 * redesenhadas a cada quadro do laboratorio.
 */
export interface SerieFourier {
  termosMax: number;
  /** Parte real de c_n, em `re[n + termosMax]`. */
  re: Float64Array;
  im: Float64Array;
  /** Quantas amostras entraram. */
  amostras: number;
}

/** Projeta pontos 3D num plano dado por dois vetores ortonormais. */
export function projetarNoPlano(
  pontos: Float64Array,
  p: readonly [number, number, number],
  q: readonly [number, number, number],
): Float64Array {
  const n = pontos.length / 3;
  const saida = new Float64Array(2 * n);
  for (let k = 0; k < n; k++) {
    const x = pontos[3 * k]!;
    const y = pontos[3 * k + 1]!;
    const z = pontos[3 * k + 2]!;
    saida[2 * k] = x * p[0] + y * p[1] + z * p[2];
    saida[2 * k + 1] = x * q[0] + y * q[1] + z * q[2];
  }
  return saida;
}

/**
 * Calcula os coeficientes uma vez. Mostrar mais ou menos harmonicos depois e so
 * truncar a soma, sem recalcular.
 */
export function decompor(curva: Float64Array, termosMax = TERMOS_MAX): SerieFourier {
  const amostras = curva.length / 2;
  if (!Number.isInteger(amostras) || amostras < 4) {
    throw new RangeError('a curva precisa de pelo menos 4 pontos, com 2 numeros cada');
  }
  if (2 * termosMax >= amostras) {
    // Um coeficiente sobre a frequencia de Nyquist e um harmonico alto lido como
    // baixo, que apareceria no desenho como um epiciclo inexistente.
    throw new RangeError(
      `${amostras} amostras nao bastam para ${termosMax} harmonicos: seriam precisas mais de ${2 * termosMax}`,
    );
  }

  const largura = 2 * termosMax + 1;
  const re = new Float64Array(largura);
  const im = new Float64Array(largura);

  for (let n = -termosMax; n <= termosMax; n++) {
    let somaRe = 0;
    let somaIm = 0;
    for (let k = 0; k < amostras; k++) {
      const x = curva[2 * k]!;
      const y = curva[2 * k + 1]!;
      const fase = (-DOIS_PI * n * k) / amostras;
      const c = Math.cos(fase);
      const s = Math.sin(fase);
      // (x + iy)(c + is)
      somaRe += x * c - y * s;
      somaIm += x * s + y * c;
    }
    re[n + termosMax] = somaRe / amostras;
    im[n + termosMax] = somaIm / amostras;
  }

  return { termosMax, re, im, amostras };
}

/** Soma da serie truncada em |n| <= termos. */
export function reconstruir(s: SerieFourier, t: number, termos: number): [number, number] {
  const T = Math.min(Math.max(0, Math.trunc(termos)), s.termosMax);
  let x = 0;
  let y = 0;
  for (let n = -T; n <= T; n++) {
    const i = n + s.termosMax;
    const fase = DOIS_PI * n * t;
    const c = Math.cos(fase);
    const sn = Math.sin(fase);
    x += s.re[i]! * c - s.im[i]! * sn;
    y += s.re[i]! * sn + s.im[i]! * c;
  }
  return [x, y];
}

/** Um elo da cadeia: o circulo que aquele harmonico desenha. */
export interface Epiciclo {
  /** O harmonico. Nunca zero: o termo constante nao gira, e sai em `excentrico`. */
  n: number;
  /** Centro do circulo — a ponta do elo anterior. */
  centro: [number, number];
  raio: number;
  /** A ponta deste elo, que e o centro do proximo. */
  ponta: [number, number];
}

export interface Cadeia {
  /**
   * Deslocamento fixo de onde a cadeia parte.
   *
   * E o termo `n = 0`, que nao gira; desenha-lo como circulo mostraria um
   * movimento inexistente.
   *
   * O valor e a posicao media no tempo do corpo. Numa elipse kepleriana ela fica a
   * `1,5·a·e` do foco, do lado do apoastro, e nao a `a·e` do centro geometrico,
   * porque o corpo passa mais tempo longe. E o deslocamento que Ptolomeu aplicava
   * entre a Terra e o centro do deferente.
   */
  excentrico: [number, number];
  /** Os elos que giram, do maior para o menor. O primeiro e o deferente. */
  elos: Epiciclo[];
  /** A ponta do ultimo elo: a posicao reconstruida. */
  ponta: [number, number];
}

/**
 * Cadeia de epiciclos no instante `t`.
 *
 * Ordenada por raio decrescente, como na construcao historica: o deferente
 * primeiro, cada epiciclo montado na ponta do anterior. Numa orbita kepleriana o
 * maior elo e sempre `n = 1`; ate e = 0,9 ele vale 0,55 contra 0,19 do segundo.
 *
 * A ponta do ultimo elo e a posicao reconstruida, nao uma ilustracao ao lado dela:
 * `fourier.test.ts` exige que as duas coincidam dentro de 1e-14.
 */
export function cadeiaDeEpiciclos(s: SerieFourier, t: number, termos: number): Cadeia {
  const T = Math.min(Math.max(0, Math.trunc(termos)), s.termosMax);
  const elos: { n: number; raio: number }[] = [];
  for (let n = -T; n <= T; n++) {
    if (n === 0) continue;
    const i = n + s.termosMax;
    elos.push({ n, raio: Math.hypot(s.re[i]!, s.im[i]!) });
  }
  elos.sort((a, b) => b.raio - a.raio || a.n - b.n);

  const excentrico: [number, number] = [s.re[s.termosMax]!, s.im[s.termosMax]!];
  let cx = excentrico[0];
  let cy = excentrico[1];
  const cadeia: Epiciclo[] = [];
  for (const elo of elos) {
    const i = elo.n + s.termosMax;
    const fase = DOIS_PI * elo.n * t;
    const c = Math.cos(fase);
    const sn = Math.sin(fase);
    const px = cx + (s.re[i]! * c - s.im[i]! * sn);
    const py = cy + (s.re[i]! * sn + s.im[i]! * c);
    cadeia.push({ n: elo.n, centro: [cx, cy], raio: elo.raio, ponta: [px, py] });
    cx = px;
    cy = py;
  }
  return { excentrico, elos: cadeia, ponta: [cx, cy] };
}

export interface Desvio {
  medioUa: number;
  maximoUa: number;
}

/** Desvio ponto a ponto entre a serie truncada e a curva de onde ela saiu. */
export function desvio(s: SerieFourier, curva: Float64Array, termos: number): Desvio {
  const n = curva.length / 2;
  let soma = 0;
  let maximo = 0;
  for (let k = 0; k < n; k++) {
    const [x, y] = reconstruir(s, k / n, termos);
    const d = Math.hypot(curva[2 * k]! - x, curva[2 * k + 1]! - y);
    soma += d;
    maximo = Math.max(maximo, d);
  }
  return { medioUa: soma / n, maximoUa: maximo };
}

/** O desvio para cada quantidade de harmonicos, de 1 ate `termosMax`. */
export function convergencia(s: SerieFourier, curva: Float64Array): Desvio[] {
  const saida: Desvio[] = [];
  for (let t = 1; t <= s.termosMax; t++) saida.push(desvio(s, curva, t));
  return saida;
}

/** Quantos harmonicos bastam para o desvio sumir no ruido do float64. */
export function harmonicosAteOPiso(
  s: SerieFourier,
  curva: Float64Array,
  piso = PISO_RESIDUO_UA,
): number | null {
  const c = convergencia(s, curva);
  const i = c.findIndex((d) => d.medioUa <= piso);
  return i < 0 ? null : i + 1;
}
