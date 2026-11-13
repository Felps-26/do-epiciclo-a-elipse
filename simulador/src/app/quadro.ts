/**
 * O que acontece depois da fisica, em cada quadro: a camera, o desenho, os nomes, as
 * reguas do rodape e, a 8 Hz, os numeros que a interface mostra.
 *
 * A camera le o MESMO instantaneo que as malhas vao usar; se lesse outra coisa, o erro
 * de acompanhamento que esta arquitetura elimina voltaria com outra cara.
 */
import { analisarSol } from '../nucleo/analiseSol.ts';
import { distanciaAoSolUa, elementosOsculadores, velocidadeOrbital } from '../nucleo/efemerides.ts';
import { energia, momentoAngular } from '../nucleo/estado.ts';
import { dataDaSimulacao, dataPorExtenso } from '../nucleo/relogio.ts';
import { kmPorS, mPorS2, uaParaKm } from '../nucleo/unidades.ts';
import { LUAS } from '../dados/luas.ts';
import { ENCONTROS } from '../dados/textos.ts';
import { larguraVisivelUa } from '../cena/camera/cameraOrbital.ts';
import { moverPivo } from '../cena/camera/pivo.ts';
import { capturar, nomeDaCaptura } from '../cena/captura.ts';
import { distancia as distanciaEscrita } from '../interface/formato.ts';
import type { RotulosDoQuadro } from '../rotulos/ancoragemNoQuadro.ts';
import type { Instantaneo, LeituraDeCorpo } from '../contratos/instantaneo.ts';
import type { Consultas } from './consultas.ts';
import { LUA_POR_CHAVE } from './consultas.ts';
import type { EstadoUi } from './estadoUi.ts';
import type { Programa } from './programa.ts';

