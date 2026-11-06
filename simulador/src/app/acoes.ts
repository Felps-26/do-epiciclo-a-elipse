/**
 * Acoes: o que a pessoa pediu, como dado.
 *
 * Um componente nunca muda o estado do programa. Ele devolve uma Acao, e
 * `aplicar.ts` decide o que fazer com ela num lugar so, o que da um unico ponto para
 * olhar quando alguem quer saber por que clicar aqui fez aquilo. Foi o motivo
 * original, na versao em pygame.
 *
 * Em TypeScript vira uma uniao discriminada, e o compilador cobra exaustividade no
 * reducer. Ele nao cobra um membro da uniao que nenhum componente constroi, e por
 * isso existe `produtorDeAcao.test.ts`.
 */
import type {
  EscalaVisual,
  IdCorpo,
  Modo,
  ModoDeUso,
  VisibilidadeDasLuas,
  Vista,
} from '../contratos/ids.ts';
import type { Predefinicao } from '../contratos/sandbox.ts';

export type { EscalaVisual, Modo, ModoDeUso, VisibilidadeDasLuas, Vista };
export type { Predefinicao };

export type Lado = 'a' | 'b';

/** As telas sobrepostas. Uma de cada vez, como no original. */
export type Tela =
  | 'ajuda'
  | 'tutorial'
  | 'dica'
  // Nao ha 'detalhes': a ficha completa de um corpo virou uma secao da lateral, que
  // abre ao lado da cena. A caixa obrigava a escolher entre ler sobre o planeta e
  // olhar para ele, e fechar a caixa apagava o que se acabara de ler.
  | 'comparar'
  | 'atividades'
  | 'matematica-do-sol'
  | 'tabela-de-dados'
  // Nao ha 'criar-pelos-numeros'. Ela existiu na especificacao como alternativa ao
  // gesto de arrastar, pelo criterio 2.5.7 da WCAG 2.2. O arrasto nao foi construido:
  // no modo Criar se aponta, se clica e se usa um controle deslizante, que o teclado
  // opera. Sem arrasto nao ha o que dar alternativa.
  | 'laboratorio';

export type Opcao =
  | 'orbitas'
  | 'trilhas'
  | 'rotulos'
  | 'aneisDeDistancia'
  | 'estrelas'
  | 'tamanhoReal'
  | 'textoMaior'
  | 'tecnico'
  | 'reduzirAnimacao';

/**
 * As tres gavetas do painel, pela pergunta que cada uma responde: `cena` (como a
 * cena e desenhada), `leitura` (como eu leio, sobre o leitor e nao sobre a cena) e
 * `destinos` (para onde ir). Moravam juntas em "Mais opções", que nao e uma
 * pergunta, e por isso ninguem achava nada.
 */
export type Gaveta = 'cena' | 'leitura' | 'destinos';

