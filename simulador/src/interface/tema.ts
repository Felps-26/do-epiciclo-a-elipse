/**
 * Paleta e papeis de cor, com o contraste conferido por codigo.
 *
 * As cores tem nome de papel e nao de aparencia, entao trocar a paleta inteira e
 * mexer so aqui. A WCAG 2.2 pede 4,5:1 entre texto e fundo e 3:1 para elemento
 * grafico, e `testes/contraste.test.ts` percorre todos os pares que a interface usa e
 * falha o build em qualquer um abaixo do limite.
 *
 * Regra que saiu dessa conferencia: cor de planeta nao e cor de texto. Medido nesta
 * paleta (o comentario herdado do projeto em Python dizia "Marte (4,5:1) e Netuno
 * (4,3:1)", impreciso):
 *
 *     Netuno    4,4997:1   reprova como texto, por pouco
 *     Marte     4,74:1     passaria
 *     os outros 6,8 a 12,4:1
 *
 * Hoje so Netuno reprova, mas a regra vale para todos: uma excecao por corpo seria
 * armadilha, porque bastaria acrescentar uma lua de cor clara para alguem escrever o
 * nome na cor do corpo e passar no teste, ate a paleta mudar. O nome do corpo vai
 * sempre em `texto` (16:1), ao lado de um ponto na cor dele, o que de quebra evita
 * transmitir informacao so por cor: ha o ponto, o nome escrito e a posicao.
 *
 * Em 3D a regra ganha alcance: o disco passa a usar textura, e a cor do corpo migra
 * inteira para as linhas de orbita, as fitas de trilha, o ponto ao lado do nome, os
 * itens da lista e os distintivos A e B.
 */
import { compor, BRANCO, PRETO } from './contraste.ts';
import {
  COR_DOS_CORPOS,
  NUNCA_COMO_TEXTO,
  corDaOrbita,
  corDaTrilha,
  corDoCorpo,
  type Cor,
} from '../dados/cores.ts';

// As cores dos CORPOS moram em `dados/cores.ts`: a cena precisa delas para as
// fitas de orbita, e `cena -> interface` e proibido. Reexportadas aqui para
// quem ja as importava do tema — inclusive o teste de contraste.
export { COR_DOS_CORPOS, NUNCA_COMO_TEXTO, corDaOrbita, corDaTrilha, corDoCorpo };

export const TEMA = {
  // -- superficies ----------------------------------------------------------
  fundo: [12, 14, 22] as Cor, // o espaco
  painel: [18, 21, 32] as Cor, // barras e paineis
  painelAlto: [26, 30, 44] as Cor, // cartoes sobre painel, campos, hover
  sobreposicao: [6, 8, 14] as Cor, // escurecimento atras de um modal

  // -- texto ----------------------------------------------------------------
  texto: [232, 234, 240] as Cor, // 16,0:1 no fundo
  textoFraco: [152, 159, 178] as Cor, // 7,3:1
  textoApagado: [120, 140, 180] as Cor, // 5,7:1, so para rotulo secundario

  // -- linhas ---------------------------------------------------------------
  borda: [58, 66, 88] as Cor, // decorativa; nao carrega informacao
  separador: [120, 140, 180] as Cor, // quando a linha significa alguma coisa
  grade: [40, 46, 64] as Cor, // aneis de distancia no fundo

  // -- estados --------------------------------------------------------------
  acento: [124, 174, 255] as Cor, // 8,6:1, selecao e controle ativo
  foco: [140, 190, 255] as Cor, // 10,0:1, anel de foco do teclado
  aviso: [255, 196, 92] as Cor, // 12,2:1, "nao esta acompanhando"
  sucesso: [120, 214, 160] as Cor, // 10,9:1
  /**
   * Fundo da caixa marcada do alternador: `acento` a 18% sobre `painel`. Vai como cor
   * fixa e nao como `color-mix` no CSS porque `contraste.test.ts` le hexadecimais
   * daqui, e uma cor calculada pelo navegador escaparia da conferencia.
   */
  marcaLigada: [37, 49, 71] as Cor,
} as const;

/**
 * Opacidade da placa atras dos rotulos que flutuam sobre a cena.
 *
 * Medido: o minimo real e 0,63. Abaixo disso o texto reprova sobre fundo branco, o
 * pior caso (o Sol centrado com bloom no maximo): 0,60 da 4,23:1, 0,62 da 4,4999:1 e
 * so 0,63 chega a 4,69:1. O 0,667 do projeto em pygame ja passava, com 5,37:1. O 0,80
 * entra por margem, nao por necessidade: 8,85:1 sobre branco e 16,32:1 sobre preto.
 *
 * O que nenhum alfa resolveria: a interface e composta depois do tonemapping. Antes
 * dele o valor da cena e HDR e chega a 25,0.
 */
export const ALFA_DA_PLACA = 0.8;

