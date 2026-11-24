# Contrato de funcionalidades

Lista das 43 funcionalidades do `versoes-anteriores/v2-pygame` (pygame, 2D) que a versão 3D precisa ter. Foi escrita antes do primeiro código de produto, para que a versão 3D não terminasse com a física certa e parte do conteúdo educativo faltando.

Regras:

- Nenhuma fase começa com uma linha vermelha na fase anterior.
- Coluna `Prova`: o teste automatizado que verifica o item, ou `manual:` seguido de um roteiro de uma frase.
- Coluna `Estado`: `pendente`, `feito`, `mudado` (entrega o mesmo valor por outro meio, e a nota diz como), `parcial` ou `defeito`.

Fases: F0 fundação, F1 física, F2 interface acessível, F3 precisão do desenho, F4 cena, F5 conteúdo, F6 luas, F7 sandbox, F8 entrega.

---

## Tempo

| # | Funcionalidade | Fase | Prova | Estado |
|---|---|---|---|---|
| 1 | Pausar e continuar, por botão escrito e por `Espaço` | F2 | `atalhos.test.ts` · `e2e/acessibilidade.spec.ts` | feito |
| 2 | Escada de velocidade 1 / 5 / 30 / 100 / 365 / 1825 / 3650 / 7300 dias por segundo, por `−` `+` e por `[` `]` | F2 | `atalhos.test.ts` · `nucleo/relogio.test.ts` | feito |
| 3 | Calibragem da máquina na abertura, limitando a escada ao que o computador entrega | F1 | `nucleo/simulador.test.ts` | feito |
| 4 | Detecção de atraso: descarta passos, nunca acumula dívida, e avisa por escrito | F1 | `nucleo/simulador.test.ts` | feito |
| 5 | Passo único de 0,5 dia por `.`, que pausa e avança exatamente um passo do integrador | F1 | `nucleo/tempoExato.test.ts` | feito |
| 6 | Voltar ao início (`R`): restaura a época, limpa rastros, reenquadra | F2 | `atalhos.test.ts` · `nucleo/trilha.test.ts` | feito |
| 7 | Data civil por extenso na lateral ("21 de setembro de 2026") | F5 | `nucleo/relogio.test.ts` · `e2e/conteudo.spec.ts` | feito |
| 8 | Linha de equivalência "1 segundo = 30 dias", em âmbar quando pausado | F2 | `manual:` pausar e conferir a cor e o texto | feito |

## Câmera e vista

| # | Funcionalidade | Fase | Prova | Estado |
|---|---|---|---|---|
| 9 | Zoom por roda e por `+` `−`, ancorado no cursor | F3 | `cena/selecao.test.ts` · `e2e/selecao.spec.ts` | feito — homotetia com centro no cursor: `pivo' = ancora + (pivo − ancora)/f`, então o ponto sob o cursor não se move |
| 10 | Arrastar para orbitar; deslocar por `Shift`+arrastar e por `Shift`+setas | F3 | `atalhos.test.ts` · `e2e/acessibilidade.spec.ts` | mudado · feito — as setas orbitam e `Shift`+setas desloca, como arrastar com o botão esquerdo e o direito. `atalhos.test.ts` impede que o mapa de teclas e a tabela da Ajuda divirjam |
| 11 | Três enquadramentos: Sistema completo (31,5 UA), Planetas internos (1,75 UA), Acompanhar, com transição interpolando `log(escala)` | F3 | `cena/camera.test.ts` · `e2e/maquete.spec.ts` | feito — mais um quarto, "perto", em órbita baixa |
| 12 | Seguir e soltar um corpo, com anel tracejado no corpo acompanhado | F3 | `rotulos.test.ts` · `e2e/rotulos.spec.ts` | feito — o anel é tracejado e não de outra cor porque, sobre uma cena que vai do preto ao branco, um contorno que só muda de cor some em metade dos fundos |
| 13 | Alternar perspectiva e ortográfica cenital por `V`, preservando centro, zoom e alvo | F3 | `atalhos.test.ts` · `e2e/ortografica.spec.ts` | feito — é uma `OrthographicCamera`; o que se preserva na troca é a altura visível no plano do alvo |
| 14 | Vista de cima por `T` | F3 | `atalhos.test.ts` · `cena/camera.test.ts` | feito |
| 15 | Leitura do campo de visão em UA | F3 | `e2e/maquete.spec.ts` | mudado · feito — em perspectiva vira "largura visível no plano do alvo" e "câmera a Y UA do alvo"; com a compressão ligada as duas somem e dão lugar ao aviso |
| 16 | Régua de escala com passos adaptativos de 0,01 a 50 UA | F3 | `e2e/maquete.spec.ts` | mudado — não há régua gráfica. As duas leituras numéricas do item 15 fazem o papel dela, e sobre escala comprimida são trocadas pelo aviso |

