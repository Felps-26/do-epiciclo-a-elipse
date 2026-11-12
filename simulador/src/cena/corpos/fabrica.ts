/**
 * Monta um corpo: a esfera, o eixo, o achatamento e os aneis.
 *
 * A esfera e um `Group` com um filho. O grupo carrega a posicao, vinda da origem
 * flutuante, e o filho a orientacao e o achatamento. Os aneis giram com o equador do
 * planeta e nao com o meridiano dele, entao penduram no grupo com a orientacao do
 * polo e nao na malha que gira.
 *
 * Achatamento: Saturno e 9,8% mais largo que alto e Jupiter 6,5%, visivel a olho,
 * e desenhar uma esfera perfeita descartaria um fato conhecido. Entra como escala
 * nao uniforme em Z; a `normalMatrix` do Three corrige as normais, e a iluminacao
 * continua certa.
 */
import {
  AdditiveBlending,
  BackSide,
  DataTexture,
  DoubleSide,
  Group,
  Mesh,
  PlaneGeometry,
  RGBAFormat,
  RingGeometry,

  SRGBColorSpace,
  Vector3,
  type Texture,
} from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  cameraPosition,
  float,
  mix,
  normalWorldGeometry,
  positionWorld,
  smoothstep,
  texture,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  CORPOS_VISUAIS,
  CORPO_GENERICO,
  type CorpoVisual,
} from '../../dados/corposVisuais.ts';
import {
  comPisoNoturno,
  corDaSuperficie,
  criarUniformesDeLuz,
  fatorDeLuz,
  sombraDoCorpoNoAnel,
  type NoFloat,
  type UniformesDeLuz,
} from '../iluminacao/modeloDeLuz.ts';
import { ESFERA } from './esfera.ts';
import { nuvensColoridas } from '../texturas/carregador.ts';
import { orientacaoDoCorpo } from './orientacao.ts';
import { amortecimentoDoGiro } from './giroVisivel.ts';

const UA_KM = 149597870.7;

/** Uma esfera so, compartilhada, com o polo em +Z. Ver `esfera.ts`. */
const GEOMETRIA = ESFERA;

export interface MapasDoCorpo {
  albedo: Texture;
  noite?: Texture;
  nuvens?: Texture;
  anel?: Texture;
}

export interface CorpoMontado {
  chave: string;
  /** Carrega a posicao. A origem flutuante escreve aqui. */
  grupo: Group;
  /** Carrega a orientacao IAU e o achatamento. */
  malha: Mesh;
  aneis: Mesh | null;
  /** A casca do halo de atmosfera, quando o corpo tem uma. */
  atmosfera: Mesh | null;
  visual: CorpoVisual;
  uniformes: UniformesDeLuz;
  /** Religa uma textura que acabou de chegar. */
  trocarMapa(papel: string, textura: Texture): void;
  /** Raio equatorial desenhado, em UA, com o exagero ja aplicado. */
  definirRaioDesenhado(raioUa: number): void;
  /**
   * `raioEmPixels` e o raio aparente do corpo na tela e serve so ao teto de giro.
   * Omitido, nao ha teto, o que mantem quem nao mede pixels (um teste, uma
   * ferramenta) com a orientacao crua da IAU.
   */
  atualizar(
    jd: number,
    posicaoDoSolNaCena: Vector3,
    distanciaRealAoSolUa: number,
    raioEmPixels?: number,
  ): void;
  /** Zera o atraso acumulado do meridiano. Ver `giroVisivel.ts`. */
  zerarGiro(): void;
  /**
   * Largura, em pixels, da imagem que a sombra do anel esta amostrando. Existe para
   * medir um defeito que ja aconteceu: o no da sombra ficava preso no marcador de 1x1
   * enquanto o anel desenhava a imagem de verdade. Um valor maior que 1 afirma que os
   * dois leem o mesmo mapa.
   */
  larguraDoMapaDaSombra(): number;
  /** A luz que este corpo recebe, como o material a ve. Existe para os testes. */
  irradianciaAtual(): number;
  /**
   * Libera geometria e material. So o sandbox usa: os nove da efemeride e as treze
   * luas vivem enquanto o programa vive. Um corpo apagado sem isto sai da cena mas
   * continua ocupando memoria de GPU, e como o teto de criados e quarenta, criar e
   * apagar repetidamente vazaria sem limite.
   */
  descartar(): void;
}

