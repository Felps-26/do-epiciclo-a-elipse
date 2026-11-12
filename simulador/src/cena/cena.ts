/**
 * A cena: corpos texturizados, iluminados por uma luz so, sobre a Via Lactea.
 *
 * Nao conhece o simulador nem o reducer e nao tem como pedir que a fisica ande:
 * recebe um `Instantaneo` e desenha. O dependency-cruiser verifica a regra. As
 * fatias de profundidade da F3 continuam aqui; sao elas que permitem ir de 31,5 UA
 * a 1 km de altitude sem z-fighting, e o teste de precisao mede isso a cada build.
 */
import { corDoCorpo } from '../dados/cores.ts';
import { MAXIMO_DE_CORPOS_CRIADOS } from '../nucleo/guardas.ts';
import { LUAS } from '../dados/luas.ts';
import { posicoesDesenhadas } from './posicoesDesenhadas.ts';
import { atenuacaoDasLinhas, foco as calcularFoco } from './escala/foco.ts';
import {
  Color,
  NoToneMapping,
  EquirectangularReflectionMapping,
  Euler,
  type Group,
  type Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Object3D,
} from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { corpoSobOPonto, raioDoContornoUa } from './selecao.ts';
import { fatiasDeProfundidade, janelaOrtografica } from './camera/planoProximo.ts';
import { alturaVisivelUa, posicaoDaCamera, type EstadoCamera } from './camera/cameraOrbital.ts';
import { aplicarOrigem, distancias } from './origemFlutuante.ts';
import { fatorDeProjecao, limitesDoSol, raioDesenhadoUa } from './escala/exageroDeTamanho.ts';
import { montarCoroa, montarCorpo, montarCascaDeProva, type CorpoMontado } from './corpos/fabrica.ts';
import { Texturas, nivelDoFundo } from './texturas/carregador.ts';
import { exposicaoQuerida, suavizarExposicao } from './iluminacao/exposicao.ts';
import { CORPOS_VISUAIS, OBLIQUIDADE_DA_ECLIPTICA, mapaDe } from '../dados/corposVisuais.ts';
import { criarComposicao } from './pos/composicao.ts';
import { criarAneisDeDistancia, criarFitas, criarPrevisao } from './linhas/fitas.ts';
import type { EstadoDaFita } from './linhas/fitas.ts';
import { estaOcluido } from '../rotulos/oclusao.ts';
import { carregarEstrelas, type Estrelas } from './ceu/estrelas.ts';
import { TEMA_GRADE } from '../dados/cores.ts';

const UA_KM = 149597870.7;

/** Cor media de cada corpo, para o 1x1 que ocupa o lugar da textura ate ela chegar. */
const COR_INICIAL: Record<string, [number, number, number]> = {
  sol: [255, 220, 120],
  mercurio: [150, 140, 125],
  venus: [200, 165, 110],
  terra: [70, 110, 160],
  marte: [165, 95, 65],
  jupiter: [190, 160, 130],
  saturno: [200, 180, 140],
  urano: [140, 190, 200],
  netuno: [80, 110, 180],
  lua: [130, 128, 124],
};

export interface CorpoNaCena {
  chave: string;
  raioKm: number;
  montado: CorpoMontado;
  casca: Object3D;
}

