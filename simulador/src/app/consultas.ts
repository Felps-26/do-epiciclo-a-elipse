/**
 * Perguntas sobre o sistema que varias partes fazem: o indice de uma chave, o nome
 * dela, onde ela esta desenhada e o que enquadrar. Respondidas sempre do mesmo
 * estado que as malhas usam, para a camera nao mirar onde o corpo nao esta.
 */
import { LUAS } from '../dados/luas.ts';
import { elementosOsculadores } from '../nucleo/efemerides.ts';
import { UA_KM } from '../nucleo/unidades.ts';
import { comprimirPonto, comprimirRaio } from '../cena/escala/escalaVisual.ts';
import type { DadosDoAlvo } from '../cena/camera/enquadramento.ts';
import type { ItemDeCorpo } from '../interface/componentes/ListaDeCorpos.tsx';
import { posicaoDesenhada } from './posicaoDesenhada.ts';
import type { Programa } from './programa.ts';

type Ponto = [number, number, number];

export const LUA_POR_CHAVE = new Map(LUAS.map((l) => [l.chave, l]));

export interface Consultas {
  indiceDe(chave: string | null): number;
  /** O nome de qualquer coisa desenhada: corpo da fisica, lua ou corpo criado. */
  nomeDaChave(chave: string): string;
  /** Onde qualquer coisa esta desenhada, em UA do espaco desenhado. */
  posicaoDe(chave: string | null): Ponto | null;
  /** O Sol e o centro da compressao, entao ele e o mesmo nos dois espacos. */
  posicaoDoSol(): Ponto;
  emMaquete(): boolean;
  /** Onde o alvo do enquadramento esta AGORA, lido do mesmo estado que as malhas. */
  dadosDoAlvo(chave: string | null): DadosDoAlvo | null;
  /** Chamar sempre que a lista de corpos mudar: o nucleo desloca os indices. */
  sincronizar(): void;
  montarLista(): ItemDeCorpo[];
}

export function criarConsultas(p: Programa, emMaquete: () => boolean): Consultas {
  const { catalogo } = p;

  /**
   * Chave -> indice, em tabela. As varreduras lineares rodavam por corpo a cada
   * passada de rotulo, e as listas so mudam quando o sandbox cria ou apaga. A tabela
   * nasce cheia: vazia, o programa comecava com todo indice em −1.
   */
  const indicesDosCorpos = (): Map<string, number> => new Map(catalogo.corpos.map((c, i) => [c.chave, i]));
  let indicePorChave = indicesDosCorpos();

  const indiceDe = (chave: string | null): number => (chave === null ? undefined : indicePorChave.get(chave)) ?? -1;

  const posicaoDoSol = (): Ponto => {
    const e = p.laco.simulador.estado;
    return [e.pos[0]!, e.pos[1]!, e.pos[2]!];
  };

  /**
   * Leva um ponto real para o espaco desenhado. A camera vive no espaco desenhado, e
   * com o pivo no real enquanto a cena comprime, acompanhar um corpo apontaria para
   * onde ele nao esta.
   */
  const paraDesenho = (q: Ponto): Ponto => (emMaquete() ? comprimirPonto(q, posicaoDoSol()) : q);

  const posicaoDe = (chave: string | null): Ponto | null => {
    const e = p.laco.simulador.estado;
    return posicaoDesenhada(chave, e.pos, catalogo.jdEpoca + e.tDias, indiceDe, paraDesenho);
  };

  return {
    indiceDe,
    posicaoDe,
    posicaoDoSol,
    emMaquete,

    nomeDaChave(chave) {
      const i = indicePorChave.get(chave);
      return (i === undefined ? undefined : catalogo.corpos[i]?.nome) ?? LUA_POR_CHAVE.get(chave)?.nome ?? chave;
    },

    dadosDoAlvo(chave) {
      if (chave === null) return null;
      const posicao = posicaoDe(chave);
      if (!posicao) return null;

      // Uma lua enquadra a orbita DELA em torno do planeta. O vetor lua-planeta e uma
      // escala local e nao e comprimido, pelo mesmo motivo que "chegar perto" nao e.
      const lua = LUA_POR_CHAVE.get(chave);
      if (lua) {
        return { posicao, afelioUa: (lua.aKm / UA_KM) * (1 + lua.excentricidade), raioKm: lua.raioMedioKm };
      }

      // Nem corpo nem lua: um corpo do sandbox apagado enquanto era acompanhado.
      const i = indiceDe(chave);
      if (i < 0) return null;
      const afelio = i === 0 ? null : elementosOsculadores(p.laco.simulador.estado, i).afelio;
      const util = afelio !== null && Number.isFinite(afelio) ? afelio : null;
      return {
        posicao,
        // O afelio enquadra a orbita inteira, e a orbita desenhada encolheu junto.
        afelioUa: util === null ? null : emMaquete() ? comprimirRaio(util) : util,
        raioKm: catalogo.corpos[i]!.raioKm,
      };
    },

    sincronizar() {
      indicePorChave = indicesDosCorpos();
    },

    /**
     * A lista que a interface mostra. As luas entram com `pai`, para a lista se
     * desenhar em dois niveis; elas nao tem indice no estado da fisica.
     */
    montarLista() {
      const daFisica: ItemDeCorpo[] = catalogo.corpos.map((c) => ({
        chave: c.chave,
        nome: c.nome,
        tipo: 'corpo',
        criado: c.papel === 'teste',
      }));
      const asLuas: ItemDeCorpo[] = LUAS.map((l) => ({ chave: l.chave, nome: l.nome, tipo: 'lua', pai: l.pai }));
      return [...daFisica, ...asLuas];
    },
  };
}
