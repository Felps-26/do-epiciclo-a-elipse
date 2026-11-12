/**
 * A luz: uma so, pontual, no Sol.
 *
 * `scene.environment = null` e nenhuma `AmbientLight`. A luz em cada ponto e `N·L`
 * com a penumbra do disco solar e o piso do lado noturno.
 *
 * Piso do lado noturno. Este cabecalho dizia que "o lado noturno e preto de
 * verdade", o que continua certo como fisica e estava errado como decisao de
 * programa: com Marte a tres raios e o Sol a noventa graus o disco inteiro saia
 * preto, e so sobrava o arco da atmosfera no limbo. O programa carregava um mapa de
 * 8K, orientava o eixo pelo polo da IAU e entregava um buraco preto. O lado noturno
 * agora recebe `PISO_DO_LADO_NOTURNO` da luz do meio-dia: a mesma textura e a mesma
 * luz com um minimo, nao uma segunda fonte, entao o terminador continua sendo um
 * terminador. Perde-se o preto absoluto. Isso esta em "o que a tela simplifica",
 * ligado por `honestidade.test.ts`, e `e2e/ladoNoturno.spec.ts` mede os dois lados
 * da regra: a noite aparece e continua sendo noite.
 *
 * Penumbra do terminador. `N·L` cru da uma borda fina demais. O Sol visto da Terra
 * tem 0,53° de diametro, e a penumbra tem a largura desse angulo; sem ela o
 * terminador vira uma navalha.
 *
 *     s  = raioDoSol / distanciaAoSol      (meio angulo, em radianos)
 *     nl = smoothstep(−s, s, dot(N, L))
 *
 * Sem decaimento automatico. A irradiancia entra por uniforme, calculada na CPU com
 * a distancia real. Com `1/d²` sobre a posicao da cena, o modo maquete (que
 * comprime distancias) deixaria Netuno a 5,5 UA visuais, ~30 vezes mais iluminado
 * que o real, e a compressao alteraria um resultado fisico visivel, que e o que a
 * regra "a escala visual nunca altera a fisica" existe para impedir.
 */
import { dot, float, mix, normalWorld, positionWorld, smoothstep, uniform, vec3, vec4 } from 'three/tsl';
import type { texture } from 'three/tsl';
import type Node from 'three/src/nodes/core/Node.js';

/**
 * Um no escalar. Nao usa `ReturnType<typeof float>` porque `float` e sobrecarregado:
 * a inferencia cai numa sobrecarga que devolve `VarNode`, e qualquer expressao
 * normal deixa de ser atribuivel.
 */
export type NoFloat = Node<'float'>;
import { Vector3 } from 'three';

/**
 * Os uniformes sao criados pela fabrica e o tipo e derivado dela. Declarar a
 * interface a mao com `ReturnType<typeof uniform>` perde o parametro de tipo do no,
 * e `.sub()` e `.negate()` somem.
 */
function criar() {
  return {
    /** Centro do corpo, no espaco da cena. Base das duas sombras do anel. */
    centroDoCorpo: uniform(new Vector3()),
    /** Raio desenhado do corpo, em unidades de cena. */
    raioDesenhado: uniform(1),
    /** Normal do plano dos aneis — o polo do corpo, no espaco da cena. */
    poloDoCorpo: uniform(new Vector3(0, 0, 1)),
    /** Raio interno e externo dos aneis, em raios do corpo. */
    anelInterno: uniform(1.11),
    anelExterno: uniform(2.33),
    /** Posicao do Sol, no MESMO espaco em que as malhas estao (relativo a camera). */
    posicaoDoSol: uniform(new Vector3()),
    /** Raio do Sol dividido pela distancia real ate este corpo. Da a penumbra. */
    meioAngulo: uniform(0.00465), // 0,53° / 2, visto de 1 UA
    /** Quanto de luz chega, em relacao a 1 UA. Calculado com a distancia REAL. */
    irradiancia: uniform(1),
  };
}

export type UniformesDeLuz = ReturnType<typeof criar>;

export const criarUniformesDeLuz = criar;

/**
 * `0` na noite fechada, `1` no meio-dia, com a penumbra do tamanho certo.
 *
 * Devolve zero na noite de proposito: este fator diz onde e noite, as luzes de
 * cidade so acendem onde ele e zero e o halo da atmosfera so brilha onde nao e. Para
 * a luz que ilumina a superficie, use `comPisoNoturno` por cima.
 *
 * Funcao TypeScript comum e nao um `Fn` do TSL: ela so monta o grafo de nos, e o
 * `Fn` serve para reaproveitar codigo no shader, o que aqui nao se ganha.
 *
 * `normal` existe para material `BackSide`, em que o three entrega `normalWorld`
 * negada (apontando para dentro) e a luz sairia do lado oposto ao Sol.
 */
