/**
 * Onde a cena desenha cada corpo e cada lua, em UA, antes da origem flutuante.
 *
 * Fica fora de `cena.ts` para que quem aponta a camera (`app/posicaoDesenhada.ts`)
 * possa ser conferido contra o mesmo calculo que posiciona as malhas.
 */
import { EMRAT, EPOCA_DAS_LUAS_JD, type LuaCompleta } from '../dados/luas.ts';
import { deslocamentoDoCentroDaTerra, posicaoDaLua } from '../nucleo/luas.ts';
import { comprimirBuffer } from './escala/escalaVisual.ts';

const deslocamento: [number, number, number] = [0, 0, 0];

/**
 * Preenche `reais` (os `nCorpos` da fisica e depois as luas, na ordem de `luas`) e,
 * em maquete, `comprimidas`. Devolve o buffer que vira coordenada de cena. `iLua` e o
 * indice da Lua dentro de `luas`.
 */
export function posicoesDesenhadas(
  posUa: Float64Array,
  nCorpos: number,
  luas: readonly { lua: LuaCompleta; iPai: number }[],
  iTerra: number,
  iLua: number,
  jd: number,
  maquete: boolean,
  reais: Float64Array,
  comprimidas: Float64Array,
): Float64Array {
  // Posicoes de todos, reais e desenhadas. `posUa` traz os corpos integrados. As
  // luas entram aqui: a posicao delas e o centro do planeta mais o vetor que Kepler
  // devolve.
  //
  // O vetor da lua nao e comprimido. A compressao e funcao da distancia ao Sol, e a
  // raiz quadrada de 384.400 km (0,00257 UA) daria 0,0507 UA, vinte vezes mais: a Lua
  // sairia da orbita da Terra e iria parar perto de Vênus. Comprime-se o sistema,
  // nunca o que esta dentro de um planeta.
  const diasDasLuas = jd - EPOCA_DAS_LUAS_JD;
  reais.set(posUa.subarray(0, 3 * nCorpos));
  for (let k = 0; k < luas.length; k++) {
    const { lua, iPai } = luas[k]!;
    const destino = 3 * (nCorpos + k);
    posicaoDaLua(lua, lua.base, diasDasLuas, deslocamento);
    reais[destino] = posUa[3 * iPai]! + deslocamento[0];
    reais[destino + 1] = posUa[3 * iPai + 1]! + deslocamento[1];
    reais[destino + 2] = posUa[3 * iPai + 2]! + deslocamento[2];
  }

  // O corpo 'terra' que o integrador move e o BARICENTRO Terra-Lua. O
  // planeta desenhado fica a 4.671 km dele, do lado oposto ao da Lua — e
  // sem isso a Lua orbitaria um ponto que nao e o centro do planeta, e a
  // sombra dela cairia no lugar errado.
  if (iTerra >= 0 && iLua >= 0) {
    const lua = luas[iLua]!.lua;
    posicaoDaLua(lua, lua.base, diasDasLuas, deslocamento);
    deslocamentoDoCentroDaTerra(deslocamento, EMRAT, deslocamento);
    reais[3 * iTerra] = posUa[3 * iTerra]! + deslocamento[0];
    reais[3 * iTerra + 1] = posUa[3 * iTerra + 1]! + deslocamento[1];
    reais[3 * iTerra + 2] = posUa[3 * iTerra + 2]! + deslocamento[2];
  }

  // A compressao age sobre o sistema, e as luas acompanham o planeta: o
  // vetor lua-planeta e preservado, e so o planeta se move.
  if (!maquete) return reais;
  comprimirBuffer(reais, nCorpos, comprimidas);
  for (let k = 0; k < luas.length; k++) {
    const { iPai } = luas[k]!;
    const d = 3 * (nCorpos + k);
    comprimidas[d] = comprimidas[3 * iPai]! + (reais[d]! - reais[3 * iPai]!);
    comprimidas[d + 1] = comprimidas[3 * iPai + 1]! + (reais[d + 1]! - reais[3 * iPai + 1]!);
    comprimidas[d + 2] = comprimidas[3 * iPai + 2]! + (reais[d + 2]! - reais[3 * iPai + 2]!);
  }
  return comprimidas;
}
