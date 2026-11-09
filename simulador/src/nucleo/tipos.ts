/**
 * Estado físico do sistema: quem está onde, com que velocidade, em que instante.
 *
 * - Sempre 3D. Mesmo quando a tela mostra o plano da eclíptica, o estado
 *   guarda (x,y,z); trocar o renderizador não mexe aqui.
 * - Um array por grandeza, não um objeto por corpo. `pos` é um Float64Array com
 *   3N números, o laço de forças percorre memória contígua e nada é alocado por
 *   passo.
 * - Capacidade separada de N. O sandbox insere e remove corpos, e realocar os
 *   buffers a cada inserção geraria lixo por quadro. Há folga reservada, e `n`
 *   diz quantos estão em uso.
 *
 * Sem protótipo nem método, para o objeto atravessar um `postMessage` se a
 * simulação mudar de thread.
 */
export interface EstadoSistema {
  /** (3 * capacidade) UA. O corpo i ocupa [3i, 3i+1, 3i+2]. */
  pos: Float64Array;
  /** (3 * capacidade) UA/dia */
  vel: Float64Array;
  /** (capacidade) UA^3/dia^2 */
  gm: Float64Array;
  /** Quantos corpos estão em uso. Sempre <= capacidade. */
  n: number;
  capacidade: number;
  /**
   * Dias TDB desde a época. `tDias === passos * dt` vale em binário exato porque
   * 0,5 e 0,125 são exatos em base 2, e é isso que deixa a data na tela
   * corresponder ao estado.
   */
  tDias: number;
}

/**
 * Buffers de trabalho do integrador, fora do estado para que um passo não aloque:
 * a milhares de passos por segundo, alocar poria o coletor de lixo no caminho
 * crítico do quadro.
 */
export interface Rascunho {
  acel: Float64Array;
  /** Usados só pelo `yoshida4Relativistico`: a aceleração newtoniana guardada e a velocidade no meio do kick. */
  acelNewton: Float64Array;
  velMeio: Float64Array;
  capacidade: number;
}

export function criarRascunho(capacidade: number): Rascunho {
  return {
    acel: new Float64Array(3 * capacidade),
    acelNewton: new Float64Array(3 * capacidade),
    velMeio: new Float64Array(3 * capacidade),
    capacidade,
  };
}

/** Garante que o rascunho comporta `capacidade` corpos, crescendo se preciso. */
export function ajustarRascunho(rascunho: Rascunho, capacidade: number): Rascunho {
  if (rascunho.capacidade >= capacidade) return rascunho;
  return criarRascunho(capacidade);
}
