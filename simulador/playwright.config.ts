/**
 * O teste autoritativo do requisito "o programa nao acessa a internet" mora aqui.
 *
 * `serviceWorkers: 'block'` nao e zelo: sem ele as requisicoes feitas por um service worker
 * escapam do `page.route`, e o teste de offline passaria verde com o programa baixando coisa.
 */
import { defineConfig, devices } from '@playwright/test';

const ORIGEM = 'http://127.0.0.1:8731';

export default defineConfig({
  testDir: './testes/e2e',
  fullyParallel: false,
  workers: 1,
  // Com SwiftShader um quadro leva centenas de milissegundos, e uma transicao de
  // camera de 0,45 s leva varios segundos de relogio. Os testes esperam a cena
  // assentar (`assentar` em preparar.ts), e o teto de cada um cobre isso.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: ORIGEM,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    // `NAVEGADORES=todos` acrescenta o Edge e o Firefox, so na spec de fumaca. O CI
    // fica no Chromium com SwiftShader, que e onde as imagens de referencia valem.
    ...(process.env['NAVEGADORES'] === 'todos'
      ? [
          { name: 'msedge', testMatch: /fumaca/, use: { ...devices['Desktop Edge'], channel: 'msedge' } },
          { name: 'firefox', testMatch: /fumaca/, use: { ...devices['Desktop Firefox'] } },
        ]
      : []),
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // SwiftShader desenha igual em qualquer maquina e no CI, entao as imagens de
        // referencia valem em todo lugar. O Metal do Mac fica para conferencia manual.
        // Sem `--enable-unsafe-webgpu`: no Linux ela entrega um WebGPU por software cujo
        // canvas sai vazio na captura, e as referencias foram gravadas pela queda para
        // WebGL2, que e o que o Windows faz sem placa de video.
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
  ],
  webServer: {
    command: 'node servidor.mjs --sem-navegador',
    url: ORIGEM,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
