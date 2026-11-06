/**
 * A esfera de todo corpo, com o polo em +Z.
 *
 * `SphereGeometry` do three.js põe os polos em ±Y (`uv.y = 1` em +Y, `uv.x = 0,5`
 * em +X). O resto do programa usa +Z como polo: a matriz da IAU
 *
 *     M = Rx(−eps) · Rz(alfa_0 + 90°) · Rx(90° − delta_0) · Rz(W)
 *
 * leva +Z ao polo norte e +X ao meridiano zero, `definirRaioDesenhado` achata o
 * eixo Z, `poloDoCorpo` é (0,0,1) levado pela orientação e os anéis nascem no
 * plano XY. Sem a rotação, o polo da textura caía no equador do corpo: olhando
 * pelo +Z da Terra apareciam América do Sul e África. `orientacao.test.ts` não
 * acusava porque mede a matriz, que estava certa, e as imagens de referência
 * foram gravadas já com o defeito.
 *
 * `rotateX(+90°)` leva +Y a +Z e deixa +X onde estava.
 */
import { SphereGeometry } from 'three';

/** 96×48 preenche a tela sem facetar. */
export const ESFERA = new SphereGeometry(1, 96, 48).rotateX(Math.PI / 2);

/**
 * Onde um ponto da textura cai na esfera, em coordenadas locais do corpo.
 * Procura o vértice de `uv` mais próximo do pedido; serve para `esfera.test.ts`
 * conferir a orientação sem GPU nem textura.
 */
export function ondeCaiNaEsfera(u: number, v: number): [number, number, number] {
  const uvs = ESFERA.attributes['uv']!;
  const pos = ESFERA.attributes['position']!;
  let melhor = 0;
  let menor = Infinity;
  for (let i = 0; i < uvs.count; i++) {
    const d = (uvs.getX(i) - u) ** 2 + (uvs.getY(i) - v) ** 2;
    if (d < menor) {
      menor = d;
      melhor = i;
    }
  }
  return [pos.getX(melhor), pos.getY(melhor), pos.getZ(melhor)];
}
