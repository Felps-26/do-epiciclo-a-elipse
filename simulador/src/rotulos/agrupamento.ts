/**
 * Na visao geral, Mercurio, Venus, a Terra e Marte cabem em poucos pixels em volta
 * do Sol, e quatro placas desempilhadas viram uma coluna sem dono. Enquanto
 * estiverem colados, eles ganham um nome so, "Planetas internos", fora da orbita de
 * Marte desenhada. Aproximando, eles se separam e cada um volta a ter o seu.
 */
import type { Candidato } from './posicionador.ts';

export const CHAVE_DOS_INTERNOS = 'internos';
const INTERNOS = ['mercurio', 'venus', 'terra', 'marte'] as const;
/** Abaixo disto, da orbita de Marte ao Sol na tela, os quatro viram um grupo. */
const SEPARACAO_MINIMA_PX = 48;

export function agruparInternos(candidatos: readonly Candidato[]): Candidato[] {
  const sol = candidatos.find((c) => c.chave === 'sol');
  const internos = INTERNOS.map((k) => candidatos.find((c) => c.chave === k));
  if (!sol || internos.some((c) => !c)) return [...candidatos];
  const presentes = internos as Candidato[];
  // Um interno escolhido, comparado ou acompanhado e o assunto: nao pode sumir no grupo.
  if (presentes.some((c) => c.papel !== null || c.nuncaAbreviar)) return [...candidatos];

  const maior = Math.max(...presentes.map((c) => Math.hypot(c.x - sol.x, c.y - sol.y)));
  if (maior >= SEPARACAO_MINIMA_PX) return [...candidatos];

  const grupo: Candidato = {
    chave: CHAVE_DOS_INTERNOS,
    nome: 'Planetas internos',
    abreviacao: 'Internos',
    x: sol.x,
    y: sol.y,
    raioPx: Math.max(maior + 4, 14),
    prioridade: Math.max(...presentes.map((c) => c.prioridade)),
    ocluido: false,
    nuncaAbreviar: false,
    papel: null,
  };
  return [...candidatos.filter((c) => !(INTERNOS as readonly string[]).includes(c.chave)), grupo];
}
