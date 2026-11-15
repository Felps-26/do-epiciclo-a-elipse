/**
 * O texto de honestidade nao pode ficar a frente do codigo, nem atras dele.
 *
 * Uma auditoria do CONTRATO.md encontrou o defeito nas duas direcoes: licenca
 * declarada e nao tomada (o modo maquete era descrito e nada comprimia) e licenca
 * tomada e nao declarada. `textos.test.ts` prova que os blocos existem e
 * `conteudo.spec.ts` que chegam a tela; este arquivo pergunta se o que esta escrito
 * e verdade.
 *
 * Cada afirmacao do texto e conferida pelo COMPORTAMENTO do codigo: chama-se a
 * funcao e olha-se o que ela faz, ou le-se a constante exportada que o texto cita.
 * A versao anterior procurava expressoes regulares no codigo-fonte, que quebravam
 * com uma reformatacao e passavam com uma mudanca de sentido que mantivesse o
 * texto. O que fica em expressao regular e so a frase do texto, que e texto.
 */
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { HONESTIDADE } from '@dados/textos.ts';
import { carregar } from '@dados/carregar.ts';
import { CORPOS_VISUAIS, TEXTURAS } from '@dados/corposVisuais.ts';
import { EPOCA_DAS_LUAS_JD, LUAS } from '@dados/luas.ts';
import { RECEITAS } from '@dados/predefinicoes.ts';
import { criarSistemaVivo } from '@app/sistemaVivo.ts';
import { PISO_DO_LADO_NOTURNO } from '@cena/iluminacao/modeloDeLuz.ts';
import { amortecimentoDoGiro } from '@cena/corpos/giroVisivel.ts';
import { orientacaoDoCorpo } from '@cena/corpos/orientacao.ts';
import { limitesDoSol, raioDesenhadoUa } from '@cena/escala/exageroDeTamanho.ts';
import { comprimirRaio } from '@cena/escala/escalaVisual.ts';
import { exposicaoQuerida } from '@cena/iluminacao/exposicao.ts';
import { brilhoRefletido, irradianciaComPenumbra, leiDoCorpo } from '@cena/iluminacao/fotometria.ts';
import { posicoesDesenhadas } from '@cena/posicoesDesenhadas.ts';
import { interpolarHermite } from '@nucleo/amostragem.ts';
import { criarEstado, inserirCorpo } from '@nucleo/estado.ts';
import { PADRAO, PRECISOES, avancar, type Integrador } from '@nucleo/integrador.ts';
import { posicaoDaLua } from '@nucleo/luas.ts';
import { Simulador } from '@nucleo/simulador.ts';
import { criarRascunho } from '@nucleo/tipos.ts';
import { UA_KM } from '@nucleo/unidades.ts';

interface Amarra {
  /** O que o texto afirma. */
  afirma: RegExp;
  bloco: keyof typeof HONESTIDADE;
  /** Confere o comportamento. Devolve `null` quando o codigo faz o que o texto diz. */
  confere: () => string | null;
}

const falha = (cond: boolean, porque: string): string | null => (cond ? null : porque);

/** Avanco do perielio de Mercurio em um seculo, Sol e Mercurio sozinhos, em ″. */
function precessaoDeMercurio(integrador: Integrador, dt: number): number {
  const { corpos } = carregar();
  const gmSol = corpos.find((c) => c.chave === 'sol')!.gm;
  const gmMerc = corpos.find((c) => c.chave === 'mercurio')!.gm;
  const mu = gmSol + gmMerc;
  const a = 0.387098;
  const e = 0.20563;
  const rp = a * (1 - e);
  const estado = criarEstado({
    gm: [gmSol, gmMerc],
    pos: [0, 0, 0, rp, 0, 0],
    vel: [0, 0, 0, 0, Math.sqrt((mu * (1 + e)) / rp), 0],
    tDias: 0,
  });
  const angulo = (): number => {
    const rx = estado.pos[3]! - estado.pos[0]!;
    const ry = estado.pos[4]! - estado.pos[1]!;
    const vx = estado.vel[3]! - estado.vel[0]!;
    const vy = estado.vel[4]! - estado.vel[1]!;
    const h = rx * vy - ry * vx;
    const r = Math.hypot(rx, ry);
    return Math.atan2((-vx * h) / mu - ry / r, (vy * h) / mu - rx / r);
  };
  const antes = angulo();
  avancar(estado, integrador, dt, Math.round(36525 / dt), criarRascunho(estado.capacidade));
  const d = angulo() - antes;
  return Math.atan2(Math.sin(d), Math.cos(d)) * (180 / Math.PI) * 3600;
}

