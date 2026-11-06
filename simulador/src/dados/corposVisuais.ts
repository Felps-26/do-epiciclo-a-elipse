/**
 * O que um corpo parece: eixo, rotacao, aneis, cor e mapas.
 *
 * Separado de `carregar.ts` porque aquele traz o que a fisica usa (GM, posicao,
 * velocidade) e este o que so o desenho usa, a mesma fronteira que o projeto em
 * pygame mantinha entre `fisica/corpo.py` e `ui/tema.py`, ligadas pela `chave`.
 *
 * Rotacao: IAU WGCCRE 2015 (Archinal et al., Celestial Mechanics and Dynamical
 * Astronomy 130:22, 2018, https://doi.org/10.1007/s10569-017-9805-5). Transcrita a
 * mao, com citacao por valor, e nao raspada do `OBJ_DATA` do Horizons, cujo texto
 * livre muda de formato de corpo para corpo. O gerador de efemerides continua lendo
 * o `OBJ_DATA`, como conferencia cruzada.
 *
 * Os termos seculares foram omitidos: o polo de Marte anda −0,109° por seculo
 * juliano, varias ordens abaixo do que se ve. A taxa de rotacao `W_ponto` fica,
 * porque e ela que faz o planeta girar.
 *
 * Tres corpos sao excecao, e os tres quase passaram errados:
 *
 *   - Lua. Sem os termos periodicos o eixo saia a 0,02° do norte da ecliptica; o
 *     valor certo e 1,54°. O termo `E1` e a propria obliquidade: a IAU escreve
 *     `delta_0 = 66,5392 + 1,5419 cos E1`, e 1,5419 e o angulo de Cassini inteiro.
 *   - Marte. A IAU 2015 publica `delta_0 = 54,432516` com um termo de amplitude
 *     1,591274°, que em J2000 vale `1,591274 cos(166,32572°) = −1,546` e devolve os
 *     52,886° das tabelas. So a constante deixava o eixo 1,55° fora do lugar.
 *   - Netuno, com 0,70° em RA e 0,51° em declinacao.
 *
 * Marte e Netuno foram achados pela conferencia cruzada de `orientacao.test.ts`, que
 * compara a obliquidade derivada de (RA, Dec) com a obliquidade escrita na mesma
 * linha deste arquivo; 1,5° nao se ve no desenho.
 *
 * Referencial. `alpha_0` e `delta_0` estao no frame equatorial ICRF e a simulacao
 * roda na ecliptica J2000 (`REF_PLANE=ECLIPTIC`, em `gerar_efemeride.py`). A
 * orientacao e a matriz inteira:
 *
 *     M = Rx(−eps) · Rz(alpha_0 + 90°) · Rx(90° − delta_0) · Rz(W)
 *
 * com `eps = 23,4392911°`. Rodar so o polo deixa o meridiano zero, e portanto a
 * textura, girado; esquecer o `Rx(−eps)` inclina os eixos 23° a mais.
 *
 * Aneis: raios em km do NSSDCA (ficha de Saturno), que nao existem no Horizons,
 * convertidos para raios equatoriais (R = 60.268 km) na hora de desenhar.
 */
import manifesto from './texturas.json';
// O JSON cru, e nao `dados/luas.ts`: aquele modulo importa ESTE para a cor e o
// nome, e um ciclo reprovaria em `sem-ciclos` do dependency-cruiser.
import luasBrutas from './luas.json';
import {
  BASE_DA_ECLIPTICA,
  baseDoPlano,
  eixoDeRotacaoSincrona,
  meridianoQueEncaraOPai,
} from '../nucleo/planoDeReferencia.ts';
import { posicaoDaLua } from '../nucleo/luas.ts';
import type { ElementosDeLua } from '../contratos/lua.ts';

interface LuaBruta {
  chave: string;
  plano: string;
  raioMedioKm: number;
  noGraus: number;
  inclinacaoGraus: number;
  taxaSideralMedidaGrausDia: number;
  poloUsado: { ra: number; dec: number };
}

