/**
 * Tira do manifesto de texturas os níveis cujo arquivo não está no disco.
 *
 * O git traz só o 2K; o 4K e o 8K vêm de `baixar_texturas.mjs`. Sem a poda, um clone
 * pedia arquivos que não tem, e cada pedido virava um 404 no console. O build e o
 * servidor de desenvolvimento aplicam a poda (ver `vite.config.ts`).
 */
export interface ManifestoDeTexturas {
  mapas: { niveis: Record<string, string> }[];
}

export function podarNiveis<M extends ManifestoDeTexturas>(manifesto: M, existe: (caminho: string) => boolean): M {
  return {
    ...manifesto,
    mapas: manifesto.mapas.map((m) => ({
      ...m,
      niveis: Object.fromEntries(Object.entries(m.niveis).filter(([, caminho]) => existe(caminho))),
    })),
  };
}
