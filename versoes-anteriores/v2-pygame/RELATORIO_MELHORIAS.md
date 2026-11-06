# Melhorias da interface (21/09/2026)

## O que mudou

- **Janelas roláveis.** Ajuda, detalhes, atividades, dicas e comparação compartilham o mesmo conteúdo rolável: barra visível que arrasta e clica, roda e trackpad fracionários, setas, Page Up/Down e Home/End. Título e ações ficam fixos, rodapés com vários botões quebram em linhas, e URLs compridas quebram sem perder caracteres.
- **Seleção A/B.** Clique esquerdo seleciona A e direito seleciona B (o direito nativo do pygame é 3; o 2 também é aceito). A comparação só abre por **Comparar planetas** ou **C**. Letras, contornos e rótulos identificam os lados, e o direito não gera pan nem zoom.
- **Comparação.** Os seletores percorrem os oito planetas e aceitam teclado. Inverter troca A/B, pares iguais recebem orientação, e os resultados mudam já no primeiro desenho depois da escolha. A janela persiste enquanto o tempo avança, preservando foco e rolagem. Mostra distância e velocidade heliocêntricas atuais em 3D e o período osculador. O produto velocidade instantânea × período saiu, com explicação, e não se mostra distância acumulada sem medi-la.
- **Clique duplo.** No canvas ou na lista, abre uma única ficha completa sem duas seleções simples. O reconhecimento usa até 320 ms e exige o mesmo corpo e posições próximas. **Ver detalhes** e **D** são a alternativa, e Enter escolhe A na lista enquanto Shift+Enter escolhe B.
- **Fichas.** Separam visão geral, características físicas externas, órbita do modelo, condições, curiosidades e fontes. Distância, velocidade e elementos osculadores acompanham o instante atual. A massa do planeta não é confundida com a GM do sistema, os pontos orbitais são baricentros, dia solar e rotação sideral são distintos, e as temperaturas dos gigantes são a 1 bar.
- **Mais opções.** Ganhou seções, espaçamento, rótulos curtos, cartões, hover e indicação textual e visual dos estados. A lateral aceita Page Up/Down e Home/End, e o recorte dela impede cliques sobre a barra superior.
- **Estrelas.** 180 pontos decorativos gerados com semente fixa, sem efeito no estado, na câmera, na escala nem nos alvos de clique. A preferência vai para `preferencias.json` ao sair.
- **Faixa inferior removida.** O canvas recupera a altura. O campo de visão fica sobre ele, inclusive durante modais, e acompanha zoom, enquadramento e resize. Mostra a extensão do menor lado do canvas e, na escala comprimida, "UA visuais · comprimido".

## Dados e uso offline

Dados estáticos congelados em `src/dados/planetas.py`, consultados em 21/09/2026:

- [NASA/NSSDCA Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/), tabela de 18/03/2025.
- Fichas individuais por planeta, com as URLs registradas no arquivo, para atmosferas e temperaturas a 1 bar.
- [Definições dos campos](https://nssdc.gsfc.nasa.gov/planetary/factsheet/fact_notes.html).
- Raios médios do catálogo JPL distribuído no projeto.

Esses dados não alimentam o integrador e não acrescentam dependência de rede. A contagem de luas é datada de 2025 e não se apresenta como censo atual. Nada em `src/fisica/` nem a efeméride foi alterado.

## Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `README.md` | Controles, comparação, fontes, escala, preferências e testes. |
| `preferencias.json` | Nova preferência `opcoes.estrelas`; os demais valores ficam. |
| `src/app/acoes.py` | Ações para percorrer e inverter os lados da comparação. |
| `src/app/aplicacao.py` | Seleção A/B, abertura automática, atualização do modal existente, rolagem lateral por teclado e campo de visão acima do véu. |
| `src/app/estado_ui.py` | Padrão e leitura compatível da preferência de estrelas. |
| `src/app/atalhos.py` | C para comparar e D para detalhes. |
| `src/dados/planetas.py` | Catálogo de dados externos com procedência. |
| `src/dados/textos.py` | Ajuda, tutorial, ressalvas e rótulos de opções. |
| `src/projecao/escala_visual.py` | Só um comentário sobre a nova localização da indicação de compressão. |
| `src/ui/eventos.py` | Rolagem de modal, arrasto da barra, clique duplo, botão secundário e teclado. |
| `src/ui/layout.py` | Rodapé com altura zero; o espaço volta ao canvas. |
| `src/ui/tipografia.py` | Quebra de palavras e URLs longas sem truncar. |
| `src/ui/cenas/cena_sistema.py` | Estrelas determinísticas e marcações A/B. |
| `src/ui/telas/sobreposicoes.py` | Caixas roláveis, ficha completa e comparação viva. |
| `src/ui/telas/tela_sistema.py` | Opções agrupadas, botões acessíveis, ficha curta rolando com a lateral e campo de visão. |
| `src/ui/widgets/base.py` | Recorte dos alvos de clique de contêineres. |
| `src/ui/widgets/botao.py` | Fundo, borda, hover e espaçamento dos alternáveis. |
| `src/ui/widgets/modal.py` | Componente compartilhado de rolagem, barra e título adaptável. |
| `tests/test_interface.py` | Expectativas atualizadas; não apaga mais as preferências do usuário. |
| `tests/test_interacoes.py` | 18 testes novos de regressão por eventos. |
| `testes.sh` | Executa o módulo novo e mostra as falhas do unittest. |

Artefatos de verificação: `saida/revisao_testes.log` e as capturas `saida/revisao_*.png`.

## Testes e revisão visual

`./testes.sh` passou nos 11 módulos: arquitetura, tema e contraste, 480 combinações de layout, rótulos, atalhos, física N-corpos, efemérides, projeção, matemática orbital, percurso de interface e os 18 testes novos de interação.

Os testes novos cobrem rolagem até a última linha em 960×600 com texto normal e maior, barra arrastável, foco e Esc, A/B pelos botões 1, 2 e 3 e pelo teclado, abertura no mesmo ciclo, clique duplo sem seleções simples, cancelamento de clique por arrasto, troca, inversão e pares iguais, números vivos sem recriar controles nem alterar a rolagem, estrelas em arquivo temporário e isoladas da física e dos alvos, campo de visão com zoom, modos, resize e compressão, fontes externas separadas e ausência de cliques através da lateral.

A revisão visual foi feita sobre capturas das superfícies renderizadas pelo pygame em SDL dummy:

- [Ajuda no fim, 960×600, texto maior](saida/revisao_ajuda_fim.png)
- [Ficha completa no fim](saida/revisao_detalhes_fim.png)
- [Atividades no fim](saida/revisao_atividades_fim.png)
- [Comparação com resultados](saida/revisao_comparacao.png)
- [Mais opções](saida/revisao_opcoes.png)
- [Mais opções, seções inferiores](saida/revisao_opcoes_fim.png)
- [Canvas com estrelas, 1280×800](saida/revisao_estrelas.png)

## Limitações

- Mouse, trackpad e teclado foram exercitados por eventos injetados, inclusive deltas fracionários. Não houve teste com trackpad físico nem inspeção de uma janela nativa do macOS.
- Os dados externos são um retrato offline, datado e arredondado, e não acompanham luas novas nem revisões de medidas.
- O clique simples espera até 320 ms por causa do reconhecimento do clique duplo. Há alternativas sem esse gesto na lista e no teclado.
- As limitações físicas (nove corpos, sem luas separadas nem relatividade) permanecem, e o integrador não foi alterado.