const LUAS_BRUTAS = luasBrutas.luas as unknown as readonly LuaBruta[];

export type Procedencia = 'imagem' | 'derivado' | 'calculado' | 'artistico' | 'decorativo';

export interface MapaDeTextura {
  corpo: string;
  papel: string;
  niveis: Record<string, string>;
  /** OBRIGATORIO. Aparece no bloco de fontes, e um teste confere que aparece. */
  procedencia: Procedencia;
  nota?: string;
  fonte: string;
  url: string;
  licenca: string;
}

export const TEXTURAS = manifesto.mapas as MapaDeTextura[];
export const CREDITO_DAS_TEXTURAS = manifesto.credito_obrigatorio;

export function mapaDe(corpo: string, papel: string): MapaDeTextura | undefined {
  return TEXTURAS.find((m) => m.corpo === corpo && m.papel === papel);
}

export interface Rotacao {
  /** Ascensao reta do polo norte, graus, no frame equatorial ICRF. */
  poloRa: number;
  /** Declinacao do polo norte, graus, no frame equatorial ICRF. */
  poloDec: number;
  /** Meridiano zero na epoca J2000, graus. */
  w0: number;
  /** Graus por dia. Negativo em corpo retrogrado. */
  wPorDia: number;
  /** Obliquidade em relacao a propria orbita, graus. So para mostrar na ficha. */
  obliquidadeGraus: number;
  /**
   * Termos periodicos de E1, que so a Lua tem em magnitude relevante.
   * `E1 = 125,045° − 0,0529921°/dia`, com os coeficientes da IAU. Sem eles o eixo da
   * Lua fica 1,5° errado, ou seja, inteiramente errado.
   */
  e1?: { ra: number; dec: number; w: number };
  /**
   * Termos trigonometricos com argumento proprio, em seculos julianos. Convencao da
   * IAU, a mesma do SPICE:
   *
   *     alpha = alpha_0 + SOMA a_i sen(theta_i)
   *     delta = delta_0 + SOMA d_i cos(theta_i)
   *     W     = W_0     + SOMA w_i sen(theta_i)
   *
   * com `theta_i = a0_i + porSeculo_i * T`.
   *
   * Existem porque a armadilha da Lua pegou Marte (ver o cabecalho): a constante
   * sozinha deixava o eixo 1,55° fora do lugar, e a obliquidade contra a orbita dava
   * 23,92° em vez dos 25,19° da ficha da NASA. A discordancia entre os dois numeros do
   * mesmo corpo denunciou o erro. Os termos minusculos da serie (10^-5 grau) seguem de
   * fora.
   */
  periodicos?: readonly { a0: number; porSeculo: number; ra?: number; dec?: number; w?: number }[];
}

export interface FaixaDeAnel {
  nome: string;
  rInternoKm: number;
  rExternoKm: number;
  /** Profundidade optica normal tipica. Usada quando nao ha textura de alfa. */
  profundidadeOptica: number;
}

/**
 * O halo de atmosfera no limbo.
 *
 * E um modelo aproximado, nao transferencia radiativa: calcula o caminho optico
 * atraves de uma casca de espessura `alturaKm`, mais forte na borda do disco (onde a
 * linha de visada atravessa mais ar) e so no lado iluminado. Reproduz o arco azul da
 * Terra, o limbo laranja de Titan e a bruma de Venus. Nao calcula espalhamento
 * multiplo, dependencia de comprimento de onda nem a cor do ceu visto de dentro.
 *
 * `alturaKm` e a altura de escala, da ficha da NASA (onde a pressao cai por um fator
 * `e`). A `cor` vem da cor dominante do limbo em imagens publicadas, nao de um
 * espectro. Por isso esta em "o que a tela simplifica", e `honestidade.test.ts`
 * reprova se sair de la.
 */
