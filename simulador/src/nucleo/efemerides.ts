/**
 * Grandezas lidas do estado atual: distancia, velocidade e a elipse que o corpo
 * percorre neste instante.
 *
 * Elementos osculadores: a orbita de um planeta nao e uma elipse fixa, porque
 * os outros planetas a deformam devagar. Calcula-se a elipse que o corpo
 * seguiria se, a partir deste instante, so o Sol existisse: uma foto, nao uma
 * previsao.
 *
 * Os elementos heliocentricos exigem posicao e velocidade relativas ao Sol.
 * Misturar vetores baricentricos com a gravidade solar mistura dois
 * referenciais: o Sol se afasta cerca de 0,005 UA do baricentro, e para Venus
 * isso infla a excentricidade em 2,5 vezes.
 */
import { GRAUS_POR_RAD } from './unidades.ts';
import type { EstadoSistema } from './tipos.ts';
import { resolverKepler } from './kepler.ts';

export interface ElementosOsculadores {
  /** Falso quando a energia especifica e >= 0: o corpo nao esta preso ao Sol. */
  ligada: boolean;
  /** Semieixo maior, UA. Infinito quando nao ligada. */
  a: number;
  excentricidade: number;
  perielio: number;
  afelio: number;
  periodoDias: number;
  /** Inclinacao em relacao ao plano da ecliptica, em graus. */
  inclinacaoGraus: number;
}

const NAO_LIGADA: ElementosOsculadores = {
  ligada: false,
  a: Infinity,
  excentricidade: NaN,
  perielio: NaN,
  afelio: NaN,
  periodoDias: NaN,
  inclinacaoGraus: NaN,
};

/** Posicao e velocidade do corpo i vistas do Sol. A base de tudo neste modulo. */
function relativoAoSol(
  e: EstadoSistema,
  i: number,
  iSol: number,
): { r: [number, number, number]; v: [number, number, number] } {
  const a = 3 * i;
  const b = 3 * iSol;
  return {
    r: [e.pos[a]! - e.pos[b]!, e.pos[a + 1]! - e.pos[b + 1]!, e.pos[a + 2]! - e.pos[b + 2]!],
    v: [e.vel[a]! - e.vel[b]!, e.vel[a + 1]! - e.vel[b + 1]!, e.vel[a + 2]! - e.vel[b + 2]!],
  };
}

type V3 = [number, number, number];
type V3Leitura = readonly [number, number, number];
const cruz = (u: V3Leitura, w: V3Leitura): V3 => [
  u[1] * w[2] - u[2] * w[1],
  u[2] * w[0] - u[0] * w[2],
  u[0] * w[1] - u[1] * w[0],
];
const escalar = (u: V3Leitura, w: V3Leitura): number => u[0] * w[0] + u[1] * w[1] + u[2] * w[2];
const norma = (u: V3Leitura): number => Math.hypot(u[0], u[1], u[2]);

export function distanciaAoSolUa(e: EstadoSistema, i: number, iSol = 0): number {
  return norma(relativoAoSol(e, i, iSol).r);
}

/** Velocidade relativa ao Sol, em UA/dia. */
export function velocidadeOrbital(e: EstadoSistema, i: number, iSol = 0): number {
  return norma(relativoAoSol(e, i, iSol).v);
}

/** Angulo do corpo no plano da ecliptica, em radianos. Base da comparacao entre planetas. */
export function anguloHeliocentrico(e: EstadoSistema, i: number, iSol = 0): number {
  const { r } = relativoAoSol(e, i, iSol);
  return Math.atan2(r[1], r[0]);
}

/**
 * Pedir a orbita do proprio referencial e erro de programacao. Sem a guarda,
 * sairia `a = 0` e `ligada = true`; devolver NAO_LIGADA tambem enganaria, porque
 * significaria orbita aberta. Para o Sol existe `analiseSol.ts`.
 */
function exigirQueNaoSejaOReferencial(i: number, iSol: number): void {
  if (i === iSol) {
    throw new RangeError(
      'o corpo de referencia nao tem elementos heliocentricos — use analisarSol() para o Sol',
    );
  }
}

/**
 * Elipse instantanea do corpo i em torno do Sol.
 *
 * `mu = GM(Sol) + GM(corpo)`: o problema de dois corpos depende da massa total.
 * Para Jupiter a diferenca no semieixo e 0,1%, maior que a tolerancia do teste
 * contra os elementos medios.
 */
export function elementosOsculadores(e: EstadoSistema, i: number, iSol = 0): ElementosOsculadores {
  exigirQueNaoSejaOReferencial(i, iSol);
  const { r, v } = relativoAoSol(e, i, iSol);
  return elementosDeVetores(r, v, e.gm[iSol]! + e.gm[i]!);
}

/**
 * Os mesmos elementos, a partir de vetores soltos.
 *
 * O sandbox avalia um corpo antes de inseri-lo; recusar depois obrigaria a
 * inserir e desfazer, passando o estado por uma configuracao invalida.
 */
