# Arquitetura

Decisões de projeto. O que está aqui foi medido ou testado. Cada garantia escrita tem um teste que falha se ela deixar de valer.

## Camadas

```
contratos/   tipos que toda camada vê; ninguém importa de volta
nucleo/      física. Só vê a si mesma e contratos/
dados/       fatos congelados, com procedência. Não vê app, cena nem interface
app/         ações, o único reducer, atalhos, laço do quadro
cena/        three.js. Lê um Instantaneo e desenha. Não vê app nem interface
rotulos/     geometria em espaço de tela (pura) e uma camada de DOM
interface/   Preact. Composta depois do tonemapping
```

As sete regras de dependência estão em `.dependency-cruiser.cjs` e rodam dentro de `npm test`. `testes/arquitetura.test.ts` confere que as sete continuam existindo e continuam como `error`, porque rebaixar uma regra para `warn` é o jeito mais fácil de passar num lint de arquitetura.

`Instantaneo` fica em `contratos/` e não em `app/` porque, se ficasse em `app/`, a regra `cena -> app` teria de ser liberada, e com ela entrariam `acoes.ts` e `aplicar.ts`: por aí a cena passaria a abrir modais e despachar ações. O teste do projeto em Python proibia `src/projecao -> src.app` pelo mesmo motivo.

O dependency-cruiser só vê imports. `Math.random`, `Date.now`, `performance` e `fetch` não são imports, então a proibição deles no núcleo fica no ESLint. Cada uma quebra uma garantia escrita do projeto: determinismo do núcleo, relógio injetado e "o programa não acessa a internet".

## Erros já pagos

| Problema | O que acontece | O que se faz |
|---|---|---|
| App sem assinatura em `~/Desktop` | Um bundle `.app` próprio, aberto pelo Finder, recebe `Operation not permitted` ao ler qualquer arquivo de `~/Desktop` (TCC do macOS). Liberar exige que a pessoa vá às Configurações do Sistema. Foi tentado e descartado. | `run.command`, que o Finder abre por duplo clique através do Terminal, que já tem o acesso. |
| `do shell script` do AppleScript não desacopla | Só retorna quando o grupo de processos que criou se fecha. Um servidor iniciado por ali deixa o applet pendurado, mesmo com `nohup`, `&` e `</dev/null`. | Não iniciar processo longo por AppleScript. |
| O Finder não passa pelo `.zshrc` | Com Node instalado via nvm, `command -v node` falha em tudo que o Finder abre, e o programa não abre sem dizer por quê. | `run.sh` procura o Node em `~/.nvm/versions/node/*/bin`, `~/.volta/bin`, `/opt/homebrew/bin` e `/usr/local/bin` antes de desistir. |
| `file://` | O Chromium recusa `new Worker()` de origem opaca, e o fetch do JSON de efemérides, dos `.ktx2` e do `.bin` do catálogo de estrelas é bloqueado por CORS. | Sempre um servidor local (`servidor.mjs`). |
| `python3 -m http.server` | Não envia COOP/COEP, não conhece `.ktx2` nem `.wasm`, e não tem o PUT das preferências nem a batida. | `ferramentas/servidor.py`, um `ThreadingHTTPServer` com o mesmo comportamento do servidor Node. |
| `stdout` do Python em buffer de bloco | Quando redirecionado, o endereço que o servidor imprime ao subir nunca aparece. | `sys.stdout.reconfigure(line_buffering=True)` antes do primeiro print. |
| Teste que mede a si mesmo | Um canvas WebGL2 lido fora do quadro devolve buffer vazio, e uma leitura vazia é estável entre dois quadros: o teste de z-fighting passava com zero. O mesmo padrão apareceu mais três vezes: uma asserção algébrica verdadeira para qualquer entrada, um corpo de teste que "se move" com a gravidade desligada, e um teste de texto que passou com o parágrafo apagado porque as palavras apareciam em outro lugar. | Toda medição vem com uma guarda que afirma que ela mede algo: `contrasteDoQuadro > 30` ao lado do stipple, valores do DE440 em vez da identidade, o corpo largado em repouso, e a verificação de texto por frase e não por palavra. |
| A coluna `P` da tabela de luas do JPL não é o período sideral | Em Io ela diz 1,762732 dia e o período medido é 1,769141 (0,36%, ou 270° de fase em um ano). A lua aparece do lado errado de Júpiter. A página não avisa, e dez das treze linhas batem. | O período é medido, casando a fase entre duas janelas de vetores do Horizons separadas por dezesseis anos (`ferramentas/gerar_luas.mjs`). |
| Polo da IAU para Urano, invertido para as luas | Com o polo publicado (257,311 / −15,175), Titânia, Oberon e Miranda saem retrógradas e erram 600 mil km. Urano gira ao contrário da própria órbita, e o JPL orienta o quadro equatorial da tabela pelo momento angular das luas. | O gerador testa as duas orientações e grava qual reproduz a posição, com o erro de cada uma. |
| `cos i` na anomalia média | `n_sideral = Mponto + periastroPonto + noPonto·cos(i)`. Nas doze luas quase equatoriais `cos i` passa de 0,996 e o fator passa despercebido. Em Tritão, retrógrado, vale −0,92: sem o fator o erro foi de 377.835 km, 106% do semieixo. | As duas formas são testadas contra a efeméride, e a escolhida fica gravada no JSON. |
| Ajustar um parâmetro e medir o erro na mesma janela | Mínimos quadrados forçam resíduo sem componente linear dentro da janela ajustada. Medir ali mede o ajuste, e "o erro não cresce" vira tautologia. | Duas janelas que não se tocam: ajuste em 2000–2016, conferência em 2020–2040. |
| Buscar corpo por índice numa lista que cresce | A cena guarda os corpos da física e as treze luas na mesma lista. `catalogo.corpos[i]` com índice de lua devolvia `undefined`; depois de criar um corpo no sandbox o mesmo índice passa a apontar para outro corpo, e a lua sai rotulada com o nome do asteroide recém-criado. | Busca por chave em tudo que pode mudar de tamanho, e `sincronizarCorpos` compara por chave. |
| `mu = gm_i + gm_j` numa guarda de separação | "Asteroide" e "Cometa" têm massa zero. Com a soma, um par deles daria separação mínima zero e a guarda aceitaria dois corpos sobrepostos. | A separação usa a GM do vizinho. Dois corpos sem massa não se puxam, e o que a guarda impede é chegar perto de quem tem massa. |
| `Cmd+Shift+Z` sem refazer | O Shift não entra na comparação de teclas (é ele que faz `/` virar `?`), então o Refazer convencional casava com o desfazer e tirava mais um corpo. | Campo `semShift` na tecla, e um teste que aperta `Cmd+Shift+Z` e exige que nada aconteça. |
| Trava de servidor que sobrevive ao processo | A trava guarda o PID para que abrir duas vezes reaproveite a instância viva. Se o processo morre sem limpar (`SIGKILL`, desligamento, suíte de testes), a abertura seguinte lê a trava, abre o navegador num endereço morto e sai, sem aviso. | `process.kill(pid, 0)` só pergunta se o processo existe. Se lançar, a trava é apagada e o servidor sobe. `testes/servidor.test.ts` põe uma trava com PID inexistente no caminho e exige resposta 200. |
| JSON válido que não é objeto | `42`, `"texto"`, `[1,2]` e `null` são JSON válidos. Gravados em `preferencias.json`, deixam o carregador recebendo um número onde espera um objeto na abertura seguinte. Achado por um teste que estava errado: o Playwright codifica `data` em string como JSON, então `'nao sou json'` chegava como `"nao sou json"`, que é válido. | Os dois servidores exigem objeto. O teste manda o corpo como bytes e cobre os cinco casos. |

