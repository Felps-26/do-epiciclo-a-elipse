/**
 * O eixo de cada corpo aponta para onde deve.
 *
 * Ha tres jeitos de errar a orientacao que dao cenas "quase certas", que ninguem
 * percebe:
 *
 *   1. esquecer `Rx(−eps)` e dar 23,44° a mais de inclinacao a todo mundo;
 *   2. rodar so o polo e deixar a textura girada num angulo arbitrario;
 *   3. descartar os termos periodicos da Lua, que valem 1,5°, ou seja, a obliquidade
 *      inteira dela.
 *
 * O terceiro aconteceu: a Lua saiu com o eixo a 0,02° do norte da ecliptica,
 * praticamente em pe.
 */
import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { CORPOS_VISUAIS, CORPO_GENERICO } from '@dados/corposVisuais.ts';
import { LUAS, EPOCA_DAS_LUAS_JD } from '@dados/luas.ts';
import { posicaoDaLua } from '@nucleo/luas.ts';
import { carregar } from '@dados/carregar.ts';
import {
  diasDesdeJ2000,
  eixoDoCorpo,
  inclinacaoDoEixoGraus,
  orientacaoDoCorpo,
} from '@cena/corpos/orientacao.ts';

const J2000 = 2451545.0;
const EPOCA = 2461041.5; // a epoca da efemeride: 2026-01-01

describe('o eixo, contra valores conhecidos', () => {
  it('a Terra fica a 23,44° — a orbita dela E a ecliptica, entao tem de bater exato', () => {
    expect(inclinacaoDoEixoGraus(CORPOS_VISUAIS['terra']!.rotacao)).toBeCloseTo(23.44, 2);
  });

  it('o Sol fica a 7,25°', () => {
    expect(inclinacaoDoEixoGraus(CORPOS_VISUAIS['sol']!.rotacao)).toBeCloseTo(7.25, 2);
  });

  it('Urano esta DEITADO', () => {
    // A tabela diz 97,77° em relacao a orbita; a IAU define o norte pelo lado
    // do polo, e nao pelo sentido do giro, entao o complemento e o que se ve:
    // 180 − 97,77 = 82,23, mais a inclinacao orbital.
    const g = inclinacaoDoEixoGraus(CORPOS_VISUAIS['urano']!.rotacao);
    expect(g).toBeGreaterThan(75);
    expect(g).toBeLessThan(90);
  });

  it('Venus gira ao contrario, e o polo dela aponta quase para cima', () => {
    expect(CORPOS_VISUAIS['venus']!.rotacao.wPorDia).toBeLessThan(0);
    expect(inclinacaoDoEixoGraus(CORPOS_VISUAIS['venus']!.rotacao)).toBeLessThan(5);
  });

  it('a Lua fica a ~1,54°, e NAO em pe', () => {
    // Sem os termos de E1 este numero era 0,02°. O `1,5419 cos E1` da IAU nao
    // e uma correcao pequena: e o angulo de Cassini inteiro.
    const g = inclinacaoDoEixoGraus(CORPOS_VISUAIS['lua']!.rotacao);
    expect(g).toBeGreaterThan(1.3);
    expect(g).toBeLessThan(1.8);
  });

  it('todo eixo e unitario', () => {
    for (const [chave, c] of Object.entries(CORPOS_VISUAIS)) {
      expect(Math.hypot(...eixoDoCorpo(c.rotacao)), chave).toBeCloseTo(1, 12);
    }
  });
});

