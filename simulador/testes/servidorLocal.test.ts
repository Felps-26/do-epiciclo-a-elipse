/**
 * Quem tem o servidor local por tras da pagina.
 *
 * Na copia do GitHub Pages a batida e o arquivo de preferencias davam 404: um erro no
 * console a cada 10 s e o tutorial voltando em toda visita. A regra e o nome do host.
 */
import { describe, expect, it } from 'vitest';
import { ehHostLocal } from '@app/servidorLocal.ts';

describe('o servidor local', () => {
  it('existe quando a pagina vem da propria maquina', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]', '::1']) {
      expect(ehHostLocal(host), host).toBe(true);
    }
  });

  it('nao existe na copia publicada, nem num nome parecido', () => {
    for (const host of ['felps-26.github.io', 'localhost.exemplo.com', '127.0.0.2.nip.io', '']) {
      expect(ehHostLocal(host), host).toBe(false);
    }
  });
});
