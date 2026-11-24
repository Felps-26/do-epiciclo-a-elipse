/**
 * Se ha o servidor local por tras desta pagina.
 *
 * O `servidor.mjs` que os scripts `run.*` sobem escuta em 127.0.0.1 e responde a
 * `/_batida` e a `/preferencias.json`. A copia publicada no GitHub Pages e so arquivo
 * estatico: la os dois caminhos davam 404, a batida enchia o console de erro a cada 10 s
 * e as preferencias nunca ficavam gravadas, com o tutorial voltando em toda visita.
 *
 * O criterio e o nome do host. Uma pagina servida de fora da maquina nunca tem o
 * servidor local, e uma servida por ela mesma (inclusive o `vite` de desenvolvimento,
 * que so responde 404 e cai no padrao, como sempre caiu) e tratada como tendo.
 */
export function ehHostLocal(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
}

export function temServidorLocal(): boolean {
  return typeof location !== 'undefined' && ehHostLocal(location.hostname);
}
