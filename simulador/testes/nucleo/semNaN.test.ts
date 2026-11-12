/**
 * Propriedade: nenhum corpo que o sandbox aceita produz NaN, nem na física nem
 * no que a cena desenha a partir dela (cônica osculadora, previsão e a versão
 * comprimida do modo maquete). 200 lançamentos com semente fixa, cada um num
 * sistema novo, de todas as predefinições e velocidades que o controle permite.
 */
import { describe, expect, it } from 'vitest';
import { carregar } from '@dados/carregar.ts';
import { criarSistemaVivo } from '@app/sistemaVivo.ts';
import { PREDEFINICOES } from '@contratos/sandbox.ts';
import { Simulador } from '@nucleo/simulador.ts';
import { elipseOsculadora, previsaoDeOrbita } from '@nucleo/efemerides.ts';
import { PASSO_PADRAO_DIAS } from '@nucleo/integrador.ts';
import { kmParaUa } from '@nucleo/unidades.ts';
import { comprimirRelativos } from '@cena/escala/escalaVisual.ts';

/** mulberry32: pequeno, determinista e bom o bastante para sortear lançamentos. */
function sorteador(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const finito = (a: ArrayLike<number>): boolean => Array.prototype.every.call(a, (x: number) => Number.isFinite(x));

describe('nenhum NaN no que o sandbox aceita', () => {
  it('200 lançamentos aleatórios, semente fixa', () => {
    const sortear = sorteador(20261112);
    let aceitos = 0;
    for (let k = 0; k < 200; k++) {
      const { estado, corpos } = carregar();
      const vivo = criarSistemaVivo(estado, corpos);
      const predefinicao = PREDEFINICOES[Math.floor(sortear() * PREDEFINICOES.length)]!;
      const r = 0.3 + sortear() ** 2 * 40;
      const ang = sortear() * 2 * Math.PI;
      const pos: [number, number, number] = [
        estado.pos[0]! + r * Math.cos(ang),
        estado.pos[1]! + r * Math.sin(ang),
        estado.pos[2]! + (sortear() - 0.5) * 0.1 * r,
      ];
      const fracao = sortear() * 1.6;
      const vCirc = Math.sqrt(estado.gm[0]! / r) * fracao;
      const vel: [number, number, number] = [
        estado.vel[0]! - Math.sin(ang) * vCirc,
        estado.vel[1]! + Math.cos(ang) * vCirc,
        estado.vel[2]!,
      ];
      const sol = [estado.pos[0]!, estado.pos[1]!, estado.pos[2]!] as const;
      const vSol = [estado.vel[0]!, estado.vel[1]!, estado.vel[2]!] as const;
      expect(finito(previsaoDeOrbita(pos, vel, sol, vSol, estado.gm[0]!)), `previsão ${k}`).toBe(true);

      const res = vivo.criar({ predefinicao, pos, vel, dtDias: PASSO_PADRAO_DIAS, diaSimulado: 0 });
      if (!res.ok) continue;
      aceitos++;

      const sim = new Simulador(estado, {
        passosMaxPorQuadro: 400,
        vigia: {
          ehCriado: (i) => corpos[i]?.papel === 'teste',
          raioUa: (i) => (corpos[i]?.papel === 'teste' ? 0 : kmParaUa(corpos[i]?.raioKm ?? 0)),
        },
      });
      for (let q = 0; q < 60; q++) {
        const rel = sim.avancar(1 / 60, 730);
        for (const c of rel.colisoes ?? []) vivo.registrarColisao(c.corpo);
        expect(finito(estado.pos.subarray(0, 3 * estado.n)), `lançamento ${k}, quadro ${q}`).toBe(true);
      }
      for (let i = 1; i < estado.n; i++) {
        const curva = elipseOsculadora(estado, i, 240);
        expect(finito(curva), `cônica do corpo ${i} no lançamento ${k}`).toBe(true);
        const relativo = new Float32Array(curva.length);
        for (let p = 0; p < curva.length; p++) relativo[p] = curva[p]! - estado.pos[p % 3]!;
        comprimirRelativos(relativo, curva.length / 3);
        expect(finito(relativo), `maquete do corpo ${i} no lançamento ${k}`).toBe(true);
      }
    }
    // Se as guardas recusassem quase tudo, a propriedade passaria vazia.
    expect(aceitos).toBeGreaterThan(100);
  }, 30_000);
});
