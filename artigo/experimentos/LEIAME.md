# Experimentos do relatório

Segunda implementação, do mesmo algoritmo, em Python + NumPy, do núcleo físico do simulador,
usada para gerar as tabelas e figuras do capítulo de Resultados.

Pressupõe que a pasta `artigo/` esteja ao lado de `simulador/` (lê o arquivo
`simulador/src/dados/efemeride_2026-01-01.json`). As versões usadas estão fixadas em
`requirements.txt` (Python 3.13). Cada roteiro roda sozinho (`python e1_validacao.py`) e
também pode ser importado sem efeito colateral: o trabalho fica em `main()`.

    pip install -r requirements.txt
    cd artigo/experimentos
    python e1_validacao.py      # tabela de validação contra o JPL      (~20 s)
    python e2_integradores.py   # custo x precisão e energia em 1000 anos (~1 min)
    python e3_fourier.py        # convergência da série e conferência com Bessel
    python e4_copernico.py      # Copérnico x coeficientes de Fourier
    python modelos_classicos.py # confere a ordem em e dos modelos clássicos
    python e5_ptolomeu.py       # Copérnico x equante x excêntrico x Fourier; Sol médio
    python referencia_jpl.py    # confere a DE440s contra os cinco pontos do Horizons
    python e6_varredura.py      # erro angular de -100 a +100 anos contra a DE440s (~10 s)
    python e7_relatividade.py   # termo pós-newtoniano: periélio e Mercúrio contra a DE440s (~15 min)
    python figuras.py           # figuras que dependem do E1, do E2 e do E4
    python figuras2.py          # amostragem em ângulo x tempo
    python figuras3.py          # Marte retrógrado e Sol em torno do baricentro (~1 min)
    python fig_elementos.py     # desenho dos elementos orbitais

As figuras são gravadas em `artigo/figuras/`.

O E6 e o E7 comparam com a efeméride DE440s do JPL, que não vai no repositório (32 MB).
Baixe `de440s.bsp` de
https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp
e ponha nesta pasta, ao lado de `referencia_jpl.py`. O `e6_varredura.py` também
lê o `e1.json` do E1 para uma conferência cruzada (rode `e1_validacao.py` antes).

## Resultados arquivados

Os JSON que os roteiros gravam (`e1.json`, `e2.json` e `e4.json` a `e7.json`) ficam no
repositório, com os números exatos das tabelas e figuras do artigo. Rodar de novo os
sobrescreve com os mesmos valores, exceto o tempo de execução que o `e7.json` registra
em `segundos_por_integracao`. O E3 só imprime na tela.
