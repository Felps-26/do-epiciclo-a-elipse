/**
 * O ponto que a camera recebe como alvo tem de ser o ponto onde a cena desenha o
 * corpo. A cena desenha a Terra a uns 4.700 km do baricentro Terra-Lua; se o alvo for
 * o baricentro, "chegar perto" deixa o planeta fora do centro e cortado pela borda.
 */
import { describe, expect, it } from 'vitest';
import { carregar } from '@dados/carregar.ts';
import { EMRAT, EPOCA_DAS_LUAS_JD, LUAS } from '@dados/luas.ts';
import { deslocamentoDoCentroDaTerra, posicaoDaLua } from '@nucleo/luas.ts';
import { UA_KM } from '@nucleo/unidades.ts';
import { posicaoDesenhada } from '@app/posicaoDesenhada.ts';
import { comprimirPonto } from '@cena/escala/escalaVisual.ts';
import { posicoesDesenhadas } from '@cena/posicoesDesenhadas.ts';

const catalogo = carregar();
const indices = new Map(catalogo.corpos.map((c, i) => [c.chave, i]));
const indiceDe = (chave: string): number => indices.get(chave) ?? -1;
const pos = catalogo.estado.pos;
const jd = catalogo.jdEpoca + 12.5;
const lua = LUAS.find((l) => l.chave === 'lua')!;

const baricentro = (chave: string): [number, number, number] => {
  const i = indiceDe(chave);
  return [pos[3 * i]!, pos[3 * i + 1]!, pos[3 * i + 2]!];
};

describe('posicaoDesenhada', () => {
  it('duplo clique na Terra centra o planeta, não o baricentro Terra-Lua', () => {
    // O mesmo calculo que `cena.ts` faz para pôr a malha da Terra no lugar.
    const vetorDaLua: [number, number, number] = [0, 0, 0];
    posicaoDaLua(lua, lua.base, jd - EPOCA_DAS_LUAS_JD, vetorDaLua);
    const desvio: [number, number, number] = [0, 0, 0];
    deslocamentoDoCentroDaTerra(vetorDaLua, EMRAT, desvio);
    const b = baricentro('terra');
    const desenhada = [b[0] + desvio[0], b[1] + desvio[1], b[2] + desvio[2]];

    const alvo = posicaoDesenhada('terra', pos, jd, indiceDe)!;
    for (let k = 0; k < 3; k++) expect(alvo[k]).toBeCloseTo(desenhada[k]!, 12);
    const kmDoBaricentro = Math.hypot(alvo[0] - b[0], alvo[1] - b[1], alvo[2] - b[2]) * UA_KM;
    expect(kmDoBaricentro).toBeGreaterThan(4000);
  });

  it('um planeta sem lua desenhada fica no ponto da física', () => {
    expect(posicaoDesenhada('marte', pos, jd, indiceDe)).toEqual(baricentro('marte'));
  });

  it('uma lua fica no planeta mais o vetor de Kepler, como na cena', () => {
    const io = LUAS.find((l) => l.chave === 'io')!;
    const vetor: [number, number, number] = [0, 0, 0];
    posicaoDaLua(io, io.base, jd - EPOCA_DAS_LUAS_JD, vetor);
    const j = baricentro('jupiter');
    expect(posicaoDesenhada('io', pos, jd, indiceDe)).toEqual([j[0] + vetor[0], j[1] + vetor[1], j[2] + vetor[2]]);
  });

  it('chave desconhecida ou nula não tem posição', () => {
    expect(posicaoDesenhada(null, pos, jd, indiceDe)).toBeNull();
    expect(posicaoDesenhada('apagado-1', pos, jd, indiceDe)).toBeNull();
  });

  it('em modo maquete o pivô de uma lua é o planeta comprimido mais o vetor lua-planeta inteiro', () => {
    // A cena comprime o sistema e preserva o vetor lua-planeta (`cena.ts`). Comprimir
    // a soma levaria a camera para dentro de Jupiter, longe de Io.
    const sol = baricentro('sol');
    const comprimir = (p: [number, number, number]) => comprimirPonto(p, sol);
    const io = LUAS.find((l) => l.chave === 'io')!;
    const vetor: [number, number, number] = [0, 0, 0];
    posicaoDaLua(io, io.base, jd - EPOCA_DAS_LUAS_JD, vetor);
    const j = comprimir(baricentro('jupiter'));
    const esperado = [j[0] + vetor[0], j[1] + vetor[1], j[2] + vetor[2]];

    const alvo = posicaoDesenhada('io', pos, jd, indiceDe, comprimir)!;
    for (let k = 0; k < 3; k++) expect(alvo[k]).toBeCloseTo(esperado[k]!, 12);
  });

  it('em modo maquete um planeta vai para o ponto comprimido', () => {
    const sol = baricentro('sol');
    const comprimir = (p: [number, number, number]) => comprimirPonto(p, sol);
    expect(posicaoDesenhada('marte', pos, jd, indiceDe, comprimir)).toEqual(comprimir(baricentro('marte')));
  });

  for (const maquete of [false, true]) {
    it(`o alvo da câmera é onde a cena desenha, para todo corpo e toda lua${maquete ? ', em maquete' : ''}`, () => {
      // O mesmo calculo que `cena.ts` usa para pôr as malhas, e nao uma copia dele.
      const n = catalogo.corpos.length;
      const luas = LUAS.map((l) => ({ lua: l, iPai: indiceDe(l.pai) }));
      const total = 3 * (n + luas.length);
      const desenho = posicoesDesenhadas(
        pos,
        n,
        luas,
        indiceDe('terra'),
        LUAS.findIndex((l) => l.chave === 'lua'),
        jd,
        maquete,
        new Float64Array(total),
        new Float64Array(total),
      );
      const sol = baricentro('sol');
      const comprimir = maquete ? (p: [number, number, number]) => comprimirPonto(p, sol) : undefined;
      const chaves = [...catalogo.corpos.map((c) => c.chave), ...LUAS.map((l) => l.chave)];
      chaves.forEach((chave, k) => {
        const alvo = posicaoDesenhada(chave, pos, jd, indiceDe, comprimir)!;
        // Em km, para a mensagem dizer o tamanho do erro.
        const km = Math.hypot(
          alvo[0] - desenho[3 * k]!,
          alvo[1] - desenho[3 * k + 1]!,
          alvo[2] - desenho[3 * k + 2]!,
        ) * UA_KM;
        expect(km, `${chave} fora do lugar desenhado`).toBeLessThan(1e-3);
      });
    });
  }
});

