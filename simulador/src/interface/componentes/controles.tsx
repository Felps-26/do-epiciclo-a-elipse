/**
 * Os controles basicos.
 *
 * Regra herdada do projeto anterior: "Botoes: texto sempre, icone nunca sozinho. O
 * controle precisa dizer por escrito o que faz. Um icone de engrenagem exige que a
 * pessoa ja conheca a convencao; 'Mais opções' nao exige."
 *
 * `testes/botoes.test.ts` le a arvore que cada componente devolve e confere os
 * atributos de acessibilidade um a um; `e2e/acessibilidade.spec.ts` varre a tela
 * montada e falha se algum `<button>` sair sem texto e sem `aria-label`. Um prova que
 * o componente oferece o caminho, o outro que ninguem tomou o contrario. O primeiro
 * ficou citado e inexistente por varias fases, a mesma classe de defeito que a
 * auditoria do CONTRATO.md achou em catorze lugares.
 *
 * Segunda regra: nunca informacao so por cor. O alternador desenha um "✓", o botao
 * ativo ganha uma barra sublinhada e `aria-pressed`, e o corpo acompanhado ganha anel
 * tracejado.
 */
import type { ComponentChildren, JSX } from 'preact';
import { paraCss, type Cor } from '../contraste.ts';

interface BotaoProps {
  children: ComponentChildren;
  onClick: () => void;
  /** Deixa o botao com peso visual maior. E o unico da barra que tem isso. */
  primario?: boolean;
  /** Marca estado ligado. Desenha a barra E emite aria-pressed. */
  ativo?: boolean;
  desabilitado?: boolean;
  /** Quando o texto visivel nao basta para quem usa leitor de tela. */
  rotulo?: string;
  titulo?: string;
}

export function Botao({ children, onClick, primario, ativo, desabilitado, rotulo, titulo }: BotaoProps): JSX.Element {
  const classes = ['botao'];
  if (primario) classes.push('botao--primario');
  if (ativo) classes.push('botao--ativo');
  return (
    <button
      type="button"
      class={classes.join(' ')}
      onClick={onClick}
      disabled={desabilitado}
      aria-pressed={ativo === undefined ? undefined : ativo}
      aria-label={rotulo}
      title={titulo}
    >
      {children}
    </button>
  );
}

interface OpcaoSegmentada<T extends string> {
  valor: T;
  texto: string;
}

interface GrupoProps<T extends string> {
  rotulo: string;
  opcoes: readonly OpcaoSegmentada<T>[];
  valor: T;
  onEscolher: (valor: T) => void;
}

/**
 * Escolha exclusiva. E um `radiogroup` de verdade e nao uma fila de botoes: o leitor
 * de tela anuncia "2 de 3" e as setas navegam entre as opcoes.
 *
 * O cabecalho prometia as setas desde a primeira versao e era falso: os tres botoes
 * eram tabulaveis um a um e nenhuma seta fazia nada. Agora ha roving tabindex: um Tab
 * entra no grupo pela opcao marcada, as setas escolhem, Home e End vao aos extremos e
 * um segundo Tab sai. E o padrao ARIA de radiogroup, e "3 opcoes" passa a custar um
 * Tab em vez de tres.
 *
 * `stopPropagation` e necessario: as quatro setas ja sao atalhos globais que giram e
 * deslocam a camera (`app/atalhos.ts`), e sem parar o evento aqui, escolher
 * "Planetas internos" com a seta giraria a cena ao mesmo tempo. `escopoDeTeclado.ts`
 * nao resolve, porque isenta `role` `button`, `option` e `listbox`, mas nao `radio`.
 * Quem da significado novo a tecla e quem a consome.
 */
