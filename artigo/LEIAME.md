# Relatório — Do epiciclo ao integrador simplético

Rascunho completo em LaTeX (abnTeX2), pronto para o Overleaf.

## Como compilar no Overleaf

1. New Project → Upload Project → envie `artigo_overleaf.zip`.
2. Menu → Compiler: **pdfLaTeX**; Main document: **main.tex**.
3. Recompile. O BibTeX roda sozinho.

## Estrutura

    main.tex                 preâmbulo, dados da capa e ordem dos capítulos
    preambulo/comandos.tex   notação, caixas didáticas, estilo de código
    pretextuais/             agradecimentos, resumo, abstract, siglas e símbolos
    capitulos/01..10         o texto
    apendices/A..E           derivações, código, execução, dados, experimentos
    figuras/                 gráficos (PDF) e capturas de tela (JPG)
    codigo/                  arquivos .ts citados no Apêndice B (cópias do simulador)
    experimentos/            roteiros Python que geram figuras e tabelas
    referencias.bib          referências (ABNT, autor-data)

## O que conferir

- `main.tex`: autores, professor, curso, cidade, ano e espaçamento (`\SingleSpacing` ou `\OnehalfSpacing`).
  A disciplina não consta na capa; se o curso exigir, acrescente uma linha em `\instituicao`.

## Pontos para a revisão com o professor

- Formato: hoje é "trabalho acadêmico" (capa, folha de rosto, capítulos).
  Para virar artigo, ver o comentário no topo de `main.tex`.
- Espaçamento: está simples; alguns cursos exigem 1,5 (`\OnehalfSpacing`).
- Seção 7.4 ("Copérnico revisitado") é a parte mais forte e a que mais merece
  leitura crítica do professor: depende da leitura das frequências do modelo
  do Commentariolus (frequência zero para o 1º epiciclo).
- Relatividade geral: citada como trabalho futuro, à escolha do supervisor.
- Capítulo 8 (uso em sala): propostas não testadas com estudantes.
