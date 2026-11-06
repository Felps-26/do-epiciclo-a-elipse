"""
A lista de atalhos mostrada na ajuda e o mapa de teclas nao podem divergir.

    .venv/bin/python -m tests.test_atalhos

Na versao anterior o rodape era uma string escrita a mao com os atalhos, e
qualquer mudanca no codigo a deixava mentindo sem ninguem notar.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pygame                                                  # noqa: E402

pygame.init()

from src.app.acoes import AlternarPausa, TrocarModo            # noqa: E402
from src.app.atalhos import MAPA, Atalhos                      # noqa: E402
from src.dados.textos import ATALHOS                           # noqa: E402

falhas = []


def checar(cond, msg):
    print(("  [ok]    " if cond else "  [FALHA] ") + msg)
    if not cond:
        falhas.append(msg)


print("=" * 78)
print("ATALHOS DE TECLADO")
print("=" * 78)

documentados = {rotulo for rotulo, _ in ATALHOS}
usados = {rotulo for _, rotulo in MAPA.values()}
so_no_codigo = usados - documentados
so_na_ajuda = documentados - Atalhos.teclas_documentadas()

checar(not so_no_codigo,
       f"toda tecla ligada a uma acao aparece na ajuda "
       f"(faltando: {sorted(so_no_codigo) or 'nenhuma'})")
checar(not so_na_ajuda,
       f"toda tecla listada na ajuda existe de verdade "
       f"(sobrando: {sorted(so_na_ajuda) or 'nenhuma'})")

a = Atalhos()
checar(isinstance(a.resolver(pygame.K_SPACE, 0), AlternarPausa),
       "espaço pausa e continua")
checar(a.resolver(pygame.K_2, 0) == TrocarModo("internos"),
       "tecla 2 vai para os planetas internos")
checar(a.resolver(pygame.K_ESCAPE, 0) is None,
       "ESC nao encerra o programa (so fecha caixa)")
checar(a.resolver(pygame.K_j, 0) is None, "tecla sem funcao nao faz nada")

print(f"\n{len(MAPA)} teclas mapeadas, {len(ATALHOS)} linhas na ajuda")
print("\n" + "=" * 78)
print("RESULTADO: " + ("todos os testes passaram."
                       if not falhas else f"{len(falhas)} falha(s)."))
print("=" * 78)
raise SystemExit(1 if falhas else 0)
