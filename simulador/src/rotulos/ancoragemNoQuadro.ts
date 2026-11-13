/**
 * Os nomes dos corpos, quadro a quadro.
 *
 * A colocacao (de que lado fica cada nome) roda a cada dois quadros: resolver a 60 Hz
 * nao muda nada que se enxergue. A ancoragem (onde a placa esta) roda em todo quadro,
 * direto no `transform` dos nos, por fora do Preact, que republica a 8 Hz e faria as
 * placas andarem aos saltos de 125 ms.
 */
import type { Cena } from '../cena/cena.ts';
import type { EstadoCamera } from '../cena/camera/cameraOrbital.ts';
import { tetoComDiscos } from '../cena/escala/foco.ts';
import { CHAVE_DOS_INTERNOS, agruparInternos } from './agrupamento.ts';
import { criarMemoriaDoDesvio, escrever, posicoesSuavizadas } from './ancoragem.ts';
import { larguraDoTexto } from './medida.ts';
import { abreviar, colocar, type Candidato, type Retangulo, type RotuloColocado } from './posicionador.ts';

/** O pedaco do estado da interface que decide quem ganha nome. */
export interface EscolhasDaTela {
  selecionado: string | null;
  comparando: string | null;
  acompanhado: string | null;
  luas: 'com' | 'sem' | 'so';
  modo: string;
  comNomes: boolean;
}

export interface RotulosDoQuadro {
  /** Recalcula (a cada dois quadros) e ancora (em todo quadro). Devolve os colocados. */
  atualizar(q: {
    cena: Cena;
    camera: EstadoCamera;
    escolhas: EscolhasDaTela;
    larguraPx: number;
    alturaPx: number;
    dtRealS: number;
    agoraS: number;
  }): RotuloColocado[];
  /** Os obstaculos do ultimo calculo, para medicao. */
  readonly ultimosObstaculos: readonly Retangulo[];
}

export function criarRotulosDoQuadro(dependencias: {
  nomeDe: (chave: string) => string;
  ehLua: (chave: string) => boolean;
  /** Retangulos da interface sobre a cena. Le layout, entao mora fora deste modulo. */
  obstaculos: (larguraPx: number, alturaPx: number) => Retangulo[];
}): RotulosDoQuadro {
  const desvio = criarMemoriaDoDesvio();
  const memoriaDeDirecao = new Map<string, number>();
  const ancoras = new Map<string, { x: number; y: number; raioPx: number }>();
  let rotulos: RotuloColocado[] = [];
  let quadro = 0;
  let azimuteAnterior = 0;
  let ultimosObstaculos: readonly Retangulo[] = [];
  /** A camada some e volta com a opcao "Nomes dos corpos", entao e procurada enquanto nao se acha. */
  let camada: HTMLElement | null = null;

  function calcular(cena: Cena, camera: EstadoCamera, e: EscolhasDaTela, L: number, A: number): RotuloColocado[] {
    const candidatos: Candidato[] = [];
    for (const p of cena.projetar(L, A)) {
      if (!p.naFrente) continue;
      // Por chave, nunca por indice: a cena guarda corpos e luas na mesma lista, e o
      // sandbox muda o que cada indice quer dizer.
      const nome = dependencias.nomeDe(p.chave);
      const ehAcompanhado = e.acompanhado === p.chave;
      const ehA = e.selecionado === p.chave;
      const ehB = e.comparando === p.chave;
      candidatos.push({
        chave: p.chave,
        nome,
        abreviacao: abreviar(nome),
        x: p.x,
        y: p.y,
        raioPx: p.raioPx,
        prioridade:
          (ehAcompanhado ? 1000 : 0) +
          (ehA ? 500 : 0) +
          (ehB ? 250 : 0) +
          // "Só as luas" troca a ordem de quem ganha nome, e nao apaga os planetas.
          (e.luas === 'so' && dependencias.ehLua(p.chave) ? 400 : 0) +
          // Mais proximo ganha, e entre iguais ganha o maior na tela.
          100 / Math.max(p.distanciaUa, 1e-6) +
          p.raioPx,
        ocluido: p.ocluido,
        nuncaAbreviar: ehA || ehAcompanhado,
        papel: ehAcompanhado ? 'acompanhado' : ehA ? 'a' : ehB ? 'b' : null,
      });
    }

    const agrupados = e.modo === 'sistema' ? agruparInternos(candidatos) : candidatos;
    ultimosObstaculos = dependencias.obstaculos(L, A);
    const girandoRapido = Math.abs(camera.azimute - azimuteAnterior) > 0.01;
    azimuteAnterior = camera.azimute;

    return colocar(agrupados, {
      larguraTela: L,
      alturaTela: A,
      alturaDoTexto: 14,
      obstaculos: ultimosObstaculos,
      medir: (t) => larguraDoTexto(t, 13),
      memoria: memoriaDeDirecao,
      camaraGirandoRapido: girandoRapido,
      // O foco afina a multidao descendo o teto, e nao a opacidade das placas, que
      // deixaria texto abaixo de 4,5:1.
      teto: tetoComDiscos(
        cena.foco,
        18,
        agrupados.map((c) => c.raioPx),
      ),
    });
  }

  return {
    get ultimosObstaculos() {
      return ultimosObstaculos;
    },

    atualizar({ cena, camera, escolhas, larguraPx, alturaPx, dtRealS, agoraS }) {
      // Sem os nomes, sobra o anel do corpo acompanhado, que nao e nome.
      if (quadro++ % 2 === 0) {
        const todos = calcular(cena, camera, escolhas, larguraPx, alturaPx);
        rotulos = escolhas.comNomes ? todos : todos.filter((r) => r.papel === 'acompanhado');
      }

      if (!camada?.isConnected) camada = document.querySelector('.rotulos');
      if (rotulos.length > 0 && camada) {
        ancoras.clear();
        for (const p of cena.projetar(larguraPx, alturaPx)) {
          if (p.naFrente) ancoras.set(p.chave, { x: p.x, y: p.y, raioPx: p.raioPx });
        }
        // O grupo dos internos fica em volta do Sol, e anda com ele.
        const sol = ancoras.get('sol');
        const grupo = rotulos.find((r) => r.chave === CHAVE_DOS_INTERNOS);
        if (sol && grupo) ancoras.set(CHAVE_DOS_INTERNOS, { x: sol.x, y: sol.y, raioPx: grupo.raioPx });
        escrever(camada, posicoesSuavizadas(rotulos, ancoras, desvio, dtRealS, agoraS));
      }
      return rotulos;
    },
  };
}