const RAIO_SOL_UA = 695700 / UA_KM;

export function montarCorpo(chave: string, mapas: MapasDoCorpo, ehOSol: boolean): CorpoMontado {
  // Sem `?? CORPOS_VISUAIS['terra']`. Das treze luas so a nossa tinha ficha visual, e
  // as outras doze eram desenhadas com a rotacao, a obliquidade, o achatamento e a
  // atmosfera da Terra (uma volta por dia sideral, eixo a 23,44°, halo azul no limbo,
  // inclusive em Fobos, uma rocha de onze quilometros). A tres pixels de diametro
  // ninguem via. `dados/corposVisuais.ts` agora deriva as doze de `luas.json`, e quem
  // cai em `CORPO_GENERICO` e so o que a pessoa criou, que fica inerte porque o
  // programa nao sabe como um corpo inventado gira.
  const visual = CORPOS_VISUAIS[chave] ?? CORPO_GENERICO;
  const uniformes = criarUniformesDeLuz();

  const material = new MeshBasicNodeMaterial();
  // Os nos sao criados UMA vez. Trocar de nivel e escrever em `.value`; criar
  // um no novo obrigaria a recompilar o shader no meio de um movimento.
  const refs: Record<string, ReturnType<typeof texture<'vec4'>> | null> = {
    albedo: texture(mapas.albedo),
    noite: mapas.noite ? texture(mapas.noite) : null,
    nuvens: mapas.nuvens ? texture(mapas.nuvens) : null,
    // O no do anel entra aqui TAMBEM, e nao so dentro de `montarAneis`. Sem
    // isto `trocarMapa('anel', ...)` nao encontrava onde escrever, e o anel
    // ficava para sempre com o marcador de 1 pixel.
    anel: null,
  };

  // Os dados do anel vem antes do material da superficie, porque a sombra do anel
  // sobre o planeta entra na iluminacao dele e nao como camada por cima. Mais de um
  // no le o mapa do anel (o anel e a sombra dele), e `trocarMapa` tem de escrever em
  // todos; ver o comentario abaixo, onde isso ja custou uma sombra chapada.
  const nosDoAnel: ReturnType<typeof texture<'vec4'>>[] = [];
  let tauDoAnel: ((r: NoFloat) => NoFloat) | null = null;
  let rInterno = 0;
  let rExterno = 0;

  if (visual.aneis) {
    // Sem textura, o anel e desenhado a partir da PROFUNDIDADE OPTICA
    // declarada nos dados. Jupiter, Urano e Netuno tem aneis de verdade, so
    // que tenues demais para existir imageamento util deles — deixa-los de
    // fora porque falta foto seria omitir um fato conhecido.
    refs['anel'] = texture(mapas.anel ?? faixaDeProfundidadeOptica(visual), uv());
    rInterno = Math.min(...visual.aneis.map((f) => f.rInternoKm)) / visual.raioEquatorialKm;
    rExterno = Math.max(...visual.aneis.map((f) => f.rExternoKm)) / visual.raioEquatorialKm;
    const mapaDoAnel = refs['anel']!;
    // Amostra o mesmo mapa que o anel desenha, no raio pedido. E o que faz a sombra
    // sobre o planeta ter a forma das faixas, inclusive a Divisao de Cassini como uma
    // linha clara dentro da sombra.
    //
    // O no da sombra e guardado e entra na lista que `trocarMapa` atualiza. Antes era
    // criado como `texture(mapaDoAnel.value, ...)`, que le o objeto `Texture` do
    // instante da montagem, sempre o marcador de 1x1 na cor media porque nenhuma imagem
    // chegou ainda. `trocarMapa('anel', t)` escrevia em `refs['anel']` e este segundo
    // no ficava apontando para o marcador: a sombra era uma tira de profundidade optica
    // constante, sem faixas, enquanto o anel ao lado desenhava a imagem de verdade.
    tauDoAnel = (r) => {
      const posicao = r.sub(float(rInterno)).div(float(rExterno - rInterno)).clamp(0, 1);
      const noDaSombra = texture(mapaDoAnel.value, vec2(posicao, float(0.5)));
      nosDoAnel.push(noDaSombra);
      const alfa = noDaSombra.a;
      return float(1).sub(alfa.min(float(0.995))).log().negate();
    };
  }

  // O Sol e sua propria fonte: ele nao tem lado noturno. Desenha-se com o
  // albedo puro e brilho alto, que e o que alimenta o bloom na composicao.
  const albedo = refs['albedo']!;
  material.colorNode = ehOSol
    ? vec4(albedo.rgb.mul(float(6)), float(1))
    : corDaSuperficie(uniformes, {
        albedo,
        ...(refs['noite'] ? { noite: refs['noite'] } : {}),
        ...(refs['nuvens'] ? { nuvens: refs['nuvens'], nuvensColoridas: nuvensColoridas(visual.chave) } : {}),
        ...(tauDoAnel ? { tauDoAnel } : {}),
        albedoGeometrico: visual.albedoGeometrico,
      });

  const malha = new Mesh(GEOMETRIA, material);
  malha.frustumCulled = false;

  const grupo = new Group();
  grupo.add(malha);

  const aneis = visual.aneis ? montarAneis(visual, refs['anel']!, uniformes) : null;
  if (aneis) grupo.add(aneis);

  // O halo da atmosfera. Pendura no GRUPO, e nao na malha: ele nao gira com o
  // meridiano do planeta — uma casca de ar nao tem meridiano —, e pendurado na
  // malha ele herdaria tambem o achatamento em Z duas vezes.
  const atmosfera = montarAtmosfera(visual, uniformes);
  if (atmosfera) grupo.add(atmosfera);

  let raioDesenhadoUa = 1;
  // O teto de giro guarda duas coisas por corpo: o `jd` do quadro anterior,
  // para saber quanto o meridiano andaria, e o atraso ja acumulado.
  let jdAnterior: number | null = null;
  let atrasoDoMeridiano = 0;
  const quaternio = orientacaoDoCorpo(visual.rotacao, 2451545);

  return {
    chave,
    grupo,
    malha,
    aneis,
    atmosfera,
    visual,
    uniformes,

    trocarMapa(papel, t) {
      const ref = refs[papel];
      if (ref) ref.value = t;
      if (papel === 'anel') for (const no of nosDoAnel) no.value = t;
    },

    /** Largura da imagem que a SOMBRA do anel esta lendo agora. Ver os testes. */
    larguraDoMapaDaSombra() {
      const img = nosDoAnel[0]?.value?.image as { width?: number } | undefined;
      return img?.width ?? 0;
    },

    definirRaioDesenhado(raioUa) {
      raioDesenhadoUa = raioUa;
      // Achatamento: o eixo polar e menor que o equatorial. A escala vai na
      // malha, nao no grupo, para os aneis nao achatarem junto.
      malha.scale.set(raioUa, raioUa, raioUa * (1 - visual.achatamento));
      if (atmosfera) {
        const e = 1 + (atmosfera.userData['espessura'] as number);
        atmosfera.scale.set(raioUa * e, raioUa * e, raioUa * e * (1 - visual.achatamento));
      }
      uniformes.raioDesenhado.value = raioUa;
      uniformes.anelInterno.value = rInterno;
      uniformes.anelExterno.value = rExterno;
      if (aneis) {
        // A geometria do anel JA esta em unidades de raio equatorial — de 1,11
        // a 2,33 em Saturno —, entao a escala e o raio desenhado e mais nada.
        // Dividir pelo raio equatorial de novo deu 1.241x, e os aneis sairam
        // maiores que o Sistema Solar.
        aneis.scale.setScalar(raioUa);
      }
    },

    irradianciaAtual() {
      return uniformes.irradiancia.value;
    },

    descartar() {
      grupo.traverse((o) => {
        const m = o as Partial<Mesh>;
        m.geometry?.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) for (const x of mat) x.dispose();
        else mat?.dispose();
      });
      grupo.removeFromParent();
    },

    zerarGiro() {
      atrasoDoMeridiano = 0;
      jdAnterior = null;
    },

    atualizar(jd, posicaoDoSolNaCena, distanciaRealAoSolUa, raioEmPixels = 0) {
      // O teto de giro. Quanto o meridiano andaria neste quadro, quanto
      // disso cabe na tela sem virar serrilha, e o resto vira atraso. Com a
      // simulacao parada `passo` e zero e nada acontece; com o corpo pequeno o
      // amortecimento e exatamente 1 e nada acontece. Ver `giroVisivel.ts`.
      const passo = jdAnterior === null ? 0 : jd - jdAnterior;
      jdAnterior = jd;
      const deltaW = visual.rotacao.wPorDia * passo;
      atrasoDoMeridiano += deltaW * (1 - amortecimentoDoGiro(deltaW, raioEmPixels));
      // O atraso fica preso em [0, 360). No topo da escada de tempo ele cresce uns 2,5
      // milhoes de graus por segundo; em poucos minutos passaria de 1e9, e somar `p.w`
      // (na casa de 1e5) a um numero dessa ordem perde digitos em float64. O meridiano
      // passaria a tremer sozinho, com a causa a horas de distancia do sintoma. Como ele
      // so entra numa rotacao, tirar voltas inteiras e exato.
      atrasoDoMeridiano %= 360;

      malha.quaternion.copy(
        orientacaoDoCorpo(visual.rotacao, jd, quaternio, -atrasoDoMeridiano),
      );
      if (aneis) aneis.quaternion.copy(malha.quaternion);

      uniformes.centroDoCorpo.value.copy(grupo.position);
      // O polo no espaco da CENA: o eixo local +Z do corpo levado pela sua
      // propria orientacao. E a normal do plano dos aneis.
      uniformes.poloDoCorpo.value.set(0, 0, 1).applyQuaternion(malha.quaternion);

      uniformes.posicaoDoSol.value.copy(posicaoDoSolNaCena);
      // A penumbra tem a largura do proprio Sol visto daqui — 0,53° na Terra,
      // e proporcionalmente menor quanto mais longe.
      uniformes.meioAngulo.value = RAIO_SOL_UA / Math.max(distanciaRealAoSolUa, 1e-9);
      // Irradiancia com a distancia REAL, e nunca a comprimida.
      uniformes.irradiancia.value = 1 / Math.max(distanciaRealAoSolUa ** 2, 1e-12);
      void raioDesenhadoUa;
    },
  };
}

