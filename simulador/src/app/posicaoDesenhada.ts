/**
 * Onde qualquer coisa desenhada esta, em UA, corpo da fisica ou lua. As luas nao tem
 * indice no estado fisico, entao `indiceDe` devolve −1 e tudo que indexa por numero
 * as perde. Esta funcao e o ponto unico onde as duas naturezas se encontram, e por
 * ela acompanhar uma lua funciona como acompanhar um planeta.
 */
import { EMRAT, EPOCA_DAS_LUAS_JD, LUAS } from '../dados/luas.ts';
import { deslocamentoDoCentroDaTerra, posicaoDaLua } from '../nucleo/luas.ts';

const LUA_POR_CHAVE = new Map(LUAS.map((l) => [l.chave, l]));
const LUA = LUA_POR_CHAVE.get('lua')!;
const deslocamentoDaLua: [number, number, number] = [0, 0, 0];

type Ponto = [number, number, number];

/**
 * `comprimir`, no modo maquete, leva um ponto real para o espaco desenhado. Ele age
 * sobre o planeta e nao sobre a lua: a cena comprime o sistema e preserva o vetor
 * lua-planeta, e comprimir a soma poria o alvo dentro do planeta.
 */
export function posicaoDesenhada(
  chave: string | null,
  pos: Float64Array,
  jd: number,
  indiceDe: (chave: string) => number,
  comprimir: (p: Ponto) => Ponto = (p) => p,
): Ponto | null {
  if (!chave) return null;
  const i = indiceDe(chave);
  if (i >= 0 && chave === 'terra') {
    // A fisica move o baricentro Terra-Lua, e a cena desenha o planeta a uns 4.700 km
    // dele. A camera mira o planeta desenhado, pelo mesmo calculo da cena.
    posicaoDaLua(LUA, LUA.base, jd - EPOCA_DAS_LUAS_JD, deslocamentoDaLua);
    deslocamentoDoCentroDaTerra(deslocamentoDaLua, EMRAT, deslocamentoDaLua);
    return comprimir([
      pos[3 * i]! + deslocamentoDaLua[0],
      pos[3 * i + 1]! + deslocamentoDaLua[1],
      pos[3 * i + 2]! + deslocamentoDaLua[2],
    ]);
  }
  if (i >= 0) return comprimir([pos[3 * i]!, pos[3 * i + 1]!, pos[3 * i + 2]!]);

  const lua = LUA_POR_CHAVE.get(chave);
  if (!lua) return null;
  const iPai = indiceDe(lua.pai);
  if (iPai < 0) return null;
  // O pai e o planeta desenhado (na Terra, o centro e nao o baricentro), e a lua
  // mantem em relacao a ele o vetor que tem sem compressao, como em `posicoesDesenhadas`.
  const pai = posicaoDesenhada(lua.pai, pos, jd, indiceDe)!;
  posicaoDaLua(lua, lua.base, jd - EPOCA_DAS_LUAS_JD, deslocamentoDaLua);
  const vx = pos[3 * iPai]! + deslocamentoDaLua[0] - pai[0];
  const vy = pos[3 * iPai + 1]! + deslocamentoDaLua[1] - pai[1];
  const vz = pos[3 * iPai + 2]! + deslocamentoDaLua[2] - pai[2];
  const paiDesenhado = comprimir(pai);
  return [paiDesenhado[0] + vx, paiDesenhado[1] + vy, paiDesenhado[2] + vz];
}
