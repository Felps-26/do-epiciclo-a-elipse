/**
 * O caminho desenhado de um corpo que escapa do Sol.
 *
 * O sandbox deixa lançar acima da velocidade de escape. Sem o ramo aberto, o
 * caminho previsto sumia e a elipse osculadora ficava com a última forma
 * fechada, pendurada longe do corpo.
 */
import { describe, expect, it } from 'vitest';
import { carregar } from '@dados/carregar.ts';
import { elipseOsculadora, previsaoDeOrbita } from '@nucleo/efemerides.ts';
import { inserirCorpo } from '@nucleo/estado.ts';

const GM_SOL = 2.9591220828411951e-4;
const ORIGEM = [0, 0, 0] as const;

/** Velocidade tangencial como fração da circular, como faz o controle do sandbox. */
function lancamento(rUa: number, fracao: number): [number, number, number] {
  return [0, Math.sqrt(GM_SOL / rUa) * fracao, 0];
}

function todosFinitos(p: Float64Array): boolean {
  return p.every((x) => Number.isFinite(x));
}

describe('caminho de órbita aberta', () => {
  for (const fracao of [Math.SQRT2, Math.SQRT2 + 1e-9, 1.6, 3]) {
    it(`com ${fracao.toFixed(4)} da circular o caminho previsto existe e não tem NaN`, () => {
      const p = previsaoDeOrbita([2, 0, 0], lancamento(2, fracao), ORIGEM, ORIGEM, GM_SOL);
      expect(p.length).toBe(3 * 240);
      expect(todosFinitos(p)).toBe(true);
    });
  }

  it('o trecho aberto passa pelo corpo e não vai além de 3 vezes a distância atual', () => {
    const p = previsaoDeOrbita([2, 0, 0], lancamento(2, 1.8), ORIGEM, ORIGEM, GM_SOL);
    let menorAoCorpo = Infinity;
    let maior = 0;
    for (let k = 0; k < p.length / 3; k++) {
      const x = p[3 * k]!;
      const y = p[3 * k + 1]!;
      const z = p[3 * k + 2]!;
      menorAoCorpo = Math.min(menorAoCorpo, Math.hypot(x - 2, y, z));
      maior = Math.max(maior, Math.hypot(x, y, z));
    }
    expect(menorAoCorpo).toBeLessThan(0.05);
    expect(maior).toBeLessThanOrEqual(6 + 1e-9);
  });

  it('a elipse osculadora de um corpo criado que escapa vira um trecho aberto, finito', () => {
    const { estado } = carregar();
    const sol = [estado.pos[0]!, estado.pos[1]!, estado.pos[2]!] as const;
    const vSol = [estado.vel[0]!, estado.vel[1]!, estado.vel[2]!];
    const v = lancamento(3, 2);
    inserirCorpo(estado, [sol[0] + 3, sol[1], sol[2]], [vSol[0]! + v[0], vSol[1]! + v[1], vSol[2]! + v[2]], 0);
    const p = elipseOsculadora(estado, estado.n - 1, 240);
    expect(p.length).toBe(3 * 240);
    expect(todosFinitos(p)).toBe(true);
  });

  it('a órbita fechada continua igual: a elipse dos planetas não muda', () => {
    const { estado } = carregar();
    const p = elipseOsculadora(estado, 3, 240);
    // A volta fecha: o primeiro e o último ponto coincidem.
    expect(Math.hypot(p[0]! - p[717]!, p[1]! - p[718]!, p[2]! - p[719]!)).toBeLessThan(1e-12);
  });
});