/**
 * Os aneis.
 *
 * Geometria de anel plano no equador, com o alfa mapeado radialmente: a coordenada
 * `u` do `RingGeometry` corre ao longo da circunferencia e nao do raio, entao e
 * refeita.
 *
 * O alfa da fonte e cobertura em incidencia normal, nao profundidade optica.
 * Alimenta-lo no lugar de `tau` quebra o termo `exp(−tau/|cos i|)` que da a sombra
 * obliqua; a conversao `tau = −ln(1 − alfa)` acontece aqui, no shader.
 */
function montarAneis(
  visual: CorpoVisual,
  alfa: ReturnType<typeof texture<'vec4'>>,
  u: UniformesDeLuz,
): Mesh {
  const faixas = visual.aneis!;
  const rInterno = Math.min(...faixas.map((f) => f.rInternoKm)) / visual.raioEquatorialKm;
  const rExterno = Math.max(...faixas.map((f) => f.rExternoKm)) / visual.raioEquatorialKm;

  const geo = new RingGeometry(rInterno, rExterno, 192, 1);
  // Refaz o UV para `u` correr do raio interno ao externo.
  const pos = geo.attributes['position']!;
  const uvs = geo.attributes['uv']!;
  const p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const r = p.length();
    uvs.setXY(i, (r - rInterno) / (rExterno - rInterno), 0.5);
  }
  uvs.needsUpdate = true;

  const material = new MeshBasicNodeMaterial({ transparent: true, side: DoubleSide, depthWrite: false });
  // tau = −ln(1 − alfa), com o alfa preso longe de 1 para o log nao estourar.
  const tau = float(1).sub(alfa.a.min(float(0.995))).log().negate();
  const luz = fatorDeLuz(u);

  // A opacidade vai no `opacityNode` e nao no `w` do `colorNode`: em TSL o `colorNode`
  // alimenta a cor difusa, e o canal alfa dele e ignorado pelo caminho de
  // transparencia. Por isso os aneis existiam no grafo, com `visible: true` e a escala
  // certa, e nao apareciam. A sombra do planeta sobre o anel e a irradiancia tambem
  // faltavam: sem elas o anel tinha o brilho de 1 UA enquanto o planeta ao lado recebia
  // 1/90 da luz, e a exposicao automatica estourava os dois de branco.
  const sombra = sombraDoCorpoNoAnel(u);
  // O anel ja tinha um piso proprio, escrito a mao como `luz*0.9 + 0.1` e sem
  // explicacao: a face nao iluminada dele nunca foi preta. O numero agora e o
  // MESMO da superficie — sao a mesma ideia, e duas constantes para a mesma
  // ideia divergem na primeira vez que alguem mexer numa delas.
  material.colorNode = alfa.rgb
    .mul(float(0.55))
    .mul(comPisoNoturno(luz))
    .mul(sombra)
    .mul(u.irradiancia);
  material.opacityNode = float(1).sub(tau.negate().exp());

  const malha = new Mesh(geo, material);
  malha.frustumCulled = false;
  malha.renderOrder = 2;
  return malha;
}

