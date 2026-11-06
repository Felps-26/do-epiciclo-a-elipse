# Instalação e execução

## O que é preciso ter antes

Python 3.9 ou mais novo. Para conferir, abra o terminal e digite
`python3 --version`.

- **macOS**: se não houver Python, instale com `brew install python@3.13`.
- **Linux**: instale Python 3 e o módulo `venv` pela sua distribuição.
- **Windows**: baixe em [python.org](https://www.python.org/downloads/) e
  marque **Add Python to PATH** durante a instalação.

## Abrir o programa

| Sistema | O que fazer |
|---|---|
| macOS | Abra **`run.command`** no Finder. Se aparecer um aviso de segurança na primeira vez, clique com o botão direito no arquivo e escolha **Abrir**. |
| Linux | Execute **`./run.sh`** nesta pasta. |
| Windows | Abra **`run.bat`**. No PowerShell, `./run.ps1` também funciona. |

O atalho cria a pasta `.venv` e instala as bibliotecas na primeira execução.
Isso leva alguns segundos e acontece só uma vez. **Depois disso não é preciso
usar o terminal nem editar arquivo nenhum.**

## O que é instalado

Só duas bibliotecas, listadas em `requirements.txt`:

- **numpy** — os cálculos de física
- **pygame-ce** — a janela e o desenho

`scipy` também é instalada, mas é opcional: serve apenas para um bloco de
verificação em `tests/test_fisica_lab.py`, que é pulado se ela faltar.

O programa **não acessa a internet**. As posições dos planetas estão
guardadas em `src/dados/efemeride_2026-01-01.json`.

## Execução manual

Com o ambiente já criado:

```bash
.venv/bin/python main.py              # macOS e Linux
.venv\Scripts\python.exe main.py      # Windows
```

## Conferir os cálculos

Nenhum teste abre janela nem usa internet.

```bash
./testes.sh                                    # todos de uma vez
.venv/bin/python -m tests.test_fisica_nbody    # só a gravitação
.venv/bin/python -m tests.test_efemeride       # só a comparação com o JPL
```

No Windows, troque `.venv/bin/python` por `.venv\Scripts\python.exe`.

## Atualizar os dados de partida

Este passo **precisa de internet** e não é necessário para usar o programa.
Ele baixa novas posições do JPL Horizons e regrava o arquivo local:

```bash
.venv/bin/python ferramentas/gerar_efemeride.py --epoca 2030-01-01 --validacao
```