export function criarAoQuadro(
  p: Programa,
  c: Consultas,
  rotulosDoQuadro: RotulosDoQuadro,
  lerUi: () => EstadoUi,
  desenhar: () => void,
): (instantaneo: Instantaneo, dtRealS: number) => void {
  /**
   * Referencias de conservacao, tiradas no estado de partida. Criar ou apagar um corpo
   * muda a energia por um degrau que nao e deriva, e comparar com a referencia velha
   * faria do painel um medidor de quantos corpos voce criou.
   */
  let energiaDeReferencia = 0;
  let momentoDeReferencia = 0;
  /** Media movel do tempo de quadro. Um valor cru pisca a 60 Hz e nao se le. */
  let msPorQuadro = 16.7;
  let ultimaPublicacao = 0;
  let publicacaoAnterior = 0;
  let tDiasAnterior = 0;
  let dtDeTempoSimulado = 0;
  const reguas = criarReguas(p);

  function publicar(agora: number): void {
    const e = p.laco.simulador.estado;
    const sol = analisarSol(e);
    if (energiaDeReferencia === 0) {
      energiaDeReferencia = energia(e);
      momentoDeReferencia = Math.hypot(...momentoAngular(e));
    }
    const passos = dtDeTempoSimulado > 0 ? dtDeTempoSimulado / p.laco.simulador.dtDias : 0;
    dtDeTempoSimulado = 0;
    p.tecnicos = {
      passoDias: p.laco.simulador.dtDias,
      passosPorSegundo: (passos * 1000) / Math.max(1, agora - publicacaoAnterior),
      quadrosPorSegundo: p.laco.quadrosPorSegundo,
      msPorQuadro,
      desvioDeEnergia: Math.abs((energia(e) - energiaDeReferencia) / energiaDeReferencia),
      desvioDeMomentoAngular: Math.abs((Math.hypot(...momentoAngular(e)) - momentoDeReferencia) / momentoDeReferencia),
      corpos: e.n,
      backend: p.backend,
      jdTdb: p.catalogo.jdEpoca + e.tDias,
    };
    publicacaoAnterior = agora;

    // Ordenada aqui: "quem puxa mais primeiro" e decisao de apresentacao.
    p.analiseDoSol = {
      distanciaAoCentroKm: uaParaKm(Math.hypot(...sol.posicaoRelativaUa)),
      velocidadeKmS: kmPorS(Math.hypot(...sol.velocidadeRelativaUaD)),
      aceleracaoMS2: mPorS2(Math.hypot(...sol.aceleracaoUaD2)),
      puxoes: sol.parcelas
        .map((parcela) => ({
          nome: p.catalogo.corpos[parcela.indice]?.nome ?? '?',
          aceleracaoMS2: mPorS2(parcela.modulo),
        }))
        .sort((a, b) => b.aceleracaoMS2 - a.aceleracaoMS2),
    };

    // As luas tem leitura propria: nao orbitam o Sol e o desvio do modelo vai escrito.
    const leiturasDasLuas: LeituraDeCorpo[] = LUAS.map((l) => ({
      chave: l.chave,
      nome: l.nome,
      tipo: 'lua',
      pai: l.pai,
      nomeDoPai: c.nomeDaChave(l.pai),
      distanciaAoPlanetaKm: l.aKm,
      periodoDias: 360 / l.taxaDaAnomaliaMediaGrausDia,
      desvioMedidoKm: l.erroMaximoKm,
    }));
    p.leituras = p.catalogo.corpos.map((corpo, k): LeituraDeCorpo => {
      if (k === 0) {
        return {
          chave: corpo.chave,
          nome: corpo.nome,
          tipo: 'referencial',
          distanciaAoCentroUa: Math.hypot(...sol.posicaoRelativaUa),
          velocidadeKmS: kmPorS(Math.hypot(...sol.velocidadeRelativaUaD)),
        };
      }
      const el = elementosOsculadores(e, k);
      return {
        chave: corpo.chave,
        nome: corpo.nome,
        tipo: 'orbita',
        distanciaAoSolUa: distanciaAoSolUa(e, k),
        velocidadeKmS: kmPorS(velocidadeOrbital(e, k)),
        periodoDias: el.periodoDias,
        ligada: el.ligada,
      };
    });
    p.leituras.push(...leiturasDasLuas);
    desenhar();
  }

  return (instantaneo, dtRealS) => {
    p.atrasado = instantaneo.atrasado;
    p.encontro = instantaneo.encontro
      ? ENCONTROS.passagem(
          p.catalogo.corpos[instantaneo.encontro.corpo]?.nome ?? '?',
          p.catalogo.corpos[instantaneo.encontro.alvo]?.nome ?? '?',
        )
      : null;
    const ui = lerUi();

    // 3. a camera
    const alvo = ui.acompanhado ?? (ui.modo === 'perto' ? ui.selecionado : null);
    p.transicao = moverPivo(
      p.camera,
      p.transicao,
      {
        // `dadosDoAlvo`, e nao o indice: as luas nao tem indice, e voar ate uma lua
        // voava ate o Sol por 0,45 s antes de saltar.
        destino: () => c.dadosDoAlvo(alvo)?.posicao ?? c.posicaoDoSol(),
        posicao: alvo ? c.posicaoDe(alvo) : null,
      },
      p.voo.rumo(),
      dtRealS,
    );

    // 4. o desenho
    const cena = p.cena;
    if (cena) {
      // O sujeito da exposicao e o alvo da camera; selecionar e ato de leitura e nao
      // muda a luz. Acompanhando uma lua, e o planeta dela.
      const i = c.indiceDe(alvo);
      const sujeito = i >= 0 ? i : c.indiceDe((alvo === null ? undefined : LUA_POR_CHAVE.get(alvo))?.pai ?? null);
      cena.definirEstado(p.laco.simulador.estado);
      cena.desenhar(
        instantaneo.pos,
        instantaneo.jd,
        p.camera,
        {
          tamanhoReal: ui.opcoes.tamanhoReal,
          estrelas: ui.opcoes.estrelas,
          orbitas: ui.opcoes.orbitas,
          trilhas: ui.opcoes.trilhas,
          aneisDeDistancia: ui.opcoes.aneisDeDistancia,
          // "Com" e "só elas" diferem em quem ganha nome, e isso e dos rotulos.
          luas: ui.luas !== 'sem',
          vista: ui.vista,
          maquete: ui.escalaVisual === 'maquete',
          alvoDaCamera: alvo,
        },
        sujeito,
      );
      p.rotulos = rotulosDoQuadro.atualizar({
        cena,
        camera: p.camera,
        escolhas: {
          selecionado: ui.selecionado,
          comparando: ui.comparando,
          acompanhado: ui.acompanhado,
          luas: ui.luas,
          modo: ui.modo,
          comNomes: ui.opcoes.rotulos,
        },
        larguraPx: p.larguraPx,
        alturaPx: p.alturaPx,
        dtRealS,
        agoraS: performance.now() / 1000,
      });
    }

    reguas();

    // A captura logo depois de desenhar: com WebGL2 o canvas e descartado na
    // apresentacao, e ler fora do quadro devolveria buffer vazio.
    if (p.capturaPendente && p.canvas) {
      p.capturaPendente = false;
      const data = dataDaSimulacao(p.catalogo.jdEpoca, p.laco.simulador.estado.tDias);
      const exposicao = cena?.exposicao ?? 1;
      const exageros = [
        !ui.opcoes.tamanhoReal ? 'corpos ampliados' : null,
        ui.escalaVisual === 'maquete' ? 'distâncias comprimidas' : null,
        exposicao > 1.5 ? `exposição ×${exposicao.toFixed(0)}` : null,
      ].filter(Boolean);
      capturar({
        canvas: p.canvas,
        larguraCss: p.larguraPx,
        alturaCss: p.alturaPx,
        rotulos: p.rotulos,
        rodape: `${dataPorExtenso(data)}${exageros.length ? ' — ' + exageros.join(', ') : ''}`,
        nomeDoArquivo: nomeDaCaptura(new Date()),
      });
    }

    // Acumulados a cada quadro e lidos a cada publicacao: um quadro isolado varia
    // demais para virar um numero que alguem le.
    dtDeTempoSimulado += p.laco.simulador.estado.tDias - tDiasAnterior;
    tDiasAnterior = p.laco.simulador.estado.tDias;
    msPorQuadro += (dtRealS * 1000 - msPorQuadro) * 0.06;

    const agora = performance.now();
    if (agora - ultimaPublicacao < 125) return;
    ultimaPublicacao = agora;
    publicar(agora);
  };
}

