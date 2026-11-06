/**
 * O que impede o sandbox de produzir orbita-lixo.
 *
 * Um corpo criado a 0,1 UA do Sol tem periodo de 11,55 dias, ou 23 passos de meio
 * dia por orbita, e nesse regime o Yoshida4 nao integra: produz uma orbita que
 * precessa e decai, bonita e errada. E o mesmo motivo pelo qual a Lua nao entra no
 * integrador. Em vez de oferecer o gesto em silencio, a criacao e recusada por
 * escrito, com a alternativa junto.
 *
 * A guarda e sobre o periastro, nao sobre a distancia no clique. Perto da
 * velocidade de escape o periastro despenca mesmo com o apoastro grande: um corpo
 * largado a 5 UA com velocidade quase radial passa raspando no Sol, e no clique
 * parecia inofensivo.
 */
import { PASSO_CURTO_DIAS, PASSO_PADRAO_DIAS } from './integrador.ts';
import type { ElementosOsculadores } from './efemerides.ts';

/**
 * Minimo de passos por orbita aceito. Abaixo disso o erro de truncamento vira a
 * forma da orbita.
 */
export const PASSOS_MINIMOS_POR_ORBITA = 40;

/**
 * O veredito e um fato, nao uma frase.
 *
 * A primeira versao montava a mensagem aqui e saiu com "11.6 dias", com ponto
 * decimal, porque o nucleo nao sabe escrever numero em portugues. Alem disso, toda
 * string de interface fica em `dados/textos.ts` para ser revisada de uma vez, e uma
 * frase escondida na fisica escapa dessa revisao. Aqui saem os numeros, e a
 * interface compoe a frase.
 */
export type Veredito =
  | { aceito: true }
  | {
      aceito: false;
      /** Qual das duas contas reprovou. A interface escreve frases diferentes. */
      razao: 'poucos-passos-por-volta' | 'periastro-rapido-demais';
      /** Quanto dura uma volta, em dias. A interface decide se escreve em horas. */
      periodoDias: number;
      /** Distancia do ponto mais proximo do Sol, em UA. */
      perielioUa: number;
      /** Quantos pontos de integracao caberiam numa volta com o passo atual. */
      passosPorVolta: number;
      /** Quantos caberiam na passagem pelo periastro. E este que costuma reprovar. */
      passosNoPeriastro: number;
      /** Passo que resolveria, ou null quando nem o curto resolve. */
      passoSugeridoDias: number | null;
    };

export function passosPorOrbita(periodoDias: number, dtDias: number): number {
  return periodoDias / Math.abs(dtDias);
}

/**
 * Tempo orbital local na passagem pelo periastro: `2*pi*sqrt(q^3/mu)`.
 *
 * E este numero que decide, e nao o periodo. O periodo depende so do semieixo
 * maior: numa orbita muito alongada `a` fica grande, o periodo longo, e "passos por
 * volta" da um numero enorme e tranquilizador, mas a passagem pelo periastro, onde
 * o integrador quebra, dura horas.
 *
 * Medido: um corpo largado a 5 UA com 10% da velocidade circular tem a = 2,51 UA,
 * e = 0,990 e periodo de 1.455 dias (2.909 passos por volta, que a versao anterior
 * da guarda aceitava). O tempo no periastro e 1,46 dia, ou 2,9 passos, e depois de
 * uma volta o corpo e expulso do sistema com `a = Infinity`, sem NaN e sem aviso.
 */
export function passosNoPeriastro(perielioUa: number, mu: number, dtDias: number): number {
  if (!(perielioUa > 0) || !(mu > 0)) return Infinity;
  return (2 * Math.PI * Math.sqrt(perielioUa ** 3 / mu)) / Math.abs(dtDias);
}

/**
 * Diz se um corpo com estes elementos pode ser integrado com este passo.
 *
 * `mu` e `GM_sol + GM_corpo`, o mesmo que `elementosOsculadores` usou; sem ele nao
 * da para converter periastro em tempo.
 */
