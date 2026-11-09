/**
 * Mede a velocidade desta maquina para definir um teto honesto.
 *
 * Nenhum teto fixo serve para todo computador. O programa integra por uma
 * fracao de segundo e usa o resultado para decidir quanto tempo simulado
 * consegue entregar por segundo sem engasgar.
 *
 * 1. Aquece antes de cronometrar: os primeiros passos medem o compilador de
 *    JavaScript, e um computador rapido pareceria lento.
 * 2. Mede por trabalho fixo (N passos), nao por tempo fixo, porque o laco por
 *    tempo varia com as interrupcoes do sistema operacional.
 * 3. Nao presume 60 Hz: numa tela de 120 Hz o orcamento por quadro cai pela
 *    metade, entao a taxa medida entra como parametro.
 *
 * O cronometro e injetado, como no simulador: o nucleo nao le o relogio.
 */
import { aceleracao } from './forcas.ts';
import { PASSO_PADRAO_DIAS, type Integrador } from './integrador.ts';
import { copiarEstado } from './estado.ts';
import { criarRascunho, type EstadoSistema } from './tipos.ts';
import type { Cronometro } from './simulador.ts';

/** Fracao do quadro que a fisica pode ocupar. O resto e para desenhar. */
export const FRACAO_CPU = 0.25;

const PASSOS_DE_AQUECIMENTO = 2000;
const PASSOS_MEDIDOS = 4000;

export interface Medicao {
  passosPorSegundo: number;
  msPorPasso: number;
  passosMedidos: number;
}

/**
 * Roda o integrador num estado descartavel e mede passos por segundo.
 * Nao toca no estado recebido.
 */
export function medirPassosPorSegundo(
  estado: EstadoSistema,
  integrador: Integrador,
  cronometro: Cronometro,
  passosMedidos = PASSOS_MEDIDOS,
): Medicao {
  const copia = copiarEstado(estado);
  const rascunho = criarRascunho(copia.capacidade);
  const dt = PASSO_PADRAO_DIAS;

  // Aquecimento descartado; tambem leva o kernel de forcas para o cache.
  aceleracao(copia, rascunho);
  for (let k = 0; k < PASSOS_DE_AQUECIMENTO; k++) integrador.passo(copia, dt, rascunho);

  const t0 = cronometro();
  for (let k = 0; k < passosMedidos; k++) integrador.passo(copia, dt, rascunho);
  const decorrido = cronometro() - t0;

  // Cronometro de resolucao grosseira pode devolver zero; um piso e melhor
  // que declarar passos por segundo infinitos.
  const ms = decorrido > 0 ? decorrido : Number.EPSILON;
  return {
    passosPorSegundo: (passosMedidos / ms) * 1000,
    msPorPasso: ms / passosMedidos,
    passosMedidos,
  };
}

/** Quantos passos cabem num quadro usando so a fracao reservada de CPU. */
export function passosMaxPorQuadro(passosPorSegundo: number, quadrosPorSegundo = 60): number {
  return Math.max(1, Math.trunc((passosPorSegundo * FRACAO_CPU) / quadrosPorSegundo));
}

/** Maior velocidade que esta maquina sustenta de verdade, em dias por segundo. */
export function tetoDiasPorSegundo(
  passosPorSegundo: number,
  dtDias = PASSO_PADRAO_DIAS,
  quadrosPorSegundo = 60,
): number {
  return passosMaxPorQuadro(passosPorSegundo, quadrosPorSegundo) * dtDias * quadrosPorSegundo;
}
