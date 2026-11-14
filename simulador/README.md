# Sistema Solar 3D

Simulador do Sistema Solar em 3D. Integra os nove corpos da efeméride do JPL por N-corpos simplético (Yoshida de 4ª ordem, passo de meio dia), desenha as treze luas, e traz o conteúdo educativo em português: fichas, atividades, laboratório de Fourier e um modo de criação de corpos.

Sucede o `versoes-anteriores/v2-pygame/` (Python + pygame, desenho 2D), que continua na pasta `versoes-anteriores/`. A física, os dados e os textos vieram de lá; o desenho é novo. As 43 funcionalidades da versão 2D estão no `CONTRATO.md`: 31 entregues como especificadas e 12 por outro meio, cada uma com a nota do motivo.

Com ele dá para:

- olhar o sistema de qualquer ângulo, de 31,5 UA até a órbita baixa de um planeta;
- acompanhar um corpo, comparar dois e ler a ficha de cada um, com a procedência dos números;
- ver a órbita reescrita como cadeia de epiciclos no laboratório de Fourier;
- criar corpos, ver a órbita que eles teriam antes de soltá-los e desfazer.

Duplo clique num corpo leva a câmera a três raios dele, e o resto do sistema desbota conforme a câmera se aproxima.

## Como abrir

| Sistema | Como |
|---|---|
| macOS | Duplo clique em `run.command`. Se o macOS bloquear na primeira vez, botão direito e **Abrir**. |
| Linux | `./run.sh` |
| Windows | Duplo clique em `run.bat`, ou `./run.ps1` no PowerShell |

Na primeira execução o lançador instala as bibliotecas e constrói o programa, o que leva um ou dois minutos. A pasta de entrega já traz `dist/` pronto, e nela só um servidor local sobe. Para encerrar, feche a aba do navegador.

## Sem internet

O programa não acessa a rede durante o uso. `testes/e2e/offline.spec.ts` aborta toda requisição que não seja para o servidor local e exige que o programa abra do mesmo jeito. Texturas, fontes e dados vão empacotados.

Só `ferramentas/` usa a rede, e nada ali roda durante o uso:

| Ferramenta | O que gera |
|---|---|
| `gerar_efemeride.py` | posições e velocidades de partida, do JPL Horizons. Veio do `versoes-anteriores/v2-pygame` sem alteração, e o JSON está copiado byte a byte, o que mantém válida a validação de ±100 anos |
| `gerar_luas.mjs` | elementos médios das treze luas e o período sideral medido |
| `conferir_luas.mjs` | erro de cada lua contra o Horizons, numa janela retida |
| `gerar_estrelas.mjs` | catálogo Yale, em 12 bytes por estrela |
| `baixar_texturas.mjs` | mapas de superfície, com a procedência de cada um |

## Desenvolvimento

```bash
npm install
npm run dev     # Vite em http://localhost:5173
npm test        # tipos, lint, arquitetura, unidade e ponta a ponta
npm run build   # gera dist/
```

`npm test` roda nesta ordem:

| Etapa | O que verifica |
|---|---|
| tipos | TypeScript estrito, com `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes` |
| lint | globais proibidas no núcleo (`Math.random`, `Date.now`, `performance`, `fetch`) e leitura de layout no caminho por quadro |
| arquitetura | as sete regras de camada de `.dependency-cruiser.cjs` |
| unidade | o núcleo em ambiente `node` (se a física tocar `document`, quebra aqui), mais `honestidade.test.ts`, que liga o que o programa afirma ao que ele faz, e `contrato.test.ts`, que exige que toda prova citada no `CONTRATO.md` exista |
| e2e | offline, acessibilidade, teclado, conteúdo dos modais, alcançabilidade das dicas, contraste dos rótulos medido em pixel, precisão de profundidade nos dois backends, laboratório, maquete e sandbox |

O desenho usa WebGPU por padrão; `?render=webgl2` força WebGL2.

As specs e o CI rodam no Chromium com SwiftShader (`--use-angle=swiftshader`), que desenha igual em qualquer máquina. Sem placa de vídeo, o Chromium não entrega adaptador WebGPU e o programa cai para WebGL2: as imagens de referência fiscalizam esse caminho. Os testes marcados `@gpu` medem o que acontece por quadro e só fazem sentido com placa de vídeo; os marcados `@lento` rodam à mão.

### Navegadores

`NAVEGADORES=todos npx playwright test fumaca` roda a spec de fumaça (abrir, chegar perto, laboratório, sandbox) em outros navegadores.

