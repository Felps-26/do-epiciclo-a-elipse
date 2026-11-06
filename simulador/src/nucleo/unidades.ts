/**
 * Unidades do JPL, e não do SI: posição em UA, velocidade em UA/dia, gravidade
 * como GM em UA³/dia² (GM junto, nunca G e M separados), tempo em dias TDB
 * contados a partir da época.
 *
 * Assim os números da efeméride entram sem conversão. Em SI, GM seria da ordem
 * de 1e20 e as posições de 1e11, e somar um termo grande a um pequeno perderia
 * dígitos que hoje não se perdem. A conversão para km e km/s existe só para
 * mostrar números na tela; nenhuma conta de física passa por ela.
 */

/** Unidade astronômica em km. Valor do cabeçalho do DE440, sem arredondar. */
export const UA_KM = 149597870.7;

export const DIA_S = 86400.0;

/** Dias de um ano juliano, 365,25, usado no projeto inteiro. */
export const ANO_DIAS = 365.25;

export const GRAUS_POR_RAD = 180 / Math.PI;

export const uaParaKm = (ua: number): number => ua * UA_KM;

export const kmParaUa = (km: number): number => km / UA_KM;

/** UA/dia -> km/s. A velocidade que aparece nas fichas. */
export const kmPorS = (uaPorDia: number): number => (uaPorDia * UA_KM) / DIA_S;

export const grausDeRad = (rad: number): number => rad * GRAUS_POR_RAD;

/**
 * UA/dia² -> m/s². Só para a tela da matemática do Sol, onde o número tem de ser
 * comparável aos 9,8 m/s² da superfície da Terra; em UA/dia² a aceleração do Sol
 * dá 4e-11.
 */
export const mPorS2 = (uaPorDia2: number): number =>
  (uaPorDia2 * UA_KM * 1000) / (DIA_S * DIA_S);