describe('a rotacao', () => {
  it('a Terra fecha uma volta em um dia SIDERAL, e nao em 24 h', () => {
    const v = new Vector3(1, 0, 0);
    const a = v.clone().applyQuaternion(orientacaoDoCorpo(CORPOS_VISUAIS['terra']!.rotacao, EPOCA).clone());
    const b = v
      .clone()
      .applyQuaternion(orientacaoDoCorpo(CORPOS_VISUAIS['terra']!.rotacao, EPOCA + 0.99726968).clone());
    expect((a.angleTo(b) * 180) / Math.PI).toBeLessThan(0.01);
  });

  it('meio dia sideral poe o mesmo ponto do outro lado', () => {
    const v = new Vector3(1, 0, 0);
    const a = v.clone().applyQuaternion(orientacaoDoCorpo(CORPOS_VISUAIS['terra']!.rotacao, EPOCA).clone());
    const b = v
      .clone()
      .applyQuaternion(orientacaoDoCorpo(CORPOS_VISUAIS['terra']!.rotacao, EPOCA + 0.49863484).clone());
    expect((a.angleTo(b) * 180) / Math.PI).toBeCloseTo(180, 0);
  });

  it('Venus gira para o outro lado que a Terra', () => {
    const eixo = new Vector3(...eixoDoCorpo(CORPOS_VISUAIS['venus']!.rotacao));
    const v = new Vector3(1, 0, 0).sub(eixo.clone().multiplyScalar(eixo.x)).normalize();
    const q0 = orientacaoDoCorpo(CORPOS_VISUAIS['venus']!.rotacao, EPOCA).clone();
    const q1 = orientacaoDoCorpo(CORPOS_VISUAIS['venus']!.rotacao, EPOCA + 10).clone();
    const a = v.clone().applyQuaternion(q0);
    const b = v.clone().applyQuaternion(q1);
    // O sinal do produto misto com o eixo diz o sentido do giro.
    expect(a.clone().cross(b).dot(eixo)).toBeLessThan(0);
  });

  it('a Terra gira para o lado certo', () => {
    const eixo = new Vector3(...eixoDoCorpo(CORPOS_VISUAIS['terra']!.rotacao));
    const v = new Vector3(1, 0, 0).sub(eixo.clone().multiplyScalar(eixo.x)).normalize();
    const a = v.clone().applyQuaternion(orientacaoDoCorpo(CORPOS_VISUAIS['terra']!.rotacao, EPOCA).clone());
    const b = v.clone().applyQuaternion(orientacaoDoCorpo(CORPOS_VISUAIS['terra']!.rotacao, EPOCA + 0.1).clone());
    expect(a.clone().cross(b).dot(eixo)).toBeGreaterThan(0);
  });

  it('J2000 e a epoca das constantes: d = 0 la', () => {
    expect(diasDesdeJ2000(J2000)).toBe(0);
    expect(diasDesdeJ2000(EPOCA)).toBeCloseTo(9496.5, 6);
  });
});

describe('dados visuais', () => {
  it('todo corpo da efemeride tem ficha visual', () => {
    for (const chave of ['sol', 'mercurio', 'venus', 'terra', 'marte', 'jupiter', 'saturno', 'urano', 'netuno']) {
      expect(CORPOS_VISUAIS[chave], chave).toBeDefined();
    }
  });

  it('os aneis de Saturno vao de 1,11 a 2,33 raios equatoriais', () => {
    const s = CORPOS_VISUAIS['saturno']!;
    const faixas = s.aneis!;
    expect(faixas[0]!.rInternoKm / s.raioEquatorialKm).toBeCloseTo(1.11, 2);
    const externo = Math.max(...faixas.map((f) => f.rExternoKm));
    expect(externo / s.raioEquatorialKm).toBeCloseTo(2.33, 2);
  });

  it('a Divisão de Cassini e mais vazia que os aneis dos dois lados', () => {
    const faixas = CORPOS_VISUAIS['saturno']!.aneis!;
    const cassini = faixas.find((f) => f.nome.includes('Cassini'))!;
    const b = faixas.find((f) => f.nome === 'B')!;
    const a = faixas.find((f) => f.nome === 'A')!;
    expect(cassini.profundidadeOptica).toBeLessThan(b.profundidadeOptica);
    expect(cassini.profundidadeOptica).toBeLessThan(a.profundidadeOptica);
  });

  it('as faixas de anel nao se sobrepoem e estao em ordem', () => {
    for (const [chave, c] of Object.entries(CORPOS_VISUAIS)) {
      if (!c.aneis) continue;
      for (let k = 0; k < c.aneis.length; k++) {
        const f = c.aneis[k]!;
        expect(f.rExternoKm, `${chave}/${f.nome}`).toBeGreaterThan(f.rInternoKm);
        if (k > 0) expect(f.rInternoKm, `${chave}/${f.nome}`).toBeGreaterThanOrEqual(c.aneis[k - 1]!.rExternoKm);
      }
    }
  });
});

