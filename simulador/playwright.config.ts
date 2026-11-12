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
  reporter: [['list']],
  use: {
    baseURL: ORIGEM,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // SwiftShader desenha igual em qualquer maquina e no CI, entao as imagens de
        // referencia valem em todo lugar. O Metal do Mac fica para conferencia manual.
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-unsafe-webgpu'] },
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
