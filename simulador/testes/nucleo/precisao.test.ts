/**
 * Os dois modos de precisao que a interface oferece, medidos contra o ponto de
 * +10 anos do JPL. O padrao nao pode mudar: e ele que o README e o artigo citam.
 */
import { describe, expect, it } from 'vitest';
import { carregar } from '@dados/carregar.ts';
import { avancar, PRECISOES, type Precisao } from '@nucleo/integrador.ts';
import { criarRascunho } from '@nucleo/tipos.ts';
import { UA_KM } from '@nucleo/unidades.ts';

function erroDeMercurioEmDezAnosKm(precisao: Precisao): number {
  const { estado, validacao, corpos } = carregar();
  const ponto = validacao['10']!;
  const { integrador, passoDias } = PRECISOES[precisao];
  avancar(estado, integrador, passoDias, Math.round(ponto.dias_desde_a_epoca / passoDias), criarRascunho(estado.capacidade));
  expect(estado.tDias).toBe(ponto.dias_desde_a_epoca);
  const i = corpos.findIndex((c) => c.chave === 'mercurio');
  const ref = ponto.corpos.mercurio!.posicao_ua;
  return Math.hypot(estado.pos[3 * i]! - ref[0], estado.pos[3 * i + 1]! - ref[1], estado.pos[3 * i + 2]! - ref[2]) * UA_KM;
}

describe('seletor de precisão', () => {
  it('no modo alto, Mercúrio fica a menos de 2.000 km do JPL em +10 anos', () => {
    expect(erroDeMercurioEmDezAnosKm('alta')).toBeLessThan(2000);
  });

  it('o padrão continua com cerca de 14.000 km, inalterado', () => {
    const erro = erroDeMercurioEmDezAnosKm('padrao');
    expect(erro).toBeGreaterThan(14000);
    expect(erro).toBeLessThan(15000);
  });
});
