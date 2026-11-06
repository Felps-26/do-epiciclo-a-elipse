#!/usr/bin/env python3
"""
Simulação do Sistema Solar: Sol e oito planetas se atraindo pela gravidade.

Para abrir, use run.command (macOS), run.sh (macOS e Linux) ou run.bat
(Windows). Eles preparam o ambiente sozinhos na primeira vez.

Se preferir a linha de comando, com o ambiente já criado:

    .venv/bin/python main.py

Para conferir os cálculos sem abrir janela:

    .venv/bin/python -m tests.test_fisica_nbody
    .venv/bin/python -m tests.test_efemeride
"""

import sys
import traceback


def main():
    try:
        from src.app.aplicacao import Aplicacao
    except ImportError as e:
        print("Falta uma biblioteca:", e)
        print("Rode ./run.sh (macOS e Linux) ou run.bat (Windows) para instalar.")
        return 1

    try:
        Aplicacao().rodar()
    except KeyboardInterrupt:
        print("\nEncerrado.")
        return 0
    except Exception:                                    # noqa: BLE001
        # Mensagem util em vez de um traceback solto: quem abriu pelo Finder
        # nao tem terminal a vista.
        print("\nO programa encontrou um erro e precisou fechar.\n")
        traceback.print_exc()
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
