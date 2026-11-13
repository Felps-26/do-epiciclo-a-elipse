/**
 * Liga o relogio de parede ao relogio da simulacao, com honestidade.
 *
 * "365 dias por segundo" a 60 quadros por segundo sao 6 dias por quadro, ou 12
 * passos de meio dia, e cabe. "100 mil dias por segundo" nenhuma maquina
 * entrega.
 *
 * Tres jeitos de lidar com isso estariam errados:
 *
 *   1. Aumentar o passo de integracao para cobrir mais tempo degrada a fisica
 *      em silencio: a orbita continua bonita e fica errada.
 *   2. Acumular a divida e pagar depois trava a simulacao tentando alcancar.
 *   3. Pular passos faz a data na tela deixar de corresponder ao estado fisico.
 *
 * Este modulo entrega os passos que couberem no orcamento, descarta o excedente
 * e avisa (`atrasado`). A data mostrada e sempre `t0 + n*dt` exatos, e a
 * interface diz que a velocidade real esta abaixo da pedida.
 *
 * O relogio e injetado em vez de chamar `performance.now()`: assim um teste
 * consegue simular um quadro lento, e o lint que proibe `performance` dentro do
 * nucleo continua valendo.
 */
import { PADRAO, PASSO_CURTO_DIAS, PASSO_PADRAO_DIAS, type Integrador } from './integrador.ts';
import { colisaoNoPasso, colisaoPrevista, encontroProximo, haCriado, type Par, type Vigia } from './encontros.ts';
import { removerCorpo } from './estado.ts';
import { ajustarRascunho, criarRascunho, type EstadoSistema, type Rascunho } from './tipos.ts';

/** Devolve milissegundos monotonicos. Injetada; nunca lida daqui de dentro. */
export type Cronometro = () => number;

export interface RelatorioPasso {
  passos: number;
  diasPedidos: number;
  diasDados: number;
  /** Verdadeiro quando o orcamento nao coube e o excedente foi descartado. */
  atrasado: boolean;
  msGastos: number;
  /** Corpo criado perto de outro com massa no fim do quadro; o passo foi encurtado. */
  encontro?: Par | null;
  /** Corpos criados removidos por colisao neste quadro, na ordem em que sairam. */
  colisoes?: Colisao[];
}

/** `corpo` e o indice no momento da remocao: aplicar em ordem mantem as listas alinhadas. */
export interface Colisao extends Par {
  tDias: number;
}

export function fracaoEntregue(r: RelatorioPasso): number {
  return r.diasPedidos <= 0 ? 1 : r.diasDados / r.diasPedidos;
}

const PARADO: RelatorioPasso = {
  passos: 0,
  diasPedidos: 0,
  diasDados: 0,
  atrasado: false,
  msGastos: 0,
};

export interface OpcoesSimulador {
  integrador?: Integrador;
  dtDias?: number;
  passosMaxPorQuadro?: number;
  cronometro?: Cronometro;
  quadrosPorSegundo?: number;
  /** Sem ela, nenhum encontro e vigiado. */
  vigia?: Vigia;
}

export class Simulador {
  estado: EstadoSistema;
  integrador: Integrador;
  dtDias: number;
  passosMaxPorQuadro: number;
  quadrosPorSegundo: number;

  vigia: Vigia | null;
  private readonly cronometro: Cronometro;
  private antes = new Float64Array(0);
  private rascunho: Rascunho;
  /** Fracao de passo que sobrou do quadro anterior. */
  private residuo = 0;
  /** O residuo e de um sentido so: trocar de sentido o zera. */
  private sentido: 1 | -1 = 1;

  constructor(estado: EstadoSistema, opcoes: OpcoesSimulador = {}) {
    this.estado = estado;
    this.integrador = opcoes.integrador ?? PADRAO;
    this.dtDias = opcoes.dtDias ?? PASSO_PADRAO_DIAS;
    this.passosMaxPorQuadro = opcoes.passosMaxPorQuadro ?? 140;
    this.quadrosPorSegundo = opcoes.quadrosPorSegundo ?? 60;
    this.cronometro = opcoes.cronometro ?? (() => 0);
    this.vigia = opcoes.vigia ?? null;
    this.rascunho = criarRascunho(estado.capacidade);
  }

  /** Teto que este orcamento sustenta na taxa de atualizacao medida. */
  get diasPorSegundoMaximo(): number {
    return this.passosMaxPorQuadro * this.dtDias * this.quadrosPorSegundo;
  }

  reiniciar(estado: EstadoSistema): void {
    this.estado = estado;
    this.rascunho = ajustarRascunho(this.rascunho, estado.capacidade);
    this.residuo = 0;
  }

  /** Chamar apos inserir ou remover corpos, para o rascunho acompanhar. */
  revalidar(): void {
    this.rascunho = ajustarRascunho(this.rascunho, this.estado.capacidade);
  }