export function avaliarCriacao(
  elementos: ElementosOsculadores,
  mu: number,
  dtDias = PASSO_PADRAO_DIAS,
): Veredito {
  // Uma hiperbole nao tem periodo, mas pode ter periastro minusculo, e ai o corpo vai
  // embora por um caminho que o integrador inventou. Medido num caso quase radial:
  // dE/E = 1,5e3 em 2.000 dias.
  const noPeriastro = passosNoPeriastro(elementos.perielio, mu, dtDias);
  const naVolta = elementos.ligada ? passosPorOrbita(elementos.periodoDias, dtDias) : Infinity;
  const passos = Math.min(noPeriastro, naVolta);

  if (!Number.isFinite(passos) || passos >= PASSOS_MINIMOS_POR_ORBITA) return { aceito: true };

  const noPeriastroCurto = passosNoPeriastro(elementos.perielio, mu, PASSO_CURTO_DIAS);
  const naVoltaCurto = elementos.ligada
    ? passosPorOrbita(elementos.periodoDias, PASSO_CURTO_DIAS)
    : Infinity;
  const cabeNoPassoCurto = Math.min(noPeriastroCurto, naVoltaCurto) >= PASSOS_MINIMOS_POR_ORBITA;

  return {
    aceito: false,
    razao: noPeriastro < naVolta ? 'periastro-rapido-demais' : 'poucos-passos-por-volta',
    periodoDias: elementos.periodoDias,
    perielioUa: elementos.perielio,
    passosPorVolta: naVolta,
    passosNoPeriastro: noPeriastro,
    passoSugeridoDias: cabeNoPassoCurto ? PASSO_CURTO_DIAS : null,
  };
}

// -- a guarda de vizinhanca --------------------------------------------------

/**
 * Separacao minima que um corpo deve guardar de outro, em UA.
 *
 * Mesmo criterio do periastro, aplicado ao vizinho: o tempo orbital local em torno
 * dele, `2*pi*sqrt(d^3/gm)`, tem de caber em pelo menos `PASSOS_MINIMOS_POR_ORBITA`
 * passos. Invertendo:
 *
 *     d_min = (gm * (N*dt / 2*pi)^2)^(1/3)
 *
 * Usa a GM do vizinho, nunca a soma das duas. "Asteroide" e "Cometa" tem massa
 * exatamente zero, e `mu = gm_i + gm_j` daria `d_min = 0` para um par deles,
 * aceitando dois corpos sobrepostos. Com a GM do vizinho esse par nao tem
 * restricao, e esta certo: corpos sem massa nao se puxam. O que a guarda impede e
 * chegar perto de quem tem massa.
 *
 * Sem ela, um corpo criado em cima de Jupiter gera `1/r^3 = Infinity` no primeiro
 * passo, e o NaN contamina os nove corpos validados num quadro so, sem como
 * desfazer.
 */
export function separacaoMinima(gmDoVizinho: number, dtDias = PASSO_PADRAO_DIAS): number {
  if (!(gmDoVizinho > 0)) return 0;
  return Math.cbrt(gmDoVizinho * ((PASSOS_MINIMOS_POR_ORBITA * Math.abs(dtDias)) / (2 * Math.PI)) ** 2);
}

export type VereditoDeVizinhanca =
  | { aceito: true }
  | {
      aceito: false;
      /** Indice do corpo de quem se chegou perto demais. */
      vizinho: number;
      distanciaUa: number;
      minimaUa: number;
    };

/**
 * Diz se ha espaco para um corpo novo nesta posicao. Percorre todos os corpos com
 * massa e devolve o pior caso, o proporcionalmente mais perto do proprio minimo;
 * devolver o primeiro que reprova daria uma mensagem que muda com a ordem do
 * catalogo.
 */
export function avaliarVizinhanca(
  estado: { pos: Float64Array; gm: Float64Array; n: number },
  pos: readonly [number, number, number],
  dtDias = PASSO_PADRAO_DIAS,
  ignorar = -1,
): VereditoDeVizinhanca {
  let pior: { vizinho: number; distanciaUa: number; minimaUa: number; folga: number } | null = null;
  for (let j = 0; j < estado.n; j++) {
    if (j === ignorar) continue;
    const minima = separacaoMinima(estado.gm[j]!, dtDias);
    if (minima <= 0) continue;
    const d = Math.hypot(
      pos[0] - estado.pos[3 * j]!,
      pos[1] - estado.pos[3 * j + 1]!,
      pos[2] - estado.pos[3 * j + 2]!,
    );
    const folga = d / minima;
    if (folga < 1 && (!pior || folga < pior.folga)) {
      pior = { vizinho: j, distanciaUa: d, minimaUa: minima, folga };
    }
  }
  return pior ? { aceito: false, ...pior } : { aceito: true };
}

/**
 * Teto de corpos criados.
 *
 * O custo por quadro cresce com n² em tres lugares (o laco de forcas, esta guarda e
 * as distancias da cena). Sem teto, algumas centenas de cliques derrubam a taxa de
 * quadros e a calibragem corta a escada de velocidade, sem nada na tela ligar uma
 * coisa a outra. Com 40 o pior caso e 1.176 pares, menos de um decimo do orcamento
 * de um quadro na maquina mais modesta medida.
 */
export const MAXIMO_DE_CORPOS_CRIADOS = 40;
