# Sistema Solar: simulação gravitacional com vistas 2D e 3D

O Sol e os oito planetas se atraem pela gravidade, todos no mesmo relógio. As posições de partida são do JPL/NASA para 1º de janeiro de 2026; daí em diante o programa calcula o resto. Mercúrio dá uma volta em 88 dias e Netuno em 165 anos, e os dois aparecem na tela no mesmo relógio.

## Como abrir

| Sistema | Como |
|---|---|
| macOS | Abra `run.command` no Finder. Se o macOS bloquear, botão direito no arquivo e **Abrir**. |
| Linux | `./run.sh` nesta pasta. |
| Windows | Abra `run.bat`, ou `./run.ps1` no PowerShell. |

Precisa de Python 3.9 ou mais novo (no macOS, `brew install python@3.13`). Na primeira abertura as bibliotecas são instaladas, o que leva alguns segundos; depois não é preciso usar o terminal.

## O que aparece ao abrir

Uma orientação curta com três coisas para experimentar, que pode ser dispensada e não volta. Atrás dela fica a visão geral do sistema. Os quatro planetas de dentro aparecem apertados perto do Sol porque Netuno está 77 vezes mais longe que Mercúrio e a tela está em escala. Há três formas de contornar isso (ver [Enxergando os planetas internos](#enxergando-os-planetas-internos)).

## Controles

Sempre visíveis na barra de cima:

| Controle | O que faz |
|---|---|
| Pausar / Continuar | Para e retoma o tempo. |
| − e + | Mudam a velocidade do tempo; o rótulo entre eles diz quantos dias simulados passam por segundo real. |
| Sistema completo / Planetas internos | Mudam só o enquadramento. O relógio e as posições seguem iguais. |
| Focar planeta | A câmera viaja junto com o planeta escolhido. |
| Ajuda | Explicações e lista de atalhos. |

No painel da direita ficam a data, a lista de planetas e **Mais opções** (rastros, nomes, anéis de distância, tamanho real, escala comprimida, texto maior e dados técnicos, além de cena e fundo, leitura e atividades). Mostrar estrelas acrescenta um fundo decorativo gerado com semente fixa, que não participa da física, da projeção nem dos cliques. As preferências vão para `preferencias.json`.

### Seleção e comparação

- Clique simples seleciona o planeta **A** e mostra a ficha curta. Clique direito no canvas ou na lista seleciona **B**. Clicar no fundo limpa A (esquerdo) ou B (direito). Na lista, Tab + Enter seleciona A e Shift+Enter seleciona B. As letras A/B aparecem na lista e no canvas.
- No pygame/SDL o botão direito é o número 3; o 2 também é aceito como seleção de B, para dispositivos que o enviam como secundário.
- Clique duplo no canvas ou na lista abre a ficha completa (visão geral, características físicas, órbita, condições, curiosidades e fontes). **Ver detalhes** e **D** abrem a mesma ficha sem clique duplo.
- **Comparar planetas** (ou **C**) abre a comparação. Dá para trocar A e B sem fechar a janela, com os seletores ou com Tab e as setas, e **Inverter A / B** troca os lados. Distância, velocidade e período osculador acompanham a simulação sem recriar a janela nem perder foco ou rolagem. O produto velocidade × período foi removido: a velocidade varia ao longo da órbita e o produto não mede um percurso.
- O espaço do campo de visão fica sobre o canvas e acompanha zoom, enquadramento e redimensionamento. Ele indica a extensão do menor lado do canvas; na escala comprimida aparece como "UA visuais · comprimido", que não é uma distância física uniforme.

### Mouse, teclado e janelas

Roda e trackpad dão zoom no canvas. Arrastar com o esquerdo move a vista 2D ou orbita a câmera 3D; o direito não arrasta nem dá zoom. Nas janelas de Ajuda, detalhes, atividades e comparação, a roda rola o conteúdo, com barra visível que pode ser arrastada ou clicada; cima/baixo, Page Up/Down e Home/End também rolam, título e botões ficam fixos, e Esc fecha e devolve o foco. Page Up/Down e Home/End percorrem a lateral.

### Vista 3D

**Vista 3D** (canto inferior esquerdo do canvas) ou **V** usa as três coordenadas da simulação, com as inclinações reais.

- Arraste com o esquerdo para orbitar; roda, trackpad ou +/− dão zoom.
- As setas deslocam a câmera e soltam o acompanhamento. Com um corpo selecionado, **Focar** mantém o acompanhamento ao girar e dar zoom.
- **T** alinha a câmera com a eclíptica e **V** volta à vista 2D. **.** pausa e avança exatamente 0,5 dia (também em Mais opções).

A projeção é ortográfica, em pygame, sem dependências novas. Discos e segmentos são ordenados por profundidade, e a oclusão dos segmentos é aproximada pelo ponto médio, não por pixel. Não há perspectiva, textura de superfície nem iluminação física; OpenGL fica para uma etapa posterior. A escolha 2D/3D é salva com as preferências. Em 3D a compressão de distâncias usa o raio espacial em torno do Sol, preservando direções e planos orbitais; em 2D usa o raio no plano XY. A grade é uma referência da eclíptica, as trilhas mostram posições históricas e as elipses osculadoras são uma aproximação instantânea.

## Enxergando os planetas internos

1. **Planetas internos** aproxima de Mercúrio, Vênus, Terra e Marte. Os outros seguem se movendo fora da tela.
2. **Focar planeta** faz a câmera viajar junto com um planeta.
3. **Comprimir distâncias**, em Mais opções, aproxima os planetas distantes para todos caberem juntos. O indicador de campo de visão identifica a escala comprimida, sem régua linear. Os cálculos continuam nas distâncias reais e os números da ficha não mudam.

## O que é calculado, simplificado e omitido

Estes três blocos também estão na Ajuda do programa.

**Calculado.** A atração gravitacional entre o Sol e os oito planetas, todos ao mesmo tempo: cada corpo puxa todos os outros, inclusive o Sol, que por isso não fica parado. O estado é guardado em três dimensões (x, y, z), com o tempo avançando de meio em meio dia.

**Simplificado na tela.** Os planetas são desenhados muito maiores que o real (a Terra, na escala certa, teria menos de um milésimo de pixel na visão geral), e uma opção mostra o tamanho verdadeiro. A vista 2D olha de cima da eclíptica; na 3D a câmera orbital mostra as inclinações já presentes no cálculo, sem ampliá-las.

**Omitido.**

- A Lua não entra como corpo separado: Terra e Lua contam como um ponto só, no centro de massa dos dois, a uns 4.700 km do centro da Terra.
- Plutão, os asteroides e as demais luas não existem aqui.
- A relatividade geral não está incluída. O efeito maior seria girar lentamente a órbita de Mercúrio, 43 segundos de arco por século.

Por isso os resultados se afastam devagar das medidas do JPL. Contra a efeméride de referência, o desvio fica abaixo de 0,5% da distância ao Sol em cem anos para frente ou para trás, com Mercúrio como pior caso (ver [Precisão medida](#precisão-medida)). É uma integração simplificada de nove corpos, não uma reprodução da efeméride do JPL por tempo indefinido.

## De onde vêm os dados

| Dado | Fonte |
|---|---|
| Posições e velocidades iniciais | JPL Horizons, centrado no baricentro do Sistema Solar, plano e equinócio da eclíptica de J2000, sistema ICRF, escala TDB. O Horizons informa a efeméride DE441 como origem. |
| Parâmetros gravitacionais (GM) | Cabeçalho da efeméride DE440/LE440 do JPL: `GMS`, `GM1`, `GM2`, `GMB`, `GM4` a `GM8`, em UA³/dia². |
| Raios físicos | Fichas de corpo do JPL Horizons (raio médio volumétrico). |
| Massa do planeta, gravidade equatorial, rotação sideral, dia solar, temperatura, luas e anéis | [NASA/NSSDCA Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/), tabela de 18/03/2025, consultada em 21/09/2026 e congelada em `src/dados/planetas.py`. |
| Atmosferas e temperaturas dos gigantes a 1 bar | Fichas individuais NASA/NSSDCA, com as URLs registradas por planeta em `src/dados/planetas.py`. |

A ficha separa esses dados externos das medidas atuais do baricentro, calculadas pelo modelo. A massa externa não substitui a GM de sistema do integrador. Dia solar e rotação sideral são grandezas distintas, e a rotação retrógrada é identificada. As temperaturas são referências e não clima calculado; nos gigantes valem para a atmosfera a 1 bar, sem superfície sólida. A contagem de luas é a da tabela de 2025, sem pretensão de censo atual, e valores ausentes não são inventados. As definições estão nas [notas da NSSDCA](https://nssdc.gsfc.nasa.gov/planetary/factsheet/fact_notes.html). DE441 é a integração de longo alcance do mesmo modelo dinâmico do DE440, então as constantes são consistentes.

O estado inicial e a procedência completa estão em `src/dados/efemeride_2026-01-01.json`, e os dados das fichas em `src/dados/planetas.py`. O programa não acessa a internet. Para regenerar o arquivo em outra época:

```bash
.venv/bin/python ferramentas/gerar_efemeride.py --epoca 2030-01-01 --validacao
```

### Convenção de centros

O Sol é o corpo 10 do Horizons. Os oito planetas são os baricentros dos sistemas planetários (ids 1 a 8), com as GM de sistema. Um sistema com luas se desloca como um ponto de massa igual à soma das massas, que é como o próprio JPL integra. Na Terra, o ponto na tela é o baricentro Terra-Lua; o centro da Terra gira em torno dele a cerca de 4.700 km (3,1×10⁻⁵ UA), menos de um milésimo de pixel na visão geral.

## Como o cálculo é feito

Integrador simplético de Yoshida de 4ª ordem, passo fixo de 0,5 dia. Simplético quer dizer que o erro de energia oscila em torno de zero em vez de crescer. O Runge-Kutta 4 erra menos num passo isolado, mas a órbita encolhe aos poucos, o que não serve para uma simulação que pode ficar séculos simulados.

Erro de posição de Mercúrio contra o Horizons depois de 10 anos:

| Método | Passo | Avaliações de força | Erro |
|---|---|---|---|
| Leapfrog | 0,25 d | 14.610 | 1,0×10⁶ km |
| Leapfrog | 0,021 d | 175.320 | 5,4×10³ km |
| Yoshida 4ª | 0,5 d | 21.915 | 1,4×10⁴ km |

O Yoshida chega à mesma ordem de grandeza do leapfrog mais fino com cerca de um oitavo das avaliações.

O passo é fixo porque o variável quebra a propriedade simplética, e o fixo faz a data exibida ser sempre `início + n × 0,5 dia`.

## Precisão medida

Desvio em relação à efeméride de referência do JPL, integrando a partir de 1º de janeiro de 2026, em km.

| Intervalo | Sol | Mercúrio | Vênus | Terra | Marte | Júpiter | Saturno | Urano | Netuno |
|---|---|---|---|---|---|---|---|---|---|
| −100 anos | 153 | 247.115 | 5.612 | 4.782 | 3.420 | 195 | 173 | 238 | 709 |
| −10 anos | 4 | 15.637 | 556 | 489 | 297 | 35 | 8 | 3 | 7 |
| +1 ano | 0,2 | 3.048 | 61 | 49 | 35 | 0,4 | 0,07 | 0,03 | 0,07 |
| +10 anos | 1 | 14.365 | 534 | 487 | 368 | 41 | 5 | 3 | 7 |
| +100 anos | 112 | 302.436 | 5.725 | 4.763 | 4.180 | 164 | 142 | 210 | 636 |

Como fração da distância ao Sol, o pior caso é Mercúrio: 0,004% em um ano, 0,03% em dez e 0,45% em cem, medido nestas cinco datas. O critério, fixado antes de olhar os resultados, era erro abaixo de 1% da distância ao Sol de −100 a +100 anos, e todos os corpos passam. Em 100 anos simulados, a energia tem desvio relativo de até 2×10⁻⁹ e o momento angular de até 1,4×10⁻¹⁴.

O erro restante vem, em ordem de importância, do truncamento do passo de 0,5 dia (que domina em Mercúrio), da Lua entrar no baricentro, dos corpos ausentes e da relatividade omitida. Para reproduzir:

```bash
.venv/bin/python -m tests.test_efemeride
```

## Velocidade do tempo

A velocidade é medida em dias simulados por segundo real, e a equivalência fica sempre na tela. O programa mede a velocidade da máquina ao abrir e não oferece velocidades que ela não sustente. Se mesmo assim um quadro não couber no orçamento, ele entrega os passos que cabem, descarta o excedente e avisa na tela. Nunca aumenta o passo nem pula passos em silêncio, e a data mostrada sempre corresponde ao estado físico desenhado.

## Explorar a matemática

O botão **Explorar a matemática**, ou **Ver a matemática desta órbita** na ficha de um planeta, abre uma segunda tela que mostra como uma soma de ondas (uma série de Fourier) redesenha a elipse de um planeta e quantas ondas são necessárias. A elipse não vem de tabela: é calculada da simulação no instante em que a tela abre, e o cabeçalho diz qual é. Enquanto o laboratório está aberto a simulação fica pausada e retoma de onde parou.

Com o **Sol** selecionado, **Focar Sol** mantém a câmera sobre ele sem calcular órbita heliocêntrica, e **Matemática do Sol** abre uma janela rolável com a posição e a velocidade dele em relação ao centro de massa dos nove corpos, a aceleração resultante e a contribuição de cada sistema planetário. O Sol não tem elipse heliocêntrica nem período orbital único para a tela de Fourier.

## Estrutura do código

```
main.py                      abre o programa
ferramentas/
  gerar_efemeride.py         (dev) baixa os dados do JPL e grava o JSON
src/
  fisica/                    sem pygame, sem pixels, sempre em 3D
    estado, forcas, integrador, relogio, simulador, calibragem,
    efemerides, trilha, corpo, kepler, fourier
  dados/                     a efeméride congelada e todo o texto da interface
  projecao/                  a ponte mundo -> tela: câmera, escala, rótulos
  ui/                        janela, tema, tipografia, layout, widgets, telas
  app/                       laço principal, ações, atalhos, estado da interface
tests/                       validação; nenhum teste abre janela ou usa internet
```

`src/fisica/` guarda posição e velocidade em três dimensões e nunca reduz a duas. Câmeras e cenas separadas implementam as vistas 2D e 3D ortográfica, e `tests/test_arquitetura.py` lê o código-fonte e falha se a separação for quebrada.

## Testes

```bash
./testes.sh
```

| Teste | O que verifica |
|---|---|
| `test_arquitetura` | A física não importa pygame nem a camada de desenho. |
| `test_fisica_nbody` | Conservação de energia e momento angular, relógio compartilhado, reversibilidade, estabilidade em 200 anos, honestidade do simulador. |
| `test_efemeride` | Posições contra o JPL em −100, −10, +1, +10 e +100 anos. |
| `test_projecao` | Câmera, projeção 2D e isolamento da escala comprimida. |
| `test_vista3d` | Base espacial, profundidade, seleção, zoom, acompanhamento, compressão, alternância de vistas e isolamento da física. |
| `test_layout` | 480 combinações de tamanho de janela sem área negativa nem sobreposição. |
| `test_rotulos` | 200 cenários sem nomes se sobrepondo nem invadindo painéis. |
| `test_tema` | Contraste WCAG de todos os pares de cor usados. |
| `test_atalhos` | A lista de atalhos da Ajuda bate com o mapa de teclas real. |
| `test_fisica_lab` | Equação de Kepler, 2ª lei, convergência de Fourier e a solução analítica de Fourier-Bessel. |
| `test_interacoes` | Rolagem e barra arrastável, foco, clique duplo, seleção A/B por mouse e teclado, troca e inversão, estrelas persistidas e isoladas da física, campo de visão, fontes das fichas. |
| `test_interface` | Percorre a interface: primeira abertura, cada planeta, pausar, acelerar, zoom, redimensionar, cada caixa e cada controle. |

Os testes de interface usam preferências temporárias e não apagam o `preferencias.json` do usuário.

## Versão anterior

`../v1-fourier` é a versão anterior, mantida como referência: compara a elipse de Kepler com a reconstrução por série de Fourier em gráficos do matplotlib.

## Problemas comuns

- `comando não encontrado: python3`: no macOS, `brew install python@3.13`; no Linux, instale Python 3 e o módulo `venv` pela distribuição.
- `ModuleNotFoundError: No module named 'pygame'`: execute `./run.sh` (ou `run.bat`), que instala as dependências.
- A janela abre pequena demais: redimensione arrastando as bordas, a partir de 960×600, ou use "Texto maior" em Mais opções.
- O programa fecha ao abrir: execute `./run.sh` pelo Terminal para ver a mensagem de erro.
