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

/**
 * Gira (e espelha, se pedido) a imagem em longitude, no lugar. `girar` e fracao da
 * volta: 0,5 leva o meridiano da borda para o meio.
 */
export function ajustarLongitude(data, L, A, canais, { espelhar, girar }) {
  if (!espelhar && girar === 0) return data;
  const saida = Buffer.alloc(data.length);
  const desloca = Math.round(girar * L);
  for (let y = 0; y < A; y++) {
    for (let x = 0; x < L; x++) {
      const origem = espelhar ? L - 1 - x : x;
      const destino = (x + desloca) % L;
      data.copy(saida, canais * (y * L + destino), canais * (y * L + origem), canais * (y * L + origem + 1));
    }
  }
  return saida;
}

/**
 * Um nivel de textura: reduz a fonte (TIFF, JPEG ou PNG) para `largura` no lado
 * maior, sem ampliar, ajusta a longitude, pinta os buracos e grava JPEG a 82. Tudo em
 * memoria, sem PNG intermediario: reescrever JPEG duas vezes empilharia artefato.
 *
 * Era o `sips` do macOS, e so no Mac dava para regenerar as texturas.
 */
export async function gerarNivel(origem, destino, largura, { ajuste = { espelhar: false, girar: 0 }, preencher = false } = {}) {
  const { default: sharp } = await import('sharp');
  sharp.cache(false);
  const reduzida = sharp(origem, { limitInputPixels: false }).resize({
    width: largura,
    height: largura,
    fit: 'inside',
    withoutEnlargement: true,
  });
  if (!ajuste.espelhar && ajuste.girar === 0 && !preencher) {
    await reduzida.jpeg({ quality: 82 }).toFile(destino);
    return;
  }
  const { data, info } = await reduzida.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (preencher) preencherSemDado(data, info.width, info.height, info.channels);
  const ajustada = ajustarLongitude(data, info.width, info.height, info.channels, ajuste);
  await sharp(ajustada, { raw: info }).jpeg({ quality: 82 }).toFile(destino);
}

/** A largura em pixels de um arquivo. */
export async function larguraDe(caminho) {
  const { default: sharp } = await import('sharp');
  return (await sharp(caminho, { limitInputPixels: false }).metadata()).width ?? 0;
}