| Navegador | Desenho | Resultado (14/11/2026, Windows 11) |
|---|---|---|
| Chromium (Playwright, SwiftShader) | WebGL2, por queda | fumaça e suíte passam |
| Microsoft Edge (placa de vídeo) | WebGPU | fumaça passa |
| Firefox | — | não testado: o Playwright precisa baixar o navegador dele |

## Erro publicado

| O quê | Valor | Onde se mede |
|---|---|---|
| Posições contra a efeméride do JPL | abaixo de 0,5% da distância ao Sol em ±100 anos (Mercúrio é o pior caso) | `nucleo/efemeride.test.ts` |
| Interpolação entre passos de meio dia | 0,09 km em Mercúrio | `nucleo/hermite.test.ts` |
| Posição das luas | de 456 km (Deimos) a 52.636 km (Tritão), em 2020–2040, janela que o gerador não viu | `nucleo/luas.test.ts` |
| Posição da Lua (série de Meeus) | 20 km no máximo, na mesma janela | `ferramentas/conferir_luas.mjs` |
| Precisão alta (passo de 0,125 dia, com relatividade) | Mercúrio a 64 km do JPL em +10 anos, contra 14.365 km no padrão | `nucleo/precisao.test.ts` |
| Energia total | oscila, não cresce | "Mostrar dados técnicos" na tela |

O erro de posição é medido em cinco datas (±1, ±10 e ±100 anos), não em varredura contínua.

## Escolhas

**As luas ficam fora do integrador.** Io dá uma volta em 1,77 dia, o que com passo de meio dia são três passos e meio por órbita, e nesse regime o integrador não integra. As luas são propagadas por Kepler, e o custo é o erro da tabela acima. A camada validada contra o JPL fica idêntica.

**O sandbox não arrasta.** Apontar, clicar e usar um controle deslizante marcado de "redonda" a "escapa" é o único caminho, e o teclado o opera. A lição sobre velocidade orbital é a mesma.

**`three` fica num pacote só.** Separá-lo em `manualChunks` evitaria invalidar 1 MB de cache a cada edição de código, mas o programa é entregue como pasta, sem visita seguinte que aproveite o cache, e a separação custaria uma requisição a mais na única vez que importa.

**TypeScript 5.9, não 7.** A cadeia de lint com tipos ainda não acompanha o 7 com segurança, e nada aqui precisa do que ele traz.

**Sem `Sistema Solar.app`.** Um bundle de duplo clique sem janela de terminal foi construído e descartado: o macOS nega a um app sem assinatura o acesso a arquivos em `~/Desktop`. O `run.command` abre por duplo clique do mesmo jeito e não pede nada. O detalhe está em `ARQUITETURA.md`.

## Peso da entrega

O nível 8K levou `publico/texturas/` de 36 MB para 150 MB, e `dist/` para 164 MB. A estimativa na hora da decisão era 60 MB a mais; o real foi 114 MB. Cinco mapas (Lua, Mercúrio, Vênus, nuvens da Terra e Marte) respondem por metade disso. Para uma pasta menor, basta tirar o nível 8K em `ferramentas/baixar_texturas.mjs`. Baixar a qualidade do JPEG de 82 para 60 economiza só um quarto, na camada em que o detalhe é o que importa.

As texturas são regeneradas em qualquer sistema com `node ferramentas/baixar_texturas.mjs` (com `--8k` para o nível 8K); a redução usa o `sharp`, e não mais o `sips` do macOS. As 2K continuam no git: sem elas, quem clona o repositório precisaria baixar todas as fontes, que somam centenas de megabytes, antes de abrir o programa.

## O que falta

- Abrir o `dist/` no Arc e no Safari por duplo clique, a partir da pasta de entrega. A suíte roda o bundle num Chromium sem janela, com os dois backends de desenho, mas ninguém abriu o programa nos dois navegadores.
- Texturas em KTX2: `toktx` é um binário nativo que não instala por npm.
- Passada SDR pré-bloom nas cenas de referência. Hoje elas pegam regressão estrutural, mas não regressão fina de cor.

## Limites do modelo

A Ajuda do programa tem três blocos: o que ele calcula, o que a tela simplifica e o que o modelo não inclui. Cada simplificação listada é ligada a um fato do código por `testes/honestidade.test.ts`. A ligação nasceu de um defeito: o "Modo maquete" tinha o alternador, o aviso e a etiqueta "DISTÂNCIAS COMPRIMIDAS" e não comprimia nada.

Os documentos do projeto são `CONTRATO.md` (as 43 funcionalidades e o teste de cada uma) e `ARQUITETURA.md` (camadas e erros já pagos).
