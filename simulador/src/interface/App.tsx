/**
 * A casca do programa.
 *
 * O primeiro elemento focavel e o link de pular para o conteudo, para quem navega por
 * teclado nao atravessar a barra inteira ate a cena.
 *
 * O ouvinte de teclado vive aqui, no documento e nao no canvas: um atalho que so
 * funciona com o canvas em foco quase nunca funciona. `escopoDeTeclado` decide quem
 * fica com cada tecla.
 */
import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { BarraSuperior } from './componentes/BarraSuperior.tsx';
import { Lateral } from './componentes/Lateral.tsx';
import { Visor } from './componentes/Visor.tsx';
import { RegioesVivas } from './componentes/RegioesVivas.tsx';
import { Imersivo } from './componentes/Imersivo.tsx';
import { Telas } from './modais/telas.tsx';
import { Laboratorio } from './laboratorio/Laboratorio.tsx';
import { despachar, ui } from './estado.ts';
import { resolver } from '../app/atalhos.ts';
import { TECLAS_DE_VOO } from '../app/voo.ts';
import { ESCADA_DIAS_POR_SEGUNDO, dataDaSimulacao } from '../nucleo/relogio.ts';
import type { LeituraDeCorpo } from '../contratos/instantaneo.ts';
import type { ItemDeCorpo } from './componentes/ListaDeCorpos.tsx';
import type { RotuloColocado } from '../rotulos/posicionador.ts';
import type { AnaliseDoSolNaTela, DadosTecnicos } from '../contratos/instantaneo.ts';
import type { CurvaDoLaboratorio } from '../nucleo/efemerides.ts';

export interface AppProps {
  corpos: readonly ItemDeCorpo[];
  leituras: readonly LeituraDeCorpo[];
  jd: number;
  tDias: number;
  atrasado: boolean;
  encontro: string | null;
  tetoDiasPorSegundo: number;
  /**
   * O passo da física, em dias. Normalmente 0,5; vira 0,125 com o passo curto. Chega à
   * interface porque passou a ter um efeito permanente e visível: a escada de
   * velocidade encolhe por um quarto. Sem dizer por quê, o programa ficaria mais lento
   * para sempre depois de uma escolha feita uma vez, com a explicação só no painel
   * técnico, que é uma opção desligada.
   */
  passoDias: number;
  larguraVisivelUa: number;
  distanciaAoAlvoUa: number;
  backend: string;
  exposicao: number;
  rotulos: readonly RotuloColocado[];
  /**
   * A analise do Sol, ja em unidades de tela. Vem pronta de `principal.ts`
   * porque a interface nao ve o estado fisico — quem le `EstadoSistema` e o
   * laco, e o que atravessa a fronteira e numero, nao estrutura.
   */
  sol: AnaliseDoSolNaTela | null;
  /** Só é lido quando a opção "Mostrar dados técnicos" está ligada. */
  tecnicos: DadosTecnicos | null;
  /** A órbita a decompor. Só vem preenchida com o laboratório aberto. */
  curvaDoLaboratorio: CurvaDoLaboratorio | null;
  /** Os corpos que a pessoa criou, na ordem em que foram criados. */
  criados: readonly { chave: string; nome: string }[];
  /**
   * UA por segundo que o voo percorre agora, sem o turbo. Vem do laço porque depende do
   * raio da câmera, que vive fora do estado da interface (a câmera é da cena), como
   * `larguraVisivelUa`.
   */
  velocidadeDeVooUaPorS: number;
  aoMontarCanvas: (canvas: HTMLCanvasElement) => void;
}