export function GrupoSegmentado<T extends string>({ rotulo, opcoes, valor, onEscolher }: GrupoProps<T>): JSX.Element {
  const atual = Math.max(0, opcoes.findIndex((o) => o.valor === valor));

  function aoTeclar(ev: JSX.TargetedKeyboardEvent<HTMLDivElement>): void {
    const passo =
      ev.key === 'ArrowRight' || ev.key === 'ArrowDown'
        ? 1
        : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp'
          ? -1
          : 0;
    let destino: number;
    if (passo !== 0) destino = (atual + passo + opcoes.length) % opcoes.length;
    else if (ev.key === 'Home') destino = 0;
    else if (ev.key === 'End') destino = opcoes.length - 1;
    else return;

    ev.preventDefault();
    ev.stopPropagation();
    const escolhida = opcoes[destino];
    if (!escolhida) return;
    onEscolher(escolhida.valor);
    // O foco segue a escolha, senao o proximo toque de seta partiria da opcao
    // velha e a navegacao andaria de um em um para sempre.
    const grupo = ev.currentTarget;
    (grupo.children[destino] as HTMLElement | undefined)?.focus();
  }

  return (
    <div class="segmentado" role="radiogroup" aria-label={rotulo} onKeyDown={aoTeclar}>
      {opcoes.map((o, i) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={o.valor === valor}
          tabIndex={i === atual ? 0 : -1}
          class={`segmentado__item${o.valor === valor ? ' segmentado__item--ativo' : ''}`}
          onClick={() => onEscolher(o.valor)}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}

interface AlternadorProps {
  texto: string;
  ligado: boolean;
  onAlternar: () => void;
  /** Uma linha explicando o que a opcao faz, quando o nome nao basta. */
  ajuda?: string;
}

/**
 * A ajuda saiu de dentro do `<label>`. Era um `<small>` no rotulo, e tudo o que esta
 * dentro de um `<label>` entra no nome acessivel do campo: o leitor de tela anunciava
 * "Caminhos previstos. A elipse que cada planeta seguiria se so o Sol existisse.
 * Caixa de selecao, marcada", a frase inteira a cada passagem. Agora e um `<p>` irmao
 * ligado por `aria-describedby`, lido depois do nome e do estado.
 */
/**
 * O identificador da ajuda vem do texto e nao de `useId`, que e um hook e exige
 * renderizador montado. `botoes.test.ts` chama estes componentes como funcoes puras,
 * num ambiente `node` sem DOM, e acrescentar `jsdom` so para conferir atributos seria
 * pagar um navegador para ler um objeto. O id derivado do rotulo nao precisa disso e
 * sai legivel no DOM. A unicidade e conferida na tela montada: o axe reprova `id`
 * repetido em `e2e/acessibilidade.spec.ts`.
 */
function idDaAjuda(texto: string): string {
  const limpo = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `ajuda-${limpo}`;
}

export function Alternador({ texto, ligado, onAlternar, ajuda }: AlternadorProps): JSX.Element {
  const id = idDaAjuda(texto);
  return (
    <div class="alternador">
      <label class="alternador__linha">
        <input
          type="checkbox"
          checked={ligado}
          onChange={onAlternar}
          aria-describedby={ajuda ? id : undefined}
        />
        {/* O "✓" e desenhado, e nao so uma mudanca de cor: a informacao precisa
            sobreviver a quem nao distingue as duas cores. */}
        <span class="alternador__caixa" aria-hidden="true">
          {ligado ? '✓' : ''}
        </span>
        <span class="alternador__texto">{texto}</span>
      </label>
      {ajuda ? (
        <p class="alternador__ajuda" id={id}>
          {ajuda}
        </p>
      ) : null}
    </div>
  );
}

interface PontoProps {
  cor: Cor;
}

/**
 * Ponto colorido ao lado de um nome. Permite mostrar a cor do corpo sem escrever o
 * nome nessa cor (Netuno da 4,4997:1 contra o fundo e reprovaria como texto). E
 * decorativo: o nome escrito ao lado carrega a informacao inteira.
 */
export function Ponto({ cor }: PontoProps): JSX.Element {
  return <span class="ponto" style={{ background: paraCss(cor) }} aria-hidden="true" />;
}

interface PainelProps {
  titulo: string;
  aberto: boolean;
  onAlternar: () => void;
  children: ComponentChildren;
}

/**
 * "Mais opções". `<details>` nativo: abre com Enter e com Espaco, anuncia o
 * estado, e funciona sem JavaScript — nada disso precisou ser escrito.
 */
export function PainelRecolhivel({ titulo, aberto, onAlternar, children }: PainelProps): JSX.Element {
  return (
    <details
      class="recolhivel"
      open={aberto}
      onToggle={(ev: Event) => {
        const alvo = ev.currentTarget as HTMLDetailsElement;
        if (alvo.open !== aberto) onAlternar();
      }}
    >
      <summary class="recolhivel__titulo">{titulo}</summary>
      <div class="recolhivel__corpo">{children}</div>
    </details>
  );
}
