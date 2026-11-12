/**
 * Onde cada lua esta, por Kepler e nao pelo integrador.
 *
 * Ficam fora da integracao porque a Lua da uma volta em 27,3 dias (55 passos de
 * meio dia por orbita, onde Yoshida4 ja precessa visivelmente) e Io em 1,77 dia
 * (tres passos e meio). Baixar o passo global para Io custaria o desempenho de
 * tudo e mudaria a camada validada contra o JPL em cem anos.
 *
 * O preco e que a posicao vem de elementos medios com taxas seculares, e erra. O
 * erro foi medido em 2020–2040, janela que o gerador dos dados nunca viu, e e
 * publicado corpo a corpo, de 456 km em Deimos a 52.636 km em Tritao. Nao cresce:
 * sao os termos periodicos que um modelo de duas massas nao tem. A Lua da Terra,
 * que e a que se ve de perto, sai da serie de Meeus (`luaMeeus.ts`).
 *
 * As luas sao cinematicas: leem o tempo e devolvem uma posicao, sem entrar em
 * `forcas.ts` nem alterar o estado. Inserir a decima quarta nao muda um bit da
 * trajetoria dos nove primeiros.
 */
import type { BaseDoPlano, ElementosDeLua } from '../contratos/lua.ts';
import { resolverKepler } from './kepler.ts';
import { posicaoDaLuaMeeus } from './luaMeeus.ts';
import { doPlanoParaEcliptica } from './planoDeReferencia.ts';
import { UA_KM } from './unidades.ts';

const GRAU = Math.PI / 180;
/** J2000,0: a epoca dos elementos de `luas.json`, de onde `dias` e contado. */
const JD_DA_EPOCA_DOS_ELEMENTOS = 2451545.0;

/**
 * Posicao da lua em UA, relativa ao centro do planeta, na ecliptica J2000. `dias`
 * conta a partir da epoca dos elementos (J2000,0), e nao da epoca do programa.
 * Escreve em `saida` em vez de alocar, porque roda treze vezes por quadro.
 */
export function posicaoDaLua(
  el: ElementosDeLua,
  base: BaseDoPlano,
  dias: number,
  saida: [number, number, number],
): void {
  if (el.chave === 'lua') {
    posicaoDaLuaMeeus(JD_DA_EPOCA_DOS_ELEMENTOS + dias, saida);
    return;
  }
  const M = (el.anomaliaMediaGraus + el.taxaDaAnomaliaMediaGrausDia * dias) * GRAU;
  const no = (el.noGraus + el.taxaDoNoGrausDia * dias) * GRAU;
  const w = (el.periastroGraus + el.taxaDoPeriastroGrausDia * dias) * GRAU;
  const i = el.inclinacaoGraus * GRAU;
  const e = el.excentricidade;

  const E = resolverKepler(M, e);
  const aUa = el.aKm / UA_KM;
  const xP = aUa * (Math.cos(E) - e);
  const yP = aUa * Math.sqrt(1 - e * e) * Math.sin(E);

  const cO = Math.cos(no);
  const sO = Math.sin(no);
  const ci = Math.cos(i);
  const si = Math.sin(i);
  const cw = Math.cos(w);
  const sw = Math.sin(w);

  // Rz(no)·Rx(i)·Rz(periastro), aberta: so as duas colunas que o plano orbital usa.
  const noPlano: [number, number, number] = [
    (cO * cw - sO * sw * ci) * xP + (-cO * sw - sO * cw * ci) * yP,
    (sO * cw + cO * sw * ci) * xP + (-sO * sw + cO * cw * ci) * yP,
    sw * si * xP + cw * si * yP,
  ];

  const ecl = doPlanoParaEcliptica(base, noPlano);
  saida[0] = ecl[0];
  saida[1] = ecl[1];
  saida[2] = ecl[2];
}

/**
 * Deslocamento do centro da Terra em relacao ao baricentro Terra-Lua:
 *
 *     r_Terra = −r_TerraLua / (1 + EMRAT)
 *
 * O corpo `terra` que o integrador move e o baricentro do par, que e o que a
 * efemeride do JPL mede. O planeta desenhado fica a uns 4.671 km dele, do lado
 * oposto ao da Lua, e a Terra bamboleia no ritmo do mes. Sem o deslocamento a Lua
 * orbitaria um ponto que nao e o centro do planeta, e a sombra cairia no lugar
 * errado.
 */
export function deslocamentoDoCentroDaTerra(
  posicaoDaLuaUa: readonly [number, number, number],
  emrat: number,
  saida: [number, number, number],
): void {
  const f = -1 / (1 + emrat);
  saida[0] = posicaoDaLuaUa[0] * f;
  saida[1] = posicaoDaLuaUa[1] * f;
  saida[2] = posicaoDaLuaUa[2] * f;
}
