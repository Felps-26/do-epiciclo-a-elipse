/**
 * O servidor local, nos dois caminhos que decidem se o programa abre.
 *
 * A trava obsoleta. O servidor grava `.servidor.trava` com o proprio PID
 * para que abrir o programa duas vezes reaproveite a instancia de pe em vez de
 * subir uma segunda. Se ele morrer sem poder limpar — um `SIGKILL`, a maquina
 * desligando, o Playwright encerrando a suite —, a trava fica. Sem recuperacao,
 * a proxima abertura leria a trava, acharia que ha uma instancia viva, abriria
 * o navegador num endereco morto e sairia. O programa nunca mais abriria, e
 * nada na tela explicaria por que.
 *
 * Roda no vitest, e nao no Playwright, de proposito: `npm test` executa o
 * vitest ANTES, e ai ainda nao ha servidor gerenciado com que brigar pela
 * trava.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { createConnection } from 'node:net';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const TRAVA = join(RAIZ, '.servidor.trava');

let filho: ChildProcess | null = null;

/** Sobe o servidor e devolve o endereco que ele imprimiu. */
function subir(): Promise<string> {
  return new Promise((resolve, reject) => {
    filho = spawn('node', [join(RAIZ, 'servidor.mjs'), '--sem-navegador'], { cwd: RAIZ });
    let saida = '';
    const prazo = setTimeout(() => reject(new Error(`o servidor nao anunciou o endereco:\n${saida}`)), 12000);
    filho.stdout?.on('data', (d: Buffer) => {
      saida += d.toString();
      const m = /(http:\/\/127\.0\.0\.1:\d+\/)/.exec(saida);
      if (m) {
        clearTimeout(prazo);
        resolve(m[1]!);
      }
    });
    filho.on('error', reject);
  });
}

/**
 * Faz o GET com o caminho cru. O `fetch` normaliza os `..` antes de enviar, então
 * com ele o servidor nunca recebe uma tentativa de sair da pasta. Devolve o código HTTP.
 */
function pedirCru(url: string, caminho: string): Promise<number> {
  const { hostname, port } = new URL(url);
  return new Promise((resolve, reject) => {
    const s = createConnection({ host: hostname, port: Number(port) }, () => {
      s.write(`GET ${caminho} HTTP/1.1\r\nHost: ${hostname}\r\nConnection: close\r\n\r\n`);
    });
    let resposta = '';
    s.on('data', (d: Buffer) => {
      resposta += d.toString('latin1');
    });
    s.on('error', reject);
    s.on('close', () => {
      const m = /^HTTP\/1\.1 (\d{3})/.exec(resposta);
      if (m) resolve(Number(m[1]));
      else reject(new Error(`resposta sem linha de status: ${resposta.slice(0, 80)}`));
    });
  });
}

const morreu = (p: ChildProcess): Promise<void> =>
  new Promise((r) => {
    if (p.exitCode !== null || p.signalCode !== null) return r();
    p.on('exit', () => r());
  });

afterEach(async () => {
  if (filho) {
    filho.kill('SIGTERM');
    await morreu(filho);
    filho = null;
  }
  if (existsSync(TRAVA)) unlinkSync(TRAVA);
});

describe('o servidor local', () => {
  it('sobe com uma trava obsoleta no caminho, em vez de desistir', async () => {
    // Um PID que ninguem tem. `process.kill(pid, 0)` nao mata: so pergunta se
    // o processo existe, e para este ele lanca.
    writeFileSync(TRAVA, JSON.stringify({ pid: 999999, porta: 8731 }), 'utf8');
    const url = await subir();
    const r = await fetch(url);
    expect(r.status, 'o servidor nao respondeu com a trava obsoleta no caminho').toBe(200);
    // E a trava foi reescrita com o PID de quem esta mesmo de pe.
    const trava = JSON.parse(readFileSync(TRAVA, 'utf8')) as { pid: number };
    expect(trava.pid).toBe(filho!.pid);
  }, 20000);

  // No Windows, `kill('SIGTERM')` encerra o processo à força, sem rodar os handlers de sinal.
  it.skipIf(process.platform === 'win32')('remove a trava ao encerrar por sinal', async () => {
    await subir();
    expect(existsSync(TRAVA)).toBe(true);
    filho!.kill('SIGTERM');
    await morreu(filho!);
    filho = null;
    expect(existsSync(TRAVA), 'a trava ficou para tras, e a proxima abertura a leria').toBe(false);
  }, 20000);

  it('serve os cabeçalhos de isolamento e recusa subir de pasta', async () => {
    // Os mesmos que `offline.spec.ts` confere no navegador. Aqui eles entram
    // porque este teste roda sem navegador nenhum e mesmo assim precisa
    // reprovar se alguem tirar um deles do servidor.
    const url = await subir();
    const r = await fetch(url);
    expect(r.headers.get('cross-origin-opener-policy')).toBe('same-origin');
    expect(r.headers.get('cross-origin-embedder-policy')).toBe('require-corp');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');

    // Sem `dist/` o servidor responde 200 com a página "falta construir" a qualquer caminho,
    // então a travessia só pode ser testada com o programa construído.
    if (existsSync(join(RAIZ, 'dist'))) {
      // `package.json` fica na raiz do projeto, uma pasta acima de `dist/`.
      expect(await pedirCru(url, '/../package.json'), 'deu para sair da pasta servida').not.toBe(200);
      expect(await pedirCru(url, '/%2e%2e/package.json'), 'deu para sair com %2e%2e').not.toBe(200);
    }
  }, 20000);
});
