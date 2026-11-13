/**
 * O sandbox visto da tela: onde um clique cai, que velocidade o controle pede, a
 * orbita prevista enquanto o corpo nao existe e a frase de uma recusa.
 */
import { previsaoDeOrbita } from '../nucleo/efemerides.ts';
import { RECUSAS } from '../dados/textos.ts';
import { direcaoDeVista, posicaoDaCamera } from '../cena/camera/cameraOrbital.ts';
import { pontoNoPlanoDoPivo } from '../cena/selecao.ts';
import type { EstadoUi } from './estadoUi.ts';
import type { Programa } from './programa.ts';
import type { Recusa } from './sistemaVivo.ts';

type Ponto = [number, number, number];

/**
 * Velocidade para uma orbita naquele ponto, como fracao da circular: perpendicular ao
 * raio, no plano da ecliptica, no sentido dos planetas. Fracao 1 da orbita redonda e
 * raiz de 2 e a de escape. Somada a do Sol, porque o referencial e baricentrico.
 */
export function velocidadeParaOrbita(p: Programa, pos: readonly [number, number, number], fracao: number): Ponto {
  const e = p.laco.simulador.estado;
  const dx = pos[0] - e.pos[0]!;
  const dy = pos[1] - e.pos[1]!;
  const dz = pos[2] - e.pos[2]!;
  const r = Math.hypot(dx, dy, dz);
  if (!(r > 0)) return [e.vel[0]!, e.vel[1]!, e.vel[2]!];
  const v = Math.sqrt(e.gm[0]! / r) * fracao;
  // Sobre o eixo z nao ha "perpendicular no plano"; ali qualquer uma serve.
  const n = Math.hypot(dx, dy);
  const ux = n > 1e-12 ? -dy / n : 1;
  const uy = n > 1e-12 ? dx / n : 0;
  return [e.vel[0]! + ux * v, e.vel[1]! + uy * v, e.vel[2]!];
}

/** Traduz um veredito do nucleo para uma frase. */
export function porExtenso(r: Recusa): string {
  if (r.tipo === 'lotado') return RECUSAS.lotado(r.maximo);
  if (r.tipo === 'vizinhanca') return RECUSAS.vizinhoPerto(r.nome, r.veredito.distanciaUa, r.veredito.minimaUa);
  const v = r.veredito;
  const temSaida = v.passoSugeridoDias !== null;
  return v.razao === 'periastro-rapido-demais'
    ? RECUSAS.periastroCurto(v.perielioUa, v.passosNoPeriastro, temSaida)
    : RECUSAS.voltaCurta(v.periodoDias, v.passosPorVolta, temSaida);
}

/** O ponto do mundo sob o cursor, no plano do pivo. Nulo em vista rasante. */
export function ancoraDoCursor(p: Programa, xCss: number, yCss: number): Ponto | null {
  if (!p.cena) return null;
  return pontoNoPlanoDoPivo(
    posicaoDaCamera(p.camera),
    p.cena.direcaoNaTela(xCss, yCss, p.larguraPx, p.alturaPx),
    direcaoDeVista(p.camera),
    p.camera.raio,
  );
}

/**
 * Onde um clique cai, no plano da ecliptica. Com a camera quase rasante o raio cruza
 * o plano longe demais e um pixel move o ponto por UAs; ai o plano passa a ser o da
 * camera, a distancia do alvo, e quem chamou anuncia a troca.
 */
export function ondeOCliqueCai(
  p: Programa,
  zDoPlano: number,
  xCss: number,
  yCss: number,
): { pos: Ponto; trocouDePlano: boolean } | null {
  if (!p.cena) return null;
  const dir = p.cena.direcaoNaTela(xCss, yCss, p.larguraPx, p.alturaPx);
  const olho = posicaoDaCamera(p.camera);
  // 0,12 e sen(7°): abaixo disso a interseccao fica a mais de oito vezes a distancia.
  if (Math.abs(dir[2]) >= 0.12) {
    const t = (zDoPlano - olho[2]) / dir[2];
    if (t > 0 && Number.isFinite(t)) {
      return { pos: [olho[0] + t * dir[0], olho[1] + t * dir[1], zDoPlano], trocouDePlano: false };
    }
  }
  const d = p.camera.raio;
  return { pos: [olho[0] + d * dir[0], olho[1] + d * dir[1], olho[2] + d * dir[2]], trocouDePlano: true };
}

/**
 * A orbita que o corpo do rascunho teria. Recalculada quando o rascunho muda, e nao
 * por quadro: a forma fechada e instantanea e nao depende do tempo.
 */
export function atualizarPrevisao(p: Programa, ui: EstadoUi): void {
  if (!p.cena) return;
  const r = ui.rascunho;
  if (ui.modoDeUso !== 'criar' || !r.pos) {
    p.cena.mostrarPrevisao(new Float64Array(0));
    return;
  }
  const e = p.laco.simulador.estado;
  p.cena.mostrarPrevisao(
    previsaoDeOrbita(
      r.pos,
      velocidadeParaOrbita(p, r.pos, r.fracaoDaCircular),
      [e.pos[0]!, e.pos[1]!, e.pos[2]!],
      [e.vel[0]!, e.vel[1]!, e.vel[2]!],
      e.gm[0]!,
    ),
  );
}
