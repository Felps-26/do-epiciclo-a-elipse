/**
 * A vigia de encontros: passo curto perto de quem tem massa, remocao na colisao,
 * e nenhum efeito sobre os nove corpos quando nada foi criado.
 */
import { describe, expect, it } from 'vitest';
import { Simulador } from '@nucleo/simulador.ts';
import { inserirCorpo } from '@nucleo/estado.ts';
import { PASSO_CURTO_DIAS } from '@nucleo/integrador.ts';
import type { Vigia } from '@nucleo/encontros.ts';
import { CORPOS, novo } from './ajuda.ts';

const JUPITER = CORPOS.findIndex((c) => c.chave === 'jupiter');
const NOVE = CORPOS.length;

const vigia: Vigia = {
  ehCriado: (i) => i >= NOVE,
  raioUa: (i) => (i < NOVE ? CORPOS[i]!.raioKm / 149597870.7 : 0),
};

describe('vigia de encontros', () => {
  it('sem corpos criados, os nove andam bit a bit igual com e sem a vigia', () => {
    const a = novo().estado;
    const b = novo().estado;
    const semVigia = new Simulador(a, { passosMaxPorQuadro: 200 });
    const comVigia = new Simulador(b, { passosMaxPorQuadro: 200, vigia });
    for (let q = 0; q < 120; q++) {
      semVigia.avancar(1 / 60, 3000);
      comVigia.avancar(1 / 60, 3000);
    }
    expect(b.tDias).toBe(a.tDias);
    expect(Array.from(b.pos.subarray(0, 3 * b.n))).toEqual(Array.from(a.pos.subarray(0, 3 * a.n)));
    expect(Array.from(b.vel.subarray(0, 3 * b.n))).toEqual(Array.from(a.vel.subarray(0, 3 * a.n)));
  });

  it('um asteroide lançado contra Júpiter colide e some, com data e alvo', () => {
    const { estado } = novo();
    const j = 3 * JUPITER;
    // A 0,05 UA de Jupiter, fora da vizinhanca de criacao, indo direto para ele a 20 km/s.
    const v = 20 / 1731.456836805555;
    inserirCorpo(
      estado,
      [estado.pos[j]! + 0.05, estado.pos[j + 1]!, estado.pos[j + 2]!],
      [estado.vel[j]! - v, estado.vel[j + 1]!, estado.vel[j + 2]!],
      0,
    );
    const sim = new Simulador(estado, { passosMaxPorQuadro: 200, vigia });
    const colisoes = [];
    for (let q = 0; q < 60 && estado.n > NOVE; q++) colisoes.push(...(sim.avancar(1 / 60, 30).colisoes ?? []));
    expect(estado.n).toBe(NOVE);
    expect(colisoes).toHaveLength(1);
    expect(colisoes[0]!.corpo).toBe(NOVE);
    expect(colisoes[0]!.alvo).toBe(JUPITER);
    // 0,05 UA a 20 km/s, acelerando no fim: pouco menos de 4,3 dias.
    expect(colisoes[0]!.tDias).toBeGreaterThan(3);
    expect(colisoes[0]!.tDias).toBeLessThan(4.4);
    expect(estado.pos.subarray(0, 3 * estado.n).every((x) => Number.isFinite(x))).toBe(true);
  });

  it('um corpo que passa a 0,05 UA do Sol dispara o passo curto, e ele volta ao sair', () => {
    const { estado } = novo();
    const gmSol = estado.gm[0]!;
    // Periastro em 0,05 UA, largado a 0,3 UA indo para dentro.
    const rp = 0.05;
    const r0 = 0.3;
    const a = 1;
    const vr0 = Math.sqrt(gmSol * (2 / r0 - 1 / a));
    const h = Math.sqrt(gmSol * a * (1 - (1 - rp / a) ** 2));
    const vt = h / r0;
    const vRad = -Math.sqrt(vr0 * vr0 - vt * vt);
    inserirCorpo(
      estado,
      [estado.pos[0]! + r0, estado.pos[1]!, estado.pos[2]!],
      [estado.vel[0]! + vRad, estado.vel[1]! + vt, estado.vel[2]!],
      0,
    );
    const sim = new Simulador(estado, { passosMaxPorQuadro: 400, vigia });
    const encontros: boolean[] = [];
    let menor = Infinity;
    for (let q = 0; q < 200; q++) {
      const r = sim.avancar(1 / 60, 30);
      encontros.push(Boolean(r.encontro));
      const d = Math.hypot(
        estado.pos[3 * NOVE]! - estado.pos[0]!,
        estado.pos[3 * NOVE + 1]! - estado.pos[1]!,
        estado.pos[3 * NOVE + 2]! - estado.pos[2]!,
      );
      menor = Math.min(menor, d);
    }
    expect(menor).toBeLessThan(0.06);
    expect(encontros.some((x) => x)).toBe(true);
    // Saiu da vizinhanca e o passo voltou ao normal.
    expect(encontros.at(-1)).toBe(false);
    // O tempo continua multiplo exato do passo curto.
    expect(estado.tDias / PASSO_CURTO_DIAS).toBe(Math.round(estado.tDias / PASSO_CURTO_DIAS));
  });
});
