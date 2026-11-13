/**
 * Ponto de entrada, e a unica peca que conhece todas as camadas.
 *
 * As regras de camada impedem que nucleo, cena e interface se enxerguem; alguem tem
 * de monta-los, e e este arquivo. A ordem do quadro e a da versao em pygame: tempo
 * real decorrido, fisica, camera, desenho (`app/quadro.ts`). As acoes ja foram
 * aplicadas quando aconteceram, porque no DOM os eventos chegam fora do laco e o
 * reducer e sincrono; o que elas fazem fora dele mora em `app/efeitos.ts`.
 */
import { aoEfeito, definirUi, despachar, ui } from './interface/estado.ts';
import { manterServidorDePe } from './app/batida.ts';
import { dePreferencias } from './app/estadoUi.ts';
import { lerPreferencias } from './app/preferencias.ts';
import { criarConsultas, LUA_POR_CHAVE } from './app/consultas.ts';
import {
  criarAoColidir,
  criarCurvaDoLaboratorio,
  criarDesenho,
  criarPrograma,
  criarPublicacaoDeMudanca,
} from './app/inicializacao.ts';
import { criarAoQuadro } from './app/quadro.ts';
import { criarAplicadorDeEfeitos } from './app/efeitos.ts';
import { obstaculosDaInterface } from './app/obstaculos.ts';
import { publicarGanchos } from './app/ganchosDeTeste.ts';
import { criarRotulosDoQuadro } from './rotulos/ancoragemNoQuadro.ts';
import { observarMudancasDeFonte } from './rotulos/medida.ts';
import type { Instantaneo } from './contratos/instantaneo.ts';
import type { Colisao } from './nucleo/simulador.ts';
import './interface/base.css';

manterServidorDePe();
observarMudancasDeFonte();

const raiz = document.querySelector<HTMLElement>('#raiz');
if (!raiz) throw new Error('faltou o elemento #raiz no index.html');

// O laco nasce dentro do programa e chama de volta estes dois, que so existem depois.
let aoQuadro: (instantaneo: Instantaneo, dtRealS: number) => void = () => {};
let aoColidir: (c: Colisao) => void = () => {};
const programa = criarPrograma({
  aoQuadro: (i, dt) => aoQuadro(i, dt),
  aoColidir: (c) => aoColidir(c),
});

const consultas = criarConsultas(programa, () => ui.value.escalaVisual === 'maquete');
const publicarMudanca = criarPublicacaoDeMudanca(programa, consultas);
const rotulosDoQuadro = criarRotulosDoQuadro({
  nomeDe: consultas.nomeDaChave,
  ehLua: (chave) => LUA_POR_CHAVE.has(chave),
  obstaculos: obstaculosDaInterface,
});
const desenhar = criarDesenho(programa, raiz, {
  curvaDoLaboratorio: criarCurvaDoLaboratorio(programa, consultas),
});

aoQuadro = criarAoQuadro(programa, consultas, rotulosDoQuadro, () => ui.value, desenhar);
aoColidir = criarAoColidir(programa, publicarMudanca);
aoEfeito(criarAplicadorDeEfeitos(programa, consultas, () => ui.value, despachar, publicarMudanca));
publicarGanchos(programa, consultas, () => rotulosDoQuadro.ultimosObstaculos);

/**
 * Sair da tela cheia pelo caminho do navegador (Esc, F11) tambem sai do modo imersivo.
 * Sem isto a janela voltaria ao normal com o programa ainda sem barra nem lateral.
 * `trocar-modo-de-uso` e nao `alternar-imersivo`, que entraria de novo fora de hora.
 */
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && ui.value.modoDeUso === 'voar') {
    despachar({ tipo: 'trocar-modo-de-uso', modo: 'explorar' });
  }
});

void (async () => {
  definirUi(dePreferencias(await lerPreferencias()));
  // A orientacao aparece uma vez so, e `tutorialVisto` vai para as preferencias mesmo
  // quando a pessoa fecha no Esc: reabrir para quem ja disse nao ensina a fechar sem ler.
  if (!ui.value.tutorialVisto) despachar({ tipo: 'abrir-tela', tela: 'tutorial' });
  desenhar();
  programa.laco.iniciar();
})();
