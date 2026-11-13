/**
 * Leituras e atalhos publicados em `window.__*` para os testes de ponta a ponta. Quase
 * todos so leem; os poucos que escrevem (a camera, as cascas de prova) existem para o
 * teste posicionar a cena sem arrastar o mouse por nove ordens de grandeza.
 */
import { posicaoDaCamera, type EstadoCamera } from '../cena/camera/cameraOrbital.ts';
import type { Retangulo } from '../rotulos/posicionador.ts';
import type { Consultas } from './consultas.ts';
import type { Programa } from './programa.ts';
import { ancoraDoCursor } from './sandboxNaTela.ts';

declare global {
  interface Window {
    __camera?: EstadoCamera;
    __posicaoDaCamera?: () => [number, number, number];
    __mostrarCascas?: (ligado: boolean) => void;
    __fatias?: () => number;
    __backend?: () => string;
    __grafo?: () => unknown;
    __anel?: () => unknown;
    __anelOpaco?: () => string;
    __larguraDoMapaDaSombra?: () => number;
    __ladoIluminado?: (deslocamento?: number) => void;
    __assentou?: () => boolean;
    __raioAparente?: (chave: string) => number;
    __foco?: () => number;
    __obstaculosDosRotulos?: () => Retangulo[];
    __fita?: (chave: string) => unknown;
    __cascaEmRaios?: (chave: string) => number | null;
    __orientacaoDe?: (chave: string) => [number, number, number, number] | null;
  }
}

export function publicarGanchos(p: Programa, c: Consultas, obstaculos: () => readonly Retangulo[]): void {
  const corpo = (chave: string) => p.cena?.corpos.find((x) => x.chave === chave);

  window.__camera = p.camera;
  window.__posicaoDaCamera = () => posicaoDaCamera(p.camera);
  window.__mostrarCascas = (ligado) => p.cena?.mostrarCascas(ligado);
  window.__fatias = () => p.cena?.fatiasNoUltimoQuadro ?? 0;
  // `assentou` inclui a camera: uma transicao ainda andando e movimento que as
  // douradas e a suite de precisao nao esperam.
  window.__assentou = () => (p.cena?.assentou ?? false) && p.transicao === null;
  window.__raioAparente = (chave) => {
    const k = corpo(chave);
    return k ? k.montado.malha.scale.x / Math.max(k.montado.grupo.position.length(), 1e-12) : 0;
  };
  /** A orientacao DESENHADA, com o teto de giro, e nao a da IAU. */
  window.__orientacaoDe = (chave) => {
    const q = corpo(chave)?.montado.malha.quaternion;
    return q ? [q.x, q.y, q.z, q.w] : null;
  };
  window.__obstaculosDosRotulos = () => obstaculos().map((o) => ({ ...o }));
  window.__foco = () => p.cena?.foco ?? 0;
  window.__fita = (chave) => p.cena?.estadoDaFita(chave) ?? null;
  window.__cascaEmRaios = (chave) => p.cena?.cascaEmRaios(chave) ?? null;
  window.__backend = () => p.backend;
  window.__projecoes = () => p.cena?.projetar(p.larguraPx, p.alturaPx) ?? [];
  window.__corpoEm = (x, y) => p.cena?.corpoEm(x, y, p.larguraPx, p.alturaPx) ?? 'SEM CENA';
  window.__tamanho = () => [p.larguraPx, p.alturaPx];
  window.__ancora = (x, y) => ancoraDoCursor(p, x, y);
  window.__dir = (x, y) => p.cena?.direcaoNaTela(x, y, p.larguraPx, p.alturaPx) ?? null;

  /** Posicao desenhada relativa ao Sol: mede a compressao sem o reenquadramento. */
  window.__posicaoNaCena = (chave) => {
    const k = corpo(chave);
    const sol = corpo('sol');
    if (!k || !sol) return null;
    const a = k.montado.grupo.position;
    const s = sol.montado.grupo.position;
    return { x: a.x - s.x, y: a.y - s.y, z: a.z - s.z, r: a.distanceTo(s) };
  };
  /** A luz que o corpo recebe. Tem de NAO mudar com a escala. */
  window.__irradianciaDe = (chave) => corpo(chave)?.montado.irradianciaAtual() ?? null;

  /**
   * Gira a camera em torno do alvo a partir da direcao do Sol. 0,6 rad deixa o corpo
   * quase todo iluminado sem pôr a camera na reta Sol-corpo, onde o halo do Sol
   * entraria no quadro; somar PI entrega o lado noturno.
   */
  window.__ladoIluminado = (deslocamento = 0.6) => {
    const sol = c.posicaoDoSol();
    p.camera.azimute = Math.atan2(sol[1] - p.camera.pivo[1], sol[0] - p.camera.pivo[0]) + deslocamento;
    p.camera.elevacao = 0.2;
    p.transicao = null;
  };

  /** Largura da imagem que a SOMBRA do anel amostra: ja foi o marcador de 1x1. */
  window.__larguraDoMapaDaSombra = () => corpo('saturno')?.montado.larguraDoMapaDaSombra() ?? 0;

  window.__anelOpaco = () => {
    const a = corpo('saturno')?.montado.aneis;
    if (!a) return 'sem anel';
    const m = a.material as unknown as { opacityNode: unknown; opacity: number; transparent: boolean; needsUpdate: boolean };
    m.opacityNode = null;
    m.opacity = 1;
    m.transparent = false;
    m.needsUpdate = true;
    return 'material do anel virou opaco';
  };
  window.__anel = () => {
    const a = corpo('saturno')?.montado.aneis;
    if (!a) return { existe: false };
    a.updateWorldMatrix(true, false);
    const g = a.geometry;
    g.computeBoundingSphere();
    const m = a.material as { transparent?: boolean; opacity?: number; side?: number };
    return {
      existe: true,
      visible: a.visible,
      renderOrder: a.renderOrder,
      escala: a.scale.toArray(),
      matrizMundo: Array.from(a.matrixWorld.elements).map((v) => +v.toPrecision(4)),
      raioDaEsferaEnvolvente: g.boundingSphere?.radius ?? null,
      vertices: g.attributes['position']?.count ?? 0,
      indices: g.index?.count ?? 0,
      material: { transparent: m.transparent, opacity: m.opacity, side: m.side },
    };
  };
  window.__grafo = () =>
    (p.cena?.corpos ?? []).map((k) => ({
      chave: k.chave,
      filhosDoGrupo: k.montado.grupo.children.length,
      temAneis: k.montado.aneis !== null,
      aneisVisiveis: k.montado.aneis?.visible ?? null,
      escalaDosAneis: k.montado.aneis?.scale.x ?? null,
      escalaDaMalha: k.montado.malha.scale.x,
      posicaoDoGrupo: k.montado.grupo.position.toArray().map((v) => +v.toFixed(6)),
    }));
}
