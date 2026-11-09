/**
 * Problema de dois corpos, resolvido analiticamente.
 *
 * Serve a duas coisas:
 *
 *   1. As luas. Elas ficam fora do integrador: a Lua da uma volta em 27,3 dias
 *      (55 passos de 0,5 dia por orbita) e Io em 1,77 dia (3,5 passos), regime em
 *      que Yoshida4 precessa. Baixar o passo global para Io pioraria o
 *      desempenho de tudo e mudaria a camada validada contra o JPL. As luas
 *      sao propagadas aqui, com elementos medios e taxas seculares, e a deriva
 *      e medida e publicada.
 *   2. O laboratorio de Fourier, que precisa da orbita kepleriana pura para
 *      comparar com a serie.
 *
 * As posicoes dos nove corpos dinamicos nao passam por aqui: saem da integracao
 * numerica, que e o que a efemeride valida.
 */
const DOIS_PI = 2 * Math.PI;

/**
 * Elementos keplerianos classicos, com as taxas seculares.
 *
 * Os angulos ficam em radianos aqui dentro. As tabelas do JPL vem em graus, e a
 * conversao acontece uma vez, na leitura do dado, para nao ter fator perdido no
 * meio de uma conta.
 */
export interface ElementosClassicos {
  /** Semieixo maior, UA. */
  aUa: number;
  e: number;
  /** Inclinacao sobre o plano de referencia, rad. */
  iRad: number;
  /** Longitude do no ascendente, rad. */
  nodoRad: number;
  /** Argumento do periastro, rad. */
  periastroRad: number;
  /** Anomalia media na epoca, rad. */
  anomaliaMediaRad: number;
  /** Movimento medio, rad/dia. Vem da tabela, e nao de sqrt(mu/a^3). */
  movimentoMedioRadDia: number;
  /** Precessao do no, rad/dia. Negativa quando o no regride. */
  taxaDoNodoRadDia: number;
  /** Precessao do periastro, rad/dia. */
  taxaDoPeriastroRadDia: number;
}

/**
 * Resolve E − e·sen(E) = M.
 *
 * O chute inicial `E = M` serve para os planetas (e < 0,21), mas acima de uns 0,8
 * oscila entre dois valores e nao converge, e um cometa do sandbox chega perto
 * de 1. O chute de Danby custa um seno a mais e converge em toda a faixa.
 *
 * Se Newton nao fechar, a bissecao fecha: e lenta, mas `E − e·sen(E) − M` e
 * monotona em E, entao nao falha. Um laco que sai por limite de iteracoes
 * devolveria lixo e poria uma lua no lugar errado sem aviso.
 *
 * M e reduzido a [0, 2π). O proprio E pode cair um ULP fora desse intervalo nos
 * extremos (em M = 0 sai −1e−17), o que nao afeta `sen(E)` e `cos(E)`, mas
 * importa ao comparar angulos.
 */
export function resolverKepler(anomaliaMedia: number, e: number, tolerancia = 1e-13): number {
  const M = normalizarAngulo(anomaliaMedia);
  if (e < 1e-12) return M;

  // Danby: o chute cai do lado certo do periastro, que e onde `E = M` erra.
  let E = M + 0.85 * e * Math.sign(Math.sin(M) === 0 ? 1 : Math.sin(M));

  for (let k = 0; k < 30; k++) {
    const f = E - e * Math.sin(E) - M;
    const df = 1 - e * Math.cos(E);
    // `df` vai a zero no periastro de uma orbita quase parabolica; sem a guarda o
    // passo explode e o NaN se propaga pela posicao, pela matriz e pela GPU.
    if (Math.abs(df) < 1e-14) break;
    const passo = f / df;
    E -= passo;
    if (Math.abs(passo) < tolerancia) return E;
  }

  // Bissecao: E fica sempre em [M − e, M + e], porque |E − M| = |e·sen(E)| <= e.
  let baixo = M - e;
  let alto = M + e;
  for (let k = 0; k < 200; k++) {
    const meio = 0.5 * (baixo + alto);
    if (meio - e * Math.sin(meio) - M > 0) alto = meio;
    else baixo = meio;
    if (alto - baixo < tolerancia) break;
  }
  return 0.5 * (baixo + alto);
}

/** Anomalia verdadeira a partir da excentrica. A forma com meio angulo nao perde quadrante. */
export function anomaliaVerdadeira(E: number, e: number): number {
  return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
}

