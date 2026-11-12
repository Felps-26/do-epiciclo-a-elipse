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
import { inserirCorpo, removerCorpo } from '@nucleo/estado.ts';

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
  /** Um quadro com o tempo parado, como com a simulacao pausada. */
  const quadroParado = () => fitas.atualizar(estado, [0, 0, 0], t, false);
  return { corpos, fitas, estado, andar, quadroParado };
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

  it('apagar um corpo criado não transfere o rastro dele a outro corpo', () => {
    const { corpos, fitas, estado, andar } = montar();
    // Dois corpos criados, longe um do outro: o primeiro em x = 5, o segundo em x = -5.
    inserirCorpo(estado, [5, 0, 0], [0, 0, 0], 0);
    corpos.push({ chave: 'criado-1', nome: 'Criado 1' });
    inserirCorpo(estado, [-5, 0, 0], [0, 0, 0], 0);
    corpos.push({ chave: 'criado-2', nome: 'Criado 2' });
    andar(30);

    // Apaga o primeiro, como `sistemaVivo.apagar`: a fisica desloca, a lista tambem.
    removerCorpo(estado, 9);
    corpos.splice(9, 1);
    andar(3);

    const sol = estado.pos[0]!;
    const rastro = pontosDoRastro(fitas.grupo, 9);
    // Nenhum ponto do rastro do sobrevivente pode estar do lado do corpo apagado.
    const doApagado = rastro.filter((p) => p[0] + sol > 0);
    expect(doApagado.length, 'o sobrevivente herdou pontos do corpo apagado').toBe(0);
    // E o rastro dele continua o mesmo de antes: 33 dias, um ponto por dia.
    expect(rastro.filter((p) => p[0] + sol < -4).length).toBeGreaterThan(30);
  });

  it('um corpo criado depois de uma remoção não herda o rastro de quem saiu', () => {
    const { corpos, fitas, estado, andar } = montar();
    inserirCorpo(estado, [5, 0, 0], [0, 0, 0], 0);
    corpos.push({ chave: 'criado-1', nome: 'Criado 1' });
    andar(30);
    removerCorpo(estado, 9);
    corpos.splice(9, 1);
    inserirCorpo(estado, [-5, 0, 0], [0, 0, 0], 0);
    corpos.push({ chave: 'criado-2', nome: 'Criado 2' });
    andar(3);

    const sol = estado.pos[0]!;
    const rastro = pontosDoRastro(fitas.grupo, 9);
    expect(rastro.filter((p) => p[0] + sol > 0).length, 'herdou o rastro do apagado').toBe(0);
  });

  it('com o tempo parado, o corpo criado numa casa reaproveitada não mostra a fita de quem a ocupava', () => {
    const { corpos, fitas, estado, andar, quadroParado } = montar();
    inserirCorpo(estado, [5, 0, 0], [0, 0, 0], 0);
    corpos.push({ chave: 'criado-1', nome: 'Criado 1' });
    inserirCorpo(estado, [-5, 0, 0], [0, 0, 0], 0);
    corpos.push({ chave: 'criado-2', nome: 'Criado 2' });
    andar(30);
    // Apagar o primeiro desloca o segundo para a casa 9; a casa 10 fica com a fita
    // desenhada do segundo. O terceiro nasce nela com a simulacao pausada.
    removerCorpo(estado, 9);
    corpos.splice(9, 1);
    inserirCorpo(estado, [0, 8, 0], [0, 0, 0], 0);
    corpos.push({ chave: 'criado-3', nome: 'Criado 3' });
    quadroParado();
    quadroParado();

    const sol = [estado.pos[0]!, estado.pos[1]!];
    const rastro = pontosDoRastro(fitas.grupo, 10);
    const alheios = rastro.filter((p) => Math.hypot(p[0] + sol[0]! - 0, p[1] + sol[1]! - 8) > 0.01);
    expect(alheios.length, 'a fita mostra pontos de outro corpo').toBe(0);
  });

  it('a órbita de um corpo que escapa é um trecho aberto estável, e não pisca', () => {
    const { corpos, fitas, estado } = montar();
    const sol = [estado.pos[0]!, estado.pos[1]!, estado.pos[2]!] as const;
    const vEscape = Math.sqrt((2 * estado.gm[0]!) / 3) * 1.3;
    inserirCorpo(
      estado,
      [sol[0] + 3, sol[1], sol[2]],
      [estado.vel[0]!, estado.vel[1]! + vEscape, estado.vel[2]!],
      0,
    );
    corpos.push({ chave: 'criado-1', nome: 'Criado 1' });
    const i = estado.n - 1;
    const linha = fitas.grupo.children[2 * i] as Line2;
    const pontosDaOrbita = (): number[] => {
      const inicio = linha.geometry.getAttribute('instanceStart') as unknown as { data: { array: Float32Array } };
      return Array.from(inicio.data.array);
    };

    const visibilidades = new Set<boolean>();
    let anterior: number[] | null = null;
    for (let q = 0; q < 60; q++) {
      // A atenuacao muda de quadro em quadro, como num voo de camera.
      fitas.atenuar(q % 2 === 0 ? 1 : 0.9, null);
      fitas.atualizar(estado, [0, 0, 0], 0, false);
      visibilidades.add(fitas.estadoDaFita('criado-1')!.orbitaVisivel);
      if (q >= 20) {
        const atual = pontosDaOrbita();
        if (anterior) expect(atual).toEqual(anterior);
        anterior = atual;
      }
    }
    expect([...visibilidades]).toEqual([true]);
    const p = pontosDaOrbita();
    expect(p.every((x) => Number.isFinite(x))).toBe(true);
    // O trecho passa pelo corpo, que esta a 3 UA do Sol no eixo x.
    let menor = Infinity;
    for (let k = 0; k + 2 < p.length; k += 3) menor = Math.min(menor, Math.hypot(p[k]! - 3, p[k + 1]!, p[k + 2]!));
    expect(menor).toBeLessThan(0.05);
  });
});