export interface Cena {
  cena: Scene;
  /** A que esta desenhando: perspectiva ou ortografica. */
  camera: PerspectiveCamera | OrthographicCamera;
  corpos: CorpoNaCena[];
  desenhar(
    /** Posicoes REAIS em UA. A compressao do modo maquete acontece aqui dentro. */
    posUa: Float64Array,
    jd: number,
    estadoCamera: EstadoCamera,
    opcoes: OpcoesDaCena,
    /** Indice do corpo que se esta olhando. Define a exposicao. -1 = visao geral. */
    sujeito: number,
  ): void;
  /**
   * Onde cada corpo caiu na tela, para a camada de rotulos. Calculada depois de
   * desenhar, com as mesmas matrizes que desenharam; com outras, o nome ficaria um
   * quadro atras do corpo.
   */
  projetar(larguraPx: number, alturaPx: number): ProjecaoDeCorpo[];
  /** O estado completo, so para a fita de rastro, que acumula por tempo simulado. */
  limparTrilhas(): void;
  definirEstado(estado: { pos: Float64Array; n: number; tDias: number }): void;
  redimensionar(largura: number, altura: number): void;
  readonly fatiasNoUltimoQuadro: number;
  /** Fator da exposicao automatica. Vai ESCRITO na tela: e um recurso visual. */
  readonly exposicao: number;
  /** Verdadeiro quando nada mais esta carregando e a imagem parou de mudar sozinha. */
  readonly assentou: boolean;
  /**
   * O foco do quadro, de 0 a 1 (ver `escala/foco.ts`). Calculado aqui, no laco que ja
   * conhece `dists[i]` e `c.raioKm`, e lido de fora pelos rotulos. Recalcula-lo em
   * `principal.ts` criaria uma segunda copia que atrasa, padrao que o projeto ja
   * pagou em quatro lugares.
   */
  readonly foco: number;
  /** O estado visual das linhas de um corpo. Ver `linhas/fitas.ts`. */
  estadoDaFita(chave: string): EstadoDaFita | null;
  /**
   * Zera o atraso que o teto de giro acumulou em todos os corpos. Chamada por "Voltar
   * ao início", que promete devolver o programa ao estado de partida, e o meridiano
   * desenhado faz parte dele. Ver `corpos/giroVisivel.ts`.
   */
  zerarGiro(): void;
  mostrarCascas(ligado: boolean): void;
  /**
   * Poe a cena em dia com a lista de corpos, que o sandbox muda.
   *
   * Compara por chave e nao por indice. `removerCorpo` do nucleo desloca os indices
   * seguintes (para nao embaralhar a ordem de somatorio das forcas), e qualquer coisa
   * que guarde indice teria de se deslocar junto. Por chave, a cena se corrige sem
   * saber o que mudou nem em que ordem.
   */
  sincronizarCorpos(): void;
  /** A órbita que o corpo do rascunho teria. Vazio esconde a linha. */
  mostrarPrevisao(pontos: Float64Array): void;
  /**
   * Que corpo está sob este pixel, ou nulo. Usa as mesmas projeções que colocaram os
   * rótulos, ou seja, as matrizes que desenharam o quadro. Um raio contra as esferas
   * erraria: os corpos são desenhados com o raio exagerado, e o que se clica é o disco
   * desenhado.
   */
  corpoEm(xCss: number, yCss: number, larguraCss: number, alturaCss: number): string | null;
  /**
   * Direcao, no espaco da cena, do raio que sai da camera por aquele pixel.
   *
   * E o inverso de `projetar`, com as mesmas matrizes; com outras, o ponto colocado
   * cairia longe de onde a pessoa clicou. Os eixos da cena e os eixos em UA sao os
   * mesmos, porque a origem flutuante so translada, entao a direcao serve direto para
   * interseccao em UA.
   */
  direcaoNaTela(xCss: number, yCss: number, larguraCss: number, alturaCss: number): [number, number, number];
}

export interface ProjecaoDeCorpo {
  chave: string;
  /** Pixels CSS. */
  x: number;
  y: number;
  raioPx: number;
  /** Falso quando esta atras da camera. */
  naFrente: boolean;
  ocluido: boolean;
  distanciaUa: number;
}

export interface OpcoesDaCena {
  tamanhoReal: boolean;
  estrelas: boolean;
  orbitas: boolean;
  trilhas: boolean;
  aneisDeDistancia: boolean;
  /** Desenhar as luas. Elas somem tambem quando a orbita nao se distingue. */
  luas: boolean;
  /** 'ortografica' troca a matriz de projecao, e nao so o rotulo do botao. */
  vista: 'perspectiva' | 'ortografica';
  /**
   * Distancias comprimidas pela raiz quadrada, em torno do Sol. Afeta so onde os
   * corpos sao desenhados. A luz de cada um e a exposicao da camera continuam usando a
   * distancia real; senao Netuno, desenhado a 5,5 UA, apareceria trinta vezes mais
   * iluminado do que e.
   */
  maquete: boolean;
  /**
   * Chave do corpo que a camera encara, ou `null`. Dirige o foco (`escala/foco.ts`).
   * Nao e o `sujeito`: acompanhando Io, o sujeito da exposicao e Jupiter, porque a luz
   * que chega na lua e a que chega no planeta, mas quem a camera encara e Io.
   */
  alvoDaCamera: string | null;
}