export function fatorDeLuz(u: UniformesDeLuz, normal: Node<'vec3'> = normalWorld) {
  const paraOSol = u.posicaoDoSol.sub(positionWorld).normalize();
  const nl = normal.normalize().dot(paraOSol);
  return smoothstep(u.meioAngulo.negate(), u.meioAngulo, nl);
}

/**
 * Quanto da luz do meio-dia o lado noturno recebe.
 *
 * Medido, nao escolhido. O criterio tem dois lados, ambos em
 * `e2e/ladoNoturno.spec.ts`: a noite tem de aparecer, com relevo e nao como chapa
 * cinza, e tem de continuar claramente mais escura que o dia. Abaixo de ~0,08 a
 * textura morre na quantizacao de 8 bits depois do tonemapping; acima de ~0,25 o
 * terminador deixa de se ler e o corpo parece chapado. 0,14 fica no meio: 2,8
 * paradas abaixo do meio-dia.
 */
export const PISO_DO_LADO_NOTURNO = 0.14;

/**
 * Luz que ilumina a superficie: a de sempre, com um minimo.
 *
 * `mix(piso, 1, luz)` e nao `max(luz, piso)`: com `max` o terminador ganharia um
 * degrau na altura do piso, uma linha dura onde o projeto gastou uma penumbra para
 * nao ter uma. Interpolando, a rampa continua inteira, entre `piso` e `1` em vez de
 * entre `0` e `1`.
 */
export function comPisoNoturno(luz: NoFloat): NoFloat {
  return luz.mul(float(1 - PISO_DO_LADO_NOTURNO)).add(float(PISO_DO_LADO_NOTURNO));
}

/**
 * Sombra do planeta sobre o anel.
 *
 * Analitica, sem mapa de sombra: o corpo e uma esfera, entao basta ver se o raio
 * que sai do ponto do anel em direcao ao Sol passa dentro dela. `t` e o parametro do
 * ponto de maior aproximacao e so conta se for positivo, ou seja, se a esfera
 * estiver entre o ponto e o Sol; senao o anel do lado de la ficaria escuro sem
 * motivo.
 */
export function sombraDoCorpoNoAnel(u: UniformesDeLuz) {
  const d = positionWorld.sub(u.centroDoCorpo);
  const paraOSol = u.posicaoDoSol.sub(positionWorld).normalize();
  const t = d.dot(paraOSol).negate();
  const perpendicular = d.add(paraOSol.mul(t));
  const raioRelativo = perpendicular.length().div(u.raioDesenhado);

  // A borda da sombra tem a largura do disco solar visto dali: e penumbra, e
  // nao um corte. Sem isso a sombra no anel tem serrilhado de navalha.
  const margem = u.meioAngulo.mul(20).max(float(0.002));
  const foraDaSombra = smoothstep(float(1).sub(margem), float(1).add(margem), raioRelativo);
  const naSombra = mix(float(0.06), float(1), foraDaSombra);

  // `t < 0` significa que o corpo esta ATRAS do ponto em relacao ao Sol: nao
  // ha sombra nenhuma nesse lado.
  return t.greaterThan(float(0)).select(naSombra, 1);
}

/**
 * Sombra do anel sobre o planeta.
 *
 * O caminho inverso: do ponto da superficie em direcao ao Sol, o raio cruza o plano
 * do anel dentro da faixa? Se cruza, a luz e atenuada por `exp(−tau / |cos i|)`. Por
 * isso o alfa da textura vira profundidade optica antes: com o alfa cru a atenuacao
 * nao depende do angulo, e a sombra obliqua, que e a que se ve, desaparece.
 */
export function sombraDoAnelNoCorpo(
  u: UniformesDeLuz,
  tauDoAnel: (r: NoFloat) => NoFloat,
) {
  const paraOSol = u.posicaoDoSol.sub(positionWorld).normalize();
  const n = u.poloDoCorpo.normalize();
  const cosI = n.dot(paraOSol);
  const d = positionWorld.sub(u.centroDoCorpo);

  // Intersecao raio-plano: t = −(d·n) / (dir·n).
  const denominador = cosI.abs().max(float(1e-3)).mul(cosI.sign());
  const t = d.dot(n).negate().div(denominador);
  const cruzamento = d.add(paraOSol.mul(t));
  const raioNoAnel = cruzamento.length().div(u.raioDesenhado);

  const dentro = t
    .greaterThan(float(0))
    .and(raioNoAnel.greaterThan(u.anelInterno))
    .and(raioNoAnel.lessThan(u.anelExterno));

  const atenuacao = tauDoAnel(raioNoAnel).div(cosI.abs().max(float(0.02))).negate().exp();
  // O `1` vai como NUMERO, e nao como `float(1)`: a primeira sobrecarga de
  // `select` aceita numero, e e ela que da o tipo certo. Com um no no lugar,
  // o TypeScript escolhe a sobrecarga generica e reclama.
  return dentro.select(atenuacao, 1);
}

