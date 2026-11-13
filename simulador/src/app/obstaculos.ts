/**
 * O que a interface cobre da cena, em pixels do canvas: o painel (quando ele flutua
 * por cima), a regua do rodape, os avisos e o painel tecnico. Nenhum nome de corpo e
 * posto ali, onde ficaria por baixo de outro texto.
 *
 * Medido do proprio DOM, e nao de numeros escritos aqui: `--largura-lateral` sao
 * 20rem, e 20rem nao sao 320 px quando a raiz tem 17 px de fonte. Le layout, por isso
 * fica fora de `rotulos/`, onde o lint proibe.
 */
import type { Retangulo } from '../rotulos/posicionador.ts';

const PECAS_SOBRE_A_CENA = '.visor__leitura, .visor__avisosDoTopo > *, .avisos > *, .tecnico';

/** Vazio quando o painel nao cobre nada: acima do ponto de quebra ele fica ao lado. */
function retanguloDoPainel(larguraPx: number, alturaPx: number, c: DOMRect): Retangulo[] {
  const painel = document.querySelector('.lateral');
  if (!painel || getComputedStyle(painel).position !== 'absolute') return [];
  const p = painel.getBoundingClientRect();
  const x = Math.max(0, p.left - c.left);
  const y = Math.max(0, p.top - c.top);
  return [{ x, y, largura: Math.min(p.width, larguraPx - x), altura: Math.min(p.height, alturaPx - y) }];
}

export function obstaculosDaInterface(larguraPx: number, alturaPx: number): Retangulo[] {
  const canvas = document.querySelector('canvas');
  if (!canvas) return [];
  const c = canvas.getBoundingClientRect();
  const saida = retanguloDoPainel(larguraPx, alturaPx, c);
  for (const el of document.querySelectorAll(PECAS_SOBRE_A_CENA)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    saida.push({ x: r.left - c.left, y: r.top - c.top, largura: r.width, altura: r.height });
  }
  return saida;
}