export function criarCena(
  renderizador: WebGPURenderer,
  corpos: readonly { chave: string; nome: string; raioKm: number }[],
  periodosDias: readonly (number | null)[],
): Cena {
  const cena = new Scene();
  cena.background = new Color(0x05060b);
  // A luz e uma so e esta no Sol; `environment` fica nulo para o lado noturno
  // ser preto de verdade.
  cena.environment = null;

  const texturas = new Texturas(renderizador);
  /** A coroa do Sol. Criada junto com o corpo dele, logo abaixo. */
  let coroa: Mesh | null = null;

  const naCena: CorpoNaCena[] = corpos.map((c) => {
    const cor = COR_INICIAL[c.chave] ?? [160, 160, 160];
    const montado = montarCorpo(
      c.chave,
      {
        albedo: texturas.obter(c.chave, 'albedo', cor),
        ...(texturas.temMapa(c.chave, 'noite') ? { noite: texturas.obter(c.chave, 'noite', [0, 0, 0]) } : {}),
        ...(texturas.temMapa(c.chave, 'nuvens') ? { nuvens: texturas.obter(c.chave, 'nuvens', [0, 0, 0]) } : {}),
        ...(texturas.temMapa(c.chave, 'anel') ? { anel: texturas.obter(c.chave, 'anel', [180, 170, 150]) } : {}),
      },
      c.chave === 'sol',
    );
    cena.add(montado.grupo);

    const casca = montarCascaDeProva();
    montado.grupo.add(casca);

    // A coroa vai no grupo do Sol, entao ela acompanha a origem flutuante sem
    // nenhuma conta propria. Ela e um disco virado para a camera, e quem o vira
    // e o laco de desenho — um `Sprite` faria isso sozinho, mas com escala em
    // PIXELS, e aqui a coroa mede em unidades de cena como todo o resto.
    if (c.chave === 'sol') {
      coroa = montarCoroa();
      montado.grupo.add(coroa);
    }

    return { chave: c.chave, raioKm: c.raioKm, montado, casca };
  });

  /**
   * As luas, montadas depois dos nove e na mesma lista.
   *
   * Ficar na mesma `naCena` faz oclusao, rotulo, escolha de fatia de profundidade e
   * projecao valerem para elas sem linha a mais; uma lista separada repetiria as
   * quatro coisas, e repetir e onde a segunda copia se atrasa. O indice delas comeca
   * em `corpos.length`, e por isso `sujeito`, que indexa os nove, continua valendo.
   */
  const indiceDoPai = new Map(corpos.map((c, i) => [c.chave, i]));
  const luasNaCena = LUAS.map((l) => {
    const cor = COR_INICIAL[l.chave] ?? [150, 148, 142];
    const montado = montarCorpo(
      l.chave,
      { albedo: texturas.obter(l.chave, 'albedo', cor) },
      false,
    );
    cena.add(montado.grupo);
    const casca = montarCascaDeProva();
    montado.grupo.add(casca);
    naCena.push({ chave: l.chave, raioKm: l.raioMedioKm, montado, casca });
    return { lua: l, iPai: indiceDoPai.get(l.pai) ?? -1 };
  });
  const iTerra = indiceDoPai.get('terra') ?? -1;
  const iLua = LUAS.findIndex((l) => l.chave === 'lua');

  texturas.aoTrocar = (chave, t) => {
    const [corpo, papel] = chave.split('/');
    naCena.find((c) => c.chave === corpo)?.montado.trocarMapa(papel!, t);
  };

  // A Via Lactea como fundo equirretangular. `backgroundRotation` a leva do
  // equatorial do panorama para a ecliptica da cena — sem isso o plano da
  // galaxia apareceria inclinado 23° a mais.
  const viaLactea = mapaDe('ceu', 'viaLactea');
  const nivelDaViaLactea = viaLactea ? nivelDoFundo(viaLactea.niveis) : null;
  if (viaLactea && nivelDaViaLactea) {
    new TextureLoader().load(viaLactea.niveis[nivelDaViaLactea]!, (t) => {
      t.mapping = EquirectangularReflectionMapping;
      t.colorSpace = SRGBColorSpace;
      cena.background = t;
      cena.backgroundIntensity = 0.32;
      cena.backgroundRotation = new Euler(-OBLIQUIDADE_DA_ECLIPTICA * (Math.PI / 180), 0, 0);
    });
  }

  // O catalogo entra quando chega. Sem ele o programa abre igual, com o
  // panorama da Via Lactea ao fundo e nada mais.
  let estrelas: Estrelas | null = null;
  void carregarEstrelas().then((e) => {
    if (!e) return;
    estrelas = e;
    e.mostrar(comEstrelas);
    cena.add(e.pontos);
  });

  /** Ver o cache em `projetar`. */
  let quadrosDesenhados = 0;
  let projecaoEmCache: {
    quadro: number;
    largura: number;
    altura: number;
    saida: ProjecaoDeCorpo[];
  } | null = null;

  const fitas = criarFitas(corpos, periodosDias, corpos.length + MAXIMO_DE_CORPOS_CRIADOS);
  cena.add(fitas.grupo);
  const aneisDeDistancia = criarAneisDeDistancia(TEMA_GRADE);
  cena.add(aneisDeDistancia.grupo);
  const previsao = criarPrevisao();
  cena.add(previsao.linha);

  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 0);
  camera.up.set(0, 0, 1);

  /**
   * Ortografica de verdade, e nao uma perspectiva de fov minusculo.
   *
   * Por dez fases a tecla `V` trocava um campo do estado e a projecao continuava em
   * perspectiva, com o botao dizendo "Vista de cima". Um fov estreito tambem nao
   * serve, porque mantem o ponto de fuga; o que a ortografica entrega e justamente a
   * ausencia dele: duas orbitas do mesmo raio saem do mesmo tamanho, uma na frente e a
   * outra atras.
   *
   * As duas compartilham posicao, orientacao e `up`. Muda so a matriz de projecao, e a
   * altura visivel no plano do pivo e igual nas duas, o que evita salto de zoom na
   * troca.
   */
  const ortografica = new OrthographicCamera(-1, 1, 1, -1, 0.001, 200);
  ortografica.position.set(0, 0, 0);
  ortografica.up.set(0, 0, 1);
  /** A que esta desenhando agora. Tudo o mais le daqui. */
  let ativa: PerspectiveCamera | OrthographicCamera = camera;

  const grupos: Group[] = naCena.map((c) => c.montado.grupo);
  // Dimensionado pelo teto e nao pela contagem de agora: o sandbox acrescenta corpos
  // durante o uso, e um array realocado no meio do quadro deixaria `grupos`, `dists` e
  // as posicoes com tamanhos diferentes por um quadro, o bastante para um `RangeError`
  // ou para um corpo desenhado na posicao de outro.
  /**
   * Separacao minima, em pixels, para uma lua valer a pena. Doze e o alvo de ponteiro
   * do criterio 2.5.8 da WCAG; abaixo disso lua e planeta sao um alvo so. Dezoito da
   * folga para o rotulo.
   */
  const SEPARACAO_MINIMA_DA_LUA_PX = 18;

  const nTotal = corpos.length + MAXIMO_DE_CORPOS_CRIADOS + LUAS.length;
  const dists = new Float64Array(nTotal);
  // Alocado uma vez: o modo maquete recalcula estas posicoes por quadro, e
  // alocar 3N doubles a 60 Hz e exatamente o tipo de lixo que faz o coletor
  // aparecer como engasgo.
  const comprimidas = new Float64Array(3 * nTotal);
  /** Posicoes REAIS de todos, luas inclusive. Alimenta a luz e a exposicao. */
  const reais = new Float64Array(3 * nTotal);
  const posDoSolNaCena = new Vector3();
  const auxiliar = new Vector3();
  const _lateral = new Vector3();
  const _borda = new Vector3();
  const _centro = new Vector3();
  let alturaPx = 600;
  let fatias = 2;
  let estadoParaTrilhas: { pos: Float64Array; n: number; tDias: number } | null = null;
  let comEstrelas = true;
  let exposicao = 1;
  let exposicaoSuave = 1;
  let focoDoQuadro = 0;
  let pixelRatio = 1;
  // A previsao e desenhada FORA do quadro, quando o rascunho muda, e precisa
  // da mesma camera que o ultimo quadro usou — senao a linha nasce deslocada
  // pela origem flutuante e so se conserta no quadro seguinte.
  let ultimaCamera: EstadoCamera = { pivo: [0, 0, 0], raio: 31.5, azimute: 0, elevacao: 0, fovGraus: 45 };

  // A cena e desenhada em HDR, SEM tonemap: quem faz o tonemap e a composicao,
  // depois do bloom. Tonemapear aqui comprimiria tudo para [0,1] e nao
  // sobraria faixa alta para florescer.
  renderizador.toneMapping = NoToneMapping;
  const composicao = criarComposicao(renderizador);

  return {
    cena,
    get camera() {
      return ativa;
    },
    corpos: naCena,
    get fatiasNoUltimoQuadro() {
      return fatias;
    },
    // O fator escrito na tela e o aplicado neste quadro, e nao o alvo.
    get exposicao() {
      return exposicaoSuave;
    },
    get foco() {
      return focoDoQuadro;
    },

    get assentou() {
      return (
        texturas.pendentes === 0 &&
        texturas.baixando === 0 &&
        Math.abs(exposicaoSuave - exposicao) < exposicao * 0.003
      );
    },

    estadoDaFita(chave) {
      return fitas.estadoDaFita(chave);
    },

    zerarGiro() {
      for (const c of naCena) c.montado.zerarGiro();
    },

    mostrarCascas(ligado) {
      for (const c of naCena) c.casca.visible = ligado;
    },

    corpoEm(xCss, yCss, larguraCss, alturaCss) {
      return corpoSobOPonto(this.projetar(larguraCss, alturaCss), xCss, yCss);
    },

    mostrarPrevisao(pontos) {
      if (pontos.length === 0) previsao.esconder();
      else previsao.mostrar(pontos, posicaoDaCamera(ultimaCamera));
    },

    direcaoNaTela(xCss, yCss, larguraCss, alturaCss) {
      auxiliar.set((xCss / larguraCss) * 2 - 1, 1 - (yCss / alturaCss) * 2, 0.5);
      auxiliar.unproject(ativa);
      auxiliar.normalize();
      return [auxiliar.x, auxiliar.y, auxiliar.z];
    },

    sincronizarCorpos() {
      // Os corpos da fisica ocupam as primeiras `corpos.length` posicoes de
      // `naCena`; as luas vem depois. Este laco mexe so na primeira parte.
      const fisicos = naCena.slice(0, naCena.length - LUAS.length);
      const chavesAgora = corpos.map((c) => c.chave);
      if (fisicos.length === corpos.length && fisicos.every((c, i) => c.chave === chavesAgora[i])) {
        return;
      }

      const porChave = new Map(fisicos.map((c) => [c.chave, c]));
      const novos: CorpoNaCena[] = [];
      for (const c of corpos) {
        const existente = porChave.get(c.chave);
        if (existente) {
          novos.push(existente);
          porChave.delete(c.chave);
          continue;
        }
        const montado = montarCorpo(
          c.chave,
          { albedo: texturas.obter(c.chave, 'albedo', [...corDoCorpo(c.chave)] as [number, number, number]) },
          false,
        );
        cena.add(montado.grupo);
        const casca = montarCascaDeProva();
        montado.grupo.add(casca);
        novos.push({ chave: c.chave, raioKm: c.raioKm, montado, casca });
      }

      // O que sobrou no mapa foi apagado. Tirar da cena E liberar a malha: um
      // grupo solto continua consumindo memoria de GPU e continua aparecendo
      // na lista de rotulos.
      for (const morto of porChave.values()) {
        cena.remove(morto.montado.grupo);
        morto.montado.descartar();
      }

      const luas = naCena.slice(naCena.length - LUAS.length);
      naCena.length = 0;
      naCena.push(...novos, ...luas);
      grupos.length = 0;
      grupos.push(...naCena.map((c) => c.montado.grupo));
    },

    redimensionar(largura, altura) {
      alturaPx = Math.max(1, altura);
      camera.aspect = largura / alturaPx;
      // `setSize` recria o buffer de PROFUNDIDADE junto com o de cor. Mexer em
      // `canvas.width` na mao deixa os dois com tamanhos diferentes, e o
      // WebGPU recusa o passe inteiro.
      renderizador.setSize(largura, alturaPx, false);
      pixelRatio = renderizador.getPixelRatio();
      composicao.redimensionar(largura, alturaPx, pixelRatio);
    },

    projetar(larguraPx, alturaCss) {
      // Uma projecao por quadro, e nao uma por quem pergunta.
      //
      // `projetar` roda a oclusao, que e O(n²) sobre os corpos, e aloca a lista de saida.
      // Era chamada pela ancoragem dos rotulos a cada quadro, pelo calculo dos rotulos a
      // cada publicacao do estado e por `corpoEm` a cada clique, sempre com a mesma
      // camera, no mesmo instante e com o mesmo resultado.
      //
      // O cache vale por quadro desenhado e pelo tamanho pedido: `desenhar` incrementa o
      // contador, e qualquer pergunta depois disso recalcula. Sem o tamanho na chave, uma
      // pergunta em pixels de CSS devolveria a resposta em pixels de dispositivo, erro que
      // so aparece em tela retina.
      if (
        projecaoEmCache !== null &&
        projecaoEmCache.quadro === quadrosDesenhados &&
        projecaoEmCache.largura === larguraPx &&
        projecaoEmCache.altura === alturaCss
      ) {
        return projecaoEmCache.saida;
      }

      /** Pixels entre o centro e o centro deslocado de `raioUa` na horizontal da tela. */
      const raioEmPixels = (centro: Vector3, raioUa: number, lPx: number, aPx: number): number => {
        const direita = _lateral.set(1, 0, 0).applyQuaternion(ativa.quaternion).multiplyScalar(raioUa);
        _borda.copy(centro).add(direita).project(ativa);
        _centro.copy(centro).project(ativa);
        return Math.hypot(((_borda.x - _centro.x) * lPx) / 2, ((_borda.y - _centro.y) * aPx) / 2);
      };

      const saida: ProjecaoDeCorpo[] = [];
      // Raio ZERO para o que nao esta desenhado, em vez de tirar da lista: o
      // indice `i` do laco abaixo indexa esta mesma lista, e filtrar aqui
      // faria cada corpo ser comparado com a esfera de outro.
      const esferas = naCena.map((c) => ({
        centro: [
          c.montado.grupo.position.x,
          c.montado.grupo.position.y,
          c.montado.grupo.position.z,
        ] as [number, number, number],
        raio: c.montado.grupo.visible ? c.montado.malha.scale.x : 0,
      }));

      for (let i = 0; i < naCena.length; i++) {
        const c = naCena[i]!;
        // O que nao esta desenhado nao e clicavel nem rotulavel. Sem isto, uma
        // lua escondida continuaria roubando o clique do planeta.
        if (!c.montado.grupo.visible) continue;
        const p = c.montado.grupo.position;
        auxiliar.copy(p).project(ativa);
        // `w <= 0` e o corpo ATRAS da camera. Em ortografica isso nao existia;
        // ignorar aqui faria o nome aparecer espelhado do outro lado da tela.
        const naFrente = auxiliar.z < 1 && p.dot(direcaoDaCamera(ativa)) > 0;
        // O raio em pixels sai da PROJECAO, e nao de uma conta de fov: projeta o
        // centro deslocado na horizontal da tela ate o limbo (`raioDoContornoUa`) e
        // mede a diferenca, com as mesmas matrizes que desenharam o quadro.
        const contorno = raioDoContornoUa(c.montado.malha.scale.x, p.length(), ativa === camera);
        const raioPx = raioEmPixels(p, contorno, larguraPx, alturaCss);
        saida.push({
          chave: c.chave,
          x: ((auxiliar.x + 1) / 2) * larguraPx,
          y: ((1 - auxiliar.y) / 2) * alturaCss,
          raioPx: Math.max(3, raioPx),
          naFrente,
          ocluido: estaOcluido([p.x, p.y, p.z], esferas, i),
          distanciaUa: p.length(),
        });
      }
      projecaoEmCache = { quadro: quadrosDesenhados, largura: larguraPx, altura: alturaCss, saida };
      return saida;
    },

    limparTrilhas() {
      fitas.limparTrilhas();
    },

    definirEstado(e) {
      estadoParaTrilhas = e;
    },

    desenhar(posUa, jd, estadoCamera, opcoes, sujeito) {
      // O contador de quadros e a chave do cache de `projetar`. Incrementa-lo
      // aqui, ANTES de qualquer coisa mudar de lugar, e o que garante que
      // nenhuma resposta do quadro anterior sobreviva a este.
      quadrosDesenhados++;
      projecaoEmCache = null;
      const { tamanhoReal, estrelas: mostrarEstrelas, maquete, luas: mostrarLuas } = opcoes;
      const ehOrtografica = opcoes.vista === 'ortografica';
      const camUa = posicaoDaCamera(estadoCamera);
      ultimaCamera = estadoCamera;

      // `posDesenho` e o unico buffer que vira coordenada de cena; `posUa` continua real e
      // alimenta tudo que e fisico daqui para baixo. Com os dois nomes a vista no mesmo
      // escopo, fica dificil usar o errado sem perceber.
      //
      // Posicoes de todos, reais e desenhadas: ver `posicoesDesenhadas`.
      const posDesenho = posicoesDesenhadas(
        posUa,
        corpos.length,
        luasNaCena,
        iTerra,
        iLua,
        jd,
        maquete,
        reais,
        comprimidas,
      );

      aplicarOrigem(posDesenho, camUa, grupos);
      distancias(posDesenho, naCena.length, camUa, dists);

      // Projecao. A altura visivel no plano do pivo e a mesma nas duas, o que evita salto
      // de zoom na troca. Na perspectiva ela sai do fov; na ortografica e a definicao da
      // camera.
      const alturaVisivel = alturaVisivelUa(estadoCamera);
      ativa = ehOrtografica ? ortografica : camera;
      if (ehOrtografica) {
        const meiaAltura = alturaVisivel / 2;
        const meiaLargura = meiaAltura * (camera.aspect || 1);
        ortografica.left = -meiaLargura;
        ortografica.right = meiaLargura;
        ortografica.top = meiaAltura;
        ortografica.bottom = -meiaAltura;
        ortografica.updateProjectionMatrix();
      } else {
        camera.fov = estadoCamera.fovGraus;
      }
      ativa.lookAt(
        estadoCamera.pivo[0] - camUa[0],
        estadoCamera.pivo[1] - camUa[1],
        estadoCamera.pivo[2] - camUa[2],
      );

      // O Sol e o centro da compressao, entao nao se move entre as duas; ler de
      // `posDesenho` deixa isso valendo por construcao.
      //
      // A lua so aparece quando da para distingui-la do planeta. O exagero de tamanho tem
      // um piso em pixels para um corpo pequeno nao sumir, o que funciona para um planeta
      // solto no vazio e produz um absurdo numa lua: Ganimedes na visao geral e desenhado
      // com 3,5 px, o que a 36 UA equivale a 25 milhoes de km, vinte e tres vezes o raio
      // da propria orbita. Quatro luas engolem Jupiter e umas as outras, e um clique no
      // meio do planeta acerta a lua que estiver por cima.
      //
      // O criterio e a separacao e nao o tamanho da lua. Enquanto a orbita inteira couber
      // dentro do disco do planeta mais um alvo de ponteiro, desenhar a lua so acrescenta
      // ruido que rouba clique e rotulo. Aproximando, elas aparecem sozinhas.
      const alturaUtil = Math.max(1, alturaPx);
      const pxPorRad = fatorDeProjecao(camera.fov, alturaUtil);
      /** Pixels por UA a uma dada distancia. Constante na ortografica. */
      const pixelsPorUa = (d: number): number =>
        ehOrtografica ? alturaUtil / Math.max(alturaVisivel, 1e-12) : pxPorRad / Math.max(d, 1e-12);
      for (let k = 0; k < luasNaCena.length; k++) {
        const { lua, iPai } = luasNaCena[k]!;
        const iCena = corpos.length + k;
        const dPai = dists[iPai]!;
        const orbitaPx = dPai > 0 ? (lua.aKm / UA_KM) * pixelsPorUa(dPai) : 0;
        const visivel = mostrarLuas && orbitaPx >= SEPARACAO_MINIMA_DA_LUA_PX;
        naCena[iCena]!.montado.grupo.visible = visivel;
      }

      if (mostrarEstrelas !== comEstrelas) {
        comEstrelas = mostrarEstrelas;
        estrelas?.mostrar(mostrarEstrelas);
      }

      // O panorama da Via Lactea fica com brilho constante na tela, sem acompanhar a
      // exposicao automatica. E uma imagem de 8 bits por canal, e a exposicao chega a 27
      // acompanhando Jupiter e a 900 em Netuno: multiplicar 8 bits por 27 mostra os
      // degraus da quantizacao e o ceu vira um mosaico de manchas retangulares, estrutura
      // inventada pelo formato do arquivo. As estrelas continuam passando pela exposicao,
      // porque vem de um catalogo com magnitude medida e tem faixa dinamica de verdade.
      cena.backgroundIntensity = mostrarEstrelas ? 0.32 / Math.max(exposicaoSuave, 1e-3) : 0;
      estrelas?.acompanhar();

      posDoSolNaCena.set(
        posDesenho[0]! - camUa[0],
        posDesenho[1]! - camUa[1],
        posDesenho[2]! - camUa[2],
      );

      const iMercurio = naCena.findIndex((c) => c.chave === 'mercurio');
      const dMercurioUa =
        iMercurio > 0
          ? Math.hypot(
              posDesenho[3 * iMercurio]! - posDesenho[0]!,
              posDesenho[3 * iMercurio + 1]! - posDesenho[1]!,
              posDesenho[3 * iMercurio + 2]! - posDesenho[2]!,
            )
          : 0;

      let maisProximo = Infinity;
      let maisDistante = 0;
      for (let i = 0; i < naCena.length; i++) {
        const c = naCena[i]!;
        const raioRealUa = c.raioKm / UA_KM;
        // A unica conta que difere entre as duas projecoes. Em perspectiva os pixels por UA
        // caem com a distancia; em ortografica sao constantes. Todo o resto (exagero de
        // tamanho, raio aparente, escolha por clique) fala em pixels e nao precisa saber qual
        // das duas esta ligada.
        const ampliado = raioDesenhadoUa(raioRealUa, pixelsPorUa(dists[i]!), tamanhoReal, c.chave === 'sol');
        const doSol = c.chave === 'sol' ? limitesDoSol(ampliado, raioRealUa, dMercurioUa) : null;
        const raio = doSol ? doSol.raioUa : ampliado;
        c.montado.definirRaioDesenhado(raio);
        c.casca.scale.setScalar(1.003);

        // A coroa acompanha o disco e fica sempre de frente para a camera.
        // Tres raios de extensao: alem disso ela vira um vidro fosco sobre o
        // sistema inteiro, e o que se quer e que o Sol continue tendo halo
        // quando o disco cabe num pixel.
        if (doSol && coroa) {
          coroa.scale.setScalar(Math.max(doSol.coroaUa, 1e-9));
          coroa.quaternion.copy(ativa.quaternion);
        }

        // Distancia REAL ao Sol, e nao a desenhada: e ela que define a
        // penumbra do terminador e quanta luz chega.
        const dSol = Math.hypot(reais[3 * i]! - reais[0]!, reais[3 * i + 1]! - reais[1]!, reais[3 * i + 2]! - reais[2]!);
        // Raio aparente, em pixels: decide se o giro cabe no quadro. `raio` ja e o raio
        // desenhado em UA, com o exagero aplicado, o mesmo numero que o picking e os rotulos
        // usam, entao o teto de giro acende quando o corpo fica grande o bastante para
        // alguem ver a textura.
        c.montado.atualizar(
          jd,
          posDoSolNaCena,
          Math.max(dSol, raioRealUa),
          raio * pixelsPorUa(dists[i]!),
        );

        // Pede o nivel de textura que a distancia justifica, medida em raios
        // do proprio corpo — e o que faz "perto" significar a mesma coisa para
        // Jupiter e para Mercurio.
        const emRaios = dists[i]! / Math.max(raio, 1e-12);
        texturas.pedir(c.chave, 'albedo', emRaios);
        if (CORPOS_VISUAIS[c.chave]) {
          texturas.pedir(c.chave, 'noite', emRaios);
          texturas.pedir(c.chave, 'nuvens', emRaios);
          texturas.pedir(c.chave, 'anel', emRaios);
        }

        const aSuperficie = Math.max(0, dists[i]! - raio);
        if (aSuperficie < maisProximo) maisProximo = aSuperficie;
        if (dists[i]! + raio > maisDistante) maisDistante = dists[i]! + raio;
      }

      // Exposicao pela distancia do sujeito ao Sol (o corpo escolhido, nao o pivo da
      // camera). Na visao geral o pivo e o Sol, e medir dali dava distancia zero: a cena
      // saia dez vezes mais escura, com "exposicao x0,1" na tela. Sem corpo escolhido, a
      // referencia e 1 UA, a Terra bem exposta, que e o que se espera ao abrir o programa.
      const dSujeito =
        sujeito > 0 && sujeito < naCena.length
          ? Math.hypot(
              reais[3 * sujeito]! - reais[0]!,
              reais[3 * sujeito + 1]! - reais[1]!,
              reais[3 * sujeito + 2]! - reais[2]!,
            )
          : 1;
      exposicao = exposicaoQuerida(dSujeito);
      // Suaviza, porque mudar a exposicao de um quadro para o outro pisca a tela, e
      // encosta no fim. Uma aproximacao exponencial pura nunca chega ao alvo, entao a
      // imagem nunca para de mudar, nem com a camera parada e a fisica pausada. Era a causa
      // de 17% dos pixels trocarem de valor entre dois quadros identicos, que o teste de
      // z-fighting acusava como disputa de profundidade. Dentro de 0,2% a exposicao assume
      // o valor final.
      exposicaoSuave = suavizarExposicao(exposicaoSuave, exposicao);

      // O foco. Calculado aqui porque e aqui que `dists[i]` e `c.raioKm`
      // ja existem, e em RAIOS REAIS — ver `escala/foco.ts` para por que o raio
      // desenhado seria a escolha obvia e errada.
      focoDoQuadro = 0;
      if (opcoes.alvoDaCamera) {
        const k = naCena.findIndex((c) => c.chave === opcoes.alvoDaCamera);
        if (k >= 0) focoDoQuadro = calcularFoco(dists[k]!, naCena[k]!.raioKm / UA_KM);
      }
      const atenuacao = atenuacaoDasLinhas(focoDoQuadro);

      // As fitas vivem num grupo ancorado no SOL: assim a geometria so muda
      // quando a orbita muda, e nao a cada quadro por causa da origem flutuante.
      fitas.mostrarOrbitas(opcoes.orbitas);
      fitas.mostrarTrilhas(opcoes.trilhas);
      fitas.atenuar(atenuacao, opcoes.alvoDaCamera);
      aneisDeDistancia.atenuar(atenuacao);
      aneisDeDistancia.mostrar(opcoes.aneisDeDistancia);
      aneisDeDistancia.definirEscala(maquete);
      aneisDeDistancia.posicionar([posDesenho[0]!, posDesenho[1]!, posDesenho[2]!], camUa);
      if (estadoParaTrilhas) {
        fitas.atualizar(estadoParaTrilhas as never, camUa, estadoParaTrilhas.tDias, maquete);
      }

      const janelas = ehOrtografica
        ? [janelaOrtografica(maisProximo, maisDistante)]
        : fatiasDeProfundidade(maisProximo, maisDistante, 2);
      fatias = janelas.length;

      // Todas as fatias escrevem no MESMO alvo HDR; o bloom le o alvo pronto,
      // uma vez so. Limpar a cor entre fatias apagaria a de tras.
      renderizador.setRenderTarget(composicao.alvo);
      for (let k = 0; k < janelas.length; k++) {
        const j = janelas[k]!;
        ativa.near = j.near;
        ativa.far = j.far;
        ativa.updateProjectionMatrix();
        if (k === 0) {
          renderizador.autoClear = true;
        } else {
          renderizador.autoClear = false;
          renderizador.clearDepth();
        }
        renderizador.render(cena, ativa);
      }
      renderizador.autoClear = true;
      renderizador.setRenderTarget(null);
      composicao.apresentar(exposicaoSuave);

      // No maximo uma textura entra em uso por quadro: subir um 4K custa
      // dezenas de milissegundos, e distribuir e a diferenca entre uma
      // transicao e um engasgo.
      texturas.aplicarUmaPorQuadro();
    },
  };
}

/** Para onde a camera olha, no espaco dela. Reutiliza um vetor por quadro. */
function direcaoDaCamera(camera: PerspectiveCamera | OrthographicCamera): Vector3 {
  return _frenteDaCamera.set(0, 0, -1).applyQuaternion(camera.quaternion);
}
const _frenteDaCamera = new Vector3();
