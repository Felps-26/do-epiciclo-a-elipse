# Experimentos do relatório

Reimplementação independente, em Python + NumPy, do núcleo físico do simulador,
usada para gerar as tabelas e figuras do capítulo de Resultados.

Pressupõe que a pasta `artigo/` esteja ao lado de `simulador/` (lê o arquivo
`simulador/src/dados/efemeride_2026-01-01.json`).

    pip install numpy scipy matplotlib
    cd artigo/experimentos
    python e1_validacao.py      # tabela de validação contra o JPL      (~20 s)
    python e2_integradores.py   # custo x precisão e energia em 1000 anos (~1 min)
    python e4_copernico.py      # Copérnico x coeficientes de Fourier
    python figuras.py           # figuras que dependem dos três acima
    python figuras2.py          # amostragem em ângulo x tempo
    python figuras3.py          # Marte retrógrado e Sol em torno do baricentro (~1 min)

As figuras são gravadas em `artigo/figuras/`.
    python fig_elementos.py     # desenho dos elementos orbitais
