/**
 * Composicao final: HDR, bloom, tonemapping e so entao a tela.
 *
 *     cena (HDR, sem tonemap) -> bloom -> ACES -> sRGB -> tela -> a interface por cima
 *
 * A ordem nao muda: bloom depois do tonemapping nao e bloom, porque o tonemap ja
 * comprimiu tudo para [0,1] e nao sobra a faixa alta que produz o halo. O Sol, que
 * na cena chega a 6 e mais, viraria branco liso.
 *
 * A interface vem depois de tudo, no DOM e nao dentro do canvas, para nenhum bloom
 * lavar o texto e os 4,5:1 de contraste valerem por construcao.
 *
 * As fatias de profundidade continuam: a cena e desenhada em duas ou mais passadas,
 * com a profundidade limpa entre elas, o que permite ir de 31,5 UA a 1 km de
 * altitude. Todas escrevem no mesmo alvo HDR, e o bloom le o alvo pronto uma vez so.
 */
import { HalfFloatType, RenderTarget, SRGBColorSpace, ACESFilmicToneMapping } from 'three';
import { RenderPipeline, type WebGPURenderer } from 'three/webgpu';
import { renderOutput, texture, uniform } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

export interface Composicao {
  /** O alvo HDR onde as fatias sao desenhadas. */
  alvo: RenderTarget;
  redimensionar(largura: number, altura: number, pixelRatio: number): void;
  /** Leva o alvo para a tela, com bloom e tonemapping. */
  apresentar(exposicao: number): void;
  definirForcaDoBloom(forca: number): void;
}

/**
 * Limiar do bloom: so floresce o que passa de 1,0 em luz linear. Com o limiar em
 * zero tudo ganha halo e a cena fica leitosa; em 1,0 florescem o Sol e as estrelas
 * mais brilhantes, como numa optica de verdade.
 */
const LIMIAR = 1.0;
const RAIO = 0.55;

export function criarComposicao(renderizador: WebGPURenderer): Composicao {
  // `?msaa=0` tira o antisserrilhado do alvo. Existe para diagnostico: as fatias de
  // profundidade carregam a cor de uma passada para a outra, e e esse carregamento
  // que depende do driver quando o alvo e multiamostrado.
  const amostras = new URLSearchParams(location.search).get('msaa') === '0' ? 0 : 4;
  function novoAlvo(l: number, a: number): RenderTarget {
    return new RenderTarget(l, a, {
      type: HalfFloatType, // HDR: sem isto o valor 6 do Sol seria cortado em 1
      depthBuffer: true,
      samples: amostras,
    });
  }

  let alvo = novoAlvo(1, 1);

  const forca = uniform(0.7);
  const exposicaoNo = uniform(1);

  /**
   * Grafo de composicao, refeito a cada redimensionamento.
   *
   * `RenderTarget.setSize` quebra o pipeline que le o alvo. O grafo era montado uma
   * vez, na abertura, e depois de qualquer mudanca de tamanho o passe de composicao
   * lia um recurso que nao existia mais: a tela ficava preta. Medido na cena de
   * partida: brilho medio 5,9 antes de esconder o painel e 0,76 depois, sem voltar ao
   * mostrar o painel. Re-apontar `cor.value` para `alvo.texture` nao bastava, porque o
   * objeto `Texture` e o mesmo; quem ficava para tras era o pipeline.
   *
   * O botao "Esconder painel" redimensiona o canvas, entao bastava ele, ao lado da
   * Ajuda, para apagar o programa. `e2e/precisao.spec.ts` esconde e mostra o painel mas
   * mede `__projecoes`, que vem da CPU e continua certa com a tela preta.
   *
   * Refazer custa uma recompilacao de shader, e redimensionar e raro (janela ou painel
   * mudando de tamanho, nunca por quadro). O `if` de igualdade em `redimensionar`
   * garante isso.
   */
  function montarPipeline(): RenderPipeline {
    const cor = texture(alvo.texture);
    const comBloom = cor.add(bloom(cor, forca, RAIO, LIMIAR));
    // A exposicao entra ANTES do tonemap, como numa camera: e o diafragma, e
    // nao um ajuste de brilho depois da foto pronta.
    return new RenderPipeline(
      renderizador,
      renderOutput(comBloom.mul(exposicaoNo), ACESFilmicToneMapping, SRGBColorSpace),
    );
  }

  let pipeline = montarPipeline();

  return {
    get alvo() {
      return alvo;
    },
    redimensionar(largura, altura, pixelRatio) {
      const l = Math.max(1, Math.round(largura * pixelRatio));
      const a = Math.max(1, Math.round(altura * pixelRatio));
      if (l === alvo.width && a === alvo.height) return;
      // Um alvo NOVO, e nao `setSize` no antigo. Ver `montarPipeline`.
      const velho = alvo;
      alvo = novoAlvo(l, a);
      velho.dispose();
      // O grafo inteiro e refeito: ver `montarPipeline`.
      pipeline = montarPipeline();
    },
    apresentar(exposicao) {
      exposicaoNo.value = exposicao;
      pipeline.render();
    },
    definirForcaDoBloom(f) {
      forca.value = f;
    },
  };
}