## Cena (tudo alternável e persistido)

| # | Funcionalidade | Fase | Prova | Estado |
|---|---|---|---|---|
| 17 | Caminhos previstos (elipses osculadoras recalculadas do estado vivo) | F4 | `nucleo/efemeride.test.ts` · `e2e/precisao.spec.ts` | feito |
| 18 | Rastros percorridos, amostrados por tempo simulado (0,25% do período de cada corpo) | F4 | `nucleo/trilha.test.ts` | feito — como a amostragem é por tempo simulado, o rastro não muda de aparência com a taxa de quadros |
| 19 | Nomes dos corpos com anti-colisão e histerese | F4 | `rotulos.test.ts` · `e2e/rotulos.spec.ts` (contraste medido em pixel) | feito — anti-colisão, histerese, banda morta de movimento e escada de abreviação. O contraste do nome sobre a placa é medido no pixel composto, com o brilho do Sol atrás |
| 20 | Anéis de distância em 1, 5, 10, 20 e 30 UA, rotulados | F4 | `e2e/maquete.spec.ts` | feito — encolhem junto com as órbitas no modo maquete |
| 21 | Campo de estrelas | F4 | `manual:` ligar e desligar "Estrelas" e conferir Sirius, Órion e a faixa da Via Láctea | mudado · feito — Yale Bright Star Catalogue: 8.404 estrelas com magnitude e temperatura reais, na orientação celeste correta |
| 22 | Planetas no tamanho real, sem piso e sem impostor, para que sumam de verdade | F4 | `cena/camera.test.ts` · `e2e/precisao.spec.ts` | feito |
| 23 | Comprimir distâncias (raiz quadrada, ângulo preservado), com a régua linear substituída por aviso | F4 | `cena/escalaVisual.test.ts` · `e2e/maquete.spec.ts` | mudado · feito — vira "Modo maquete". Durante uma fase o alternador, o aviso e a etiqueta existiam e nada era comprimido. Hoje comprime, e o teste mede também que a luz não muda |
| 24 | HUD técnico: integrador, passo, orçamento, `t` em dias, energia total, `\|L\|`, FPS, ms do quadro | F2 | `e2e/conteudo.spec.ts` | feito — mostra passo, passos por segundo, ms por quadro, desvio de energia, desvio do momento angular, corpos e backend. Num integrador simplético o desvio de energia oscila e não cresce |

## Seleção e informação

