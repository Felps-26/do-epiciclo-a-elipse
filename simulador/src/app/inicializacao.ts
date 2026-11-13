/**
 * Montar o programa: carregar a efemeride, criar a camera, o sistema do sandbox, o
 * laco e, quando o canvas aparece, a cena. E o que `principal.ts` chama, na ordem.
 */
import { render, h } from 'preact';
import { App } from '../interface/App.tsx';
import { ui, despachar, definirContexto } from '../interface/estado.ts';
import { carregar } from '../dados/carregar.ts';
import { ENCONTROS } from '../dados/textos.ts';
import { curvaDoLaboratorio, elementosOsculadores, type CurvaDoLaboratorio } from '../nucleo/efemerides.ts';
import { dataDaSimulacao, dataPorExtenso } from '../nucleo/relogio.ts';
import { kmParaUa } from '../nucleo/unidades.ts';
import type { Colisao } from '../nucleo/simulador.ts';
import { criarRenderizador } from '../cena/renderizador.ts';
import { criarCena } from '../cena/cena.ts';
import { criarCamera, larguraVisivelUa } from '../cena/camera/cameraOrbital.ts';
import { velocidadeDeVooUaPorS } from '../cena/camera/voo.ts';
import type { Instantaneo } from '../contratos/instantaneo.ts';
import { criarLaco } from './laco.ts';
import { ligarPonteiro } from './ponteiro.ts';
import { ligarVoo } from './voo.ts';
import { criarSistemaVivo } from './sistemaVivo.ts';
import type { Consultas } from './consultas.ts';
import type { Programa } from './programa.ts';
import { atualizarPrevisao, ondeOCliqueCai } from './sandboxNaTela.ts';

/**
 * O laco chama de volta quem ainda nao existe quando ele nasce: o corpo do quadro e a
 * colisao precisam das consultas, que precisam do programa. Por isso os dois chegam
 * como funcoes que so sao chamadas depois de `laco.iniciar`.
 */
export function criarPrograma(ganchos: {
  aoQuadro: (instantaneo: Instantaneo, dtRealS: number) => void;
  aoColidir: (c: Colisao) => void;
}): Programa {
  const catalogo = carregar();
  const laco = criarLaco({
    catalogo,
    lerUi: () => ui.value,
    vigia: {
      ehCriado: (i) => catalogo.corpos[i]?.papel === 'teste',
      // So os corpos da efemeride sao alvo: os criados atravessam uns aos outros.
      raioUa: (i) => (catalogo.corpos[i]?.papel === 'teste' ? 0 : kmParaUa(catalogo.corpos[i]?.raioKm ?? 0)),
    },
    aoColidir: (c) => ganchos.aoColidir(c),
    aoQuadro: (i, dt) => ganchos.aoQuadro(i, dt),
  });
  return {
    catalogo,
    camera: criarCamera(),
    // O dono das mutacoes recebe as MESMAS referencias que o laco e a cena usam.
    vivo: criarSistemaVivo(catalogo.estado, catalogo.corpos),
    // As teclas de voo ficam no documento, e nao no canvas: uma tecla que so funciona
    // com o canvas em foco quase nunca funciona.
    voo: ligarVoo(document, { ativo: () => ui.value.modoDeUso === 'voar' }),
    laco,
    cena: null,
    canvas: null,
    backend: 'iniciando',
    larguraPx: 800,
    alturaPx: 600,
    transicao: null,
    corpos: [],
    leituras: [],
    analiseDoSol: null,
    tecnicos: null,
    rotulos: [],
    atrasado: false,
    encontro: null,
    passoCurtoPedido: false,
    capturaPendente: false,
  };
}

/**
 * O que a interface precisa saber quando a lista de corpos muda. E o unico caminho
 * por onde ela muda: `removerCorpo` desloca os indices, e quem os guarda se corrige
 * aqui, antes de qualquer leitura.
 */
export function criarPublicacaoDeMudanca(p: Programa, c: Consultas): () => void {
  const publicarContexto = (): void =>
    definirContexto({
      chaves: p.catalogo.corpos.map((k) => k.chave),
      // Getter: o teto muda com o passo curto, e o reducer le no instante da acao.
      get tetoDiasPorSegundo() {
        return p.laco.tetoDiasPorSegundo;
      },
      // O mesmo nome em toda parte: sem ele as luas saiam pela chave crua.
      nomeDe: (chave) => c.nomeDaChave(chave),
    });
  publicarContexto();
  p.corpos = c.montarLista();

  return () => {
    c.sincronizar();
    despachar({
      tipo: 'sistema-mudou',
      modificado: p.vivo.modificado,
      podeDesfazer: p.vivo.podeDesfazer,
      proximoDesfazer: p.vivo.proximoDesfazer,
    });
    p.corpos = c.montarLista();
    publicarContexto();
    p.cena?.sincronizarCorpos();
  };
}

/** A colisao ja tirou o corpo da fisica; aqui saem a lista e o anuncio. */
export function criarAoColidir(p: Programa, publicarMudanca: () => void): (c: Colisao) => void {
  return (c) => {
    const nome = p.catalogo.corpos[c.corpo]?.nome ?? '?';
    const alvo = p.catalogo.corpos[c.alvo]?.nome ?? '?';
    p.vivo.registrarColisao(c.corpo);
    publicarMudanca();
    const data = dataPorExtenso(dataDaSimulacao(p.catalogo.jdEpoca, c.tDias));
    despachar({ tipo: 'avisar', texto: ENCONTROS.colisao(nome, alvo, data) });
  };
}

