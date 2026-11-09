/**
 * Aceleracao gravitacional mutua entre todos os corpos.
 *
 * Todos puxam todos, inclusive o Sol, que por isso nao fica parado. E a lei da
 * gravitacao de Newton para N corpos:
 *
 *     a_i = soma_{j != i}  GM_j * (r_j - r_i) / |r_j - r_i|^3
 *
 * Fora do modelo:
 *   - Relatividade geral, no integrador padrao. O maior efeito e a precessao
 *     do perielio de Mercurio, 43 segundos de arco por seculo, que no passo de
 *     meio dia fica abaixo do erro do proprio integrador. A correcao existe
 *     como opcao (`somarCorrecaoRelativistica`, usada so pelo
 *     `yoshida4Relativistico`) para os experimentos do artigo.
 *   - Corpos ausentes: a Lua entra somada a Terra (ver dados/carregar.ts);
 *     Plutao, asteroides e outros satelites nao existem.
 *   - Achatamento dos corpos, pressao de radiacao e mares.
 *
 * O laco visita cada par uma vez so, pela terceira lei de Newton, o que poupa
 * metade das raizes quadradas e das divisoes.
 *
 * Os `!` nos indices existem porque `noUncheckedIndexedAccess` vale tambem para
 * Float64Array. Os indices sao validos: vao de 0 a 3n-1 num buffer de
 * 3*capacidade.
 */
import type { EstadoSistema, Rascunho } from './tipos.ts';
import { C_UA_POR_DIA } from './unidades.ts';

/**
 * Escreve em `rascunho.acel` a aceleracao de cada corpo, em UA/dia^2.
 * Nao aloca. Nao le nem escreve nada alem de `acel`.
 */
export function aceleracao(estado: EstadoSistema, rascunho: Rascunho): void {
  const { pos, gm, n } = estado;
  const a = rascunho.acel;

  a.fill(0, 0, 3 * n);

  for (let i = 0; i < n; i++) {
    const ix = 3 * i;
    const xi = pos[ix]!;
    const yi = pos[ix + 1]!;
    const zi = pos[ix + 2]!;
    const gmi = gm[i]!;

    for (let j = i + 1; j < n; j++) {
      const jx = 3 * j;
      const dx = pos[jx]! - xi;
      const dy = pos[jx + 1]! - yi;
      const dz = pos[jx + 2]! - zi;

      const r2 = dx * dx + dy * dy + dz * dz;
      // 1 / r^3, escrito como 1/(r^2 * r) para uma raiz so.
      const inv = 1 / (r2 * Math.sqrt(r2));

      // `a[k] = a[k]! + ...` em vez de `+=`: com noUncheckedIndexedAccess o lado
      // esquerdo do `+=` e lido como `number | undefined`.
      const fi = gm[j]! * inv; // quanto j puxa i
      a[ix] = a[ix]! + fi * dx;
      a[ix + 1] = a[ix + 1]! + fi * dy;
      a[ix + 2] = a[ix + 2]! + fi * dz;

      const fj = gmi * inv; // e, pela terceira lei, quanto i puxa j
      a[jx] = a[jx]! - fj * dx;
      a[jx + 1] = a[jx + 1]! - fj * dy;
      a[jx + 2] = a[jx + 2]! - fj * dz;
    }
  }
}

const C2 = C_UA_POR_DIA * C_UA_POR_DIA;

/**
 * Soma a `rascunho.acel` o termo pos-newtoniano de primeira ordem do Sol
 * (corpo 0), em cada corpo i >= 1:
 *
 *     a = mu / (c^2 r^3) * [ (4 mu / r - v^2) r + 4 (r . v) v ]
 *
 * com r e v do corpo em torno do Sol e mu = GM do Sol. E o termo do campo de
 * Schwarzschild para uma particula de teste e da os 43"/seculo de Mercurio.
 * Os outros planetas nao entram como fonte: o efeito deles e milhares de vezes
 * menor.
 *
 * Depende da velocidade, entao o Yoshida que o usa deixa de ser exatamente
 * simpletico. Deve ser chamada depois de `aceleracao`, que zera o buffer. `vel`
 * permite avaliar o termo com outra velocidade que nao a do estado (o meio do
 * kick).
 */
export function somarCorrecaoRelativistica(
  estado: EstadoSistema,
  rascunho: Rascunho,
  vel: Float64Array = estado.vel,
): void {
  const { pos, gm, n } = estado;
  const a = rascunho.acel;
  const mu = gm[0]!;
  const xs = pos[0]!;
  const ys = pos[1]!;
  const zs = pos[2]!;
  const uxs = vel[0]!;
  const uys = vel[1]!;
  const uzs = vel[2]!;

  for (let i = 1; i < n; i++) {
    const ix = 3 * i;
    const rx = pos[ix]! - xs;
    const ry = pos[ix + 1]! - ys;
    const rz = pos[ix + 2]! - zs;
    const vx = vel[ix]! - uxs;
    const vy = vel[ix + 1]! - uys;
    const vz = vel[ix + 2]! - uzs;

    const r2 = rx * rx + ry * ry + rz * rz;
    const r = Math.sqrt(r2);
    const v2 = vx * vx + vy * vy + vz * vz;
    const rv = rx * vx + ry * vy + rz * vz;

    const k = mu / (C2 * r2 * r);
    const kr = k * ((4 * mu) / r - v2);
    const kv = 4 * k * rv;
    a[ix] = a[ix]! + kr * rx + kv * vx;
    a[ix + 1] = a[ix + 1]! + kr * ry + kv * vy;
    a[ix + 2] = a[ix + 2]! + kr * rz + kv * vz;
  }
}