| # | Funcionalidade | Fase | Prova | Estado |
|---|---|---|---|---|
| 25 | Selecionar A por clique na cena, pela lista lateral ou por teclado | F2 | `e2e/selecao.spec.ts` · `cena/selecao.test.ts` · `e2e/acessibilidade.spec.ts` | feito — o picking é em espaço de tela, não por raio: os corpos são desenhados ampliados, e um raio acertaria o tamanho real em vez do disco que se vê |
| 26 | Selecionar B por `Shift`+`Enter` na lista, ou pelos seletores do modal | F2 | `e2e/acessibilidade.spec.ts` · `e2e/conteudo.spec.ts` | feito |
| 27 | Distintivos A e B na cena, nos rótulos e na lista, escritos e nunca só por cor | F4 | `rotulos.test.ts` · `contraste.test.ts` · `e2e/rotulos.spec.ts` | feito — "A" e "B" nos rótulos, anel tracejado no acompanhado, e os três repetidos por extenso no rótulo acessível da lista |
| 28 | Ficha curta embutida: distância ao Sol, velocidade, período. O Sol tem ficha própria | F5 | `e2e/conteudo.spec.ts` · `nucleo/presetCanonico.test.ts` | feito — a ficha do Sol não tem período |
| 29 | Ficha completa com os sete blocos, incluindo o de fontes | F5 | `e2e/conteudo.spec.ts` · `e2e/acessibilidade.spec.ts` | mudado · feito — virou uma seção da lateral, aberta por `F` ou pelo botão "Ficha inteira", e não mais um modal. O modal cobria a cena, e fechá-lo para olhar o planeta apagava o que se acabara de ler |
| 30 | Modal "Matemática do Sol": posição e velocidade relativas ao centro de massa, aceleração resultante e a puxada de cada sistema planetário, em m/s² | F5 | `e2e/conteudo.spec.ts` | feito — a coluna de comparação é com a puxada de Júpiter e não "fração do total": as parcelas são vetores e se cancelam em parte, e os módulos somavam 147% |
| 31 | Modal de comparação A/B ao vivo, com o aviso de que velocidade × período não é distância percorrida | F5 | `e2e/conteudo.spec.ts` | feito |

## Aprendizado

| # | Funcionalidade | Fase | Prova | Estado |
|---|---|---|---|---|
| 32 | Tutorial de primeira execução, dispensável para sempre | F5 | `e2e/conteudo.spec.ts` | mudado · feito — ganhou um quarto passo, sobre a câmera 3D, e fechar com `Esc` também marca como visto |
| 33 | Ajuda com os três blocos (o que calcula, o que a tela simplifica, o que o modelo não inclui) e a tabela de atalhos | F5 | `e2e/conteudo.spec.ts` · `textos.test.ts` · `honestidade.test.ts` | mudado · feito — `honestidade.test.ts` liga cada simplificação listada a um fato do código, nos dois sentidos: listar o que não se faz reprova, e fazer o que não está listado também |
| 34 | Quatro atividades guiadas, cada uma com a resposta escrita junto | F5 | `e2e/conteudo.spec.ts` | feito |
| 35 | Seis dicas escritas, alcançáveis a partir da tela principal | F5 | `e2e/dicasAlcancaveis.spec.ts` (alcançabilidade transitiva, medida no DOM) | feito — o teste reprova o desenho antigo: apagar a lista de dicas da tela de Atividades deixa a suíte vermelha |
| 36 | Laboratório de Fourier: elipse osculadora do corpo selecionado tirada do estado vivo, reconstruída por harmônicos, com desvio médio, máximo e atual e a convergência | F5 | `nucleo/fourier.test.ts` · `nucleo/kepler.test.ts` · `e2e/laboratorio.spec.ts` | mudado · feito — lâmina de 40% com a cena pausada ao lado, cadeia de epiciclos rotulada "construção histórica, não é a física do modelo", e coeficientes conferidos contra uma quadratura independente |

## Sistema

