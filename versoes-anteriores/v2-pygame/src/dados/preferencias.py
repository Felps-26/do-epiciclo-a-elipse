"""
Guarda as preferencias entre execucoes, sem nunca impedir o programa de abrir.

Qualquer problema de leitura -- arquivo corrompido, versao antiga, permissao
negada -- devolve os padroes em silencio. Preferencia e conveniencia, nao pode
virar motivo de tela de erro.
"""

import json
import os

ARQUIVO = os.path.join(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__)))), "preferencias.json")


def carregar():
    try:
        with open(ARQUIVO, encoding="utf-8") as f:
            d = json.load(f)
        return d if isinstance(d, dict) else {}
    except Exception:                                     # noqa: BLE001
        return {}


def salvar(dados):
    try:
        with open(ARQUIVO, "w", encoding="utf-8") as f:
            json.dump(dados, f, indent=1, ensure_ascii=False)
        return True
    except Exception:                                     # noqa: BLE001
        return False
