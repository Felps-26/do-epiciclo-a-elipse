/**
 * O unico lugar onde as distancias desenhadas deixam de ser proporcionais as reais.
 *
 * Netuno esta 77 vezes mais longe do Sol que Mercurio, e numa tela com o sistema
 * inteiro em escala real os quatro internos ocupam a largura de um dedo. Por isso a
 * compressao existe, mas e opcional e desligada por padrao: comprimir distancia e
 * uma distorcao util, e precisa vir com etiqueta. Ligada, o visor escreve
 * "DISTANCIAS COMPRIMIDAS — o desenho nao esta em escala", a Ajuda declara a
 * simplificacao e a regua linear e substituida pelo aviso, em vez de ficar ao lado
 * dele, porque regua reta sobre escala nao linear da leituras erradas.
 *
 * Este modulo mexe so em coordenada de desenho. Nada volta para o estado fisico, e
 * `src/nucleo/` nem pode importar este arquivo (o dependency-cruiser verifica). Na
 * cena, a iluminacao e a exposicao continuam usando a distancia real; senao Netuno,
 * desenhado a 5,5 UA, receberia trinta vezes mais luz do que recebe.
 *
 * Portado de `src/projecao/escala_visual.py` sem mudar a matematica, trocando o raio
 * 2D pelo de tres dimensoes.
 */

/** A distancia que fica inalterada. Com 1 UA, a orbita da Terra nao se mexe. */
export const R_REFERENCIA_UA = 1;

/** Abaixo disto nao ha direcao radial definida, e o fator seria divisao por zero. */
const R_MINIMO = 1e-9;

/**
 * `r_desenhado = R·raiz(r_real / R)`. Raiz quadrada e nao logaritmo: o log manda o
 * centro para menos infinito e precisa de um piso arbitrario, e a raiz e monotona,
 * suave e vale zero em zero. Com R = 1 UA, Mercurio vai de 0,39 para 0,62 e Netuno de
 * 30,1 para 5,5, e a razao entre o mais longe e o mais perto cai de 77:1 para 8,8:1.
 */
export function comprimirRaio(rUa: number): number {
  return rUa <= 0 ? 0 : R_REFERENCIA_UA * Math.sqrt(rUa / R_REFERENCIA_UA);
}

/** O fator pelo qual multiplicar o vetor radial. 1 quando nao ha compressao. */
export function fatorEm(rUa: number): number {
  return rUa > R_MINIMO ? comprimirRaio(rUa) / rUa : 1;
}

/**
 * Comprime um ponto em torno de `origem`, preservando a direcao. O angulo nao muda,
 * entao a posicao angular dos planetas continua correta (Marte em oposicao aparece em
 * oposicao); muda so o quanto ele parece longe. A origem e a posicao medida do Sol e
 * nao a do referencial, que e o baricentro do Sistema Solar: comprimir em torno do
 * baricentro deslocaria o Sol do centro do desenho por um valor que cresce com a
 * compressao.
 */
export function comprimirPonto(
  p: readonly [number, number, number],
  origem: readonly [number, number, number],
): [number, number, number] {
  const dx = p[0] - origem[0];
  const dy = p[1] - origem[1];
  const dz = p[2] - origem[2];
  const f = fatorEm(Math.hypot(dx, dy, dz));
  return [origem[0] + dx * f, origem[1] + dy * f, origem[2] + dz * f];
}

/**
 * Comprime um buffer inteiro de posicoes em torno do corpo `iOrigem`. Escreve em
 * `saida`, que pode ser o mesmo buffer da entrada: a conta de cada corpo so depende
 * dele e da origem, lida antes do laco.
 */
export function comprimirBuffer(
  posUa: Float64Array,
  n: number,
  saida: Float64Array,
  iOrigem = 0,
): void {
  const ox = posUa[3 * iOrigem]!;
  const oy = posUa[3 * iOrigem + 1]!;
  const oz = posUa[3 * iOrigem + 2]!;
  for (let i = 0; i < n; i++) {
    const k = 3 * i;
    const dx = posUa[k]! - ox;
    const dy = posUa[k + 1]! - oy;
    const dz = posUa[k + 2]! - oz;
    const f = fatorEm(Math.hypot(dx, dy, dz));
    saida[k] = ox + dx * f;
    saida[k + 1] = oy + dy * f;
    saida[k + 2] = oz + dz * f;
  }
}

/** Comprime pontos ja RELATIVOS a origem, no lugar. Para as fitas e as trilhas. */
export function comprimirRelativos(buffer: Float32Array, n: number): void {
  for (let k = 0; k < n; k++) {
    const i = 3 * k;
    const f = fatorEm(Math.hypot(buffer[i]!, buffer[i + 1]!, buffer[i + 2]!));
    buffer[i] = buffer[i]! * f;
    buffer[i + 1] = buffer[i + 1]! * f;
    buffer[i + 2] = buffer[i + 2]! * f;
  }
}