const AMARRAS: Amarra[] = [
  {
    bloco: 'simplifica',
    afirma: /O lado noturno não é preto/,
    confere: () => {
      const escrito = HONESTIDADE.simplifica.texto.match(/recebe (\d+)% da luz do meio-dia/);
      return falha(
        PISO_DO_LADO_NOTURNO > 0 && escrito !== null && Number(escrito[1]) === Math.round(PISO_DO_LADO_NOTURNO * 100),
        `o texto diz ${escrito?.[1] ?? '?'}% e o piso aplicado é ${PISO_DO_LADO_NOTURNO * 100}%`,
      );
    },
  },
  {
    bloco: 'simplifica',
    afirma: /A rotação desenhada tem um teto/,
    // Marte a 30 dias por segundo: 29 voltas por segundo num disco grande.
    confere: () =>
      falha(amortecimentoDoGiro(175, 300) < 0.01 && amortecimentoDoGiro(0.1, 3) === 1, 'o giro não é limitado'),
  },
  {
    bloco: 'simplifica',
    afirma: /mosaicos de imageamento real/,
    confere: () =>
      falha(
        TEXTURAS.some((m) => m.corpo === 'ganimedes' && m.papel === 'albedo' && /USGS/.test(m.fonte)),
        'nenhuma lua tem mosaico do USGS no manifesto',
      ),
  },
  {
    bloco: 'simplifica',
    afirma: /meridiano zero como o que\n.*encara o planeta|meridiano zero como o que encara o planeta/,
    confere: () => {
      // Io na época: o ponto voltado para Júpiter tem de estar perto da longitude 0.
      const io = LUAS.find((l) => l.chave === 'io')!;
      const p: [number, number, number] = [0, 0, 0];
      posicaoDaLua(io, io.base, 0, p);
      const q = orientacaoDoCorpo(CORPOS_VISUAIS['io']!.rotacao, EPOCA_DAS_LUAS_JD).clone().invert();
      const v = new Vector3(-p[0], -p[1], -p[2]).normalize().applyQuaternion(q);
      const lon = (Math.atan2(v.y, v.x) * 180) / Math.PI;
      return falha(Math.abs(lon) < 1, `o meridiano zero de Io aponta a ${lon.toFixed(1)}° do planeta`);
    },
  },
  {
    bloco: 'simplifica',
    afirma: /desenhados maiores que o tamanho real/,
    // A Terra na visão geral: 10 px por UA daria um disco de 0,0004 px.
    confere: () =>
      falha(raioDesenhadoUa(6371 / UA_KM, 10, false, false) > (6371 / UA_KM) * 1000, 'o raio não é ampliado'),
  },
  {
    bloco: 'simplifica',
    afirma: /o desenho interpola a posição/,
    confere: () => {
      const a = criarEstado({ gm: [1], pos: [0, 0, 0], vel: [1, 0, 0], tDias: 0 });
      const b = criarEstado({ gm: [1], pos: [1, 0, 0], vel: [1, 0, 0], tDias: 1 });
      const s = new Float64Array(3);
      interpolarHermite(a, b, 1, 0.5, s);
      return falha(Math.abs(s[0]! - 0.5) < 1e-12, 'a posição desenhada entre dois passos não é interpolada');
    },
  },
  {
    bloco: 'simplifica',
    afirma: /halo de ar no limbo/,
    confere: () =>
      falha(
        (CORPOS_VISUAIS['terra']!.atmosfera?.alturaKm ?? 0) > 0 && CORPOS_VISUAIS['mercurio']!.atmosfera === undefined,
        'a atmosfera não está descrita só para quem tem ar',
      ),
  },
  {
    bloco: 'simplifica',
    afirma: /coroa do Sol é desenho/,
    // De perto, a coroa é um plano seis raios maior que o disco, somado à cena.
    confere: () => {
      const { raioUa, coroaUa } = limitesDoSol(0.00465, 0.00465, 0.39);
      return falha(coroaUa >= raioUa * 6 - 1e-12, 'o Sol não tem coroa desenhada');
    },
  },
  {
    bloco: 'simplifica',
    afirma: /exposição automática/,
    // Saturno a 9,5 UA recebe 1/90 da luz: a cena inteira é multiplicada por 90.
    confere: () => falha(Math.abs(exposicaoQuerida(9.5) - 90.25) < 1e-9, 'a exposição não compensa 1/d²'),
  },
  {
    bloco: 'simplifica',
    afirma: /a Lua cheia não escurece na borda/,
    confere: () => {
      const visual = (chave: string) => CORPOS_VISUAIS[chave]!;
      if (leiDoCorpo(visual('lua')) !== 'lommelSeeliger') return 'a Lua não usa Lommel–Seeliger';
      if (leiDoCorpo(visual('terra')) !== 'lambert') return 'a Terra, com atmosfera, não usa Lambert';
      // Fase zero: incidência igual à emissão em todo o disco, e o brilho não cai.
      for (const mu of [1, 0.5, 0.1]) {
        if (Math.abs(brilhoRefletido('lommelSeeliger', mu, mu) - 1) > 1e-12) return 'a Lua cheia escurece na borda';
      }
      // E a luz cai com o ângulo do Sol: rasante perto do terminador.
      return falha(irradianciaComPenumbra(0.1, 0.00465) < irradianciaComPenumbra(0.9, 0.00465) / 5, 'a luz não cai com o ângulo');
    },
  },
  {
    bloco: 'simplifica',
    afirma: /"Modo maquete" ligado, as distâncias desenhadas deixam de ser proporcionais/,
    confere: () => {
      // Netuno, a 30 UA, desenhado a √30 UA; a posição real fica intacta.
      const pos = new Float64Array([0, 0, 0, 30, 0, 0]);
      const reais = new Float64Array(6);
      const comprimidas = new Float64Array(6);
      const desenho = posicoesDesenhadas(pos, 2, [], -1, -1, EPOCA_DAS_LUAS_JD, true, reais, comprimidas);
      return falha(
        Math.abs(desenho[3]! - Math.sqrt(30)) < 1e-9 && reais[3] === 30 && comprimirRaio(30) === Math.sqrt(30),
        `Netuno desenhado a ${desenho[3]} UA e real a ${reais[3]} UA`,
      );
    },
  },
  {
    bloco: 'simplifica',
    afirma: /A iluminação e a geometria continuam usando as distâncias reais/,
    confere: () => {
      const pos = new Float64Array([0, 0, 0, 9.5, 0, 0]);
      const reais = new Float64Array(6);
      posicoesDesenhadas(pos, 2, [], -1, -1, EPOCA_DAS_LUAS_JD, true, reais, new Float64Array(6));
      // A exposição sai da distância real: Saturno continua pedindo 90, comprimido ou não.
      return falha(reais[3] === 9.5 && exposicaoQuerida(reais[3]) === 90.25, 'a luz mediria a distância desenhada');
    },
  },
  {
    bloco: 'simplifica',
    afirma: /As luas não são integradas/,
    confere: () => {
      const { estado, corpos } = carregar();
      return falha(
        LUAS.length > 0 && estado.n === corpos.length && !corpos.some((c) => LUAS.some((l) => l.chave === c.chave)),
        'alguma lua entrou no estado integrado',
      );
    },
  },
  {
    bloco: 'naoInclui',
    afirma: /As luas aparecem desenhadas/,
    confere: () => falha(LUAS.length === 13, `há ${LUAS.length} luas`),
  },
  {
    bloco: 'naoInclui',
    afirma: /dá para criar um/,
    confere: () => {
      const { estado, corpos } = carregar();
      const vivo = criarSistemaVivo(estado, corpos);
      const r = vivo.criar({
        predefinicao: 'asteroide',
        pos: [3, 0.5, 0],
        vel: [0, Math.sqrt(estado.gm[0]! / 3), 0],
        dtDias: 0.5,
        diaSimulado: 0,
      });
      return falha(RECEITAS.length > 0 && r.ok && estado.n === corpos.length, 'criar um corpo não muda o sistema');
    },
  },
  {
    bloco: 'naoInclui',
    afirma: /um corpo criado que bate num planeta ou no Sol sai da simulação/,
    confere: () => {
      const { estado, corpos } = carregar();
      const nove = estado.n;
      const j = 3 * corpos.findIndex((c) => c.chave === 'jupiter');
      inserirCorpo(
        estado,
        [estado.pos[j]! + 0.05, estado.pos[j + 1]!, estado.pos[j + 2]!],
        [estado.vel[j]! - 20 / 1731.456836805555, estado.vel[j + 1]!, estado.vel[j + 2]!],
        0,
      );
      const sim = new Simulador(estado, {
        passosMaxPorQuadro: 400,
        vigia: { ehCriado: (i) => i >= nove, raioUa: (i) => (i < nove ? corpos[i]!.raioKm / UA_KM : 0) },
      });
      let passouPerto = false;
      for (let q = 0; q < 60 && estado.n > nove; q++) {
        const r = sim.avancar(1 / 60, 30);
        if (r.encontro) passouPerto = true;
      }
      return falha(
        estado.n === nove && passouPerto,
        `n = ${estado.n} (eram ${nove} antes de criar), passou perto: ${passouPerto}`,
      );
    },
  },
  {
    bloco: 'naoInclui',
    afirma: /A relatividade geral fica de fora na precisão padrão/,
    confere: () => {
      // O integrador padrão não avança o periélio; o da precisão alta avança os 43″ da
      // relatividade. Os dois com passo de 0,05 dia, onde o truncamento não inventa
      // precessão própria.
      const padrao = precessaoDeMercurio(PADRAO, 0.05);
      const alta = precessaoDeMercurio(PRECISOES.alta.integrador, 0.05);
      return falha(
        Math.abs(padrao) < 0.5 && Math.abs(alta - 42.98) < 1 && PRECISOES.alta.passoDias < PRECISOES.padrao.passoDias,
        `padrão ${padrao.toFixed(2)}″, alta ${alta.toFixed(2)}″ por século`,
      );
    },
  },
];

/**
 * A amarra vale nos dois sentidos: declarar sem fazer e fazer sem declarar saem da
 * mesma tabela, entao nao ha como consertar uma direcao e esquecer a outra.
 */
describe('texto e codigo dizem a mesma coisa, nos dois sentidos', () => {
  for (const amarra of AMARRAS) {
    const nome = amarra.afirma.source.slice(0, 46);
    it(nome, () => {
      const declarada = amarra.afirma.test(HONESTIDADE[amarra.bloco].texto);
      const problema = amarra.confere();
      const implementada = problema === null;
      if (declarada && !implementada) {
        expect.fail(`O texto declara "${nome}" e o código não faz: ${problema}`);
      }
      if (implementada && !declarada) {
        expect.fail(`O código faz "${nome}" e o texto não declara.`);
      }
    }, 60_000);
  }

  it('a lista de amarras não ficou vazia nem inteira em branco', () => {
    const declaradas = AMARRAS.filter((a) => a.afirma.test(HONESTIDADE[a.bloco].texto));
    expect(declaradas.length).toBeGreaterThan(AMARRAS.length / 2);
  });
});