## Testes de texto

Duas afirmações do projeto são sobre prosa, e nenhuma ferramenta comum as verifica. Ambas viraram teste depois de falharem.

`testes/honestidade.test.ts` liga cada simplificação listada no bloco "o que a tela simplifica" a um fato do código, nos dois sentidos: listar o que não se faz reprova, e fazer o que não está listado também. Nasceu de um defeito: o "Modo maquete" tinha o alternador, o aviso falado e a etiqueta na tela, e não comprimia nada.

A correção pós-newtoniana do Sol existe só como opção (`yoshida4Relativistico`, em `nucleo/integrador.ts`), para os experimentos do artigo. O programa roda com `PADRAO = yoshida4`, sem ela, e a mesma amarra exige isso para a Ajuda continuar dizendo que a relatividade não entra.

`testes/contrato.test.ts` lê o `CONTRATO.md` e exige que toda prova citada exista no disco. Nasceu de uma auditoria que achou catorze arquivos de teste citados que nunca existiram, em dezessete dos quarenta e três itens.

## Execução

`run.sh`, `run.command`, `run.bat` e `run.ps1` fazem o mesmo em cada sistema: instalam as bibliotecas se faltarem, constroem se faltar `dist/` e sobem `servidor.mjs`. A pasta de entrega já traz `dist/`, então na máquina de quem recebe só o servidor local sobe. Sem Node, `ferramentas/servidor.py` assume.

O servidor escuta em 127.0.0.1, e não em 0.0.0.0, para que outra máquina da rede não o alcance. A porta é fixa (8731): a URL é sempre a mesma, e abrir duas vezes reaproveita a instância viva.

A batida é o que faz fechar a aba encerrar o programa. A página bate em `/_batida` a cada 10 s, e sem batida por 30 s o processo sai e remove a trava. Sem isso cada abertura deixaria um processo órfão segurando a porta, e encerrar o programa exigiria um terminal.

As preferências vão para um arquivo, por `PUT /preferencias.json`, e não para `localStorage`. Assim continuam sendo o mesmo `preferencias.json` de sempre, sobrevivem à troca de navegador e não ficam presas à origem (que inclui a porta). A exceção é a cópia publicada no GitHub Pages, que não tem servidor: lá, e só lá, elas vão para o `localStorage`, e a batida não é enviada (`src/app/servidorLocal.ts`).
