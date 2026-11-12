/**
 * Nomes que ficam longe do corpo (V1, B2), o grupo dos planetas internos, e os
 * achados da ancoragem por quadro: o raio que cresce durante o voo (#26, #31),
 * as placas derrubadas pelo teto (#28) e o teto com foco pleno (#37).
 */
import { describe, expect, it } from 'vitest';
import {
  LIMIAR_DA_LIGACAO_PX,
  criarMemoriaDoDesvio,
  escrever,
  posicoesSuavizadas,
  segmentoDeLigacao,
} from '@rotulos/ancoragem.ts';
import { agruparInternos, CHAVE_DOS_INTERNOS } from '@rotulos/agrupamento.ts';
import type { Candidato, RotuloColocado } from '@rotulos/posicionador.ts';
import { tetoComDiscos } from '@cena/escala/foco.ts';

const rotulo = (chave: string, extra: Partial<RotuloColocado> = {}): RotuloColocado => ({
  chave,
  texto: chave,
  forma: 'inteiro',
  papel: null,
  raioPx: 10,
  centroX: 100,
  centroY: 100,
  x: 116,
  y: 93,
  largura: 60,
  altura: 14,
  ocluido: false,
  direcao: [1, 0],
  ...extra,
});

describe('linha de ligação', () => {
  it('perto do corpo, sem linha', () => {
    expect(segmentoDeLigacao(100, 100, 10, { x: 116, y: 93, largura: 60, altura: 14 })).toBeNull();
  });

  it(`mais de ${LIMIAR_DA_LIGACAO_PX} px longe, a linha vai da borda do disco à placa`, () => {
    const s = segmentoDeLigacao(100, 100, 10, { x: 100, y: 40, largura: 60, altura: 14 })!;
    expect(s).not.toBeNull();
    // A placa está acima: a linha sai do topo do disco e chega na base da placa.
    expect(s.x1).toBeCloseTo(100, 9);
    expect(s.y1).toBeCloseTo(90, 9);
    expect(s.x2).toBeCloseTo(100, 9);
    expect(s.y2).toBeCloseTo(54, 9);
  });
});

describe('grupo dos planetas internos', () => {
  const c = (chave: string, x: number, extra: Partial<Candidato> = {}): Candidato => ({
    chave,
    nome: chave,
    abreviacao: chave,
    x,
    y: 300,
    raioPx: 2,
    prioridade: 1,
    ocluido: false,
    nuncaAbreviar: false,
    papel: null,
    ...extra,
  });

  it('na visão geral, os quatro internos colados ao Sol viram um nome só', () => {
    const lista = [c('sol', 400), c('mercurio', 403), c('venus', 406), c('terra', 409), c('marte', 414), c('jupiter', 450)];
    const saida = agruparInternos(lista);
    expect(saida.map((x) => x.chave).sort()).toEqual([CHAVE_DOS_INTERNOS, 'jupiter', 'sol'].sort());
    const grupo = saida.find((x) => x.chave === CHAVE_DOS_INTERNOS)!;
    expect(grupo.nome).toBe('Planetas internos');
    // A placa fica fora da órbita de Marte desenhada, e não em cima do Sol.
    expect(grupo.raioPx).toBeGreaterThanOrEqual(14);
  });

  it('aproximando, eles se separam e cada um volta a ter nome', () => {
    const lista = [c('sol', 400), c('mercurio', 440), c('venus', 480), c('terra', 520), c('marte', 590)];
    expect(agruparInternos(lista).map((x) => x.chave)).not.toContain(CHAVE_DOS_INTERNOS);
  });

  it('um interno escolhido não some dentro do grupo', () => {
    const lista = [c('sol', 400), c('mercurio', 403), c('venus', 406), c('terra', 409, { papel: 'a' }), c('marte', 414)];
    expect(agruparInternos(lista).map((x) => x.chave)).not.toContain(CHAVE_DOS_INTERNOS);
  });
});

describe('ancoragem durante o voo', () => {
  it('o raio cresce e a placa fica na borda do disco, sem atraso (#26)', () => {
    const mem = criarMemoriaDoDesvio();
    let t = 0;
    for (let k = 0; k < 30; k++) {
      t += 1 / 60;
      const raio = 10 + 4 * k;
      // A colocação (30 Hz) só sabe do raio de dois quadros atrás.
      const colocado = rotulo('terra', { raioPx: raio - 8, x: 100 + raio - 8 + 6, direcao: [1, 0] });
      const p = posicoesSuavizadas([colocado], new Map([['terra', { x: 100, y: 100, raioPx: raio }]]), mem, 1 / 60, t);
      expect(p.get('terra')!.x, `quadro ${k}`).toBeCloseTo(100 + raio + 6, 6);
      expect(p.get('terra')!.raioPx).toBe(raio);
    }
  });
});

/** Nós de mentira, só com o que `escrever` usa. */
function camada(chaves: string[]) {
  const no = (attr: string, chave: string) => ({
    dataset: { [attr]: chave, raio: '20' } as Record<string, string>,
    style: { transform: '', visibility: '', width: '', height: '' } as Record<string, string>,
  });
  const rot = chaves.map((k) => no('rotulo', k));
  const anel = [no('anel', chaves[0]!)];
  const linha = chaves.map((k) => no('linha', k));
  const raiz = {
    querySelectorAll: (sel: string) => (sel === '[data-rotulo]' ? rot : sel === '[data-anel]' ? anel : linha),
  };
  return { raiz: raiz as unknown as HTMLElement, rot, anel, linha };
}

describe('escrever no quadro', () => {
  (globalThis as { MutationObserver?: unknown }).MutationObserver ??= class {
    observe(): void {}
  };

  it('uma placa derrubada pelo teto some no mesmo quadro (#28)', () => {
    const { raiz, rot } = camada(['terra', 'marte']);
    const pos = new Map([['terra', { x: 1, y: 2, centroX: 0, centroY: 0, raioPx: 4, largura: 30, altura: 14 }]]);
    escrever(raiz, pos);
    expect(rot[0]!.style['visibility']).toBe('');
    expect(rot[1]!.style['visibility']).toBe('hidden');
  });

  it('o anel acompanha o raio do quadro, e não o da última publicação (#31)', () => {
    const { raiz, anel } = camada(['terra']);
    escrever(raiz, new Map([['terra', { x: 0, y: 0, centroX: 200, centroY: 100, raioPx: 50, largura: 30, altura: 14 }]]));
    expect(anel[0]!.style['width']).toBe('116px');
    expect(anel[0]!.style['transform']).toBe('translate(142px, 42px)');
  });
});

describe('teto de rótulos com foco pleno (#37)', () => {
  it('discos grandes na tela continuam com nome', () => {
    expect(tetoComDiscos(1, 18, [200, 30, 25, 22, 18, 3, 1])).toBe(5);
    expect(tetoComDiscos(0, 18, [200, 30])).toBe(18);
    expect(tetoComDiscos(1, 18, [2, 1])).toBe(1);
  });
});