/**
 * A conferencia cruzada que o comentario de `corposVisuais.ts` promete.
 *
 * A tabela traz tres numeros por corpo (`poloRa`, `poloDec` e `obliquidadeGraus`) e os
 * dois primeiros determinam o terceiro. Foram transcritos a mao do relatorio da IAU, e
 * e na transcricao a mao que um digito troca de lugar sem nada reclamar: a cena
 * continua desenhando um eixo, o errado. Os testes acima conferem cinco corpos contra
 * valores que alguem lembrou de escrever; Mercurio, Marte, Jupiter, Saturno e Netuno
 * nao estavam em nenhum.
 *
 * A comparacao e contra a normal real da orbita, tirada de `r × v` da efemeride. A
 * primeira versao comparava com o polo da ecliptica e abria uma folga do tamanho da
 * inclinacao orbital, larga demais: um erro de tres graus em `poloDec` de Marte cabia
 * nela. Obliquidade e o angulo do eixo com a normal da orbita, medido aqui com folga
 * de um decimo de grau, a precisao com que a tabela da NASA publica o numero.
 */
describe('a conferência cruzada polo × obliquidade', () => {
  const catalogo = carregar();

  /** A normal da órbita de um corpo, por `r × v`, em coordenadas da cena. */
  function normalDaOrbita(i: number): Vector3 {
    const e = catalogo.estado;
    const r = new Vector3(e.pos[3 * i]!, e.pos[3 * i + 1]!, e.pos[3 * i + 2]!);
    const v = new Vector3(e.vel[3 * i]!, e.vel[3 * i + 1]!, e.vel[3 * i + 2]!);
    // Heliocêntrico: o estado é baricêntrico, e a órbita de que se fala é em
    // torno do Sol. A diferença é pequena e é justamente da ordem da folga.
    const rs = new Vector3(e.pos[0]!, e.pos[1]!, e.pos[2]!);
    const vs = new Vector3(e.vel[0]!, e.vel[1]!, e.vel[2]!);
    return r.sub(rs).cross(v.sub(vs)).normalize();
  }

  const anguloGraus = (a: Vector3, b: Vector3): number =>
    (Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) * 180) / Math.PI;

  /** A obliquidade que o par (RA, Dec) implica, contra a órbita do próprio corpo. */
  function obliquidadeDerivada(chave: string, i: number): number {
    const eixo = new Vector3(...eixoDoCorpo(CORPOS_VISUAIS[chave]!.rotacao, EPOCA));
    return anguloGraus(eixo, normalDaOrbita(i));
  }

  it('a obliquidade derivada do polo bate com a escrita, nos oito planetas', () => {
    const conferidos: string[] = [];
    for (let i = 1; i < catalogo.corpos.length; i++) {
      const chave = catalogo.corpos[i]!.chave;
      const corpo = CORPOS_VISUAIS[chave];
      if (!corpo) continue;
      const derivada = obliquidadeDerivada(chave, i);
      const escrita = corpo.rotacao.obliquidadeGraus;
      // A IAU define o norte pelo lado do polo, e não pelo sentido do giro: num
      // corpo retrógrado a tabela publica o suplemento. Vênus (177,36°) e Urano
      // (97,77°) são os dois casos, e aceitar os dois lados é o que torna a
      // conferência aplicável à tabela como ela é publicada.
      const distancia = Math.min(Math.abs(derivada - escrita), Math.abs(derivada - (180 - escrita)));
      expect(
        distancia,
        `${chave}: polo (${corpo.rotacao.poloRa}, ${corpo.rotacao.poloDec}) dá ${derivada.toFixed(3)}°, ` +
          `a tabela diz ${escrita}°`,
      ).toBeLessThanOrEqual(0.1);
      conferidos.push(chave);
    }
    expect(conferidos.length, `conferidos: ${conferidos.join(', ')}`).toBe(8);
    for (const c of ['mercurio', 'marte', 'jupiter', 'saturno', 'netuno']) {
      expect(conferidos, `${c} ficou de fora`).toContain(c);
    }
  });

  it('e a conferência REPROVA um polo trocado por meio grau', () => {
    // Sem esta prova, a folga acima poderia estar larga o bastante para aprovar
    // qualquer coisa. Meio grau é menos que um erro de digitação típico, e tem
    // de reprovar em todos — inclusive nos que a órbita inclina mais.
    for (let i = 1; i < catalogo.corpos.length; i++) {
      const chave = catalogo.corpos[i]!.chave;
      const rot = CORPOS_VISUAIS[chave]?.rotacao;
      if (!rot) continue;
      const torto = new Vector3(...eixoDoCorpo({ ...rot, poloDec: rot.poloDec + 0.5 }, EPOCA));
      const certo = new Vector3(...eixoDoCorpo(rot, EPOCA));
      expect(anguloGraus(torto, certo), `${chave}: meio grau no polo mal se mexeu`)
        .toBeGreaterThan(0.1);
    }
  });

  it('nenhum corpo está com o `eps` somado duas vezes', () => {
    // A armadilha 1 do cabeçalho, medida em todos: sem `Rx(−eps)` a Terra
    // sairia a 23,44 + 23,44 = 46,9° do polo da eclíptica.
    const ecliptica = new Vector3(0, 0, 1);
    for (const [chave, corpo] of Object.entries(CORPOS_VISUAIS)) {
      const derivada = anguloGraus(new Vector3(...eixoDoCorpo(corpo.rotacao, EPOCA)), ecliptica);
      const comErro = corpo.rotacao.obliquidadeGraus + 23.4392911;
      expect(Math.abs(derivada - comErro), `${chave} parece ter o eps somado duas vezes`)
        .toBeGreaterThan(1);
    }
  });
});