export function App(props: AppProps): JSX.Element {
  const e = ui.value;

  useEffect(() => {
    function aoTeclar(ev: KeyboardEvent): void {
      // No modo imersivo as seis letras do voo sao do voo e nao atalhos. Sem esta linha,
      // apertar S para ir para tras salvaria uma imagem da tela a cada repeticao do
      // teclado, e A e D disparariam coisas invisiveis. "Nenhum atalho e a unica forma de
      // fazer alguma coisa" continua valendo: sair do modo devolve a barra e a lateral,
      // onde cada uma tem botao escrito.
      if (ui.value.modoDeUso === 'voar' && TECLAS_DE_VOO[ev.key.toLowerCase()] !== undefined) return;

      // Com uma caixa aberta, o Esc e dela. O `<dialog>` fecha sozinho no Esc e emite
      // `cancel`, que ja despacha `fechar`; este ouvinte tambem resolvia Esc para `fechar`,
      // e um toque produzia dois despachos. Foi inofensivo ate o Esc ganhar um segundo
      // significado, sair do modo imersivo quando nao ha caixa aberta: o primeiro despacho
      // fechava a caixa e o segundo, vendo que ja nao havia caixa, tirava a pessoa do modo.
      if (ev.key === 'Escape' && document.querySelector('dialog[open]')) return;
      const alvo = ev.target as HTMLElement | null;
      const acao = resolver(ev, alvo ? { tagName: alvo.tagName, isContentEditable: alvo.isContentEditable, role: alvo.getAttribute('role') } : null);
      if (!acao) return;
      ev.preventDefault();
      despachar(acao);
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, []);

  // "Texto maior" e um numero numa variavel CSS; tudo mede em rem.
  useEffect(() => {
    document.documentElement.style.setProperty('--escala-texto', e.opcoes.textoMaior ? '1.25' : '1');
  }, [e.opcoes.textoMaior]);

  useEffect(() => {
    document.documentElement.dataset['reduzirAnimacao'] = e.opcoes.reduzirAnimacao ? 'sim' : 'nao';
  }, [e.opcoes.reduzirAnimacao]);

  const nomeDe = (chave: string | null): string | null =>
    chave ? (props.corpos.find((c) => c.chave === chave)?.nome ?? null) : null;

  const leitura = props.leituras.find((l) => l.chave === e.selecionado) ?? null;
  const degraus = ESCADA_DIAS_POR_SEGUNDO.filter((v) => v <= props.tetoDiasPorSegundo);

  // No modo imersivo a barra e a lateral recuam. O `<canvas>` ja ocupa a area
  // inteira por CSS; o que muda aqui e quem existe no DOM ao lado dele.
  const imersivo = e.modoDeUso === 'voar';
  const comLateral = e.lateralAberta && !imersivo;

  return (
    <>
      <a class="pular" href="#conteudo">
        Pular para a simulação
      </a>

      {imersivo ? null : (
        <BarraSuperior
          data={dataDaSimulacao(props.jd - props.tDias, props.tDias)}
          noTeto={e.diasPorSegundo >= (degraus[degraus.length - 1] ?? 0)}
          noPiso={e.diasPorSegundo <= (degraus[0] ?? 0)}
        />
      )}

      <main
        id="conteudo"
        class={`corpo${comLateral ? '' : ' corpo--sem-lateral'}${imersivo ? ' corpo--imersivo' : ''}`}
      >
        <Visor
          larguraVisivelUa={props.larguraVisivelUa}
          distanciaAoAlvoUa={props.distanciaAoAlvoUa}
          atrasado={props.atrasado}
          encontro={props.encontro}
          backend={props.backend}
          exposicao={props.exposicao}
          rotulos={props.rotulos}
          passoDias={props.passoDias}
          tecnicos={props.tecnicos}
          aoMontarCanvas={props.aoMontarCanvas}
        />
        {imersivo ? (
          <Imersivo velocidadeUaPorS={props.velocidadeDeVooUaPorS} exposicao={props.exposicao} />
        ) : null}
        {imersivo ? null : e.telaAberta === 'laboratorio' ? (
          // A lamina do laboratorio SUBSTITUI a lateral: as duas juntas
          // deixariam a cena com menos de metade da largura, e a cena e a
          // outra metade do que o laboratorio mostra.
          <Laboratorio
            nome={nomeDe(e.selecionado) ?? 'Nenhum corpo'}
            curva={props.curvaDoLaboratorio}
          />
        ) : comLateral ? (
          <Lateral
            corpos={props.corpos}
            leitura={leitura}
            criados={props.criados}
          />
        ) : null}
      </main>

      <RegioesVivas />
      <Telas corpos={props.corpos} leituras={props.leituras} sol={props.sol} />
    </>
  );
}
