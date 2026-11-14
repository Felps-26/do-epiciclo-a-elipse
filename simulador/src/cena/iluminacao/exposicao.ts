/**
 * Exposicao automatica.
 *
 * A luz que chega a um corpo cai com `1/d²`, e isso fica na fisica: Saturno, a 9,5
 * UA, recebe 1/90 do que a Terra recebe. Uma tela nao tem 90 vezes de faixa
 * dinamica sobrando, entao a cena inteira e multiplicada por um fator so, como a
 * exposicao de uma camera, e o fator aparece escrito.
 *
 * O teto cobre o sandbox inteiro (40 UA). Com 400, Netuno saia com 44% do brilho
 * que a propria formula pede, e a tela escrevia ×400 como se fosse tudo.
 */
export const EXPOSICAO_MAXIMA = 1600;
export const EXPOSICAO_MINIMA = 0.02;

/** O fator que deixa um corpo a `dSujeitoUa` do Sol com o brilho da Terra. */
export function exposicaoQuerida(dSujeitoUa: number): number {
  const querida = Math.max(dSujeitoUa, 0.3) ** 2;
  return Math.min(EXPOSICAO_MAXIMA, Math.max(EXPOSICAO_MINIMA, querida));
}

/**
 * Um quadro de aproximacao ao alvo. Mudar de uma vez pisca a tela; uma
 * exponencial pura nunca chega, e a imagem nunca para de mudar com a camera
 * parada. Dentro de 0,2% assume o alvo.
 */
export function suavizarExposicao(atual: number, alvo: number): number {
  return Math.abs(alvo - atual) < alvo * 0.002 ? alvo : atual + (alvo - atual) * 0.08;
}

/** Parada de verdade, e nao perto do alvo: perto, o proximo quadro ainda muda a imagem. */
export function exposicaoAssentou(atual: number, alvo: number): boolean {
  return atual === alvo;
}