export interface Atmosfera {
  /** Altura de escala, em km. Define a espessura da casca desenhada. */
  alturaKm: number;
  /** Cor do halo, linear. Ver a nota sobre procedencia acima. */
  cor: readonly [number, number, number];
  /** Quao opaca a casca fica no limbo, de 0 a 1. Medida no olho, nao no espectro. */
  densidade: number;
}

export interface CorpoVisual {
  chave: string;
  /** Raio equatorial, km. O raio da efemeride e o medio volumetrico. */
  raioEquatorialKm: number;
  /** Achatamento (a−b)/a. Saturno tem 9,8%: da para ver. */
  achatamento: number;
  rotacao: Rotacao;
  /** O halo no limbo. Ausente em corpo sem atmosfera perceptivel. */
  atmosfera?: Atmosfera;
  aneis?: FaixaDeAnel[];
  /** Albedo geometrico, da NASA Planetary Fact Sheet. Modula quanto o corpo reflete. */
  albedoGeometrico: number;
}

export const CORPOS_VISUAIS: Record<string, CorpoVisual> = {
  sol: {
    chave: 'sol',
    raioEquatorialKm: 695700,
    achatamento: 0,
    rotacao: { poloRa: 286.13, poloDec: 63.87, w0: 84.176, wPorDia: 14.1844, obliquidadeGraus: 7.25 },
    albedoGeometrico: 1,
  },
  mercurio: {
    chave: 'mercurio',
    raioEquatorialKm: 2440.53,
    achatamento: 0.0009,
    rotacao: { poloRa: 281.0103, poloDec: 61.4155, w0: 329.5988, wPorDia: 6.1385108, obliquidadeGraus: 0.034 },
    albedoGeometrico: 0.142,
  },
  venus: {
    // A atmosfera de Venus E o que se ve: a superficie nunca aparece. Altura de
    // escala 15,9 km, e a cor amarelo-palida do topo das nuvens de acido
    // sulfurico.
    atmosfera: { alturaKm: 15.9, cor: [1.0, 0.88, 0.62], densidade: 0.95 },
    chave: 'venus',
    raioEquatorialKm: 6051.8,
    achatamento: 0,
    // RETROGRADO: gira ao contrario de todos os outros, e devagar — um dia de
    // Venus dura 243 dias terrestres. O programa antigo so ESCREVIA isso; aqui
    // fica visivel.
    rotacao: { poloRa: 272.76, poloDec: 67.16, w0: 160.2, wPorDia: -1.4813688, obliquidadeGraus: 177.36 },
    albedoGeometrico: 0.689,
  },
  terra: {
    // Altura de escala 8,5 km. O azul e o do espalhamento Rayleigh, que e a
    // razao de o ceu ser azul e de o limbo aparecer como um arco fino.
    atmosfera: { alturaKm: 8.5, cor: [0.33, 0.52, 1.0], densidade: 0.55 },
    chave: 'terra',
    raioEquatorialKm: 6378.137,
    achatamento: 0.0033528,
    rotacao: { poloRa: 0, poloDec: 90, w0: 190.147, wPorDia: 360.9856235, obliquidadeGraus: 23.44 },
    albedoGeometrico: 0.434,
  },
  marte: {
    // Altura de escala 11,1 km — maior que a da Terra, apesar de a atmosfera ser
    // cem vezes mais rarefeita, porque a gravidade e menor. A cor e a da poeira
    // suspensa.
    atmosfera: { alturaKm: 11.1, cor: [0.85, 0.62, 0.45], densidade: 0.3 },
    chave: 'marte',
    raioEquatorialKm: 3396.19,
    achatamento: 0.00589,
    // Os tres termos grandes da serie da IAU 2015. Sem eles o eixo sai 1,55° torto; ver
    // `periodicos` em `Rotacao`. Os argumentos sao os angulos 15, 20 e 26 do sistema de
    // Marte (`BODY4_NUT_PREC_ANGLES`), todos com a taxa de 0,5042615°/seculo, a
    // precessao do eixo, de ~71.400 anos.
    rotacao: {
      poloRa: 317.269202,
      poloDec: 54.432516,
      w0: 176.049863,
      wPorDia: 350.891982443297,
      obliquidadeGraus: 25.19,
      periodicos: [
        { a0: 79.398797, porSeculo: 0.5042615, ra: 0.419057 },
        { a0: 166.325722, porSeculo: 0.5042615, dec: 1.591274 },
        { a0: 95.391654, porSeculo: 0.5042615, w: 0.584542 },
      ],
    },
    albedoGeometrico: 0.17,
  },
  jupiter: {
    // Num gigante gasoso nao ha superficie: a casca desenhada e a bruma acima do
    // nivel de 1 bar, que e onde a tabela mede tudo.
    atmosfera: { alturaKm: 27, cor: [0.95, 0.85, 0.72], densidade: 0.4 },
    chave: 'jupiter',
    raioEquatorialKm: 71492,
    achatamento: 0.06487,
    // Sistema III, que e a rotacao do campo magnetico — a unica definicao util
    // para um corpo sem superficie, onde cada latitude gira numa velocidade.
    rotacao: { poloRa: 268.056595, poloDec: 64.495303, w0: 284.95, wPorDia: 870.536, obliquidadeGraus: 3.13 },
    aneis: [
      { nome: 'halo', rInternoKm: 92000, rExternoKm: 122500, profundidadeOptica: 1e-6 },
      { nome: 'principal', rInternoKm: 122500, rExternoKm: 129000, profundidadeOptica: 5e-6 },
      { nome: 'gossamer', rInternoKm: 129000, rExternoKm: 222000, profundidadeOptica: 1e-7 },
    ],
    albedoGeometrico: 0.538,
  },
  saturno: {
    // Altura de escala 59,5 km, a maior dos oito.
    atmosfera: { alturaKm: 59.5, cor: [0.95, 0.88, 0.7], densidade: 0.35 },
    chave: 'saturno',
    raioEquatorialKm: 60268,
    achatamento: 0.09796,
    rotacao: { poloRa: 40.589, poloDec: 83.537, w0: 38.9, wPorDia: 810.7939024, obliquidadeGraus: 26.73 },
    aneis: [
      { nome: 'D', rInternoKm: 66900, rExternoKm: 74510, profundidadeOptica: 0.01 },
      { nome: 'C', rInternoKm: 74658, rExternoKm: 92000, profundidadeOptica: 0.1 },
      { nome: 'B', rInternoKm: 92000, rExternoKm: 117580, profundidadeOptica: 1.5 },
      { nome: 'Divisão de Cassini', rInternoKm: 117580, rExternoKm: 122170, profundidadeOptica: 0.08 },
      { nome: 'A', rInternoKm: 122170, rExternoKm: 136775, profundidadeOptica: 0.6 },
      { nome: 'F', rInternoKm: 140180, rExternoKm: 140680, profundidadeOptica: 0.1 },
    ],
    albedoGeometrico: 0.499,
  },
  urano: {
    // O metano absorve o vermelho, e e isso que deixa o limbo esverdeado.
    atmosfera: { alturaKm: 27.7, cor: [0.6, 0.88, 0.92], densidade: 0.45 },
    chave: 'urano',
    raioEquatorialKm: 25559,
    achatamento: 0.02293,
    // DEITADO: obliquidade de 97,8°, entao ele rola pela orbita em vez de
    // girar como um piao. E retrogrado pela convencao da IAU, que define o
    // norte pelo lado do polo, e nao pelo sentido do giro.
    rotacao: { poloRa: 257.311, poloDec: -15.175, w0: 203.81, wPorDia: -501.1600928, obliquidadeGraus: 97.77 },
    aneis: [
      { nome: 'internos', rInternoKm: 41837, rExternoKm: 50024, profundidadeOptica: 0.3 },
      { nome: 'épsilon', rInternoKm: 51149, rExternoKm: 51249, profundidadeOptica: 1.5 },
    ],
    albedoGeometrico: 0.488,
  },
  netuno: {
    // Mesma quimica de Urano, com mais metano — daí o azul mais fundo.
    atmosfera: { alturaKm: 19.7, cor: [0.42, 0.62, 0.95], densidade: 0.45 },
    chave: 'netuno',
    raioEquatorialKm: 24764,
    achatamento: 0.01708,
    // O termo de N entrou. Tinha sido omitido por valer menos de 1°, mas vale 0,70° em
    // RA e 0,51° em declinacao, o bastante para a obliquidade derivada dar 27,85° contra
    // os 28,32° da tabela. `N = 357,85° + 52,316°/seculo`, o angulo 1 do sistema de
    // Netuno.
    rotacao: {
      poloRa: 299.36,
      poloDec: 43.46,
      w0: 253.18,
      wPorDia: 536.3128492,
      obliquidadeGraus: 28.32,
      periodicos: [{ a0: 357.85, porSeculo: 52.316, ra: 0.7, dec: -0.51, w: -0.48 }],
    },
    aneis: [
      { nome: 'Galle a Adams', rInternoKm: 41900, rExternoKm: 62933, profundidadeOptica: 0.01 },
    ],
    albedoGeometrico: 0.442,
  },
  lua: {
    chave: 'lua',
    raioEquatorialKm: 1738.1,
    achatamento: 0.0012,
    rotacao: {
      poloRa: 269.9949,
      poloDec: 66.5392,
      w0: 38.3213,
      wPorDia: 13.17635815,
      obliquidadeGraus: 6.68,
      // O 1,5419 aqui e o angulo de Cassini inteiro, e nao uma correcao.
      e1: { ra: -3.8787, dec: 1.5419, w: 3.561 },
    },
    albedoGeometrico: 0.136,
  },
};

