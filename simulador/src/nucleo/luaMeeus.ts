/**
 * A Lua pela serie truncada da ELP-2000/82 (Meeus, Astronomical Algorithms,
 * cap. 47): 60 termos em longitude e distancia, 60 em latitude, cerca de 10″ e
 * poucos km de erro. Os elementos medios com taxa secular erravam 15.000 km,
 * porque nao tem a eveccao (1,27°) nem a variacao (0,66°).
 *
 * A serie da coordenadas geocentricas na ecliptica e no equinocio medios DA
 * DATA. A cena usa a ecliptica J2000; sem a precessao, em 2026 a Lua estaria
 * 0,36° (2.400 km) fora do lugar.
 */
import { OBLIQUIDADE_RAD } from './planoDeReferencia.ts';
import { UA_KM } from './unidades.ts';

const GRAU = Math.PI / 180;
const SEGUNDO = GRAU / 3600;
const JD_J2000 = 2451545.0;

// Tabela 47.A: D, M, M', F, coeficiente do seno em Σl (1e-6 grau), do cosseno em Σr (metro).
// prettier-ignore
const LONGITUDE_E_DISTANCIA: readonly (readonly [number, number, number, number, number, number])[] = [
  [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111], [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925], [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138], [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586], [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321], [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661], [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208], [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379], [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650], [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003], [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884], [0, 1, 2, 0, -2120, 5751],
  [0, 2, 0, 0, -2069, 0], [2, -2, -1, 0, 2048, -4950], [2, 0, 1, -2, -1773, 4130],
  [2, 0, 0, 2, -1595, 0], [4, -1, -1, 0, 1215, -3958], [0, 0, 2, 2, -1110, 0],
  [3, 0, -1, 0, -892, 3258], [2, 1, 1, 0, -810, 2616], [4, -1, -2, 0, 759, -1897],
  [0, 2, -1, 0, -713, -2117], [2, 2, -1, 0, -700, 2354], [2, 1, -2, 0, 691, 0],
  [2, -1, 0, -2, 596, 0], [4, 0, 1, 0, 549, -1423], [0, 0, 4, 0, 537, -1117],
  [4, -1, 0, 0, 520, -1571], [1, 0, -2, 0, -487, -1739], [2, 1, 0, -2, -399, 0],
  [0, 0, 2, -2, -381, -4421], [1, 1, 1, 0, 351, 0], [3, 0, -2, 0, -340, 0],
  [4, 0, -3, 0, 330, 0], [2, -1, 2, 0, 327, 0], [0, 2, 1, 0, -323, 1165],
  [1, 1, -1, 0, 299, 0], [2, 0, 3, 0, 294, 0], [2, 0, -1, -2, 0, 8752],
];

// Tabela 47.B: D, M, M', F, coeficiente do seno em Σb (1e-6 grau).
// prettier-ignore
const LATITUDE: readonly (readonly [number, number, number, number, number])[] = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463], [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870], [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794],
  [0, 0, 0, 3, -1749], [0, 1, -1, 1, -1565], [1, 0, 0, 1, -1491], [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410], [0, 1, 0, -1, -1344], [1, 0, 0, -1, -1335], [0, 0, 3, 1, 1107],
  [4, 0, 0, -1, 1021], [4, 0, -1, 1, 833], [0, 0, 1, -3, 777], [4, 0, -2, 1, 671],
  [2, 0, 0, -3, 607], [2, 0, 2, -1, 596], [2, -1, 1, -1, 491], [2, 0, -2, 1, -451],
  [0, 0, 3, -1, 439], [2, 0, 2, 1, 422], [2, 0, -3, -1, 421], [2, 1, -1, 1, -366],
  [2, 1, 0, 1, -351], [4, 0, 0, 1, 331], [2, -1, 1, 1, 315], [2, -2, 0, -1, 302],
  [0, 0, 1, 3, -283], [2, 1, 1, -1, -229], [1, 1, 0, -1, 223], [1, 1, 0, 1, 223],
  [0, 1, -2, -1, -220], [2, 1, -1, -1, -220], [1, 0, 1, 1, -185], [2, -1, -2, -1, 181],
  [0, 1, 2, 1, -177], [4, 0, -2, -1, 176], [4, -1, -1, -1, 166], [1, 0, 1, -1, -164],
  [4, 0, 1, -1, 132], [1, 0, -1, -1, -119], [4, -1, 0, -1, 115], [2, -2, 0, 1, 107],
];

export interface CoordenadasDaData {
  /** Longitude e latitude geocentricas na ecliptica media da data, graus. */
  longitudeGraus: number;
  latitudeGraus: number;
  distanciaKm: number;
}