export interface EstadoRelativo {
  /** Posicao em relacao ao corpo central, UA, no plano de referencia dos elementos. */
  pos: [number, number, number];
  /** Velocidade em relacao ao corpo central, UA/dia. */
  vel: [number, number, number];
}

/**
 * Elementos -> posicao e velocidade, em 3D.
 *
 * A rotacao completa e `Rz(nodo) · Rx(i) · Rz(periastro)` sobre a base perifocal:
 * o primeiro `Rz` leva o periastro ao no, `Rx` inclina o plano e o segundo `Rz`
 * leva o no a longitude certa. Trocar a ordem gira a orbita para um lugar
 * plausivel e errado.
 *
 * O plano de referencia sai como entrou: elementos no equador do planeta dao saida
 * no equador do planeta. Quem sabe qual plano cada tabela usa converte para a
 * ecliptica da cena, para este modulo nao precisar conhecer os corpos.
 */
export function estadoDeElementos(
  el: ElementosClassicos,
  mu: number,
  diasDesdeAEpoca: number,
): EstadoRelativo {
  const M = el.anomaliaMediaRad + el.movimentoMedioRadDia * diasDesdeAEpoca;
  const nodo = el.nodoRad + el.taxaDoNodoRadDia * diasDesdeAEpoca;
  const periastro = el.periastroRad + el.taxaDoPeriastroRadDia * diasDesdeAEpoca;

  const E = resolverKepler(M, el.e);
  const a = el.aUa;
  const e = el.e;
  const r = a * (1 - e * Math.cos(E));

  // Base perifocal: x para o periastro, y a 90 graus no sentido do movimento.
  const xP = a * (Math.cos(E) - e);
  const yP = a * Math.sqrt(1 - e * e) * Math.sin(E);

  // Velocidade perifocal. `sqrt(mu*a)/r` nao passa pela anomalia verdadeira e por
  // isso nao perde precisao perto do periastro.
  const fator = Math.sqrt(mu * a) / r;
  const vxP = -fator * Math.sin(E);
  const vyP = fator * Math.sqrt(1 - e * e) * Math.cos(E);

  const cO = Math.cos(nodo);
  const sO = Math.sin(nodo);
  const ci = Math.cos(el.iRad);
  const si = Math.sin(el.iRad);
  const cw = Math.cos(periastro);
  const sw = Math.sin(periastro);

  // Colunas da matriz Rz(nodo)·Rx(i)·Rz(periastro), abertas para evitar 27
  // multiplicacoes por corpo por quadro.
  const p0 = cO * cw - sO * sw * ci;
  const p1 = sO * cw + cO * sw * ci;
  const p2 = sw * si;
  const q0 = -cO * sw - sO * cw * ci;
  const q1 = -sO * sw + cO * cw * ci;
  const q2 = cw * si;

  return {
    pos: [p0 * xP + q0 * yP, p1 * xP + q1 * yP, p2 * xP + q2 * yP],
    vel: [p0 * vxP + q0 * vyP, p1 * vxP + q1 * vyP, p2 * vxP + q2 * vyP],
  };
}

/**
 * Uma volta inteira em `n` pontos igualmente espacados no tempo.
 *
 * O espacamento temporal faz a segunda lei de Kepler aparecer no desenho: os
 * pontos ficam espalhados perto do foco, onde o corpo corre, e juntos longe dele.
 * Amostrar em angulo daria os coeficientes de outra funcao, e o laboratorio de
 * Fourier precisa do tempo.
 */
export function amostrarNoTempo(el: ElementosClassicos, mu: number, n: number): Float64Array {
  const saida = new Float64Array(3 * n);
  const periodo = DOIS_PI / el.movimentoMedioRadDia;
  for (let k = 0; k < n; k++) {
    const { pos } = estadoDeElementos(el, mu, (k / n) * periodo);
    saida[3 * k] = pos[0];
    saida[3 * k + 1] = pos[1];
    saida[3 * k + 2] = pos[2];
  }
  return saida;
}

/** Para [0, 2π). O resto de JS pode ser negativo, e o chute de Danby depende do sinal. */
export function normalizarAngulo(a: number): number {
  const r = a % DOIS_PI;
  return r < 0 ? r + DOIS_PI : r;
}

export const grausParaRad = (g: number): number => (g * Math.PI) / 180;
