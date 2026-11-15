/**
 * Fotometria de um ponto iluminado: quanto ele recebe do Sol e quanto devolve para a câmera.
 *
 * Esta é a referência em números comuns; `modeloDeLuz.ts` monta o mesmo cálculo em
 * nós do shader, e `testes/cena/fotometria.test.ts` prende as propriedades das duas.
 *
 * Irradiância. A luz que chega a um elemento de superfície cai com o cosseno da
 * incidência (lei de Lambert). Perto do terminador o Sol não é um ponto: ele tem
 * meio ângulo `s` (0,27° visto da Terra), e a borda da noite é uma penumbra dessa
 * largura. A rampa (x + s)²/4s, com x = cos i, cola na reta x em `x = s` e no zero em
 * `x = −s` com valor e derivada contínuos.
 *
 * Brilho refletido. Duas leis, conforme a superfície:
 *   - Lambert, μ₀: o espalhador ideal, boa aproximação para nuvens e atmosferas;
 *   - Lommel–Seeliger, 2μ₀/(μ₀ + μ): espalhamento simples num meio sem atmosfera,
 *     o regolito da Lua e de Mercúrio. Com fase zero ela vale 1 em todo o disco, e por
 *     isso a Lua cheia não escurece na borda (Fairbairn, JRASC 99, 92, 2005).
 * As duas valem 1 no ponto subsolar visto de frente, e a calibração da exposição
 * automática não muda com a troca de lei.
 */

export type LeiFotometrica = 'lambert' | 'lommelSeeliger';

/** Quem tem atmosfera espalha como nuvem; regolito exposto, como a Lua. */
export function leiDoCorpo(visual: { atmosfera?: unknown }): LeiFotometrica {
  return visual.atmosfera ? 'lambert' : 'lommelSeeliger';
}

/** Irradiância relativa ao meio-dia, com `x` = cos da incidência e `s` o meio ângulo do Sol. */
export function irradianciaComPenumbra(x: number, s: number): number {
  if (x >= s) return x;
  if (x <= -s) return 0;
  return ((x + s) * (x + s)) / (4 * s);
}

/**
 * Brilho visto, relativo ao ponto subsolar visto de frente. `mu0` é o cosseno da
 * incidência (já com a penumbra), `mu` o da emissão, entre a normal e a câmera.
 */
export function brilhoRefletido(lei: LeiFotometrica, mu0: number, mu: number): number {
  if (!(mu0 > 0)) return 0;
  if (lei === 'lambert') return mu0;
  // O piso em `mu` evita 0/0 no limbo da face de noite; com `mu0 > 0` o valor fica
  // entre 0 e 2, e 2 é o limite do limbo iluminado em quadratura.
  return (2 * mu0) / (mu0 + Math.max(mu, 0));
}
