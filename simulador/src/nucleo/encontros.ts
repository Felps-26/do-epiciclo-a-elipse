/**
 * Vigia de encontros dos corpos criados no sandbox.
 *
 * As guardas de `guardas.ts` so olham o instante da criacao. Depois disso um
 * corpo criado pode passar raspando por Jupiter ou pelo Sol, onde o passo de
 * 0,5 dia nao resolve a curva. A vigia roda por passo, so sobre os criados, e
 * nunca escreve no estado: quem decide trocar o passo ou remover e o simulador.
 */
import { PASSO_PADRAO_DIAS } from './integrador.ts';
import { separacaoMinima } from './guardas.ts';
import type { EstadoSistema } from './tipos.ts';

/** O que o nucleo precisa saber dos corpos, sem conhecer o catalogo. */
export interface Vigia {
  ehCriado(i: number): boolean;
  /** Raio fisico em UA; 0 quando o corpo nao tem superficie conhecida. */
  raioUa(i: number): number;
}

export interface Par {
  corpo: number;
  alvo: number;
}

export function haCriado(e: EstadoSistema, vigia: Vigia): boolean {
  for (let i = 0; i < e.n; i++) if (vigia.ehCriado(i)) return true;
  return false;
}

/**
 * O primeiro corpo criado dentro da vizinhanca de um corpo com massa. A
 * vizinhanca e a mesma da guarda de criacao, medida com o passo padrao: e nela
 * que o passo de 0,5 dia deixa de caber 40 vezes na volta local.
 */
export function encontroProximo(e: EstadoSistema, vigia: Vigia): Par | null {
  for (let i = 0; i < e.n; i++) {
    if (!vigia.ehCriado(i)) continue;
    for (let j = 0; j < e.n; j++) {
      if (j === i) continue;
      const minima = separacaoMinima(e.gm[j]!, PASSO_PADRAO_DIAS);
      if (minima <= 0) continue;
      const d = Math.hypot(
        e.pos[3 * i]! - e.pos[3 * j]!,
        e.pos[3 * i + 1]! - e.pos[3 * j + 1]!,
        e.pos[3 * i + 2]! - e.pos[3 * j + 2]!,
      );
      if (d < minima) return { corpo: i, alvo: j };
    }
  }
  return null;
}

/**
 * Um corpo criado que cruzou a superficie de outro durante o passo.
 *
 * Olhar so o fim do passo deixaria passar quase todo impacto: a 60 km/s um
 * corpo anda 0,004 UA em 0,125 dia, oito raios de Jupiter. Por isso mede a
 * menor distancia no segmento do movimento relativo entre o inicio e o fim.
 */
export function colisaoNoPasso(antes: Float64Array, e: EstadoSistema, vigia: Vigia): Par | null {
  for (let i = 0; i < e.n; i++) {
    if (!vigia.ehCriado(i)) continue;
    for (let j = 0; j < e.n; j++) {
      if (j === i) continue;
      const raio = vigia.raioUa(j);
      if (!(raio > 0)) continue;
      const ax = antes[3 * i]! - antes[3 * j]!;
      const ay = antes[3 * i + 1]! - antes[3 * j + 1]!;
      const az = antes[3 * i + 2]! - antes[3 * j + 2]!;
      const bx = e.pos[3 * i]! - e.pos[3 * j]!;
      const by = e.pos[3 * i + 1]! - e.pos[3 * j + 1]!;
      const bz = e.pos[3 * i + 2]! - e.pos[3 * j + 2]!;
      const dx = bx - ax;
      const dy = by - ay;
      const dz = bz - az;
      const d2 = dx * dx + dy * dy + dz * dz;
      const s = d2 > 0 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy + az * dz) / d2)) : 0;
      if (Math.hypot(ax + s * dx, ay + s * dy, az + s * dz) < raio) return { corpo: i, alvo: j };
    }
  }
  return null;
}

/**
 * Um corpo criado que vai cruzar a superficie de outro dentro do proximo passo.
 *
 * Tem de ser olhado antes: no passo que atravessa o alvo, a forca 1/r^2 perto
 * do centro arremessa o corpo para longe, e o segmento entre inicio e fim ja nao
 * passa pelo alvo. A reta do movimento relativo e comparada com o raio de
 * captura `R·sqrt(1 + 2GM/(R·w^2))`, que inclui o foco gravitacional da hiperbole.
 */
export function colisaoPrevista(e: EstadoSistema, vigia: Vigia, dtDias: number): (Par & { emDias: number }) | null {
  for (let i = 0; i < e.n; i++) {
    if (!vigia.ehCriado(i)) continue;
    for (let j = 0; j < e.n; j++) {
      if (j === i) continue;
      const raio = vigia.raioUa(j);
      if (!(raio > 0)) continue;
      const ax = e.pos[3 * i]! - e.pos[3 * j]!;
      const ay = e.pos[3 * i + 1]! - e.pos[3 * j + 1]!;
      const az = e.pos[3 * i + 2]! - e.pos[3 * j + 2]!;
      const wx = e.vel[3 * i]! - e.vel[3 * j]!;
      const wy = e.vel[3 * i + 1]! - e.vel[3 * j + 1]!;
      const wz = e.vel[3 * i + 2]! - e.vel[3 * j + 2]!;
      const w2 = wx * wx + wy * wy + wz * wz;
      if (!(w2 > 0)) continue;
      const t = Math.min(Math.abs(dtDias), Math.max(0, -(ax * wx + ay * wy + az * wz) / w2));
      const captura = raio * Math.sqrt(1 + (2 * e.gm[j]!) / (raio * w2));
      if (Math.hypot(ax + t * wx, ay + t * wy, az + t * wz) < captura) return { corpo: i, alvo: j, emDias: t };
    }
  }
  return null;
}