export function elementosDeVetores(
  rVec: readonly [number, number, number],
  vVec: readonly [number, number, number],
  mu: number,
): ElementosOsculadores {
  const r = norma(rVec);
  const v2 = escalar(vVec, vVec);
  if (!(r > 0) || !(mu > 0)) return { ...NAO_LIGADA };

  // Energia especifica: eps = v^2/2 - mu/r, e a = -mu/(2 eps)
  const energiaEsp = v2 / 2 - mu / r;
  if (energiaEsp >= 0) return { ...NAO_LIGADA };
  const a = -mu / (2 * energiaEsp);

  const hVec = cruz(rVec, vVec); // momento angular especifico
  const h = norma(hVec);

  // Vetor de Laplace-Runge-Lenz: aponta para o perielio, e seu modulo e `e`.
  const vxh = cruz(vVec, hVec);
  const eVec: V3 = [vxh[0] / mu - rVec[0] / r, vxh[1] / mu - rVec[1] / r, vxh[2] / mu - rVec[2] / r];
  const exc = norma(eVec);

  const inclinacaoGraus = h > 0 ? Math.acos(Math.min(1, Math.max(-1, hVec[2] / h))) * GRAUS_POR_RAD : 0;

  return {
    ligada: true,
    a,
    excentricidade: exc,
    perielio: a * (1 - exc),
    afelio: a * (1 + exc),
    periodoDias: 2 * Math.PI * Math.sqrt((a * a * a) / mu),
    inclinacaoGraus,
  };
}

/**
 * Pontos (n,3) da elipse instantanea, em UA, no referencial da cena.
 *
 * Desenhada em torno da posicao atual do Sol, para acompanha-lo. Devolve um
 * Float64Array achatado (3 numeros por ponto), vazio quando a orbita nao esta
 * ligada.
 *
 * Na base perifocal, `p` aponta para o perielio, `w` e a normal do plano e `q`
 * fecha a base; a elipse ja sai no plano orbital real, sem rotacao depois.
 */
export function elipseOsculadora(
  e: EstadoSistema,
  i: number,
  nPontos = 360,
  iSol = 0,
): Float64Array {
  exigirQueNaoSejaOReferencial(i, iSol);
  const { r: rVec, v: vVec } = relativoAoSol(e, i, iSol);
  const mu = e.gm[iSol]! + e.gm[i]!;
  const r = norma(rVec);
  const energiaEsp = escalar(vVec, vVec) / 2 - mu / r;
  if (energiaEsp >= 0) return new Float64Array(0);

  const a = -mu / (2 * energiaEsp);
  const hVec = cruz(rVec, vVec);
  const vxh = cruz(vVec, hVec);
  const eVec: V3 = [vxh[0] / mu - rVec[0] / r, vxh[1] / mu - rVec[1] / r, vxh[2] / mu - rVec[2] / r];
  const exc = norma(eVec);

  // Orbita quase circular nao tem perielio definido: qualquer base do plano
  // serve, e a posicao atual e uma escolha tao boa quanto outra.
  const pHat: V3 =
    exc > 1e-12
      ? [eVec[0] / exc, eVec[1] / exc, eVec[2] / exc]
      : [rVec[0] / r, rVec[1] / r, rVec[2] / r];
  const h = norma(hVec);
  const wHat: V3 = [hVec[0] / h, hVec[1] / h, hVec[2] / h];
  const qHat = cruz(wHat, pHat);

  const b = a * Math.sqrt(Math.max(0, 1 - exc * exc));
  const sx = e.pos[3 * iSol]!;
  const sy = e.pos[3 * iSol + 1]!;
  const sz = e.pos[3 * iSol + 2]!;

  const saida = new Float64Array(3 * nPontos);
  for (let k = 0; k < nPontos; k++) {
    // Anomalia excentrica espalha os pontos pela geometria da elipse, que e o que
    // um caminho desenhado quer. Espacamento por tempo e coisa do laboratorio.
    const anomalia = (2 * Math.PI * k) / (nPontos - 1);
    const x = a * (Math.cos(anomalia) - exc);
    const y = b * Math.sin(anomalia);
    saida[3 * k] = sx + x * pHat[0] + y * qHat[0];
    saida[3 * k + 1] = sy + x * pHat[1] + y * qHat[1];
    saida[3 * k + 2] = sz + x * pHat[2] + y * qHat[2];
  }
  return saida;
}

/**
 * A elipse que um corpo seguiria se fosse largado aqui, com esta velocidade.
 *
 * Fechada, nao integrada: integrar custaria um worker e uma segunda fisica que
 * poderia discordar da primeira, para chegar no primeiro instante a esta mesma
 * elipse osculadora de dois corpos.
 *
 * Devolve vazio quando a orbita nao e fechada; a ausencia da linha diz que o
 * corpo vai embora.
 */