  /**
   * Avanca o tempo simulado correspondente a `dtRealS` segundos reais. Velocidade
   * negativa anda para tras: o integrador e reversivel, e o passo vai com sinal.
   */
  avancar(dtRealS: number, diasPorSegundo: number): RelatorioPasso {
    const comSinal = Math.max(0, dtRealS) * diasPorSegundo;
    if (comSinal === 0 || !Number.isFinite(comSinal)) return { ...PARADO };
    const sentido: 1 | -1 = comSinal < 0 ? -1 : 1;
    if (sentido !== this.sentido) {
      this.sentido = sentido;
      this.residuo = 0;
    }
    const pedidos = Math.abs(comSinal);

    // O residuo guarda a fracao de passo nao usada, para que velocidades
    // abaixo de um passo por quadro avancem suavemente em vez de ficarem
    // paradas ate juntar um passo inteiro.
    this.residuo += pedidos;
    // Sem corpo criado o caminho e o de sempre, passo a passo identico ao
    // validado contra o JPL: a vigia nao pode mexer nos nove por acidente.
    if (this.vigia && haCriado(this.estado, this.vigia)) return this.avancarVigiado(pedidos, this.vigia);
    const querido = Math.trunc(this.residuo / this.dtDias);
    const passos = Math.min(querido, this.passosMaxPorQuadro);
    const atrasado = passos < querido;

    const t0 = this.cronometro();
    for (let k = 0; k < passos; k++) {
      this.integrador.passo(this.estado, sentido * this.dtDias, this.rascunho);
    }
    this.estado.tDias += sentido * passos * this.dtDias;
    const msGastos = this.cronometro() - t0;

    if (atrasado) {
      this.residuo = 0; // descarta o excedente, sem acumular divida
    } else {
      this.residuo -= passos * this.dtDias;
    }

    return { passos, diasPedidos: pedidos, diasDados: passos * this.dtDias, atrasado, msGastos };
  }

  /**
   * O mesmo orcamento, com o passo escolhido a cada passo: curto enquanto um
   * corpo criado esta na vizinhanca de outro com massa, normal fora dela.
   */
  private avancarVigiado(pedidos: number, vigia: Vigia): RelatorioPasso {
    const colisoes: Colisao[] = [];
    let passos = 0;
    let dados = 0;
    let encontro = encontroProximo(this.estado, vigia);
    const passoDe = (): number => (encontro ? Math.min(this.dtDias, PASSO_CURTO_DIAS) : this.dtDias);

    const t0 = this.cronometro();
    while (passos < this.passosMaxPorQuadro && this.residuo - dados >= passoDe()) {
      const dt = this.sentido * passoDe();
      const e = this.estado;
      let prevista = colisaoPrevista(e, vigia, dt);
      while (prevista) {
        colisoes.push({ corpo: prevista.corpo, alvo: prevista.alvo, tDias: e.tDias + Math.sign(dt) * prevista.emDias });
        removerCorpo(e, prevista.corpo);
        prevista = colisaoPrevista(e, vigia, dt);
      }
      if (colisoes.length > 0 && !haCriado(e, vigia)) {
        encontro = null;
        break;
      }
      if (this.antes.length < 3 * e.n) this.antes = new Float64Array(3 * e.capacidade);
      this.antes.set(e.pos.subarray(0, 3 * e.n));
      this.integrador.passo(e, dt, this.rascunho);
      e.tDias += dt;
      dados += Math.abs(dt);
      passos++;

      // Sem fusao de massa: o corpo criado sai, e o alvo segue como estava.
      let c = colisaoNoPasso(this.antes, e, vigia);
      while (c) {
        colisoes.push({ ...c, tDias: e.tDias });
        removerCorpo(e, c.corpo);
        this.antes.copyWithin(3 * c.corpo, 3 * (c.corpo + 1), 3 * (e.n + 1));
        c = colisaoNoPasso(this.antes, e, vigia);
      }
      if (colisoes.length > 0 && !haCriado(e, vigia)) {
        encontro = null;
        break;
      }
      encontro = encontroProximo(e, vigia);
    }
    const msGastos = this.cronometro() - t0;

    const atrasado = passos >= this.passosMaxPorQuadro && this.residuo - dados >= passoDe();
    this.residuo = atrasado ? 0 : Math.max(0, this.residuo - dados);
    return { passos, diasPedidos: pedidos, diasDados: dados, atrasado, msGastos, encontro, colisoes };
  }

  /** Pausa e avanca exatamente um passo. Aceita dt negativo. */
  passoUnico(sentido: 1 | -1 = 1): void {
    this.integrador.passo(this.estado, sentido * this.dtDias, this.rascunho);
    this.estado.tDias += sentido * this.dtDias;
    this.residuo = 0;
  }
}
