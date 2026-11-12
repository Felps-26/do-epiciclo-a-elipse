/** O que os mosaicos das luas precisam antes de virar textura. */
/**
 * Pinta com a cor media os buracos pretos de "sem dado" dos mosaicos. Na tela eles
 * saiam do mesmo preto do lado noturno, como se faltasse um pedaco do corpo. A
 * mascara cresce dois pixels para levar junto a franja que a compressao deixa.
 */
export function preencherSemDado(data, L, A, canais) {
  const vazio = new Uint8Array(L * A);
  let soma = [0, 0, 0];
  let validos = 0;
  for (let i = 0; i < L * A; i++) {
    const k = i * canais;
    if (data[k] < 10 && data[k + 1] < 10 && data[k + 2] < 10) vazio[i] = 1;
    else {
      soma = [soma[0] + data[k], soma[1] + data[k + 1], soma[2] + data[k + 2]];
      validos++;
    }
  }
  if (validos === 0) return;
  const media = soma.map((s) => Math.round(s / validos));
  const crescido = vazio.slice();
  for (let y = 0; y < A; y++) {
    for (let x = 0; x < L; x++) {
      if (!vazio[y * L + x]) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const yy = y + dy;
          if (yy >= 0 && yy < A) crescido[yy * L + ((x + dx + L) % L)] = 1;
        }
      }
    }
  }
  for (let i = 0; i < L * A; i++) {
    if (!crescido[i]) continue;
    data[i * canais] = media[0];
    data[i * canais + 1] = media[1];
    data[i * canais + 2] = media[2];
  }
}