export function previsaoDeOrbita(
  posUa: readonly [number, number, number],
  velUaDia: readonly [number, number, number],
  solUa: readonly [number, number, number],
  solVelUaDia: readonly [number, number, number],
  mu: number,
  nPontos = 240,
): Float64Array {
  const r: [number, number, number] = [posUa[0] - solUa[0], posUa[1] - solUa[1], posUa[2] - solUa[2]];
  const v: [number, number, number] = [
    velUaDia[0] - solVelUaDia[0],
    velUaDia[1] - solVelUaDia[1],
    velUaDia[2] - solVelUaDia[2],
  ];
  const el = elementosDeVetores(r, v, mu);
  if (!el.ligada) return new Float64Array(0);

  const rn = norma(r);
  const energiaEsp = escalar(v, v) / 2 - mu / rn;
  const a = -mu / (2 * energiaEsp);
  const hVec = cruz(r, v);
  const vxh = cruz(v, hVec);
  const eVec: V3 = [vxh[0] / mu - r[0] / rn, vxh[1] / mu - r[1] / rn, vxh[2] / mu - r[2] / rn];
  const exc = norma(eVec);
  const pHat: V3 = exc > 1e-12 ? [eVec[0] / exc, eVec[1] / exc, eVec[2] / exc] : [r[0] / rn, r[1] / rn, r[2] / rn];
  const h = norma(hVec);
  const wHat: V3 = [hVec[0] / h, hVec[1] / h, hVec[2] / h];
  const qHat = cruz(wHat, pHat);
  const b = a * Math.sqrt(Math.max(0, 1 - exc * exc));

  const saida = new Float64Array(3 * nPontos);
  for (let k = 0; k < nPontos; k++) {
    const anomalia = (2 * Math.PI * k) / (nPontos - 1);
    const x = a * (Math.cos(anomalia) - exc);
    const y = b * Math.sin(anomalia);
    saida[3 * k] = solUa[0] + x * pHat[0] + y * qHat[0];
    saida[3 * k + 1] = solUa[1] + x * pHat[1] + y * qHat[1];
    saida[3 * k + 2] = solUa[2] + x * pHat[2] + y * qHat[2];
  }
  return saida;
}

export interface CurvaDoLaboratorio {
  /** `2n` numeros: x, y em UA no plano orbital, com o periastro em +x. */
  pontos: Float64Array;
  aUa: number;
  excentricidade: number;
  periodoDias: number;
  inclinacaoGraus: number;
  /** Onde o corpo esta agora, como fracao da volta contada do periastro. */
  faseAtual: number;
}

/**
 * A orbita osculadora amostrada igualmente espacada no tempo, no proprio plano.
 *
 * Difere de `elipseOsculadora`, que espalha os pontos pela geometria: aqui eles
 * ficam juntos perto do apoastro e espalhados perto do periastro, onde o corpo
 * corre. Sao funcoes distintas, com coeficientes de Fourier distintos, e a
 * serie de epiciclos so descreve o movimento com parametrizacao pelo tempo,
 * porque o epiciclo gira a velocidade constante.
 *
 * Sai em 2D no plano orbital: a terceira dimensao so acrescentaria oclusao e
 * esconderia o desvio que se quer medir.
 */
export function curvaDoLaboratorio(
  e: EstadoSistema,
  i: number,
  nPontos = 720,
  iSol = 0,
): CurvaDoLaboratorio | null {
  const el = elementosOsculadores(e, i, iSol);
  if (!el.ligada) return null;

  const a = el.a;
  const exc = el.excentricidade;
  const b = a * Math.sqrt(Math.max(0, 1 - exc * exc));

  const pontos = new Float64Array(2 * nPontos);
  for (let k = 0; k < nPontos; k++) {
    const E = resolverKepler((2 * Math.PI * k) / nPontos, exc);
    pontos[2 * k] = a * (Math.cos(E) - exc);
    pontos[2 * k + 1] = b * Math.sin(E);
  }

  return {
    pontos,
    aUa: a,
    excentricidade: exc,
    periodoDias: el.periodoDias,
    inclinacaoGraus: el.inclinacaoGraus,
    faseAtual: faseNaOrbita(e, i, a, exc, iSol),
  };
}

/** Fracao da volta ja percorrida desde o periastro, em [0, 1). */
function faseNaOrbita(
  e: EstadoSistema,
  i: number,
  a: number,
  exc: number,
  iSol: number,
): number {
  const { r: rVec, v: vVec } = relativoAoSol(e, i, iSol);
  const r = norma(rVec);
  // `cos E = (1 − r/a)/e`, e o sinal vem de r·v: positivo depois do periastro.
  const cosE = exc > 1e-12 ? Math.min(1, Math.max(-1, (1 - r / a) / exc)) : 1;
  const E = escalar(rVec, vVec) >= 0 ? Math.acos(cosE) : 2 * Math.PI - Math.acos(cosE);
  const M = E - exc * Math.sin(E);
  const f = M / (2 * Math.PI);
  return f - Math.floor(f);
}
