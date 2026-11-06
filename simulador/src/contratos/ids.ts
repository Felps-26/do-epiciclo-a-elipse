/**
 * Tipos que toda camada vê e nenhuma importa de volta.
 *
 * `Instantaneo` mora em `contratos/` e não em `src/app/` porque, em `app/`, a
 * regra "a cena não importa app" teria de ser liberada para a cena desenhar, e
 * com ela entrariam `acoes.ts` e `aplicar.ts`: por aí a cena passaria a abrir
 * modais e despachar ações.
 */

/** Chave estável de um corpo. É a mesma do catálogo, do tema e dos textos. */
export type IdCorpo = string;

/**
 * Como um corpo entra na simulação.
 *
 *   dinamico    entra no integrador N-corpos e puxa os outros: o Sol e os oito
 *               baricentros planetários, a camada validada contra o JPL.
 *   cinematico  a posição vem de um modelo analítico, não da integração: as luas
 *               e o centro da Terra. Não puxa nem é puxado.
 *   teste       criado no sandbox. Entra no integrador, e sua presença significa
 *               que o sistema deixou de ser o do JPL.
 */
export type Papel = 'dinamico' | 'cinematico' | 'teste';

/** Identidade física de um corpo: o que ele é, não onde está. */
export interface Corpo {
  readonly chave: IdCorpo;
  readonly nome: string;
  readonly papel: Papel;
  /** UA^3/dia^2 */
  readonly gm: number;
  /** Raio médio volumétrico real, em km. A tela desenha ampliado e avisa. */
  readonly raioKm: number;
  readonly idHorizons: string;
  /**
   * Verdadeiro quando o ponto simulado é o baricentro de um sistema planetário e
   * não o centro do planeta. Vale para os oito, mas só pesa na Terra: o
   * baricentro Terra-Lua fica a ~4.671 km do centro do planeta.
   */
  readonly eBaricentro: boolean;
}

/*
 * Estes tipos moram aqui porque `enquadramento.ts` precisa de `Modo`, e importá-lo
 * de `app/acoes.ts` derrubaria a regra "a cena não vê o app". O lint de arquitetura
 * pegou essa importação.
 */
export type Modo = 'sistema' | 'internos' | 'acompanhar' | 'perto';

export type Vista = 'perspectiva' | 'ortografica';

export type EscalaVisual = 'real' | 'maquete';

/**
 * O quanto as luas participam da tela. "Sem" limpa a cena para olhar o sistema.
 * "Só" faz das luas o assunto (quem chegou perto de Júpiter e quer ver as
 * quatro, não o disco) e muda quem ganha nome e caminho desenhado, mas mantém os
 * planetas: uma lua sem o corpo que ela orbita não diz em torno de quê gira.
 */
export type VisibilidadeDasLuas = 'com' | 'sem' | 'so';

/** O que a pessoa está fazendo: olhando, mexendo ou voando. */
export type ModoDeUso = 'explorar' | 'criar' | 'voar';
