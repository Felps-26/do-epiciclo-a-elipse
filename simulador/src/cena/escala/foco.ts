/**
 * O foco: escalar de 0 a 1 que diz o quanto a câmera está em cima de um corpo.
 *
 * É função só da posição da câmera. Aproximar aumenta, afastar diminui, e não há
 * modo para ligar nem estado para guardar.
 *
 * A distância é medida em raios reais do corpo, não nos desenhados. A cena já
 * calcula `emRaios = dist / raioDesenhado` para escolher o nível de textura, mas
 * com o exagero de tamanho ligado isso cai para algumas dezenas na visão geral, e
 * todo planeta ficaria no meio do esmaecimento. Com o raio real o escalar não
 * depende do exagero nem do "tamanho real", e o modo maquete não precisa de ramo,
 * porque comprime posições e nunca a escala local.
 *
 * Sem suavização no tempo: a câmera já é suavizada por `transicao.ts`, e um
 * segundo amortecimento em cima do primeiro foi o erro mais caro do projeto.
 * Sendo função pura do quadro, dois quadros com a câmera parada dão o mesmo
 * valor, que é o que `precisao.spec.ts` e `imersivo.spec.ts` medem.
 */

/** Acima disto, em raios reais do corpo, nada é atenuado. */
export const FOCO_COMECA_EM = 64;

/**
 * Abaixo disto o foco é pleno. O enquadramento "perto" fica a 3 raios, então
 * chegar lá satura o escalar com folga. A 3 raios e 45° de campo a altura
 * visível é `2 · 3R · tan(22,5°) = 2,485R` contra um diâmetro de `2R`: o corpo
 * ocupa 80% da altura da tela.
 */
export const FOCO_PLENO_EM = 4;

/**
 * Acima deste foco a linha é escondida, não desenhada quase transparente: a 2%
 * de opacidade ela custaria o mesmo passe de desenho e entregaria um fantasma.
 */
export const CORTE_DA_LINHA = 0.92;

/**
 * O foco, de 0 a 1. `distanciaUa` e `raioRealUa` na mesma unidade.
 *
 * A rampa é em espaço log, como `transicao.ts` interpola `log(raio)`: linear em
 * raios gastaria quase toda a rampa perto de 64 e desabaria no fim, um corte e
 * não um movimento. Em log cada oitava de aproximação rende o mesmo esmaecimento.
 * O `smoothstep` tira os joelhos das pontas.
 */
export function foco(distanciaUa: number, raioRealUa: number): number {
  if (!(raioRealUa > 0) || !(distanciaUa > 0)) return 0;
  const emRaios = distanciaUa / raioRealUa;
  if (emRaios >= FOCO_COMECA_EM) return 0;
  if (emRaios <= FOCO_PLENO_EM) return 1;
  const t =
    Math.log(FOCO_COMECA_EM / emRaios) / Math.log(FOCO_COMECA_EM / FOCO_PLENO_EM);
  return t * t * (3 - 2 * t);
}

/**
 * Quanto da opacidade de uma linha auxiliar sobrevive a este foco.
 *
 * Multiplica e nunca liga: quem desligou "Caminhos previstos" não os vê voltar
 * ao se aproximar de um planeta. As fitas de órbita já saem a 30% da cor do
 * corpo e os anéis de distância usam uma cor decorativa. Nenhum dos dois está
 * sob a regra de 3:1, porque a informação é a forma e não a cor, então o
 * esmaecimento pode ir a zero. Ele nunca toca a malha de um corpo.
 */
export function atenuacaoDasLinhas(f: number): number {
  if (f >= CORTE_DA_LINHA) return 0;
  return Math.max(0, 1 - f / CORTE_DA_LINHA);
}

/**
 * Quantos rótulos sobrevivem a este foco.
 *
 * Afina a multidão sem apagar texto: baixar a opacidade de uma placa deixaria
 * texto legível abaixo de 4,5:1, e a roda pode parar em qualquer ponto. Desce o
 * teto que `colocar` já recebe, e a prioridade existente decide quem fica (o
 * corpo acompanhado vale +1000 e é o último a sair).
 */
export function tetoDeRotulos(f: number, tetoBase: number): number {
  if (f <= 0) return tetoBase;
  return Math.max(1, Math.round(tetoBase * (1 - f) + 1 * f));
}