/** A serie do capitulo 47, sem nutacao: ecliptica e equinocio medios da data. */
export function luaNaDataMedia(jdTdb: number): CoordenadasDaData {
  const T = (jdTdb - JD_J2000) / 36525;
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;

  const Ll = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
  const D = (297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000) * GRAU;
  const M = (357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000) * GRAU;
  const Ml = (134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000) * GRAU;
  const F = (93.272095 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000) * GRAU;
  const A1 = (119.75 + 131.849 * T) * GRAU;
  const A2 = (53.09 + 479264.29 * T) * GRAU;
  const A3 = (313.45 + 481266.484 * T) * GRAU;
  // A excentricidade da orbita da Terra diminui: os termos com M pesam E ou E^2.
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const fatorE = (m: number): number => (m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E);

  let somaL = 0;
  let somaR = 0;
  for (const [d, m, ml, f, cl, cr] of LONGITUDE_E_DISTANCIA) {
    const arg = d * D + m * M + ml * Ml + f * F;
    const k = fatorE(m);
    somaL += cl * k * Math.sin(arg);
    somaR += cr * k * Math.cos(arg);
  }
  let somaB = 0;
  for (const [d, m, ml, f, cb] of LATITUDE) {
    somaB += cb * fatorE(m) * Math.sin(d * D + m * M + ml * Ml + f * F);
  }

  const LlRad = Ll * GRAU;
  somaL += 3958 * Math.sin(A1) + 1962 * Math.sin(LlRad - F) + 318 * Math.sin(A2);
  somaB +=
    -2235 * Math.sin(LlRad) +
    382 * Math.sin(A3) +
    175 * Math.sin(A1 - F) +
    175 * Math.sin(A1 + F) +
    127 * Math.sin(LlRad - Ml) -
    115 * Math.sin(LlRad + Ml);

  const longitude = (Ll + somaL / 1e6) % 360;
  return {
    longitudeGraus: longitude < 0 ? longitude + 360 : longitude,
    latitudeGraus: somaB / 1e6,
    distanciaKm: 385000.56 + somaR / 1000,
  };
}

/**
 * Vetor equatorial medio da data para o equador e equinocio J2000 (IAU 1976).
 * As tres rotacoes de Meeus (21.4) aplicadas ao contrario, sobre o vetor.
 */
export function equatorialDaDataParaJ2000(jdTdb: number, v: readonly [number, number, number]): [number, number, number] {
  const t = (jdTdb - JD_J2000) / 36525;
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t * t * t) * SEGUNDO;
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t * t * t) * SEGUNDO;
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t * t * t) * SEGUNDO;

  // Desfaz a ascensao reta somada (z), a inclinacao do equador (theta) e o zeta.
  const cz = Math.cos(z);
  const sz = Math.sin(z);
  const x1 = cz * v[0] + sz * v[1];
  const y1 = -sz * v[0] + cz * v[1];
  const z1 = v[2];

  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const x2 = ct * x1 + st * z1;
  const z2 = -st * x1 + ct * z1;

  const cs = Math.cos(zeta);
  const ss = Math.sin(zeta);
  return [cs * x2 + ss * y1, -ss * x2 + cs * y1, z2];
}

/** Obliquidade media da data (IAU 1976), rad. */
function obliquidadeDaData(jdTdb: number): number {
  const T = (jdTdb - JD_J2000) / 36525;
  return (84381.448 - 46.815 * T - 0.00059 * T * T + 0.001813 * T * T * T) * SEGUNDO;
}

/** Posicao geocentrica da Lua em UA, na ecliptica J2000 que a cena usa. */
export function posicaoDaLuaMeeus(jdTdb: number, saida: [number, number, number]): void {
  const c = luaNaDataMedia(jdTdb);
  const l = c.longitudeGraus * GRAU;
  const b = c.latitudeGraus * GRAU;
  const r = c.distanciaKm / UA_KM;
  const xe = r * Math.cos(b) * Math.cos(l);
  const ye = r * Math.cos(b) * Math.sin(l);
  const ze = r * Math.sin(b);

  const eps = obliquidadeDaData(jdTdb);
  const ce = Math.cos(eps);
  const se = Math.sin(eps);
  const eq = equatorialDaDataParaJ2000(jdTdb, [xe, ce * ye - se * ze, se * ye + ce * ze]);

  const c0 = Math.cos(OBLIQUIDADE_RAD);
  const s0 = Math.sin(OBLIQUIDADE_RAD);
  saida[0] = eq[0];
  saida[1] = c0 * eq[1] + s0 * eq[2];
  saida[2] = -s0 * eq[1] + c0 * eq[2];
}
