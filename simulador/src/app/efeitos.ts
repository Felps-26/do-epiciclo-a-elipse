/**
 * O que os efeitos do reducer fazem fora dele: mexer na camera, na cena, na fisica e
 * no sistema do sandbox. O reducer e puro e nao ve nada disso.
 */
import { PASSO_CURTO_DIAS, PRECISOES } from '../nucleo/integrador.ts';
import {
  ELEVACAO_MAXIMA,
  alturaVisivelUa,
  aproximar,
  aproximarEm,
  deslocar,
  orbitar,
} from '../cena/camera/cameraOrbital.ts';
import { iniciarTransicao } from '../cena/camera/transicao.ts';
import {
  ELEVACAO_DE_CHEGADA,
  FASE_DE_CHEGADA_GRAUS,
  FASE_DO_LADO_ILUMINADO_GRAUS,
  azimuteParaFase,
  enquadrar,
} from '../cena/camera/enquadramento.ts';
import type { Efeito } from './aplicar.ts';
import type { Acao } from './acoes.ts';
import type { Consultas } from './consultas.ts';
import type { EstadoUi } from './estadoUi.ts';
import type { Programa } from './programa.ts';
import { ancoraDoCursor, porExtenso, velocidadeParaOrbita } from './sandboxNaTela.ts';

export function criarAplicadorDeEfeitos(
  p: Programa,
  c: Consultas,
  lerUi: () => EstadoUi,
  despachar: (acao: Acao) => void,
  publicarMudanca: () => void,
): (efeito: Efeito) => void {
  const { camera } = p;

  return (efeito) => {
    p.laco.aplicarEfeito(efeito);
    switch (efeito.tipo) {
      case 'orbitar-camera':
        orbitar(camera, efeito.azimute, efeito.elevacao);
        p.transicao = null;
        break;

      case 'deslocar-camera': {
        // O unico lugar que converte fracao em UA: so aqui se conhece a altura visivel.
        const h = alturaVisivelUa(camera);
        deslocar(camera, efeito.fracaoX * h, efeito.fracaoY * h);
        p.transicao = null;
        break;
      }

      case 'ajustar-zoom': {
        // A roda cancela a transicao, senao ficaria morta meio segundo depois de cada
        // enquadramento. Acompanhando, o zoom e centrado: ancorar no cursor move o pivo,
        // e o acompanhamento o reescreveria no quadro seguinte.
        p.transicao = null;
        const ancora =
          efeito.ancora && lerUi().acompanhado === null ? ancoraDoCursor(p, efeito.ancora[0], efeito.ancora[1]) : null;
        if (ancora) aproximarEm(camera, efeito.fator, ancora);
        else aproximar(camera, efeito.fator);
        break;
      }

      case 'tela-cheia': {
        // A recusa do navegador vira aviso escrito: o modo imersivo funciona sem ela.
        if (efeito.querer) {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.().then(
              () => despachar({ tipo: 'avisar', texto: '' }),
              () =>
                despachar({
                  tipo: 'avisar',
                  texto:
                    'O navegador não deu a tela cheia. O modo imersivo continua valendo: os controles recuaram e as teclas de voo funcionam.',
                }),
            );
          }
        } else if (document.fullscreenElement) {
          void document.exitFullscreen?.();
        }
        // A troca de tela cheia rouba o foco por um instante, e um `keyup` perdido
        // deixaria a camera voando sozinha.
        p.voo.soltar();
        break;
      }

      case 'vista-superior':
        p.transicao = iniciarTransicao(camera.raio, camera.azimute, ELEVACAO_MAXIMA);
        break;

      case 'enquadrar': {
        const destino = enquadrar(efeito.modo, c.posicaoDoSol(), c.dadosDoAlvo(efeito.alvo), c.emMaquete());
        if (efeito.modo === 'perto' && efeito.alvo && efeito.alvo !== 'sol') {
          const azimute = azimuteParaFase(
            destino.pivo,
            c.posicaoDoSol(),
            camera.azimute,
            ELEVACAO_DE_CHEGADA,
            FASE_DE_CHEGADA_GRAUS,
          );
          p.transicao = iniciarTransicao(destino.raio, azimute, ELEVACAO_DE_CHEGADA);
        } else {
          p.transicao = iniciarTransicao(destino.raio, camera.azimute, camera.elevacao);
        }
        break;
      }

      case 'lado-iluminado': {
        const azimute = azimuteParaFase(
          camera.pivo,
          c.posicaoDoSol(),
          camera.azimute,
          ELEVACAO_DE_CHEGADA,
          FASE_DO_LADO_ILUMINADO_GRAUS,
        );
        p.transicao = iniciarTransicao(camera.raio, azimute, ELEVACAO_DE_CHEGADA);
        break;
      }

      case 'capturar-tela':
        p.capturaPendente = true;
        break;

      case 'reiniciar-fisica':
        p.cena?.limparTrilhas();
        // O meridiano desenhado tambem volta: o teto de giro acumula um atraso, e
        // "Voltar ao inicio" promete o estado de partida inteiro.
        p.cena?.zerarGiro();
        camera.pivo = [0, 0, 0];
        p.transicao = iniciarTransicao(31.5, -Math.PI / 2, 0.45);
        break;

      // -- sandbox ------------------------------------------------------------
      case 'criar-corpo': {
        const resultado = p.vivo.criar({
          predefinicao: efeito.predefinicao,
          pos: efeito.pos,
          vel: velocidadeParaOrbita(p, efeito.pos, efeito.fracaoDaCircular),
          dtDias: p.laco.simulador.dtDias,
          diaSimulado: p.laco.simulador.estado.tDias,
        });
        if (!resultado.ok) {
          despachar({
            tipo: 'recusar-criacao',
            texto: porExtenso(resultado.recusa),
            passoCurtoResolve:
              resultado.recusa.tipo === 'periastro' &&
              resultado.recusa.veredito.passoSugeridoDias !== null &&
              p.laco.simulador.dtDias !== PASSO_CURTO_DIAS,
          });
          break;
        }
        publicarMudanca();
        despachar({ tipo: 'mirar-colocacao', pos: null });
        despachar({ tipo: 'selecionar', chave: resultado.chave });
        break;
      }

      case 'apagar-corpo':
        if (p.vivo.apagar(efeito.chave)) publicarMudanca();
        break;

      case 'desfazer': {
        const o = p.vivo.desfazer();
        publicarMudanca();
        if (o) despachar({ tipo: 'avisar', texto: `Desfeito: ${o}.` });
        break;
      }

      case 'restaurar-sistema':
        p.vivo.restaurar();
        p.cena?.limparTrilhas();
        publicarMudanca();
        despachar({ tipo: 'avisar', texto: 'De volta ao Sistema Solar da efeméride do JPL.' });
        break;

      case 'usar-passo-curto':
        p.passoCurtoPedido = true;
        p.laco.simulador.dtDias = PASSO_CURTO_DIAS;
        break;

      case 'definir-precisao': {
        const precisao = PRECISOES[efeito.precisao];
        p.laco.simulador.integrador = precisao.integrador;
        p.laco.simulador.dtDias =
          efeito.precisao === 'padrao' && p.passoCurtoPedido ? PASSO_CURTO_DIAS : precisao.passoDias;
        break;
      }

      default:
        break;
    }
  };
}
