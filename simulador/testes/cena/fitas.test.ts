/**
 * Os rastros dos corpos criados no sandbox.
 *
 * As fitas sao indexadas pela posicao do corpo na fisica, e o sandbox muda essas
 * posicoes: apagar um corpo desloca os seguintes uma casa para tras. O rastro tem de
 * seguir o corpo, e nao a casa.
 */
import { describe, expect, it } from 'vitest';
import type { Line2 } from 'three/addons/lines/webgpu/Line2.js';
import { criarFitas } from '@cena/linhas/fitas.ts';
import { carregar } from '@dados/carregar.ts';
import { inserirCorpo } from '@nucleo/estado.ts';

/** Os pontos que a fita de rastro do corpo `i` esta desenhando, relativos ao Sol. */
function pontosDoRastro(grupo: { children: unknown[] }, i: number): [number, number, number][] {
  // Cada corpo pendura duas fitas no grupo, a orbita e o rastro, nessa ordem.
  const linha = grupo.children[2 * i + 1] as Line2;
  const inicio = linha.geometry.getAttribute('instanceStart') as unknown as { data: { array: Float32Array } };
  const a = inicio.data.array;
  const pontos: [number, number, number][] = [];
  for (let k = 0; k + 2 < a.length; k += 6) pontos.push([a[k]!, a[k + 1]!, a[k + 2]!]);
  return pontos;
}

function montar() {
  const catalogo = carregar();
  const corpos: { chave: string; nome: string }[] = catalogo.corpos.map((c) => ({ chave: c.chave, nome: c.nome }));
  const periodos = corpos.map(() => 365);
  const fitas = criarFitas(corpos, periodos, corpos.length + 4);
  const estado = catalogo.estado;
  let t = 0;
  /** Avanca o tempo e anda cada corpo criado ao longo do proprio eixo. */
  const andar = (dias: number) => {
    for (let k = 0; k < dias; k++) {
      t += 1;
      for (let i = 9; i < estado.n; i++) estado.pos[3 * i + 2] = 0.001 * t;
      fitas.atualizar(estado, [0, 0, 0], t, false);
    }
  };
  return { corpos, fitas, estado, andar };
}

describe('rastros do sandbox', () => {
  it('o rastro de um corpo recém-criado nasce vazio, sem amostras da origem', () => {
    const { corpos, fitas, estado, andar } = montar();
    // O sistema roda um mes antes da criacao: as casas de reserva tiveram tempo de
    // gravar o que houvesse nelas.
    andar(30);
    inserirCorpo(estado, [5, 0, 0], [0, 0, 0], 0);
    corpos.push({ chave: 'criado-1', nome: 'Criado 1' });
    andar(3);

    const sol = estado.pos[0]!;
    const rastro = pontosDoRastro(fitas.grupo, 9);
    // O corpo nunca passou perto do Sol; um ponto ali e amostra de uma casa vazia.
    const naOrigem = rastro.filter((p) => Math.abs(p[0] + sol) < 1);
    expect(naOrigem.length, 'o rastro nasceu com amostras da origem').toBe(0);
  });
});
