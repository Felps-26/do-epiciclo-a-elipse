/**
 * Retrato que a fisica publica a cada quadro, e que a cena e a interface leem.
 *
 * E o contrato que mantem as camadas separadas: a cena recebe um Instantaneo e
 * desenha, sem conhecer o simulador nem o reducer e sem como pedir que a fisica
 * ande.
 *
 * As posicoes vem em Float64 absoluto, em UA, e nao num buffer de render pronto.
 * Publicar Float32 ja relativo a camera economizaria uma subtracao, mas Float32
 * quantiza a 269 km a 30 UA e a 13 km a 1,5 UA, e Fobos (11 km de diametro) ficaria
 * menor que o quantum de posicao do proprio pai. A conversao para coordenada de
 * cena e feita em dupla precisao por `cena/origemFlutuante`.
 */
import type { IdCorpo } from './ids.ts';

export interface Instantaneo {
  /** Dias TDB desde a epoca, JA interpolado: `tDias + alfa * dt`. */
  tDias: number;
  /** Dia juliano correspondente, para virar data civil. */
  jd: number;
  /** (3N) UA, absolutas, na ordem do catalogo. */
  pos: Float64Array;
  /** (3N) UA/dia, do ultimo estado integrado. */
  vel: Float64Array;
  n: number;
  /** Verdadeiro quando o quadro nao entregou o tempo pedido. */
  atrasado: boolean;
  pausado: boolean;
  /** Indices do corpo criado e de quem ele passa perto, enquanto o passo esta encurtado. */
  encontro: { corpo: number; alvo: number } | null;
}

/**
 * O que a ficha de um corpo mostra, derivado do Instantaneo e nao guardado.
 *
 * E uma uniao e nao um objeto com campos opcionais, porque o Sol nao e um planeta
 * com dados faltando: ele nao tem distancia ao Sol, periodo nem elipse, e e a
 * propria referencia heliocentrica; mede-se o movimento dele em torno do centro de
 * massa. Com campos opcionais, a primeira versao produziu uma ficha do Sol dizendo
 * "uma volta leva cerca de 0 dias".
 *
 * As luas tem um terceiro tipo: nao orbitam o Sol, a distancia que importa e a do
 * planeta, e a posicao vem de um modelo aproximado cujo desvio a ficha precisa
 * mostrar.
 */
export type LeituraDeCorpo =
  | {
      chave: IdCorpo;
      nome: string;
      tipo: 'orbita';
      distanciaAoSolUa: number;
      velocidadeKmS: number;
      periodoDias: number;
      /** Falso quando a energia e >= 0: o corpo nao esta preso ao Sol. */
      ligada: boolean;
    }
  | {
      chave: IdCorpo;
      nome: string;
      tipo: 'lua';
      /** A chave do corpo que ela orbita. */
      pai: IdCorpo;
      nomeDoPai: string;
      /** Semieixo da orbita em torno do planeta, em km. */
      distanciaAoPlanetaKm: number;
      /** Volta em torno do planeta, em dias. */
      periodoDias: number;
      /** O desvio medido contra a efemeride do JPL, em km. Vai escrito. */
      desvioMedidoKm: number;
    }
  | {
      chave: IdCorpo;
      nome: string;
      tipo: 'referencial';
      /** Distancia ao centro de massa dos corpos simulados, em UA. */
      distanciaAoCentroUa: number;
      /** Velocidade em relacao ao centro de massa, em km/s. */
      velocidadeKmS: number;
    };

/**
 * Analise do Sol ja convertida para as unidades que aparecem escritas. Mora aqui e
 * nao em `nucleo/analiseSol.ts`, como `LeituraDeCorpo`, porque e o formato do que
 * atravessa a fronteira: o nucleo publica vetores em UA/dia² sem saber que existe
 * uma tabela ordenada por fracao do total, e a interface le esta estrutura sem saber
 * que existe `EstadoSistema`.
 */
export interface AnaliseDoSolNaTela {
  distanciaAoCentroKm: number;
  velocidadeKmS: number;
  /** Modulo da aceleracao resultante, em m/s^2. */
  aceleracaoMS2: number;
  /** Uma linha por sistema planetario, da maior puxada para a menor. */
  puxoes: { nome: string; aceleracaoMS2: number }[];
}

/**
 * O que a opcao "Mostrar dados técnicos" mostra.
 *
 * Existe porque o texto de ajuda da opcao prometia quatro coisas (passo de
 * integracao, energia, desempenho e qual placa esta desenhando) e a tela entregava
 * so a ultima.
 *
 * `desvioDeEnergia` e o numero que justifica o integrador: num integrador
 * simpletico ele oscila, num Euler ou num RK4 cresce sem voltar. Mostra-lo ao vivo
 * e a unica forma de "integrador simpletico" ser mais que uma palavra no README.
 */
export interface DadosTecnicos {
  /** Passo do integrador, em dias. */
  passoDias: number;
  /** Passos por segundo real, medidos no intervalo entre publicacoes. */
  passosPorSegundo: number;
  quadrosPorSegundo: number;
  msPorQuadro: number;
  /** |E(t) - E(0)| / |E(0)|. Adimensional. */
  desvioDeEnergia: number;
  /** |L(t) - L(0)| / |L(0)|. Conserva-se melhor ainda que a energia. */
  desvioDeMomentoAngular: number;
  corpos: number;
  backend: string;
  /** O instante desenhado, em dia juliano TDB. A tela escreve tambem o UTC aproximado. */
  jdTdb: number;
}
