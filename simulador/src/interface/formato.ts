/**
 * Números escritos em português, num lugar só.
 *
 * `numero` estava escrita em cinco arquivos com duas regras diferentes (umas só
 * trocavam o ponto por vírgula, outras também agrupavam milhares), e a mesma
 * grandeza saía escrita de jeitos diferentes em cantos da tela.
 *
 * `distancia` nasceu de um defeito: a leitura "câmera a X UA do alvo" mostrava
 * "0,0000 UA" quando o duplo clique levava a câmera a três raios do corpo. Agora
 * a unidade acompanha a grandeza (km abaixo de 0,01 UA, UA acima), e a troca
 * aparece na própria leitura.
 */

/** Quilômetros por unidade astronômica. IAU 2012, exato por definição. */
const UA_KM = 149597870.7;

/**
 * Abaixo disto a leitura vai em quilômetros. 0,01 UA são 1,5 milhão de km: acima
 * de qualquer corpo e abaixo da menor distância entre planetas. O corte cai num
 * vão onde nada acontece, então a leitura não pisca entre as unidades.
 */
const EM_KM_ABAIXO_DE_UA = 0.01;

/** Casas decimais pela ordem de grandeza: número grande não precisa de quatro. */
export function numero(v: number, casas?: number): string {
  const n = casas ?? (Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 1 ? 2 : 4);
  return v.toFixed(n).replace('.', ',');
}

/** O mesmo, com os milhares agrupados por ponto: 149.597.871. */
export function milhares(v: number, casas = 0): string {
  const [inteiro, decimal] = v.toFixed(casas).split('.');
  const agrupado = inteiro!.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimal ? `${agrupado},${decimal}` : agrupado;
}

/**
 * Distância em UA, na unidade que ela pede. Devolve o texto com a unidade:
 * quem escrevesse "X UA" ao redor não saberia que a unidade mudou.
 */
export function distancia(ua: number): string {
  if (!Number.isFinite(ua)) return '—';
  const abs = Math.abs(ua);
  if (abs < EM_KM_ABAIXO_DE_UA) {
    const km = ua * UA_KM;
    // Abaixo de 10 km ganha uma casa: é a faixa da órbita baixa, em que o
    // programa promete chegar a 100 m do chão.
    return `${Math.abs(km) < 10 ? numero(km, 1) : milhares(km)} km`;
  }
  return `${numero(ua)} UA`;
}
