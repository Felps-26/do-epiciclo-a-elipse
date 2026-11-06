# Arquitetura

Para quem vai mexer no código. Para usar o programa, veja o [README](README.md).

## A separação que sustenta tudo

```
src/fisica/     posição e velocidade em 3D, em UA e UA/dia. Sem pygame,
                sem pixels, sem saber que existe uma tela.
src/dados/      a efeméride congelada, o catálogo e todo o texto da interface.
src/projecao/   a ponte mundo -> tela: câmera, escala visual, rótulos.
src/ui/         janela, tema, tipografia, layout, widgets, cenas e telas.
src/app/        o laço principal, as ações e os atalhos.
```

`src/fisica/` guarda `(N, 3)` e nunca reduz para duas dimensões. A vista superior usa XY em `CenaSistema` e `Camera2D.mundo_para_tela`:

```python
p = np.atleast_2d(p)[:, :2]
```

`Camera3D` (`src/projecao/camera3d.py`) usa uma base ortonormal e projeção ortográfica, e reaproveita enquadramento, zoom e transições da câmera 2D. `CenaSistema3D` ordena discos e segmentos de curvas por profundidade em pygame; a profundidade do segmento é a do ponto médio, sem z-buffer, perspectiva nem iluminação física. Widgets, layout, tema e física são os mesmos, e uma cena OpenGL futura pode trocar esse renderizador sem tocar na física.

`EstadoUI.vista` escolhe 2D ou 3D. `Aplicacao` mantém duas câmeras e duas cenas sobre um único estado e relógio; ao alternar, transfere centro, zoom e alvo, e a orientação orbital se preserva. O avanço unitário usa o integrador por exatamente um passo, pausa o relógio e atualiza o tempo e as trilhas.

`tests/test_arquitetura.py` percorre a árvore sintática de cada arquivo e falha se `src/fisica/` importar `pygame`, `src.projecao` ou `src.ui`. A versão anterior afirmava essa separação enquanto `src/ui/hud.py` importava um atalho da raiz, e nada verificava.

## Decisões

- **Passo fixo de 0,5 dia, integrador simplético.** O passo adaptativo quebra a propriedade simplética, e o fixo faz a data exibida ser sempre `início + n × 0,5 dia`.
- **O simulador descarta e nunca acumula.** Quando a velocidade pedida não cabe no orçamento do quadro, `Simulador.avancar` entrega os passos que cabem, descarta o excedente e marca `atrasado=True`. Acumular dívida travaria a janela, e aumentar o passo degradaria a física sem aviso.
- **A escala comprimida vive em `src/projecao/escala_visual.py`** e é aplicada às coordenadas de desenho por cada cena (raio no plano XY em 2D, raio espacial em 3D). A aplicação transforma também o alvo de acompanhamento, para câmera e corpo usarem as mesmas coordenadas visuais. Nada disso volta para o estado: todo número físico lê do `EstadoSistema`.
- **`Camera2D` guarda `px_por_ua` e não `escala × zoom`.** Com o par, "zoom 1,0" significava coisas diferentes conforme o planeta escolhido.
- **Nenhum `pygame.Rect` em escopo de módulo.** Era a causa de a janela anterior não redimensionar. `ui/layout.calcular()` é função pura (números entram, retângulos saem), e `tests/test_layout.py` confere 480 combinações sem abrir janela.
- **Widgets não guardam hover, foco nem pressionado.** Os três vêm do `Contexto`, montado do zero a cada quadro; guardá-los no widget é o caminho conhecido para botões que continuam iluminados depois que o painel fecha.
- **Widgets devolvem `Acao` e nunca mudam estado.** `Aplicacao.aplicar` é o único lugar onde algo muda, e é onde se depura "por que clicar aqui fez aquilo".

## Armadilhas do pygame, medidas aqui

| Assunto | O que se descobriu |
|---|---|
| Coordenada enorme | `aalines` corta sozinho e custa o mesmo (0,006 ms) com coordenada de 1e8 px. `lines(width=2)` não corta: a mesma curva custa 196 ms. Por isso órbitas e trilhas usam `aalines`. |
| O que quebra de fato | `int(float('inf'))` levanta `OverflowError`. Toda coordenada passa por `Camera2D.sanear` antes de virar inteiro. |
| Fontes | `render()` custa ~4,4 µs e o blit de cache 0,17 µs. Cache LRU obrigatório, com os números arredondados antes de formatar para a string se repetir entre quadros. |
| Tamanho de fonte | O número passado não é altura em pixels. O espaçamento vertical sai de `get_linesize()`, nunca de um valor somado à mão. |
| Fonte do sistema | Comparar a largura de "ação" com "acao" não detecta falta de acento. Funciona comparar os pixels com os de um caractere que a fonte certamente não tem. |
| Setas tipográficas | Não existem na fonte do sistema nem na embutida. `desenho.seta_cima` e `seta_baixo` desenham triângulos. |
| Redimensionar | No macOS chegam dezenas de eventos por segundo. O handler só marca sujo, e o recálculo acontece uma vez antes do desenho. |
| `set_mode` | Devolve uma Surface nova a cada chamada. Só a `Janela` guarda referência. |
| `pygame.SCALED` | Não usado: fixa uma resolução lógica e briga com layout que se reorganiza. |
| `ev.rel` | Acumula fora da janela e dá salto ao recuperar foco. O arrasto usa posição absoluta. |
| Roda do trackpad | `ev.y` é inteiro e faz o zoom andar aos trancos. Usar `precise_y`. |
| Captura de tela | `pygame.image.save` trava o quadro por dezenas de ms. Depois de salvar, descarta-se um `tick()` para o `dt` inflado não virar salto na data. |

## O erro da câmera que perseguia o planeta

A câmera que acompanha um planeta usava amortecimento exponencial em direção à posição do corpo. Isso nunca alcança um alvo em movimento: estabiliza a uma distância proporcional à velocidade (11 px com Marte a 30 dias por segundo e 237 px a 3650). Durante a aproximação o zoom crescia na mesma taxa em que o erro diminuía, então o erro em pixels nem encolhia. Decair o erro em vez de perseguir a posição é algebricamente a mesma coisa. A solução foi dar prazo à transição: 0,45 s de animação e depois a câmera trava no corpo (ver `Camera2D.atualizar`).

## Regenerar os dados

`ferramentas/gerar_efemeride.py` é a única parte do projeto que acessa a internet, e não roda durante o uso. Busca os vetores de estado no JPL Horizons, as constantes GM no cabeçalho do DE440 e os raios nas fichas de corpo, e grava tudo com a procedência.