/**
 * As doze luas sem ficha propria, derivadas de `luas.json`.
 *
 * `corpos/fabrica.ts` fazia `CORPOS_VISUAIS[chave] ?? CORPOS_VISUAIS['terra']`, e das
 * treze luas so a nossa tinha entrada. As outras doze eram desenhadas com a rotacao,
 * o eixo, o achatamento e a atmosfera da Terra (Fobos, uma rocha de onze quilometros,
 * saia com halo azul de Rayleigh no limbo), invisivel a tres pixels de diametro.
 *
 * A primeira versao deste teste era circular: derivava o eixo de `poloUsado` e depois
 * conferia o eixo contra `poloUsado`, passava com erro de 0,000° e teria passado igual
 * com a derivacao errada, que estava errada. O eixo de uma lua travada por mare e a
 * normal da orbita, que difere do polo do planeta pela inclinacao: onze casos erravam
 * por pouco e Tritao, com 157,3°, por inteiro.
 *
 * Agora se mede o travamento, contra a mesma `orientacaoDoCorpo` que desenha a cena:
 * a face que encara o planeta tem de continuar encarando enquanto a lua da a volta.
 * Isso reprova periodo, eixo e meridiano errados de uma vez e nao se satisfaz por
 * construcao.
 */
describe('as luas derivadas de luas.json', () => {
  const derivadas = LUAS.filter((l) => l.chave !== 'lua');
  const UA_KM = 149597870.7;

  /** Direcao da lua para o planeta, na ecliptica, em `dias` a partir da epoca. */
  function paraOPai(l: (typeof LUAS)[number], dias: number): Vector3 {
    const r: [number, number, number] = [0, 0, 0];
    posicaoDaLua(l, l.base, dias, r);
    return new Vector3(-r[0], -r[1], -r[2]).normalize();
  }

  /** O meridiano zero do corpo, na ecliptica, no mesmo instante. */
  function meridiano(chave: string, dias: number): Vector3 {
    const jd = EPOCA_DAS_LUAS_JD + dias;
    return new Vector3(1, 0, 0).applyQuaternion(
      orientacaoDoCorpo(CORPOS_VISUAIS[chave]!.rotacao, jd, new Quaternion()),
    );
  }

  const anguloGraus = (a: Vector3, b: Vector3): number =>
    (Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) * 180) / Math.PI;

  it('sao doze, e nenhuma ficou de fora', () => {
    expect(derivadas).toHaveLength(12);
    for (const l of derivadas) {
      expect(CORPOS_VISUAIS[l.chave], `${l.chave} sem ficha visual`).toBeDefined();
    }
  });

  it('mostram sempre a MESMA FACE para o planeta, volta após volta', () => {
    // A medida de verdade. Em quartos de orbita ao longo de tres voltas, o
    // angulo entre o meridiano zero e a direcao do planeta tem de ficar em
    // zero — a menos da libracao em longitude, que e real e vale ~2e radianos.
    for (const l of derivadas) {
      const periodo = 360 / l.taxaSideralMedidaGrausDia;
      // A tolerancia e a libracao optica, medida. Uma lua travada por mare gira a taxa
      // constante e percorre a orbita a taxa variavel, entao a face oscila em torno do
      // planeta com amplitude `2e` radianos (a equacao do centro). Medido nas doze, em
      // oitavos de orbita ao longo de doze voltas, a amplitude real fica entre 1,15x e 2,00x
      // esse valor: Tita balanca 5,1° contra 3,3° de `2e`, Calisto 1,6° contra 0,8°. O
      // excesso e o termo em `e²` mais a precessao do no na janela.
      //
      // 2,5x cobre o pior caso com folga e continua apertado: um periodo errado por 1% faz a
      // face dar uma volta inteira em poucas orbitas, o que nenhuma tolerancia aguenta. O
      // piso de 0,2° e para Deimos e Tritao, cuja excentricidade e publicada como zero e
      // cujo residuo medido foi 0,008° e 0,076°.
      const libracao = Math.max((2.5 * 2 * l.excentricidade * 180) / Math.PI, 0.2);
      for (let k = 0; k <= 12; k++) {
        const dias = (k * periodo) / 4;
        const erro = anguloGraus(meridiano(l.chave, dias), paraOPai(l, dias));
        expect(
          erro,
          `${l.chave} em t=${dias.toFixed(3)} d: face ${erro.toFixed(2)}° fora, libração vale ${libracao.toFixed(2)}°`,
        ).toBeLessThan(libracao);
      }
    }
  });

  it('o eixo é a normal da ÓRBITA, e não o polo do planeta', () => {
    // Onze delas os dois quase coincidem; e por isso que usar o polo do planeta
    // passaria despercebido. Miranda inclina 4,4° e Tritao 157,3°: nesses dois
    // a diferenca e grande, e e ela que este teste exige que exista.
    const miranda = CORPOS_VISUAIS['miranda']!.rotacao;
    const urano = CORPOS_VISUAIS['urano']!.rotacao;
    const eixoMiranda = new Vector3(...eixoDoCorpo(miranda, EPOCA));
    const eixoUrano = new Vector3(...eixoDoCorpo(urano, EPOCA));
    expect(anguloGraus(eixoMiranda, eixoUrano), 'Miranda deveria inclinar sobre o equador de Urano')
      .toBeGreaterThan(3);
  });

  it('giram no período SIDERAL da própria órbita', () => {
    for (const l of derivadas) {
      const periodoDeRotacao = 360 / Math.abs(CORPOS_VISUAIS[l.chave]!.rotacao.wPorDia);
      const periodoSideral = 360 / l.taxaSideralMedidaGrausDia;
      expect(Math.abs(periodoDeRotacao - periodoSideral) / periodoSideral, l.chave).toBeLessThan(1e-12);
    }
  });

  it('Tritão é a única retrógrada, e o eixo dela aponta ao contrário do de Netuno', () => {
    // Com o eixo definido como a normal da orbita, a rotacao e sempre positiva
    // e nao ha ramo com sinal. O retrogrado aparece onde deve: no ANGULO entre
    // o eixo da lua e o do planeta.
    expect(derivadas.filter((l) => l.inclinacaoGraus > 90).map((l) => l.chave)).toEqual(['tritao']);

    const eixoTritao = new Vector3(...eixoDoCorpo(CORPOS_VISUAIS['tritao']!.rotacao, EPOCA));
    const eixoNetuno = new Vector3(...eixoDoCorpo(CORPOS_VISUAIS['netuno']!.rotacao, EPOCA));
    expect(eixoTritao.dot(eixoNetuno), 'Tritão deveria girar contra Netuno').toBeLessThan(0);

    // As de Urano NAO entram nesta conta, e a razao esta no ARQUITETURA.md:
    // o polo publicado pela IAU para Urano sai invertido em relacao as luas
    // dele — o JPL orienta o quadro equatorial da tabela pelo momento angular
    // das luas, e Urano gira ao contrario da propria orbita. Titania, Oberon e
    // Miranda sairiam "retrogradas" por essa convencao sem serem.
    for (const chave of ['titania', 'oberon', 'miranda']) {
      expect(LUAS.find((l) => l.chave === chave)!.inclinacaoGraus, `${chave} orbita direto`)
        .toBeLessThan(90);
    }
  });

  it('NENHUMA ficou com a rotação, o eixo ou a ATMOSFERA da Terra', () => {
    const terra = CORPOS_VISUAIS['terra']!;
    for (const l of derivadas) {
      const v = CORPOS_VISUAIS[l.chave]!;
      expect(Math.abs(v.rotacao.wPorDia), `${l.chave} gira como a Terra`)
        .not.toBeCloseTo(terra.rotacao.wPorDia, 4);
      expect(inclinacaoDoEixoGraus(v.rotacao), `${l.chave} tem o eixo da Terra`)
        .not.toBeCloseTo(inclinacaoDoEixoGraus(terra.rotacao), 2);
      // A que ninguém tinha visto: uma lua com halo azul de Rayleigh.
      expect(v.atmosfera, `${l.chave} herdou a atmosfera da Terra`).toBeUndefined();
    }
    expect(terra.atmosfera, 'a Terra continua com a dela').toBeDefined();
  });

  it('quem não tem ficha cai no genérico, e o genérico não é a Terra', async () => {
    // O valor da mudanca esta tanto no que passou a existir quanto no que
    // deixou de ser tolerado. Um corpo criado no sandbox precisa de alguma
    // ficha; o que ele nao pode e herdar a da Terra.
    expect(CORPO_GENERICO.rotacao.wPorDia, 'o genérico não deve girar').toBe(0);
    expect(CORPO_GENERICO.atmosfera, 'o genérico não tem atmosfera').toBeUndefined();
    expect(CORPO_GENERICO.achatamento).toBe(0);

    // A LINHA da atribuição, e não o arquivo inteiro. A primeira versão
    // procurava o padrão no texto todo e casava com o próprio comentário que
    // explica por que ele saiu — um teste que reprova a documentação do
    // conserto é um teste que empurra na direção de não documentar.
    const fonte = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../../src/cena/corpos/fabrica.ts', import.meta.url), 'utf8'),
    );
    const atribuicao = fonte.split('\n').find((l) => /^\s*const visual = /.test(l)) ?? '';
    expect(atribuicao, 'não achei a atribuição de `visual`').not.toBe('');
    expect(atribuicao, 'o padrão voltou a ser a Terra').not.toContain("CORPOS_VISUAIS['terra']");
    expect(atribuicao).toContain('CORPO_GENERICO');
  });

  it('o raio desenhado é o da lua, e não o da Terra', () => {
    for (const l of derivadas) {
      expect(CORPOS_VISUAIS[l.chave]!.raioEquatorialKm, l.chave).toBeCloseTo(l.raioMedioKm, 6);
    }
    void UA_KM;
  });
});