| # | Funcionalidade | Fase | Prova | Estado |
|---|---|---|---|---|
| 37 | Captura de tela em PNG, sem virar salto na data simulada | F4 | `manual:` capturar com o tempo correndo e conferir a data antes e depois | feito — a composição inclui rótulos e rodapé, e a leitura acontece dentro do quadro |
| 38 | Persistência de preferências, descartando o que é transitório (seleção, acompanhado, modal aberto) | F0 | `e2e/offline.spec.ts` · `e2e/conteudo.spec.ts` | mudado · feito — grava em arquivo por `PUT /preferencias.json`, e não em `localStorage`, que é particionado por origem; na cópia do GitHub Pages, sem servidor, vão para o `localStorage` |
| 39 | "Texto maior" (1,25×), reescalando fontes, alvos e espaçamento | F2 | `e2e/layout.spec.ts` · `e2e/rotulos.spec.ts` | feito |
| 40 | Janela redimensionável a partir de 960×600, com a lateral virando sobreposição abaixo do breakpoint | F2 | `e2e/layout.spec.ts` (70 tamanhos × 2 escalas, medidos no DOM) · `e2e/acessibilidade.spec.ts` (reflow a 320 px) | mudado · feito — a prova original era `layout.test.ts`, 560 combinações contra `src/interface/layout.ts`, um módulo que nada no programa importava (todo `var(--x, fallback)` do CSS resolvia para o fallback). O módulo foi apagado e o teste passou a medir a tela |
| 41 | Avisos temporários de 2,6 s confirmando cada ação | F2 | `e2e/acessibilidade.spec.ts` | mudado · feito — duas regiões `polite` separadas, porque uma só embaralha as mensagens quando se segura `]` |
| 42 | Navegação completa por teclado, com foco visível só no uso por teclado e foco preso em modais | F2 | `e2e/acessibilidade.spec.ts` | feito |
| 43 | Rótulo acessível em todo controle ("Mostrar estrelas. Ligado.") | F2 | `e2e/acessibilidade.spec.ts` | feito |

---

## Itens novos (não contam como paridade)

