// Diz se o dist/ e mais velho que o codigo que o gera. Sai com 0 se o dist/
// esta em dia (ou nao ha como comparar) e com 1 se algum arquivo de origem
// mudou depois da ultima construcao. Os scripts run.* usam isto para nao
// abrir sem aviso um programa antigo.
//
// So o codigo conta: src/, index.html e as configuracoes da construcao. O
// publico/ fica de fora de proposito: sao texturas e dados que o vite apenas
// copia, e varrer milhares de arquivos a cada abertura custaria mais do que
// o descuido que se quer pegar.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const marco = join(raiz, 'dist', 'index.html');
if (!existsSync(marco)) process.exit(0);
const construido = statSync(marco).mtimeMs;

function maisNovo(caminho) {
  const info = statSync(caminho);
  if (!info.isDirectory()) return info.mtimeMs;
  let max = 0;
  for (const nome of readdirSync(caminho)) max = Math.max(max, maisNovo(join(caminho, nome)));
  return max;
}

const origens = ['src', 'index.html', 'vite.config.ts', 'package.json', 'tsconfig.json']
  .map((p) => join(raiz, p))
  .filter((p) => existsSync(p));
const ultimo = Math.max(...origens.map(maisNovo));
process.exit(ultimo > construido ? 1 : 0);