export type Acao =
  // -- tempo ----------------------------------------------------------------
  | { tipo: 'alternar-pausa' }
  | { tipo: 'mudar-velocidade'; passo?: -1 | 1; valor?: number }
  | { tipo: 'avancar-passo'; sentido?: -1 | 1 }
  | { tipo: 'voltar-ao-inicio' }
  // -- camera ---------------------------------------------------------------
  | { tipo: 'trocar-modo'; modo: Modo }
  | { tipo: 'alternar-vista' }
  | { tipo: 'vista-superior' }
  | { tipo: 'ajustar-zoom'; fator: number; ancora?: readonly [number, number] }
  | { tipo: 'orbitar-camera'; azimute: number; elevacao: number }
  /**
   * Desloca a camera. As duas componentes sao fracao da altura visivel, nao pixels
   * nem UA.
   *
   * O nome do campo carrega a unidade. Antes eram `dx`/`dy` sem unidade: `ponteiro.ts`
   * convertia pixel para UA antes de despachar e `atalhos.ts` mandava 48 ("pixels por
   * toque"), que chegava cru em `deslocar(camera, dxUa, dyUa)`. `Shift`+seta deslocava
   * o pivo 48 UA por toque num sistema de 31,5 UA de raio. O mouse estava certo e o
   * teclado errado, quebrando a paridade gesto-tecla, que e requisito.
   *
   * A fracao e adimensional e independe do zoom, entao os dois produtores falam a
   * mesma lingua e a conversao fica em `principal.ts`, o unico que conhece a altura
   * visivel em UA.
   */
  | { tipo: 'deslocar-camera'; fracaoX: number; fracaoY: number }
  | { tipo: 'acompanhar'; chave: IdCorpo | null }
  // -- selecao --------------------------------------------------------------
  | { tipo: 'selecionar'; chave: IdCorpo | null }
  | { tipo: 'comparar-com'; chave: IdCorpo | null }
  | { tipo: 'mudar-comparacao'; lado: Lado; passo: -1 | 1 }
  | { tipo: 'inverter-comparacao' }
  // -- cena -----------------------------------------------------------------
  | { tipo: 'alternar-opcao'; opcao: Opcao }
  | { tipo: 'definir-escala-visual'; escala: EscalaVisual }
  /** Quanto as luas aparecem. Tres estados, nao um booleano; ver `VisibilidadeDasLuas`. */
  | { tipo: 'definir-luas'; visibilidade: VisibilidadeDasLuas }
  /** O proximo dos tres, em ciclo. Produtor: a tecla `L`. */
  | { tipo: 'ciclar-luas' }
  | { tipo: 'alternar-lateral' }
  | { tipo: 'alternar-ficha' }
  /**
   * Entra e sai do modo imersivo. Separado de `trocar-modo-de-uso` porque a tela cheia
   * e do navegador: `requestFullscreen` exige um gesto da pessoa no mesmo quadro e
   * recusa sem ele. Uma acao propria faz o efeito de tela cheia sair so daqui.
   */
  | { tipo: 'alternar-imersivo' }
  /**
   * Abre ou fecha uma das tres gavetas do painel. Era `alternar-mais-opcoes`, para uma
   * gaveta so. Quando "Leitura" e "Ir para" sairam de dentro de "Mais opções", o
   * caminho obvio seria mais duas acoes e dois booleanos. Com o nome da gaveta como
   * campo, a quarta custa uma linha, como em `alternar-opcao` para as oito opcoes.
   */
  | { tipo: 'alternar-gaveta'; gaveta: Gaveta }
  // -- telas ----------------------------------------------------------------
  | { tipo: 'abrir-tela'; tela: Tela; argumento?: string }
  | { tipo: 'mostrar-dica'; chave: string }
  | { tipo: 'fechar' }
  // -- sandbox --------------------------------------------------------------
  | { tipo: 'trocar-modo-de-uso'; modo: ModoDeUso }
  | { tipo: 'escolher-predefinicao'; predefinicao: Predefinicao }
  | { tipo: 'mirar-colocacao'; pos: readonly [number, number, number] | null }
  | { tipo: 'definir-velocidade'; fracaoDaCircular: number }
  | { tipo: 'criar-corpo' }
  /**
   * Recusa de uma criacao, com a saida junto. Produtor: `principal.ts`, que chama o
   * sistema vivo e recebe o veredito. A frase ja vem de `dados/textos.ts`; o reducer
   * so precisa saber se o passo curto resolve, porque disso depende existir o botao.
   * Uma recusa sem saida e um beco.
   */
  | { tipo: 'recusar-criacao'; texto: string; passoCurtoResolve: boolean }
  | { tipo: 'apagar-corpo'; chave: IdCorpo }
  | { tipo: 'desfazer' }
  | { tipo: 'restaurar-sistema' }
  | { tipo: 'usar-passo-curto' }
  /**
   * Resultado de uma mutacao, vindo de quem mexeu no sistema. `principal.ts` chama
   * `sistemaVivo`, recebe o veredito e despacha isto. O reducer e puro e nunca ve
   * `EstadoSistema`, entao nao poderia calcular estes campos, e o distintivo de sistema
   * modificado seria um palpite sobre um estado que ele nao enxerga.
   */
  | { tipo: 'sistema-mudou'; modificado: boolean; podeDesfazer: boolean; proximoDesfazer: string | null }
  // -- sistema --------------------------------------------------------------
  | { tipo: 'capturar-tela' }
  /**
   * Frase temporaria na pilha de avisos. Saiu da uniao na F2 por nao ter produtor
   * (uma acao que so o reducer construiria e caminho morto) e voltou na F7 com ele:
   * quando uma criacao e recusada, os numeros do veredito estao em `principal.ts` e a
   * frase em portugues em `dados/textos.ts`, e o reducer nao ve nenhum dos dois.
   */
  | { tipo: 'avisar'; texto: string };

// `confirmar` fica fora da uniao: o reducer ja emite o efeito de mesmo nome, e
// ninguem de fora precisa confirmar nada. `avisar` voltou com o produtor, como
// combinado.

export type TipoDeAcao = Acao['tipo'];

/**
 * Todos os tipos, como valor, para o teste de exaustividade: a uniao some em tempo
 * de execucao, e sem esta lista nao ha como percorrer os membros e ver se cada um
 * tem produtor. `acoes.test.ts` falha se um tipo estiver na uniao e nao aqui.
 */
export const TIPOS_DE_ACAO = [
  'alternar-pausa', 'mudar-velocidade', 'avancar-passo', 'voltar-ao-inicio',
  'trocar-modo', 'alternar-vista', 'vista-superior', 'ajustar-zoom',
  'orbitar-camera', 'deslocar-camera', 'acompanhar',
  'selecionar', 'comparar-com', 'mudar-comparacao', 'inverter-comparacao',
  'alternar-opcao', 'definir-escala-visual', 'definir-luas', 'ciclar-luas',
  'alternar-lateral', 'alternar-ficha', 'alternar-imersivo', 'alternar-gaveta',
  'abrir-tela', 'mostrar-dica', 'fechar',
  'trocar-modo-de-uso', 'escolher-predefinicao', 'mirar-colocacao', 'definir-velocidade',
  'criar-corpo', 'recusar-criacao', 'apagar-corpo', 'desfazer', 'restaurar-sistema', 'usar-passo-curto',
  'sistema-mudou',
  'capturar-tela', 'avisar',
] as const satisfies readonly TipoDeAcao[];