| Funcionalidade | Fase | Prova | Estado |
|---|---|---|---|
| 13 luas cinemáticas, com a deriva medida e publicada | F6 | `nucleo/luas.test.ts` · `e2e/conteudo.spec.ts` | feito — de 456 km (Deimos) a 52.636 km (Tritão) contra a efeméride, numa janela de vinte anos que o gerador não viu |
| Rotação e obliquidade reais nas malhas | F4 | `cena/orientacao.test.ts` | feito |
| Anéis com as duas sombras | F4 | `e2e/precisao.spec.ts` | feito |
| Sandbox: criar corpos com a órbita prevista e desfazer | F7 | `nucleo/sandbox.test.ts` · `e2e/sandbox.spec.ts` | feito |
| Criar sem arrastar (WCAG 2.2, 2.5.7) | F7 | `e2e/sandbox.spec.ts` | mudado · feito — o único caminho é apontar, clicar e usar um controle deslizante, que o teclado opera |
| Distintivo permanente "sistema modificado", com o botão de voltar | F7 | `e2e/sandbox.spec.ts` | feito |
| Guarda de periastro e guarda de vizinhança, com a saída escrita | F7 | `nucleo/guardaPeriastro.test.ts` · `nucleo/sandbox.test.ts` | feito |
| Quarto enquadramento "Perto do corpo", até órbita baixa | F3 | `cena/camera.test.ts` · `e2e/precisao.spec.ts` | feito |
| "Ver como tabela": a cena descrita em palavras, para leitor de tela | F2 | `e2e/conteudo.spec.ts` | feito — as luas também entram; antes eram desenhadas e não existiam para quem usa leitor de tela |
| Modo maquete que de fato comprime e não mexe na luz | F4 | `cena/escalaVisual.test.ts` · `e2e/maquete.spec.ts` | feito |
| Texto das simplificações ligado ao código, nos dois sentidos | F5 | `honestidade.test.ts` | feito |
| Contraste dos rótulos medido no pixel composto | F4 | `e2e/rotulos.spec.ts` | feito — o teste analítico passou a ser derivado desse |
| Lista de corpos em dois níveis, com as luas sob o planeta | F6 | `e2e/acessibilidade.spec.ts` · `e2e/conteudo.spec.ts` | feito — `listbox > group > option` e não `tree`, porque `tree` usaria a seta direita para abrir nós, e ela é a que anda na lista |
| Luas com três estados escritos: com, sem, só elas | F6 | `e2e/conteudo.spec.ts` | feito — em "só elas" os planetas continuam desenhados, porque uma lua sem o planeta não diz em torno de quê gira |
| Modo imersivo: tela cheia, controles recuados e câmera com W A S D | F4 | `voo.test.ts` · `e2e/imersivo.spec.ts` | feito — voar é transladar o pivô, não uma segunda câmera, então a origem flutuante, as fatias de profundidade e o picking continuam valendo |
| As simplificações visuais continuam avisadas no modo imersivo | F4 | `e2e/imersivo.spec.ts` | feito |
| `Shift`+seta desloca a câmera na mesma unidade do arrasto | F3 | `atalhos.test.ts` · `e2e/imersivo.spec.ts` | defeito corrigido — a tecla mandava 48 como "pixels por toque" e `deslocar` o lia como UA: 48 UA por toque num sistema de 31,5 UA de raio |
| Orçamento de controles com teste próprio | F8 | `e2e/orcamento.spec.ts` | feito — o arquivo era citado por `BarraSuperior.tsx` e não existia. Os tetos foram medidos e postos um acima do observado |
| Doze cenas de referência, cada backend contra a própria imagem | F8 | `e2e/douradas.spec.ts` | parcial — as 24 imagens pegam regressão estrutural (ordem de desenho, orientação, corpo faltando) mas não regressão fina de cor: o gancho pré-bloom do plano não existe, e depois do bloom o ruído de driver chega a 0,2% dos pixels |
| "Sem procedência, não grava" | F8 | `procedencia.test.ts` | feito — o teste achou `derivaDasLuas.json` sem fonte declarada; foi corrigido no gerador |
| Conferência cruzada do polo da IAU em todos os corpos | F4 | `cena/orientacao.test.ts` | feito — achou dois erros de dados: a IAU 2015 publica o polo de Marte como constante mais um termo de 1,591274°, e só a constante tinha sido copiada (eixo 1,55° torto). Netuno tinha o mesmo problema, com 0,5°. Hoje os oito batem dentro de 0,04° |
| Rótulos ancorados por quadro, com o desvio suavizado | F4 | `ancoragem.test.ts` · `e2e/rotulos.spec.ts` | feito — a placa ocupava 8 posições distintas em 40 quadros de giro (publicação a 8 Hz) e passou a ocupar 40. Suaviza-se o desvio, não a posição, para a placa não perseguir o corpo com atraso |
| Casca de atmosfera no limbo e coroa do Sol | F4 | `honestidade.test.ts` · `e2e/douradas.spec.ts` | feito — as duas estão listadas como simplificações visuais. A coroa existe porque o brilho que nasce do disco não sobrevive ao zoom: de Netuno o Sol tem menos de um pixel |
| Passo curto avisado na tela enquanto está ligado | F7 | `e2e/sandbox.spec.ts` | feito — o teto da escada de velocidade passou a ser recalculado a partir do passo atual |
| Duplo clique leva a câmera até o corpo e o resto do sistema desbota | F9 | `cena/foco.test.ts` · `e2e/foco.spec.ts` | feito — o duplo clique enquadrava a órbita (afélio × 1,25) e agora enquadra 3R. O que desbota é auxílio de desenho (órbitas, anéis, nomes), e a atenuação multiplica: quem desligou "Caminhos previstos" não os vê voltar |
| Lado noturno deixou de ser preto | F14 | `e2e/ladoNoturno.spec.ts` | defeito corrigido — a cor era `dia × luz × irradiância` e `luz` é zero na noite. Marte a três raios com o Sol atrás saía como um disco preto. O lado noturno recebe 14% da luz do meio-dia; o teste prende o valor pelos dois lados (piso 0 e piso 1 reprovam) |
| Esfera dos corpos girada 90° | F14 | `cena/esfera.test.ts` · `e2e/orientacaoDaTextura.spec.ts` | defeito corrigido — `SphereGeometry` do three.js põe os polos em ±Y e o resto do programa trata +Z como polo, então o polo da textura ficava no equador do corpo. Nenhum teste pegava: `orientacao.test.ts` mede a matriz, que estava certa, e as 24 imagens de referência foram gravadas já com o defeito |
| Esconder o painel apagava a simulação | F14 | `e2e/layout.spec.ts` | defeito corrigido — `RenderTarget.setSize` descarta o recurso de GPU do alvo HDR e o canvas ficava preto (brilho médio 5,9 antes, 0,76 depois). O alvo passou a ser recriado. `precisao.spec.ts` não pegava porque mede `__projecoes`, que vem da CPU |
| Teste de ponta a ponta com resposta conhecida | F14 | `e2e/orientacaoDaTextura.spec.ts` | feito — a Lua é travada por maré, então da Terra se vê sempre a face dos mares escuros. A área escura só sai certa (12% contra 6,1% com a esfera errada) se matriz, geometria, meridiano e mapa estiverem certos juntos |
| Sombra do anel de Saturno lia um mapa de 1×1 | F14 | `e2e/ladoNoturno.spec.ts` | defeito corrigido — o nó da sombra era criado com a textura marcadora de 1 pixel do momento da montagem e `trocarMapa('anel', …)` nunca o alcançava |
| Barra de cima rolava de lado e escondia o botão de acelerar | F14 | `e2e/layout.spec.ts` | defeito corrigido — a 320 px o grupo de tempo pedia 44 + 44 + 103 + 155 px. A página não rolava (`overflow-y: auto` em `.barra` faz o navegador computar `overflow-x: auto`), então o teste de refluxo passava com a barra rolando por dentro. Os grupos passaram a quebrar em linha, e o teste mede o `scrollWidth` da barra |
| Três avisos do visor no mesmo ponto | F14 | `e2e/orcamento.spec.ts` | defeito corrigido — distintivo de sistema modificado, tarja de atraso e pílula de passo curto usavam o mesmo `top` e `left`, e o texto de baixo vazava pelo de cima. Agora são uma faixa em coluna |
| Entrar em "Criar" com o painel escondido não mostrava nada | F14 | `e2e/sandbox.spec.ts` | defeito corrigido — `PainelDeCriacao` só existe dentro da lateral. Entrar em Criar agora abre o painel |
| O painel entrava como obstáculo de rótulo com 8 px, e ele tem 340 | F14 | `e2e/rotulos.spec.ts` | defeito corrigido — abaixo de 1000 px o painel é uma sobreposição opaca e os nomes eram desenhados atrás dele. O retângulo passou a ser medido do próprio painel (`--largura-lateral` são 20rem, e a raiz tem 17 px de fonte, 21 com "Texto maior") |
| Sombra do anel sobre o planeta deixou de ser um vazio | F14 | `e2e/ladoNoturno.spec.ts` | feito — o piso de luz entra depois da sombra do anel, e não antes |
| Teto de rotação desenhada, medido em pixels por quadro | F14 | `cena/giroVisivel.test.ts` · `e2e/giro.spec.ts` | defeito corrigido — a 20 anos por segundo Marte dá milhares de voltas por segundo contra sessenta quadros, e a textura virava um serrilhado que piscava. Marte a 319 px de raio: 179 px por quadro sem o teto, 1,67 com ele. Abaixo de 8 px de raio o fator é 1 |
| O teste do teto de giro medindo a si mesmo | F14 | `e2e/giro.spec.ts` | defeito corrigido — comparava com `PIXELS_POR_QUADRO`, importado do módulo medido, então subir a constante subia o limite. O limite passou a ser um número escrito no teste |
| Voo funciona também para as treze luas | F9 | `e2e/foco.spec.ts` | defeito corrigido — `indiceDe` devolvia −1 para lua e a transição escolhia o destino por `i >= 0`: voar até Io levava a câmera ao Sol por 0,45 s e depois saltava |
| Roda do mouse continua viva durante o voo | F9 | `e2e/foco.spec.ts` | defeito corrigido — `ajustar-zoom` era o único efeito de câmera que não cancelava a transição |
| Interface organizada por pergunta | F11 | `e2e/orcamento.spec.ts` · `e2e/acessibilidade.spec.ts` · `e2e/layout.spec.ts` | feito — a barra tem três grupos e responde a duas perguntas: quando (pausa, velocidade, data) e o que estou fazendo (Explorar, Criar, Voar). O painel passou de sete blocos para quatro, com título escrito, e "Mais opções" virou três gavetas: Mais opções (a cena), Leitura e Ir para |
| Nada clicável sobre a cena | F11 | `e2e/orcamento.spec.ts` | feito — eram três botões soltos num canto do canvas. O teto virou zero; a única exceção é o distintivo de sistema modificado, que carrega a saída junto |
| Controles de marcação recuam em vez de disputar com a cena | F11 | `botoes.test.ts` · `contraste.test.ts` · `e2e/acessibilidade.spec.ts` | feito — a caixa em repouso usava `--separador` (#788cb4), quase a cor do texto. Agora é um contorno em `--grade` e só se preenche quando marcada. `.alternador` ganhou os 44 px que `.botao` já obedecia, na linha inteira |
| Setas navegam dentro de um grupo exclusivo | F11 | `botoes.test.ts` | defeito corrigido — o cabeçalho de `controles.tsx` prometia isso e não havia seta nem `tabIndex`. Agora há roving tabindex, com Home e End, e `stopPropagation`, senão a mesma seta escolheria a opção e giraria a câmera |
| A ajuda de uma opção fora do nome dela | F11 | `botoes.test.ts` · `e2e/acessibilidade.spec.ts` | defeito corrigido — era um `<small>` dentro do `<label>`, e o leitor de tela lia a frase inteira antes de dizer "caixa de seleção, marcada". Agora é uma irmã ligada por `aria-describedby` |
| `base.css` e `tema.ts` com a mesma cor | F11 | `contraste.test.ts` | defeito corrigido — eram duas cópias que ninguém comparava, e divergiam em `--painel` e `--texto-fraco` |
| Cenas de referência remedidas: de 0,83% para 0,01% | F11 | `e2e/douradas.spec.ts` | feito — os tetos antigos mediam datas de simulação diferentes, não ruído de driver. Com a captura ancorada em `tDias = 0`, 23 das 24 cenas dão zero pixel de diferença em três execuções |
| Cinco luas com mosaico de imageamento real | F12 | `procedencia.test.ts` · `honestidade.test.ts` | feito — doze das treze luas eram uma textura de 1×1 pixel. Io, Europa, Ganimedes e Calisto entraram com mosaicos Voyager/Galileo e Encélado com o da Cassini (USGS, domínio público). As outras oito seguem com a cor média, e a ficha diz que não existe mosaico global delas |
| Convenção de longitude de cada mosaico, lida do rótulo publicado | F12 | `honestidade.test.ts` | feito — os cinco mosaicos não concordam entre si: Io e Encélado vão de −180° a +180° para oeste, Europa e Calisto de 0° a 360° para oeste, Ganimedes de 0° a 360° para leste. Cada imagem foi espelhada e girada conforme o rótulo PDS. Não foi feita a conferência contra uma fotografia de referência |
| Nível 8K, só no corpo que se está olhando | F12 | `cena/texturas.test.ts` | feito — o limiar é 6 raios, o dobro do enquadramento "perto". O teste afirma que a escada tem ponto fixo (sem oscilação na fronteira) e nunca pula de 2K direto para 8K |
| Régua embaixo da cena não marca mais zero ao aproximar | F12 | `formato.test.ts` | defeito corrigido — a três raios de Io as duas leituras diziam "0,0000 UA" (5.464 km). A unidade agora acompanha a grandeza, e `formato.ts` recolheu as cinco cópias de `numero` que havia em `src/`, com duas regras diferentes entre elas |
| Terceiro nível de frequência que `estado.ts` dizia ter | F13 | `e2e/rotulos.spec.ts` · `e2e/precisao.spec.ts` | defeito corrigido — o cabeçalho descrevia leituras escritas por `textContent` e não havia nenhum em `src/`: iam pela árvore Preact, a 8 Hz. As duas leituras passaram a ser escritas por fora do Preact, por `data-leitura` |
| Menos trabalho por quadro, medido | F13 | `nucleo/trilha.test.ts` · `e2e/precisao.spec.ts` | feito — `Trilha.pontos()` alocava 10 KB por corpo por quadro (~5,4 MB/s de lixo) e agora devolve uma vista reutilizada. `projetar()` roda por quadro desenhado. A ancoragem dos rótulos deixou de varrer o DOM duas vezes por quadro. O `dist/` perdeu 5,7 MB de mapa de origem |
| Buscas por chave viraram tabela, e a tabela nascia vazia | F13 | `e2e/douradas.spec.ts` · `e2e/rotulos.spec.ts` | defeito corrigido — `indiceDe` virou um `Map` preenchido em `publicarMudanca`, que não roda na abertura. O programa começava com índice −1 para todos, e `jupiter-e-as-galileanas` saiu com 74% dos pixels diferentes |
| Medida de contraste dos rótulos com dois defeitos, nela mesma | F13 | `e2e/rotulos.spec.ts` | defeito corrigido — (1) comparava a foto com retângulos do DOM lidos centenas de ms depois; agora espera as placas pararem. (2) Agrupava pixels por cor RGB exata e exigia quatro iguais, o que falha sobre gradiente; agora agrupa por faixa de luminância e usa a mediana do fundo. O resultado oscilava entre 1,31:1 e 3,00:1 sem mudança de legibilidade; com a placa a 5% de opacidade o teste ainda reprova (1,16:1) |
| Escolher um corpo não move a cena | F9 | `e2e/layout.spec.ts` | defeito corrigido — `.corpo` era `flex: 1 1 auto` e a altura saía do `<canvas>`. Escolher Júpiter deslocava a cena 15,5 px, e nenhum duplo clique funcionava porque os dois cliques chegavam com `y` diferente contra 4 px de folga. Corrigido com base zero no CSS e a comparação do duplo clique em coordenadas de tela |

---

## Situação atual

<!-- contagem: feito=31, mudado=12 -->

| Estado | Quantos |
|---|---|
| feito | 31 |
| mudado | 12 |
| parcial | 0 |
| pendente | 0 |

Falta fora das 43:

- Texturas em KTX2/Basis. `toktx` é um binário nativo, não instala por npm e não está na máquina de desenvolvimento. Hoje as texturas são JPG/PNG em 2K, 4K e 8K, e sobem descomprimidas para a VRAM.
- Abrir o `dist/` construído no Arc e no Safari por duplo clique, que é o critério de pronto da F8. Nenhum teste substitui isso.

## Sobre o teste deste arquivo

Uma auditoria achou o contrato citando catorze arquivos de teste que nunca existiram, em dezessete dos quarenta e três itens, e nove linhas marcadas `pendente` que já estavam prontas. `testes/contrato.test.ts` passou a ler este arquivo. Ele não julga se o teste citado prova o que diz provar, mas exige que o arquivo exista, que todo item tenha prova ou roteiro manual, que todo estado seja um dos declarados e que a contagem no comentário acima bata com as linhas da tabela.
