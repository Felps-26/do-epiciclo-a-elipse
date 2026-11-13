/**
 * Para onde a camera olha neste quadro: a transicao em curso, o corpo seguido e o
 * voo do modo imersivo, nessa ordem.
 *
 * A ordem importa. O acompanhamento reescreve o pivo por completo, e um voo aplicado
 * antes seria apagado no mesmo quadro. Sem perseguicao: com um corpo seguido, o pivo
 * E a posicao dele, lida do mesmo instantaneo que as malhas, e o erro e zero.
 */
import type { EstadoCamera } from './cameraOrbital.ts';
import { avancarTransicao, type Transicao } from './transicao.ts';
import { velocidadeDeVooUaPorS, voar } from './voo.ts';

type Ponto = [number, number, number];

export interface Rumo {
  frente: number;
  direita: number;
  cima: number;
  turbo: boolean;
}

/** Devolve a transicao que continua valendo depois deste quadro, ou `null`. */
export function moverPivo(
  camera: EstadoCamera,
  transicao: Transicao | null,
  alvo: {
    /** Onde a transicao termina: o corpo, ou o Sol sem corpo. */
    destino: () => Ponto;
    /** O corpo seguido agora, ou `null`. */
    posicao: Ponto | null;
  },
  rumo: Rumo,
  dtRealS: number,
): Transicao | null {
  let t = transicao;
  if (t) {
    if (avancarTransicao(camera, t, alvo.destino(), dtRealS)) t = null;
  } else if (alvo.posicao) {
    camera.pivo = alvo.posicao;
  }

  // Em UA por segundo, vezes o tempo real: sem isso o voo andaria mais rapido num
  // computador mais rapido. Voar e "quero olhar outra coisa": a transicao perde o
  // sentido e seria uma briga entre dois donos do mesmo pivo.
  if (rumo.frente !== 0 || rumo.direita !== 0 || rumo.cima !== 0) {
    const passo = velocidadeDeVooUaPorS(camera, rumo.turbo) * dtRealS;
    voar(camera, rumo.frente * passo, rumo.direita * passo, rumo.cima * passo);
    t = null;
  }
  return t;
}
