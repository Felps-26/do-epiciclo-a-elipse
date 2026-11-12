/**
 * Quem posiciona as placas e a ancoragem, por quadro; o Preact so as cria.
 *
 * A arvore Preact e republicada a 8 Hz. Se ela trouxesse `transform` no `style`, cada
 * republicacao reescreveria a posicao com o calculo de ate 125 ms atras, por cima da
 * que `ancoragem.escrever` acabou de pôr, e a placa daria um tranco oito vezes por
 * segundo com a camera em movimento. Sem DOM, como `botoes.test.ts`: le-se a arvore.
 */
import { describe, expect, it } from 'vitest';
import type { VNode } from 'preact';
import { CamadaDeRotulos } from '@rotulos/camada.tsx';
import type { RotuloColocado } from '@rotulos/posicionador.ts';

type No = VNode<Record<string, unknown>>;

function nos(n: unknown, saida: No[] = []): No[] {
  if (Array.isArray(n)) {
    for (const f of n) nos(f, saida);
    return saida;
  }
  if (n === null || typeof n !== 'object') return saida;
  const v = n as No;
  if (!v.props) return saida;
  saida.push(v);
  nos(v.props['children'], saida);
  return saida;
}

const rotulo = (chave: string, extra: Partial<RotuloColocado> = {}): RotuloColocado => ({
  chave,
  texto: chave,
  forma: 'inteiro',
  papel: null,
  raioPx: 40,
  centroX: 300,
  centroY: 200,
  x: 350,
  y: 190,
  largura: 80,
  altura: 20,
  ocluido: false,
  ...extra,
});

const ROTULOS = [
  rotulo('marte', { papel: 'acompanhado' }),
  rotulo('venus'),
  rotulo('mercurio', { forma: 'ponto' }),
];

const posicionados = (): No[] =>
  nos(CamadaDeRotulos({ rotulos: ROTULOS })).filter(
    (n) => n.props['data-rotulo'] !== undefined || n.props['data-anel'] !== undefined,
  );

describe('a camada de rotulos', () => {
  it('o Preact não reescreve o transform das placas a cada republicação', () => {
    const alvos = posicionados();
    expect(alvos.length).toBe(4); // tres rotulos e o anel do acompanhado
    for (const n of alvos) {
      const estilo = (n.props['style'] ?? {}) as Record<string, unknown>;
      expect(estilo['transform'], `${String(n.props['data-rotulo'] ?? n.props['data-anel'])}`).toBeUndefined();
    }
  });

  it('uma placa nova nasce na posição calculada, e a ancoragem assume dali', () => {
    for (const n of posicionados()) {
      // O Preact tira `ref` das props e guarda no proprio no virtual.
      const ref = n.ref as unknown as ((no: { style: { transform: string } } | null) => void) | undefined;
      expect(typeof ref, 'sem ref a placa nasceria no canto da tela').toBe('function');
      const no = { style: { transform: '' } };
      ref!(no);
      expect(no.style.transform).toMatch(/^translate\(/);
      // Ja posicionada pela ancoragem: a republicacao seguinte nao mexe.
      no.style.transform = 'translate(1px, 2px)';
      ref!(no);
      ref!(null);
      expect(no.style.transform).toBe('translate(1px, 2px)');
    }
  });

  it('sem os nomes, o anel do corpo acompanhado continua (#40)', () => {
    const arvore = nos(CamadaDeRotulos({ rotulos: ROTULOS, comNomes: false }));
    expect(arvore.filter((n) => n.props['data-anel'] === 'marte').length).toBe(1);
    expect(arvore.filter((n) => n.props['data-rotulo'] !== undefined).length).toBe(0);
  });
});