/**
 * `ReturnType<typeof texture>` escolhe a sobrecarga generica e infere o no como
 * `unknown`, e `.rgb` e `.r` somem. Fixando o parametro em `'vec4'`, o padrao do
 * `TextureNode`, os componentes voltam.
 */
export type NoDeTextura = ReturnType<typeof texture<'vec4'>>;

export interface MapasDaSuperficie {
  albedo: NoDeTextura;
  noite?: NoDeTextura;
  nuvens?: NoDeTextura;
  /** O mapa de nuvens e uma foto colorida (Venus), e nao uma mascara cinza (Terra). */
  nuvensColoridas?: boolean;
  /** Quanto o corpo reflete, da ficha da NASA. Modula o brilho do lado de dia. */
  albedoGeometrico: number;
  /** Profundidade optica do anel num raio dado. Ausente em corpo sem anel. */
  tauDoAnel?: (r: NoFloat) => NoFloat;
}

/**
 * Cor final de um ponto da superficie.
 *
 * Ordem: dia, noite, nuvens. As nuvens entram por ultimo e so do lado iluminado:
 * nuvem nao brilha no escuro, e deixar as luzes de cidade aparecerem atraves dela e
 * um erro visivel.
 *
 * Ha dois fatores de luz. `luz` e o cru, zero na noite, e e o que as luzes de
 * cidade consultam. `luzVisivel` e o que de fato ilumina a superficie, com o piso.
 * Trocar um pelo outro apaga as luzes das cidades ou as faz vazar para o lado de
 * dia.
 */
export function corDaSuperficie(u: UniformesDeLuz, mapas: MapasDaSuperficie) {
  // A sombra do anel entra na LUZ, e nao na cor: ela nao escurece a
  // superficie, ela impede o Sol de chegar nela.
  const luz = mapas.tauDoAnel
    ? fatorDeLuz(u).mul(sombraDoAnelNoCorpo(u, mapas.tauDoAnel))
    : fatorDeLuz(u);
  // O piso entra depois da sombra do anel e nao antes, para a faixa que o anel
  // projeta sobre Saturno ser uma sombra com a superficie dentro (como numa fotografia
  // da Cassini) e nao um vazio preto atravessando o planeta.
  const luzVisivel = comPisoNoturno(luz);
  const dia = mapas.albedo.rgb.mul(float(mapas.albedoGeometrico * 2.2));

  let cor = dia.mul(luzVisivel).mul(u.irradiancia);

  if (mapas.noite) {
    // As luzes de cidade so aparecem onde o Sol nao bate, com transicao mais estreita
    // que a da luz, para o contorno do continente iluminado nao vazar para o lado de
    // dia. A mascara le a luz crua: com a do piso ela nunca chegaria a zero e as
    // cidades acenderiam de dia.
    const noite = mapas.noite.rgb.mul(float(1.4));
    cor = cor.add(noite.mul(float(1).sub(smoothstep(float(0), float(0.25), luz))));
  }

  if (mapas.nuvens) {
    // As nuvens usam a luz com piso, como a superficie: com a crua, o lado noturno da
    // Terra teria o oceano visivel e buracos pretos em forma de nuvem por cima,
    // apagando o que o piso acabou de acender. Elas continuam escondendo as luzes de
    // cidade.
    if (mapas.nuvensColoridas) {
      // Em Venus a foto E o topo das nuvens: a cor dela e o albedo, e qualquer
      // pixel que nao seja preto cobre a superficie, que de fora nunca aparece.
      const albedoDasNuvens = mapas.nuvens.rgb;
      const cobertura = smoothstep(float(0.02), float(0.2), dot(albedoDasNuvens, vec3(0.2126, 0.7152, 0.0722)));
      cor = mix(cor, albedoDasNuvens.mul(luzVisivel).mul(u.irradiancia), cobertura);
    } else {
      const cobertura = mapas.nuvens.r;
      cor = mix(cor, vec3(1, 1, 1).mul(luzVisivel).mul(u.irradiancia), cobertura.mul(float(0.9)));
    }
  }

  return vec4(cor, float(1));
}
