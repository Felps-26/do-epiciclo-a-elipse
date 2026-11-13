/**
 * O estado do programa que nao e da fisica nem da interface: a camera, a cena, o
 * tamanho do canvas e o que a ultima publicacao calculou para a tela.
 *
 * Mora num objeto so, passado a quem precisa, e nao em variaveis soltas de um
 * modulo: assim cada pedaco de `principal.ts` pode morar no proprio arquivo sem
 * importar um estado global escondido.
 */
import type { Catalogo } from '../dados/carregar.ts';
import type { Cena } from '../cena/cena.ts';
import type { EstadoCamera } from '../cena/camera/cameraOrbital.ts';
import type { Transicao } from '../cena/camera/transicao.ts';
import type { AnaliseDoSolNaTela, DadosTecnicos, LeituraDeCorpo } from '../contratos/instantaneo.ts';
import type { RotuloColocado } from '../rotulos/posicionador.ts';
import type { ItemDeCorpo } from '../interface/componentes/ListaDeCorpos.tsx';
import type { Laco } from './laco.ts';
import type { SistemaVivo } from './sistemaVivo.ts';
import type { Voo } from './voo.ts';

export interface Programa {
  readonly catalogo: Catalogo;
  readonly camera: EstadoCamera;
  readonly vivo: SistemaVivo;
  readonly voo: Voo;
  /** Criado depois do programa, porque o laco chama de volta quem o programa monta. */
  laco: Laco;
  cena: Cena | null;
  canvas: HTMLCanvasElement | null;
  backend: string;
  /** Pixels CSS do canvas. */
  larguraPx: number;
  alturaPx: number;
  transicao: Transicao | null;
  /** A lista lateral: corpos da fisica e luas. */
  corpos: ItemDeCorpo[];
  leituras: LeituraDeCorpo[];
  analiseDoSol: AnaliseDoSolNaTela | null;
  tecnicos: DadosTecnicos | null;
  rotulos: RotuloColocado[];
  atrasado: boolean;
  /** A frase da vigia de encontros, enquanto o passo esta encurtado por ela. */
  encontro: string | null;
  /** O passo curto pedido pelo sandbox sobrevive a voltar da precisao alta para a padrao. */
  passoCurtoPedido: boolean;
  /** Uma captura pedida, atendida no fim do proximo quadro desenhado. */
  capturaPendente: boolean;
}