export interface ParDeContraste {
  nome: string;
  frente: Cor;
  atras: Cor;
  minimo: number;
}

/**
 * Os pares (frente, fundo) que a interface usa de verdade, com o limite exigido.
 * Quem acrescentar cor nova acrescenta aqui tambem, senao a conferencia nao cobre.
 */
export const PARES_PARA_CONFERIR: ParDeContraste[] = [
  { nome: 'texto sobre fundo', frente: TEMA.texto, atras: TEMA.fundo, minimo: 4.5 },
  { nome: 'texto sobre painel', frente: TEMA.texto, atras: TEMA.painel, minimo: 4.5 },
  { nome: 'texto sobre painel alto', frente: TEMA.texto, atras: TEMA.painelAlto, minimo: 4.5 },
  { nome: 'texto fraco sobre fundo', frente: TEMA.textoFraco, atras: TEMA.fundo, minimo: 4.5 },
  { nome: 'texto fraco sobre painel', frente: TEMA.textoFraco, atras: TEMA.painel, minimo: 4.5 },
  { nome: 'texto fraco sobre painel alto', frente: TEMA.textoFraco, atras: TEMA.painelAlto, minimo: 4.5 },
  { nome: 'texto apagado sobre fundo', frente: TEMA.textoApagado, atras: TEMA.fundo, minimo: 4.5 },
  { nome: 'texto apagado sobre painel', frente: TEMA.textoApagado, atras: TEMA.painel, minimo: 4.5 },
  // Novo par: as marcas "A"/"B" e os titulos da ficha ficam sobre painel alto,
  // porque o item escolhido da lista e a ficha inteira usam esse fundo.
  { nome: 'texto apagado sobre painel alto', frente: TEMA.textoApagado, atras: TEMA.painelAlto, minimo: 4.5 },
  { nome: 'acento sobre fundo', frente: TEMA.acento, atras: TEMA.fundo, minimo: 4.5 },
  { nome: 'acento sobre painel', frente: TEMA.acento, atras: TEMA.painel, minimo: 4.5 },
  { nome: 'acento sobre painel alto', frente: TEMA.acento, atras: TEMA.painelAlto, minimo: 4.5 },
  { nome: 'aviso sobre fundo', frente: TEMA.aviso, atras: TEMA.fundo, minimo: 4.5 },
  { nome: 'aviso sobre painel', frente: TEMA.aviso, atras: TEMA.painel, minimo: 4.5 },
  { nome: 'sucesso sobre painel', frente: TEMA.sucesso, atras: TEMA.painel, minimo: 4.5 },
  { nome: 'anel de foco sobre fundo', frente: TEMA.foco, atras: TEMA.fundo, minimo: 3 },
  { nome: 'anel de foco sobre painel', frente: TEMA.foco, atras: TEMA.painel, minimo: 3 },
  { nome: 'anel de foco sobre painel alto', frente: TEMA.foco, atras: TEMA.painelAlto, minimo: 3 },
  { nome: 'separador sobre painel', frente: TEMA.separador, atras: TEMA.painel, minimo: 3 },

  // Os tres pares que o desenho novo dos controles de marcacao criou. O "✓" e
  // um caractere e vai medido como texto (4,5), e nao como grafico (3): ele e
  // a forma que carrega o estado para quem nao distingue as duas cores.
  { nome: 'o ✓ sobre a caixa marcada', frente: TEMA.acento, atras: TEMA.marcaLigada, minimo: 4.5 },
  { nome: 'texto fraco sobre o trilho do segmentado', frente: TEMA.textoFraco, atras: TEMA.grade, minimo: 4.5 },
  { nome: 'texto sobre o trilho do segmentado', frente: TEMA.texto, atras: TEMA.grade, minimo: 4.5 },

  // Os dois casos que so existem em 3D: o rotulo sobre a placa translucida,
  // com a cena mais clara e a mais escura possiveis atras dela.
  {
    nome: 'rotulo sobre placa, com cena BRANCA atras',
    frente: TEMA.texto,
    atras: compor(TEMA.fundo, ALFA_DA_PLACA, BRANCO),
    minimo: 4.5,
  },
  {
    nome: 'rotulo sobre placa, com cena PRETA atras',
    frente: TEMA.texto,
    atras: compor(TEMA.fundo, ALFA_DA_PLACA, PRETO),
    minimo: 4.5,
  },
  ...Object.entries(COR_DOS_CORPOS).map(([k, c]) => ({
    nome: `disco de ${k} sobre fundo`,
    frente: c,
    atras: TEMA.fundo,
    minimo: 3,
  })),
  ...Object.entries(COR_DOS_CORPOS).map(([k, c]) => ({
    nome: `ponto de ${k} sobre painel`,
    frente: c,
    atras: TEMA.painel,
    minimo: 3,
  })),
];