/**
 * As doze luas sem ficha propria, derivadas de `luas.json`.
 *
 * Antes, `corpos/fabrica.ts` fazia `CORPOS_VISUAIS[chave] ?? CORPOS_VISUAIS['terra']`,
 * e das treze luas so a nossa tinha entrada: Io, Europa, Ganimedes, Calisto,
 * Encelado, Tita, Fobos, Deimos, Titania, Oberon, Miranda e Tritao eram desenhadas
 * com a rotacao, a obliquidade, o achatamento e o albedo da Terra. A tres pixels
 * ninguem via, e ficaria visivel ao chegar perto.
 *
 * Nada aqui e escrito a mao. Sao corpos travados por mare: o periodo de rotacao e o
 * orbital, e o eixo e o polo do plano da orbita. Os dois estao em `luas.json`,
 * medidos contra o Horizons por `ferramentas/gerar_luas.mjs`, com o erro de cada
 * alternativa. Transcrever de novo criaria uma segunda copia para divergir da
 * primeira.
 *
 * `w0 = 0` e uma simplificacao declarada: o meridiano zero da maioria destas luas
 * nao esta publicado, entao a longitude desenhada e arbitraria. O eixo e o periodo
 * sao medidos. Isso esta em "o que a tela simplifica" e na ficha de cada lua.
 */
