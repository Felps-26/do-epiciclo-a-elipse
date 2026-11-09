/**
 * A correcao pos-newtoniana do Sol, conferida pelo numero que todo mundo
 * conhece: o perielio de Mercurio avanca 42,98" por seculo.
 *
 * Dois corpos isolados (Sol e Mercurio), entao nao ha perturbacao dos outros
 * planetas para misturar com o efeito. Sem a correcao a orbita kepleriana nao
 * precessa, e o segundo teste mede quanto o proprio integrador inventa de
 * precessao no mesmo passo: e ele que garante que os 42,98" do primeiro vem do
 * termo, e nao do truncamento.
 */
import { describe, expect, it } from 'vitest';
import { criarEstado } from '@nucleo/estado.ts';
import { avancar, PADRAO, yoshida4, yoshida4Relativistico, type Integrador } from '@nucleo/integrador.ts';
import { criarRascunho } from '@nucleo/tipos.ts';
import { CORPOS } from './ajuda.ts';

const SEG_POR_RAD = (180 / Math.PI) * 3600;
const DIAS = 36525;
const DT = 0.05;

const gmDe = (nome: string): number => {
  const c = CORPOS.find((k) => k.nome === nome);
  if (!c) throw new Error(`corpo ${nome} ausente da efemeride`);
  return c.gm;
};

/** Angulo do vetor de excentricidade (v x h)/mu - r/|r|, no plano xy. */
function anguloDoPerielio(pos: Float64Array, vel: Float64Array, mu: number): number {
  const rx = pos[3]! - pos[0]!;
  const ry = pos[4]! - pos[1]!;
  const vx = vel[3]! - vel[0]!;
  const vy = vel[4]! - vel[1]!;
  const h = rx * vy - ry * vx; // so a componente z: a orbita fica no plano
  const r = Math.hypot(rx, ry);
  const ex = (vy * h) / mu - rx / r;
  const ey = (-vx * h) / mu - ry / r;
  return Math.atan2(ey, ex);
}

/** Sol e Mercurio, com Mercurio no perielio. */
function mercurioNoPerielio() {
  const gmSol = gmDe('Sol');
  const gmMerc = gmDe('Mercúrio');
  const mu = gmSol + gmMerc;
  const a = 0.387098;
  const e = 0.20563;
  const rp = a * (1 - e);
  const vp = Math.sqrt((mu * (1 + e)) / rp);
  const estado = criarEstado({
    gm: [gmSol, gmMerc],
    pos: [0, 0, 0, rp, 0, 0],
    vel: [0, 0, 0, 0, vp, 0],
    tDias: 0,
  });
  return { estado, mu, rascunho: criarRascunho(estado.capacidade) };
}

/** Posicao de Mercurio depois de dez anos com passo dt. */
function mercurioEmDezAnos(integrador: Integrador, dt: number): [number, number, number] {
  const { estado, rascunho } = mercurioNoPerielio();
  avancar(estado, integrador, dt, Math.round(3652.5 / dt), rascunho);
  return [estado.pos[3]!, estado.pos[4]!, estado.pos[5]!];
}

/**
 * Quanto o erro cai quando o passo cai a metade, comparando 0,5 e 0,25 dia com
 * 0,125. Num metodo de 4a ordem a razao fica perto de 17.
 */
function razaoDeConvergencia(integrador: Integrador): number {
  type Ponto = [number, number, number];
  const x1 = mercurioEmDezAnos(integrador, 0.5);
  const x2 = mercurioEmDezAnos(integrador, 0.25);
  const x3 = mercurioEmDezAnos(integrador, 0.125);
  const dist = (p: Ponto, q: Ponto) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  return dist(x1, x3) / dist(x2, x3);
}

/** Avanco do perielio em um seculo, em segundos de arco. */
function avancoEmUmSeculo(integrador: Integrador): number {
  const { estado, mu, rascunho } = mercurioNoPerielio();

  const antes = anguloDoPerielio(estado.pos, estado.vel, mu);
  avancar(estado, integrador, DT, Math.round(DIAS / DT), rascunho);
  const depois = anguloDoPerielio(estado.pos, estado.vel, mu);

  // a diferenca dando a volta, porque os dois angulos estao em (-pi, pi]
  const d = Math.atan2(Math.sin(depois - antes), Math.cos(depois - antes));
  return d * SEG_POR_RAD;
}

describe('correcao pos-newtoniana do Sol', () => {
  it('com a correção, o periélio de Mercúrio avança 42,98″ por século (±1%)', () => {
    const avanco = avancoEmUmSeculo(yoshida4Relativistico);
    expect(Math.abs(avanco - 42.98), `avanco medido: ${avanco.toFixed(3)}"`).toBeLessThan(0.43);
  });

  it('sem a correção, o mesmo problema precessa menos de 0,5″ por século', () => {
    const avanco = avancoEmUmSeculo(yoshida4);
    expect(Math.abs(avanco), `avanco medido: ${avanco.toFixed(4)}"`).toBeLessThan(0.5);
  });

  // A forca depende de v. Avaliada com a v do comeco do kick, o passo fica
  // assimetrico e o erro cai so com dt (razao perto de 5 aqui); em Mercurio isso
  // virava milhoes de km por seculo contra a DE440s.
  it('com a correção, o integrador continua de quarta ordem', () => {
    const razao = razaoDeConvergencia(yoshida4Relativistico);
    expect(razao, `razao medida: ${razao.toFixed(2)} (yoshida4: ${razaoDeConvergencia(yoshida4).toFixed(2)})`)
      .toBeGreaterThan(10);
  });

  it('a correção não é o padrão', () => {
    expect(PADRAO).toBe(yoshida4);
  });
});