/**
 * As duas reguas embaixo da cena, escritas por `textContent`, por fora do Preact. Com o
 * duplo clique levando a camera ao corpo, a regua muda a cada quadro, e pela arvore
 * Preact (8 Hz) ela andava aos saltos. A string e comparada antes de escrever, porque
 * escrever invalida o layout do no.
 */
function criarReguas(p: Programa): () => void {
  const ultimas = { largura: '', distancia: '' };
  let nos: { largura: HTMLElement | null; distancia: HTMLElement | null } | null = null;
  return () => {
    if (!nos?.largura?.isConnected && !nos?.distancia?.isConnected) {
      nos = {
        largura: document.querySelector('[data-leitura="largura"]'),
        distancia: document.querySelector('[data-leitura="distancia"]'),
      };
    }
    const larguraUa = larguraVisivelUa(p.camera, p.larguraPx / Math.max(1, p.alturaPx));
    const textos = {
      largura: `largura visível no plano do alvo: ${distanciaEscrita(larguraUa)}`,
      distancia: `câmera a ${distanciaEscrita(p.camera.raio)} do alvo`,
    };
    for (const qual of ['largura', 'distancia'] as const) {
      if (ultimas[qual] === textos[qual]) continue;
      ultimas[qual] = textos[qual];
      const no = nos?.[qual];
      if (no?.isConnected) no.textContent = textos[qual];
    }
  };
}
