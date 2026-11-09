/**
 * Integradores simpleticos. O erro de energia oscila em torno de zero em vez de
 * crescer, o que importa numa simulacao que pode rodar por seculos simulados.
 * Runge-Kutta 4 erra menos num passo isolado, mas a orbita encolhe aos poucos.
 *
 * O padrao e Yoshida de 4a ordem com passo fixo de 0,5 dia. Erro de posicao de
 * Mercurio contra o JPL Horizons em 10 anos (avaliacoes de forca contadas com a
 * aceleracao reaproveitada entre passos):
 *
 *     leapfrog dt=0,25 d      14 610 avaliacoes    erro 1,0e6 km
 *     leapfrog dt=0,021 d    175 320 avaliacoes    erro 5,4e3 km
 *     Yoshida4 dt=0,5 d       21 915 avaliacoes    erro 1,4e4 km
 *
 * Para chegar ao erro do Yoshida o leapfrog precisa de mais de cinco vezes o
 * custo.
 *
 * O passo e fixo porque o variavel quebra a propriedade simpletica, e o fixo
 * faz a data exibida ser sempre `t0 + n * 0,5 dia`.
 */
import { aceleracao, somarCorrecaoRelativistica } from './forcas.ts';
import type { EstadoSistema, Rascunho } from './tipos.ts';

export const PASSO_PADRAO_DIAS = 0.5;

/**
 * Passo curto, oferecido quando o sandbox cria um corpo de orbita rapida.
 * 0,125 e divisor binario exato de 0,5, entao `tDias` continua exato.
 */
export const PASSO_CURTO_DIAS = 0.125;

export interface Integrador {
  readonly nome: string;
  readonly avaliacoesPorPasso: number;
  /** Avanca (pos, vel) por um passo dt, no lugar. Nao guarda estado entre chamadas. */
  passo(estado: EstadoSistema, dt: number, rascunho: Rascunho): void;
}

function somarEscalado(alvo: Float64Array, fonte: Float64Array, k: number, ate: number): void {
  for (let i = 0; i < ate; i++) alvo[i]! += k * fonte[i]!;
}

/**
 * Velocity Verlet de 2a ordem. Referencia independente do Yoshida nos testes,
 * simples o bastante para um erro nele ser visivel a olho.
 *
 * Calcula a aceleracao duas vezes por passo, sem reaproveitar a do passo
 * anterior, para nao guardar estado entre chamadas.
 */
export const leapfrog: Integrador = {
  nome: 'leapfrog',
  avaliacoesPorPasso: 2,
  passo(estado, dt, rascunho) {
    const m = 3 * estado.n;
    aceleracao(estado, rascunho);
    somarEscalado(estado.vel, rascunho.acel, 0.5 * dt, m);
    somarEscalado(estado.pos, estado.vel, dt, m);
    aceleracao(estado, rascunho);
    somarEscalado(estado.vel, rascunho.acel, 0.5 * dt, m);
  },
};

/**
 * Coeficientes de Yoshida (1990): tres passos de leapfrog encadeados, o do
 * meio com sinal negativo. Os termos de erro de 2a ordem se cancelam e sobra
 * erro de 4a ordem.
 *
 * Sao literais de 17 digitos, e nao calculados, para o valor nao depender de
 * `Math.cbrt` concordar com `2 ** (1/3)` no ultimo bit em todo motor de
 * JavaScript. `pesosYoshida.test.ts` confere os literais contra a formula
 * dentro de 1 ulp.
 */
const W1 = 1.3512071919596578; // 1 / (2 - 2^(1/3))
const W0 = -1.7024143839193155; // 1 - 2*W1
const PESOS = [W1, W0, W1] as const;

export const yoshida4: Integrador = {
  nome: 'yoshida4',
  avaliacoesPorPasso: 3,
  passo(estado, dt, rascunho) {
    const m = 3 * estado.n;
    for (const w of PESOS) {
      somarEscalado(estado.pos, estado.vel, 0.5 * w * dt, m);
      aceleracao(estado, rascunho);
      somarEscalado(estado.vel, rascunho.acel, w * dt, m);
      somarEscalado(estado.pos, estado.vel, 0.5 * w * dt, m);
    }
  },
};

/**
 * O mesmo Yoshida, com a correcao pos-newtoniana do Sol somada em cada kick.
 * Nao e o padrao: a validacao contra o JPL e feita sem ela, e no passo de 0,5
 * dia o truncamento esconde o efeito.
 *
 * A forca passa a depender da velocidade, entao o metodo deixa de ser
 * exatamente simpletico. Em Mercurio o termo vale cerca de 3e-8 da gravidade
 * do Sol.
 *
 * O termo e avaliado no meio do kick. Com a velocidade do comeco do kick, o
 * passo fica assimetrico no tempo e o erro cai so com dt: contra a DE440s,
 * Mercurio errava milhoes de km por seculo, mais do que sem o termo. Com a
 * velocidade estimada no meio, o metodo volta a ser de 4a ordem
 * (`relatividade.test.ts` confere), e a correcao custa um termo a mais por
 * kick, sem avaliacao N^2 extra.
 */
export const yoshida4Relativistico: Integrador = {
  nome: 'yoshida4Relativistico',
  avaliacoesPorPasso: 3,
  passo(estado, dt, rascunho) {
    const m = 3 * estado.n;
    const { acel, acelNewton, velMeio } = rascunho;
    for (const w of PESOS) {
      somarEscalado(estado.pos, estado.vel, 0.5 * w * dt, m);
      aceleracao(estado, rascunho);
      acelNewton.set(acel.subarray(0, m));
      somarCorrecaoRelativistica(estado, rascunho);
      velMeio.set(estado.vel.subarray(0, m));
      somarEscalado(velMeio, acel, 0.5 * w * dt, m);
      acel.set(acelNewton.subarray(0, m));
      somarCorrecaoRelativistica(estado, rascunho, velMeio);
      somarEscalado(estado.vel, acel, w * dt, m);
      somarEscalado(estado.pos, estado.vel, 0.5 * w * dt, m);
    }
  },
};

export const INTEGRADORES: Record<string, Integrador> = { yoshida4, leapfrog, yoshida4Relativistico };
export const PADRAO = yoshida4;

/** Os pesos, expostos so para o teste que os confere contra a formula. */
export const PESOS_YOSHIDA = PESOS;

/**
 * Aplica `passos` passos de tamanho `dtDias` no estado, no lugar.
 *
 * Aceita dt negativo para rodar o tempo para tras. A integracao e reversivel
 * (20 anos de ida e volta devolvem o estado inicial com erro abaixo de 1 km), e
 * `reversibilidade.test.ts` depende disso.
 */
export function avancar(
  estado: EstadoSistema,
  integrador: Integrador,
  dtDias: number,
  passos: number,
  rascunho: Rascunho,
): EstadoSistema {
  for (let k = 0; k < passos; k++) integrador.passo(estado, dtDias, rascunho);
  estado.tDias += passos * dtDias;
  return estado;
}