function visuaisDasLuas(): Record<string, CorpoVisual> {
  const saida: Record<string, CorpoVisual> = {};
  const r: [number, number, number] = [0, 0, 0];

  for (const l of LUAS_BRUTAS) {
    // A nossa Lua tem ficha propria, com os termos de E1 que valem a
    // obliquidade inteira dela. Derivar por cima seria perde-los.
    if (l.chave === 'lua') continue;

    const base =
      l.plano === 'ecliptic' ? BASE_DA_ECLIPTICA : baseDoPlano(l.poloUsado.ra, l.poloUsado.dec);

    // O eixo: a normal da ORBITA. Ver `eixoDeRotacaoSincrona` — nao e o polo do
    // planeta, e em Tritao os dois sao quase opostos.
    const eixo = eixoDeRotacaoSincrona(base, l.noGraus, l.inclinacaoGraus);

    // O meridiano zero que encara o planeta na epoca. `posicaoDaLua` devolve a
    // lua RELATIVA ao planeta, entao a direcao para o planeta e o oposto dela.
    posicaoDaLua(l as unknown as ElementosDeLua, base, 0, r);
    const d = Math.hypot(r[0], r[1], r[2]);
    const paraOPai: [number, number, number] = [-r[0] / d, -r[1] / d, -r[2] / d];

    saida[l.chave] = {
      chave: l.chave,
      raioEquatorialKm: l.raioMedioKm,
      // Achatamento zero significa "nao sabemos", e nao "e uma esfera
      // perfeita" — que em Fobos seria falso com folga. Desenhar um
      // achatamento inventado seria pior que nao desenhar.
      achatamento: 0,
      rotacao: {
        poloRa: eixo.ra,
        poloDec: eixo.dec,
        w0: meridianoQueEncaraOPai(eixo.ra, eixo.dec, paraOPai),
        // Positiva por construcao: a normal da orbita e destra com o movimento.
        wPorDia: l.taxaSideralMedidaGrausDia,
        // Zero contra a PROPRIA orbita, que e o que obliquidade quer dizer.
        obliquidadeGraus: 0,
      },
      albedoGeometrico: ALBEDO_DAS_LUAS[l.chave] ?? 0.2,
    };
  }
  return saida;
}

