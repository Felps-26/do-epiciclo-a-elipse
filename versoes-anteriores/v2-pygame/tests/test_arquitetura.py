"""
Guarda-corpo da separacao entre fisica e interface.

A documentacao antiga deste projeto afirmava que core/ e ui/ eram separados,
enquanto src/ui/hud.py importava um atalho da raiz e ninguem percebia. Uma
afirmacao que nada verifica apodrece. Este teste le o codigo-fonte e falha se
a separacao for quebrada.

Por que importa aqui especificamente: a regra "a escala visual comprimida
nunca altera a fisica" so se sustenta se o pacote de fisica nao puder nem ver
o modulo que faz a compressao.
"""

import ast
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

# pacote -> prefixos de import proibidos
REGRAS = {
    "src/fisica": ("pygame", "src.projecao", "src.ui", "src.app", "src.dados"),
    "src/dados": ("pygame", "src.projecao", "src.ui", "src.app"),
    "src/projecao": ("src.ui", "src.app"),
}


def _imports(caminho):
    with open(caminho, encoding="utf-8") as f:
        arvore = ast.parse(f.read(), filename=caminho)
    nomes = []
    for no in ast.walk(arvore):
        if isinstance(no, ast.Import):
            nomes += [a.name for a in no.names]
        elif isinstance(no, ast.ImportFrom) and no.module and no.level == 0:
            nomes.append(no.module)
    return nomes


def verificar():
    falhas = []
    for pacote, proibidos in REGRAS.items():
        pasta = os.path.join(RAIZ, pacote)
        if not os.path.isdir(pasta):
            falhas.append(f"pacote ausente: {pacote}")
            continue
        for arquivo in sorted(os.listdir(pasta)):
            if not arquivo.endswith(".py"):
                continue
            caminho = os.path.join(pasta, arquivo)
            for nome in _imports(caminho):
                for p in proibidos:
                    if nome == p or nome.startswith(p + "."):
                        falhas.append(f"{pacote}/{arquivo} importa '{nome}' (proibido: {p})")
    return falhas


def test_separacao_de_camadas():
    falhas = verificar()
    assert not falhas, "separacao de camadas quebrada:\n  " + "\n  ".join(falhas)


if __name__ == "__main__":
    f = verificar()
    for x in f:
        print("  [FALHA]", x)
    print("separacao de camadas: " + ("OK" if not f else f"{len(f)} violacao(oes)"))
    raise SystemExit(1 if f else 0)
