@echo off
REM Compila o relatorio com MiKTeX ou TeX Live (pdfLaTeX + BibTeX).
REM Duplo clique neste arquivo. O PDF sai como main.pdf nesta pasta.
cd /d "%~dp0"
pdflatex -interaction=nonstopmode main.tex
bibtex main
pdflatex -interaction=nonstopmode main.tex
pdflatex -interaction=nonstopmode main.tex
start "" main.pdf
