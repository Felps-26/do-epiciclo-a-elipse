/**
 * O relogio da simulacao: de `tDias` para uma data que alguem le.
 *
 * A conversao de dia juliano para data civil usa aritmetica inteira (algoritmo de
 * Fliegel e Van Flandern) e nao o `Date` do JavaScript, por tres motivos: `Date`
 * carrega fuso horario e aqui a escala e TDB; `Date` so vai ate ±273.790 anos e o
 * programa permite andar alem; e o nucleo tem de ser deterministico e sem
 * plataforma, o que o lint cobra ao proibir `Date.now` aqui dentro.
 */
import { ANO_DIAS } from './unidades.ts';

export const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const;

/**
 * A escada de velocidade. Cada degrau e uma escolha de leitura, e nao uma
 * progressao geometrica: 1 dia/s para ver a Lua, 30 para os planetas internos,
 * 365 para a Terra fechar uma volta por segundo, 7300 para ver Netuno andar.
 */
export const ESCADA_DIAS_POR_SEGUNDO = [1, 5, 30, 100, 365, 1825, 3650, 7300] as const;

export interface DataCivil {
  ano: number;
  mes: number; // 1 a 12
  dia: number;
}

/** Dia juliano -> data civil, por aritmetica inteira. Vale para qualquer ano. */
export function dataDeJulianoTdb(jd: number): DataCivil {
  // +0,5 porque o dia juliano vira a meia-noite e comeca ao meio-dia.
  const z = Math.floor(jd + 0.5);
  let a = z;
  if (z >= 2299161) {
    const alfa = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alfa - Math.floor(alfa / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);

  const dia = b - d - Math.floor(30.6001 * e);
  const mes = e < 14 ? e - 1 : e - 13;
  const ano = mes > 2 ? c - 4716 : c - 4715;
  return { ano, mes, dia };
}

/** Data civil -> dia juliano da meia-noite (Meeus 7.1), calendario gregoriano. */
export function julianoDeData(ano: number, mes: number, dia: number): number {
  const y = mes > 2 ? ano : ano - 1;
  const m = mes > 2 ? mes : mes + 12;
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + dia + b - 1524.5;
}

// TAI − UTC desde 1972 (IERS). Depois do ultimo, presume-se que nao ha outro.
// prettier-ignore
const SALTOS: readonly (readonly [number, number, number])[] = [
  [1972, 1, 10], [1972, 7, 11], [1973, 1, 12], [1974, 1, 13], [1975, 1, 14], [1976, 1, 15],
  [1977, 1, 16], [1978, 1, 17], [1979, 1, 18], [1980, 1, 19], [1981, 7, 20], [1982, 7, 21],
  [1983, 7, 22], [1985, 7, 23], [1988, 1, 24], [1990, 1, 25], [1991, 1, 26], [1992, 7, 27],
  [1993, 7, 28], [1994, 7, 29], [1996, 1, 30], [1997, 7, 31], [1999, 1, 32], [2006, 1, 33],
  [2009, 1, 34], [2012, 7, 35], [2015, 7, 36], [2017, 1, 37],
];
const JD_DOS_SALTOS = SALTOS.map(([a, m]) => julianoDeData(a, m, 1));
/** Ate onde os segundos intercalares sao conhecidos; depois disso, estimativa. */
const ANO_DO_ULTIMO_DADO = 2026;

/** ΔT de Espenak e Meeus (NASA, 2006), em segundos, por trechos. */
function deltaTEspenakMeeus(ano: number): number {
  const u = (ano - 1820) / 100;
  if (ano < 1900 || ano >= 2150) return -20 + 32 * u * u;
  if (ano < 1920) {
    const t = ano - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  }
  if (ano < 1941) {
    const t = ano - 1920;
    return 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3;
  }
  if (ano < 1961) {
    const t = ano - 1950;
    return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547;
  }
  if (ano < 1986) {
    const t = ano - 1975;
    return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718;
  }
  if (ano < 2005) {
    const t = ano - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  }
  if (ano < 2050) {
    const t = ano - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t ** 2;
  }
  return -20 + 32 * u * u - 0.5628 * (2150 - ano);
}

/**
 * TDB − UTC em segundos (TDB e TT diferem menos de 2 ms).
 *
 * De 1972 ate o ultimo dado, e exato: 32,184 s mais os segundos intercalares.
 * Antes, o ΔT de Espenak e Meeus (UTC ~ UT1). Depois, o ultimo valor exato mais a
 * subida que os mesmos polinomios preveem, para nao saltar na emenda.
 */
export function tdbMenosUtcSegundos(jdTdb: number): number {
  const ano = 2000 + (jdTdb - 2451545) / 365.25;
  if (jdTdb < JD_DOS_SALTOS[0]!) return deltaTEspenakMeeus(ano);
  if (ano > ANO_DO_ULTIMO_DADO) {
    const ultimo = 32.184 + SALTOS[SALTOS.length - 1]![2];
    return ultimo + deltaTEspenakMeeus(ano) - deltaTEspenakMeeus(ANO_DO_ULTIMO_DADO);
  }
  let k = 0;
  while (k + 1 < JD_DOS_SALTOS.length && jdTdb >= JD_DOS_SALTOS[k + 1]!) k++;
  return 32.184 + SALTOS[k]![2];
}

export interface InstanteCivil extends DataCivil {
  hora: number;
  minuto: number;
  segundo: number;
}

/** Data e hora de um dia juliano, arredondadas ao segundo, sem mudar de escala. */
export function instanteDeJuliano(jd: number): InstanteCivil {
  const segundosNoDia = Math.round((jd + 0.5 - Math.floor(jd + 0.5)) * 86400);
  // 86400 arredondado pertence ao dia seguinte.
  const virou = segundosNoDia === 86400;
  const data = dataDeJulianoTdb(virou ? Math.floor(jd + 0.5) + 0.5 : jd);
  const s = virou ? 0 : segundosNoDia;
  return { ...data, hora: Math.floor(s / 3600), minuto: Math.floor((s % 3600) / 60), segundo: s % 60 };
}

/** O instante em UTC aproximado, para quando a tela mostra hora e nao so a data. */
export function utcDeJulianoTdb(jdTdb: number): InstanteCivil {
  return instanteDeJuliano(jdTdb - tdbMenosUtcSegundos(jdTdb) / 86400);
}

/** "31/12/2025 23:58:51". */
export function instanteCurto(i: InstanteCivil): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${dataCurta(i)} ${p(i.hora)}:${p(i.minuto)}:${p(i.segundo)}`;
}

export function dataDaSimulacao(jdEpoca: number, tDias: number): DataCivil {
  return dataDeJulianoTdb(jdEpoca + tDias);
}

/** "21 de setembro de 2026". A forma longa, para a barra lateral. */
export function dataPorExtenso(data: DataCivil): string {
  const mes = MESES[data.mes - 1] ?? '?';
  if (data.ano <= 0) {
    // Ano juliano 0 e 1 a.C., -1 e 2 a.C., e assim por diante.
    return `${data.dia} de ${mes} de ${1 - data.ano} a.C.`;
  }
  return `${data.dia} de ${mes} de ${data.ano}`;
}

/** "21/09/2026". A forma curta, para dentro de caixas estreitas. */
export function dataCurta(data: DataCivil): string {
  const dd = String(data.dia).padStart(2, '0');
  const mm = String(data.mes).padStart(2, '0');
  return `${dd}/${mm}/${data.ano}`;
}

/**
 * "30 dias por segundo", "3 meses por segundo", "10 anos por segundo". O degrau
 * de meses, entre 45 e 300 dias, evita que 100 dias/s vire "0,3 ano por segundo".
 * Arredonda para inteiro porque "9,9 anos por segundo" tem uma precisao que a
 * leitura nao usa.
 */
export function velocidadePorExtenso(diasPorSegundo: number): string {
  const d = diasPorSegundo;
  if (d <= 0) return 'pausado';
  if (d < 2) return '1 dia por segundo';
  if (d < 45) return `${d.toFixed(0)} dias por segundo`;
  if (d < 300) {
    const meses = d / 30.44;
    return `${meses.toFixed(0)} ${meses < 1.5 ? 'mês' : 'meses'} por segundo`;
  }
  const anos = d / ANO_DIAS;
  return `${anos.toFixed(0)} ${anos < 1.5 ? 'ano' : 'anos'} por segundo`;
}

/**
 * Degrau seguinte ou anterior da escada, limitado pelo teto da maquina. Quando a
 * velocidade atual nao esta na escada, parte-se do degrau mais proximo e nao do
 * primeiro. Isso acontece quando a calibragem corta a escada entre duas aberturas
 * ou as preferencias guardam um valor que deixou de existir; partir do primeiro
 * jogaria alguem de 3650 dias/s para 5 num toque.
 */
export function mudarVelocidade(atual: number, passo: -1 | 1, tetoDiasPorSegundo: number): number {
  const possiveis = ESCADA_DIAS_POR_SEGUNDO.filter((v) => v <= tetoDiasPorSegundo);
  const degraus: readonly number[] = possiveis.length > 0 ? possiveis : [ESCADA_DIAS_POR_SEGUNDO[0]];

  let i = degraus.indexOf(atual);
  if (i < 0) {
    i = degraus.reduce(
      (melhor, v, k) => (Math.abs(v - atual) < Math.abs(degraus[melhor]! - atual) ? k : melhor),
      0,
    );
  }
  const j = Math.min(degraus.length - 1, Math.max(0, i + passo));
  return degraus[j]!;
}