/** A interface inteira, redesenhada a cada despacho e a cada publicacao. */
export function criarDesenho(
  p: Programa,
  raiz: HTMLElement,
  extras: { curvaDoLaboratorio: () => CurvaDoLaboratorio | null },
): () => void {
  const desenhar = (): void => {
    // A previsao acompanha o rascunho, e `desenhar` roda exatamente quando ele pode ter
    // mudado; pendurar em efeitos especificos esqueceria algum.
    atualizarPrevisao(p, ui.value);
    render(
      h(App, {
        corpos: p.corpos,
        leituras: p.leituras,
        sol: p.analiseDoSol,
        tecnicos: p.tecnicos,
        curvaDoLaboratorio: extras.curvaDoLaboratorio(),
        criados: p.vivo.criados.map((k) => ({ chave: k.chave, nome: k.nome })),
        jd: p.catalogo.jdEpoca + p.laco.simulador.estado.tDias,
        tDias: p.laco.simulador.estado.tDias,
        atrasado: p.atrasado,
        encontro: p.encontro,
        tetoDiasPorSegundo: p.laco.tetoDiasPorSegundo,
        passoDias: p.laco.simulador.dtDias,
        larguraVisivelUa: larguraVisivelUa(p.camera, p.larguraPx / Math.max(1, p.alturaPx)),
        exposicao: p.cena?.exposicao ?? 1,
        rotulos: p.rotulos,
        distanciaAoAlvoUa: p.camera.raio,
        // Sem o turbo: a tira diz que Shift multiplica por quatro.
        velocidadeDeVooUaPorS: velocidadeDeVooUaPorS(p.camera, false),
        backend: p.backend,
        aoMontarCanvas: (canvas: HTMLCanvasElement) => {
          void montarCena(p, canvas, desenhar);
        },
      }),
      raiz,
    );
  };
  return desenhar;
}

/**
 * A curva do laboratorio, guardada com a chave do que a produziu. O laboratorio abre
 * com a cena pausada; sem a memoria, cada publicacao a 8 Hz refaria a decomposicao de
 * Fourier para o mesmo resultado.
 */
export function criarCurvaDoLaboratorio(p: Programa, c: Consultas): () => CurvaDoLaboratorio | null {
  let memoria: { chave: string; curva: CurvaDoLaboratorio | null } | null = null;
  return () => {
    const e = ui.value;
    if (e.telaAberta !== 'laboratorio') return null;
    const i = c.indiceDe(e.selecionado);
    if (i <= 0) return null;
    const chave = `${e.selecionado}@${p.laco.simulador.estado.tDias}`;
    if (memoria?.chave !== chave) memoria = { chave, curva: curvaDoLaboratorio(p.laco.simulador.estado, i) };
    return memoria.curva;
  };
}

/** Le o tamanho em pixels CSS; quem escreve `canvas.width` e o `setSize` do renderizador. */
function dimensionar(p: Programa): void {
  if (!p.canvas || !p.cena) return;
  p.larguraPx = Math.max(1, p.canvas.clientWidth);
  p.alturaPx = Math.max(1, p.canvas.clientHeight);
  p.cena.redimensionar(p.larguraPx, p.alturaPx);
}

async function montarCena(p: Programa, canvas: HTMLCanvasElement, desenhar: () => void): Promise<void> {
  if (p.canvas === canvas) return;
  p.canvas = canvas;
  const { renderizador, backend, motivoDaQueda } = await criarRenderizador(canvas);
  // Pixels CSS, com teto de 2: o piso em pixels dos corpos nao conhece devicePixelRatio.
  renderizador.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  p.backend = motivoDaQueda ? `${backend} (${motivoDaQueda})` : backend;
  // O periodo de cada corpo dita o intervalo de amostragem do rastro dele.
  const periodos = p.catalogo.corpos.map((_, i) =>
    i === 0 ? null : elementosOsculadores(p.catalogo.estado, i).periodoDias,
  );
  // A lista VIVA: o sandbox empurra e tira corpos dela, e a cena precisa ver isso.
  p.cena = criarCena(renderizador, p.catalogo.corpos, periodos);
  dimensionar(p);
  new ResizeObserver(() => dimensionar(p)).observe(canvas);
  ligarPonteiro(canvas, {
    despachar,
    alturaPx: () => p.alturaPx,
    aoClicar: (x, y, duplo) => {
      if (ui.value.modoDeUso !== 'criar') {
        // Clicar escolhe o corpo; o duplo clique chega perto (3 raios), como a tecla 4.
        const chave = p.cena?.corpoEm(x, y, p.larguraPx, p.alturaPx) ?? null;
        if (!chave) return;
        despachar({ tipo: 'selecionar', chave });
        if (duplo) despachar({ tipo: 'trocar-modo', modo: 'perto' });
        return;
      }
      const e = p.laco.simulador.estado;
      const alvo = ondeOCliqueCai(p, e.pos[2]!, x, y);
      if (!alvo) return;
      despachar({ tipo: 'mirar-colocacao', pos: alvo.pos });
      // Mudar em silencio o significado do gesto poria o corpo noutro lugar sem dizer.
      if (alvo.trocouDePlano) {
        despachar({
          tipo: 'avisar',
          texto:
            'A câmera está quase de lado em relação ao plano dos planetas, e ali um ponto na ' +
            'tela não decide uma posição nesse plano. O corpo foi colocado no plano da câmera, ' +
            'à distância do alvo. Use T para alinhar com o plano dos planetas.',
        });
      }
    },
  });
  desenhar();
}