/**
 * Faixa de 1 pixel de altura construida das faixas declaradas. Substitui a textura
 * de alfa em Jupiter, Urano e Netuno. O valor gravado e a profundidade optica
 * normalizada, convertida de volta para cobertura por `alfa = 1 − exp(−tau)`, a mesma
 * relacao que o shader usa no outro sentido.
 */
function faixaDeProfundidadeOptica(visual: CorpoVisual): Texture {
  const faixas = visual.aneis!;
  const rInterno = Math.min(...faixas.map((f) => f.rInternoKm));
  const rExterno = Math.max(...faixas.map((f) => f.rExternoKm));
  const largura = 512;
  const dados = new Uint8Array(largura * 4);

  for (let i = 0; i < largura; i++) {
    const r = rInterno + ((rExterno - rInterno) * (i + 0.5)) / largura;
    const faixa = faixas.find((f) => r >= f.rInternoKm && r <= f.rExternoKm);
    const tau = faixa ? faixa.profundidadeOptica : 0;
    const alfa = 1 - Math.exp(-tau);
    // Cinza levemente quente: gelo de agua com tracos de poeira.
    dados[i * 4] = 235;
    dados[i * 4 + 1] = 225;
    dados[i * 4 + 2] = 205;
    dados[i * 4 + 3] = Math.round(255 * Math.min(1, alfa));
  }

  const t = new DataTexture(dados, largura, 1, RGBAFormat);
  t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Uma casca fina, para o que a fase F4 ainda nao desenha e a F3 media. */
export function montarCascaDeProva(): Mesh {
  const m = new MeshBasicNodeMaterial({ side: BackSide });
  m.colorNode = vec4(mix(vec3(0.2, 0.4, 0.8), vec3(0.1, 0.2, 0.5), positionWorld.y), float(1));
  const malha = new Mesh(GEOMETRIA, m);
  malha.frustumCulled = false;
  malha.visible = false;
  return malha;
}

/**
 * O halo de atmosfera no limbo.
 *
 * Uma casca desenhada por dentro (`BackSide`), um pouco maior que o planeta. O que se
 * vê é o caminho óptico através dela: no centro do disco a linha de visada
 * atravessa a casca duas vezes e sai quase de imediato; na borda corre rasante e
 * atravessa muito mais ar. Daí o arco fino e brilhante no limbo e o nada no meio,
 * como numa foto da órbita.
 *
 *     caminho  = (1 − |N·V|)^3        quanto da casca a vista atravessa
 *     luz      = fatorDeLuz            zero no lado noturno, com penumbra
 *     frente   = (N·V)                 só a metade da casca virada para cá
 *
 * `BackSide` faz o halo aparecer ao redor do disco e não sobre ele. Sem `depthWrite`
 * e somando em vez de misturar, ele nunca apaga o que está atrás, inclusive o
 * planeta e os anéis.
 *
 * É um modelo aproximado e está em "o que a tela simplifica" e na procedência de
 * `Atmosfera`: sem espalhamento múltiplo, sem dependência de comprimento de onda, e
 * com a cor escolhida de imagens publicadas e não de um espectro.
 */
function montarAtmosfera(visual: CorpoVisual, u: UniformesDeLuz): Mesh | null {
  const atm = visual.atmosfera;
  if (!atm) return null;

  // Espessura desenhada: três alturas de escala cobrem 95% da massa de ar e deixam o
  // arco visível sem virar neblina. Há um piso de 1,5%, porque a altura de escala da
  // Terra é 0,13% do raio e uma casca assim some em qualquer zoom que não seja órbita
  // baixa: o halo existiria no dado e não na tela.
  const relativa = Math.max((3 * atm.alturaKm) / visual.raioEquatorialKm, 0.015);

  const material = new MeshBasicNodeMaterial({
    side: BackSide,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const paraACamera = cameraPosition.sub(positionWorld).normalize();
  // Em `BackSide` o three nega `normalWorld`. A normal da geometria aponta para fora,
  // que é o que a vista e a luz precisam: com a negada, o halo acenderia no limbo da noite.
  const n = normalWorldGeometry;
  const nv = n.dot(paraACamera).abs();
  const caminho = float(1).sub(nv).pow(float(3));
  const brilho = caminho.mul(fatorDeLuz(u, n)).mul(float(atm.densidade));

  material.colorNode = vec4(vec3(...atm.cor).mul(brilho), float(1));

  const malha = new Mesh(GEOMETRIA, material);
  malha.frustumCulled = false;
  // Depois da superfície (2) e antes das fitas: o halo soma luz sobre o que já
  // foi desenhado, e escrever profundidade faria ele esconder o próprio planeta.
  malha.renderOrder = 3;
  malha.userData['espessura'] = relativa;
  return malha;
}

/**
 * A coroa do Sol.
 *
 * Um disco virado para a câmera, com queda radial, somado à cena. O bloom sozinho
 * não sobrevive ao zoom: a coroa da composição nasce dos pixels claros do disco
 * solar, e de Netuno o Sol tem menos de um pixel. Sem coroa própria, a estrela do
 * sistema vira um ponto sem halo, igual a uma estrela de fundo.
 *
 * A queda é `1/r²` a partir da borda do disco, cortada em três raios. Não é o perfil
 * da coroa K nem da F, e sim uma queda suave escolhida para o halo terminar dentro do
 * quadro. Entra em "o que a tela simplifica".
 */
export function montarCoroa(): Mesh {
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  // `uv()` vai de 0 a 1 no plano; o centro é 0,5.
  const r = uv().sub(vec2(0.5, 0.5)).length().mul(float(2));
  // Queda em `1/(kr)³` e não `1/(kr)²`. Medido na tela: com expoente 2 e brilho 0,55 a
  // coroa cobria a órbita de Mercúrio inteira com névoa laranja e lavava os quatro
  // planetas internos. O halo tem de dizer "há uma estrela aqui" sem apagar o que está
  // em volta. Com expoente 3 e brilho 0,32 ele morre dentro de um raio solar desenhado
  // e continua visível de Netuno.
  const queda = float(1).div(r.mul(float(3.0)).pow(float(3)).add(float(1)));
  // Corte na borda do disco, para o halo não ter um anel duro onde acaba.
  const borda = float(1).sub(smoothstep(float(0.72), float(1), r));
  material.colorNode = vec4(vec3(1.0, 0.92, 0.75).mul(queda.mul(borda).mul(float(0.32))), float(1));

  const malha = new Mesh(new PlaneGeometry(1, 1), material);
  malha.frustumCulled = false;
  // Última: a coroa soma sobre tudo, inclusive sobre as fitas de órbita que
  // passam na frente do Sol.
  malha.renderOrder = 6;
  return malha;
}
