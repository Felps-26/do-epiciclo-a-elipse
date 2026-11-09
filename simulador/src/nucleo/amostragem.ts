/**
 * Interpolacao entre dois passos integrados, para o desenho ficar liso.
 *
 * A fisica anda em passos fixos de meio dia; a tela desenha a 60 ou 120 Hz.
 * Sem interpolacao, num zoom proximo os planetas andam aos trancos.
 *
 * Usa Hermite cubico com um passo de antecedencia, e nao Taylor de 2a ordem:
 * a extrapolacao de Taylor erra 213 km em Mercurio (4,4% do disco) e nao
 * encontra o proximo estado integrado, o que da um salto a cada passo. O
 * Hermite usa posicao e velocidade nas duas pontas e e continuo na fronteira.
 *
 * O desenho mostra um ponto entre o estado atual e o proximo, entao a data
 * escrita na tela e `tDias + alfa*dt`, o instante exato do que se ve.
 */
import type { EstadoSistema } from './tipos.ts';

/**
 * Escreve em `saida` a posicao interpolada entre `a` (alfa=0) e `b` (alfa=1).
 *
 * `dtDias` e o intervalo entre os dois estados — pode ser negativo, e o sinal
 * importa, porque a velocidade entra multiplicada por ele.
 */
export function interpolarHermite(
  a: EstadoSistema,
  b: EstadoSistema,
  dtDias: number,
  alfa: number,
  saida: Float64Array,
): void {
  const t = alfa < 0 ? 0 : alfa > 1 ? 1 : alfa;

  // Base de Hermite. h00 + h01 = 1, entao alfa = 0 devolve `a` e alfa = 1
  // devolve `b` sem erro: pausado, o que se ve e o estado integrado.
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  const m = 3 * Math.min(a.n, b.n);
  for (let k = 0; k < m; k++) {
    saida[k] = h00 * a.pos[k]! + h10 * dtDias * a.vel[k]! + h01 * b.pos[k]! + h11 * dtDias * b.vel[k]!;
  }
}

/** O instante que o quadro interpolado representa, em dias desde a epoca. */
export function instanteInterpolado(a: EstadoSistema, dtDias: number, alfa: number): number {
  return a.tDias + alfa * dtDias;
}
