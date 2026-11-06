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

export function posicaoDesenhada(
  chave: string | null,
  pos: Float64Array,
  jd: number,
  indiceDe: (chave: string) => number,
): [number, number, number] | null {
  if (!chave) return null;
  const i = indiceDe(chave);
  if (i >= 0 && chave === 'terra') {
    // A fisica move o baricentro Terra-Lua, e a cena desenha o planeta a uns 4.700 km
    // dele. A camera mira o planeta desenhado, pelo mesmo calculo da cena.
    posicaoDaLua(LUA, LUA.base, jd - EPOCA_DAS_LUAS_JD, deslocamentoDaLua);
    deslocamentoDoCentroDaTerra(deslocamentoDaLua, EMRAT, deslocamentoDaLua);
    return [
      pos[3 * i]! + deslocamentoDaLua[0],
      pos[3 * i + 1]! + deslocamentoDaLua[1],
      pos[3 * i + 2]! + deslocamentoDaLua[2],
    ];
  }
  if (i >= 0) return [pos[3 * i]!, pos[3 * i + 1]!, pos[3 * i + 2]!];

  const lua = LUA_POR_CHAVE.get(chave);
  if (!lua) return null;
  const iPai = indiceDe(lua.pai);
  if (iPai < 0) return null;
  posicaoDaLua(lua, lua.base, jd - EPOCA_DAS_LUAS_JD, deslocamentoDaLua);
  return [
    pos[3 * iPai]! + deslocamentoDaLua[0],
    pos[3 * iPai + 1]! + deslocamentoDaLua[1],
    pos[3 * iPai + 2]! + deslocamentoDaLua[2],
  ];
}
