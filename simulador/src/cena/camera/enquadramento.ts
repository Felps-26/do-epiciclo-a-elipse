/**
 * Os enquadramentos nomeados. Cada um e uma distancia e um alvo, com o motivo escrito.
 *
 * Os valores dos tres primeiros vem da versao anterior, onde foram escolhidos
 * olhando a tela: 31,5 UA poe Netuno na borda; 1,75 UA da para ver os quatro
 * internos sem perder Marte; acompanhar usa o afelio do corpo vezes 1,25 para
 * a orbita inteira caber com folga.
 */
import type { Modo } from '../../contratos/ids.ts';
import { comprimirRaio } from '../escala/escalaVisual.ts';

export interface Alvo {
  pivo: [number, number, number];
  raio: number;
}

export const RAIO_SISTEMA_UA = 31.5;
export const RAIO_INTERNOS_UA = 1.75;

export interface DadosDoAlvo {
  posicao: [number, number, number];
  /** Afelio em UA, quando o corpo tem orbita fechada. */
  afelioUa: number | null;
  raioKm: number;
}

const UA_KM = 149597870.7;

/**
 * `maquete` comprime SO os enquadramentos que medem o sistema inteiro.
 *
 * 'sistema' e 'internos' sao distancias heliocentricas, e com a compressao
 * ligada o sistema desenhado cabe em 5,5 UA: manter 31,5 poria os oito
 * planetas num aglomerado de meia dezena de pixels.
 *
 * 'perto' e 'acompanhar' NAO passam por aqui, e a razao importa. 'perto' e
 * tres raios do proprio corpo — uma distancia LOCAL, de 1e-5 UA, que a raiz
 * quadrada inflaria trezentas vezes e jogaria a camera para fora da orbita da
 * lua mais distante. 'acompanhar' usa o afelio, que ja chega comprimido de
 * quem mediu a orbita. Comprimir duas vezes e o erro obvio; comprimir uma
 * escala local e o erro que parece certo.
 */
export function enquadrar(
  modo: Modo,
  sol: [number, number, number],
  alvo: DadosDoAlvo | null,
  maquete = false,
): Alvo {
  const daCena = (r: number): number => (maquete ? comprimirRaio(r) : r);
  switch (modo) {
    case 'sistema':
      return { pivo: [...sol], raio: daCena(RAIO_SISTEMA_UA) };

    case 'internos':
      return { pivo: [...sol], raio: daCena(RAIO_INTERNOS_UA) };

    case 'acompanhar':
      if (!alvo) return { pivo: [...sol], raio: daCena(RAIO_SISTEMA_UA) };
      // O Sol nao tem afelio; para ele o enquadramento e um raio fixo que
      // mostra a regiao onde ele bamboleia em volta do baricentro.
      return { pivo: [...alvo.posicao], raio: alvo.afelioUa !== null ? alvo.afelioUa * 1.25 : 1 };

    case 'perto':
      if (!alvo) return { pivo: [...sol], raio: daCena(RAIO_SISTEMA_UA) };
      // Orbita baixa: da para ver o horizonte curvar e o terminador cruzar.
      // 3 raios do corpo poe a esfera inteira na tela com folga.
      return { pivo: [...alvo.posicao], raio: (alvo.raioKm / UA_KM) * 3 };

    default: {
      const _exaustivo: never = modo;
      void _exaustivo;
      return { pivo: [...sol], raio: daCena(RAIO_SISTEMA_UA) };
    }
  }
}

/** Angulo Sol-corpo-camera ao chegar perto: o terminador fica a vista. */
export const FASE_DE_CHEGADA_GRAUS = 75;
/** Fase do "Lado iluminado": quase cheia, sem pôr a camera na reta do Sol. */
export const FASE_DO_LADO_ILUMINADO_GRAUS = 30;
export const ELEVACAO_DE_CHEGADA = 0.2;

/**
 * O azimute que poe a camera, na elevacao dada, a `faseGraus` do Sol vista do corpo.
 * Ha dois, um de cada lado da direcao do Sol; fica o mais perto do azimute atual,
 * para o voo girar o menos possivel. Chegar pelo lado do Sol mostrava o disco em fase
 * cheia, e o terminador, que a penumbra foi feita para mostrar, ficava fora de vista.
 */
export function azimuteParaFase(
  alvo: readonly [number, number, number],
  sol: readonly [number, number, number],
  azimuteAtual: number,
  elevacao: number,
  faseGraus: number,
): number {
  const dx = sol[0] - alvo[0];
  const dy = sol[1] - alvo[1];
  const dz = sol[2] - alvo[2];
  const azSol = Math.atan2(dy, dx);
  const elSol = Math.atan2(dz, Math.hypot(dx, dy));
  // cos(fase) = cos(el) cos(elSol) cos(delta) + sen(el) sen(elSol)
  const c =
    (Math.cos((faseGraus * Math.PI) / 180) - Math.sin(elevacao) * Math.sin(elSol)) /
    (Math.cos(elevacao) * Math.cos(elSol));
  const delta = Math.acos(Math.min(1, Math.max(-1, c)));
  const distancia = (a: number): number => Math.abs(Math.atan2(Math.sin(a - azimuteAtual), Math.cos(a - azimuteAtual)));
  const a1 = azSol + delta;
  const a2 = azSol - delta;
  return distancia(a1) <= distancia(a2) ? a1 : a2;
}