/**
 * Albedo geometrico, das fichas do NSSDCA/JPL, consultado em 21/09/2026. Fica
 * separado porque e a unica coisa destas luas que nao esta em `luas.json`, que
 * descreve a orbita e nao a superficie. So alimenta o brilho difuso.
 *
 * O de Encelado passa de 1 e nao e erro: o albedo geometrico pode exceder a unidade
 * em um corpo que espalha de volta na direcao da fonte, e o gelo fresco dos jatos do
 * polo sul faz isso. E a superficie mais reflexiva do Sistema Solar.
 */
const ALBEDO_DAS_LUAS: Record<string, number> = {
  fobos: 0.071,
  deimos: 0.068,
  io: 0.63,
  europa: 0.67,
  ganimedes: 0.43,
  calisto: 0.17,
  encelado: 1.38,
  tita: 0.22,
  titania: 0.35,
  oberon: 0.31,
  miranda: 0.32,
  tritao: 0.76,
};

/**
 * Ficha de quem nao tem ficha: os corpos criados no sandbox.
 *
 * Neutra, e nao a da Terra. O padrao anterior, `CORPOS_VISUAIS[chave] ??
 * CORPOS_VISUAIS['terra']`, dava a um asteroide inventado a rotacao, a obliquidade,
 * o achatamento e a atmosfera da Terra: uma pedra criada no sandbox saia com halo
 * azul de Rayleigh no limbo.
 *
 * Aqui ela nao gira. O programa nao sabe o periodo de rotacao de uma coisa que a
 * pessoa acabou de inventar, e girar uma vez por dia sideral com eixo a 23,44° seria
 * afirmar algo falso.
 */
export const CORPO_GENERICO: CorpoVisual = {
  chave: 'generico',
  raioEquatorialKm: 1,
  achatamento: 0,
  rotacao: { poloRa: 0, poloDec: 90, w0: 0, wPorDia: 0, obliquidadeGraus: 0 },
  albedoGeometrico: 0.1,
};

Object.assign(CORPOS_VISUAIS, visuaisDasLuas());

/** Obliquidade da ecliptica em J2000, graus. Leva o ICRF equatorial para a eclíptica. */
export const OBLIQUIDADE_DA_ECLIPTICA = 23.4392911;

/** Raio equatorial de Saturno, para converter os raios dos anéis. */
export const raioEquatorialUa = (chave: string): number =>
  (CORPOS_VISUAIS[chave]?.raioEquatorialKm ?? 1) / 149597870.7;
