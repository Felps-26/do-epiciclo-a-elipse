/**
 * Quanto do giro real de um corpo cabe num quadro.
 *
 * A 30 dias por segundo, Marte (1,026 dia por volta) dá 29 voltas por segundo
 * contra 60 quadros: 175° entre um quadro e o seguinte. Isso é aliasing. A
 * superfície vira um serrilhado que pisca, e dois quadros seguidos mostram lados
 * opostos do planeta. De longe ninguém vê, porque o disco tem três pixels, mas
 * com zoom o planeta ocupa 80% da tela e a textura de 8K fica ilegível.
 *
 * O teto é em pixels por quadro e não em graus, porque o mesmo giro é invisível
 * num disco de três pixels e um borrão num de seiscentos:
 *
 *     pixels = |ΔW| · (π/180) · raioEmPixels
 *
 * O giro desenhado é reduzido pelo fator que leva esse número ao teto. Abaixo de
 * `RAIO_MINIMO_PX` o fator é 1, e com a simulação pausada ΔW é zero, então a
 * vista geral e as cenas de referência não mudam.
 *
 * O custo é que o meridiano desenhado passa a atrasar em relação ao real, e o
 * atraso não se recupera. O eixo, a inclinação e o terminador continuam certos;
 * o que fica errado é qual meridiano está de frente. Isso está em "o que a tela
 * simplifica", ligado por `honestidade.test.ts`, e "Voltar ao início" zera o
 * atraso.
 */

/**
 * Pixels que a superfície pode andar entre dois quadros. Medido: a 60 Hz, 1,5 px
 * são 90 px/s, que o olho lê como movimento. Acima de uns 3 px a textura cintila
 * mesmo com mipmap e anisotropia, e abaixo de 1 px o planeta parece congelado.
 */
export const PIXELS_POR_QUADRO = 1.5;

/**
 * Abaixo deste raio aparente o corpo é um ponto, sem textura para borrar, e o
 * fator é 1. Oito pixels é o disco a partir do qual `posicionador.ts` já rotula.
 */
export const RAIO_MINIMO_PX = 8;

/**
 * Fator, de 0 (congelado) a 1 (intacto), pelo qual multiplicar o giro real.
 * Pura: quem integra o atraso é a cena.
 */
export function amortecimentoDoGiro(deltaWGraus: number, raioEmPixels: number): number {
  if (!(raioEmPixels > RAIO_MINIMO_PX)) return 1;
  const pixels = Math.abs(deltaWGraus) * (Math.PI / 180) * raioEmPixels;
  if (!(pixels > PIXELS_POR_QUADRO)) return 1;
  return PIXELS_POR_QUADRO / pixels;
}
