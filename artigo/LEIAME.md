# Artigo: Do epiciclo ao integrador simplético

Artigo em LaTeX (abnTeX2, opção `article`, ABNT NBR 6022) que compara a série de Fourier da órbita kepleriana com os epiciclos de Copérnico e Ptolomeu, usando o simulador da pasta `../simulador/`. O PDF compilado fica anexado à Release `v1.0` do repositório, e não dentro dele.

## Estrutura

    main.tex                 preâmbulo do documento, dados do título e ordem das seções
    preambulo/comandos.tex   notação, caixas didáticas, estilo de código
    pretextuais/             resumo, abstract e agradecimentos
    secoes/01..07            o texto: introdução, Ptolomeu e Copérnico, Fourier,
                             método, resultados, discussão, conclusão
    apendices/               A_derivacoes.tex e B_reproducao.tex
    figuras/                 gráficos (PDF) e capturas de tela (JPG)
    experimentos/            roteiros Python que geram figuras e tabelas (veja o LEIAME da pasta)
    referencias.bib          referências, estilo autor-data (abntex2cite)
    compilar.bat             compila no Windows

## Como compilar

Precisa de MiKTeX ou TeX Live com `abntex2` e `babel-portuges`. Dentro de `artigo/`, no Windows, dê duplo clique em `compilar.bat`. Em qualquer sistema, a sequência é:

    pdflatex main
    bibtex main
    pdflatex main
    pdflatex main

O PDF sai como `main.pdf`. No Overleaf, envie a pasta `artigo/` compactada, escolha o compilador pdfLaTeX e o arquivo principal `main.tex`; o BibTeX roda sozinho.

## Onde mudar o quê

- Título, autores e supervisão: `\tituloartigo`, `\autoresartigo` e `\credenciaisartigo`, no começo de `main.tex`.
- Tabelas e figuras de resultados: saem dos roteiros de `experimentos/`, que gravam em `figuras/`. A ordem de execução e o tempo de cada um estão em `experimentos/LEIAME.md`; o Apêndice B do artigo explica como reproduzir tudo.

## Pontos para a revisão com o professor

- A seção "Copérnico revisitado" (resultados) é a parte mais forte e a que mais merece leitura crítica: depende de ler a frequência do primeiro epiciclo do *Commentariolus* como zero no referencial fixo, conferida na tradução de Rosen (1939, p. 74-75). Em Vênus o mecanismo é outro (p. 81-82).
- A relatividade geral entra só como termo pós-newtoniano do Sol, no experimento E7 e na discussão; o que ela deixa de fora está dito no próprio texto.
