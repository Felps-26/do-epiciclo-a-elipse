"""
Carrega a efemeride congelada e monta o estado inicial.

O arquivo JSON em src/dados/ foi gerado por ferramentas/gerar_efemeride.py a
partir do JPL e fica versionado junto com o codigo. E o que permite abrir o
programa sem internet: nada aqui vai a rede.

Convencao de centros, que precisa ficar clara antes de qualquer conta:

  - O Sol e o corpo 10 do Horizons, com GMS do cabecalho do DE440.
  - Os oito planetas sao os BARICENTROS dos sistemas planetarios (ids 1 a 8),
    com as GM de sistema (GM1, GM2, GMB, GM4..GM8). Um sistema planetario com
    luas se desloca, como um todo, praticamente como um ponto de massa igual a
    soma das massas -- e e assim que o proprio JPL integra.
  - Para a Terra isso significa que o ponto na tela e o baricentro Terra-Lua.
    O centro da Terra gira em torno dele a cerca de 4670 km (3,1e-5 UA), o que
    na visao geral vale menos de um milesimo de pixel.

Origem do referencial: baricentro do Sistema Solar. Plano e equinocio da
ecliptica de J2000, sistema ICRF. Escala de tempo TDB.
"""

import json
import os

import numpy as np

from src.fisica.corpo import Corpo
from src.fisica.estado import EstadoSistema

PASTA = os.path.dirname(os.path.abspath(__file__))
ARQUIVO_PADRAO = "efemeride_2026-01-01.json"


class EfemerideInvalida(Exception):
    """O arquivo de dados esta ausente, truncado ou incoerente."""


def _exigir(condicao, mensagem):
    if not condicao:
        raise EfemerideInvalida(mensagem)


def carregar(arquivo: str = ARQUIVO_PADRAO):
    """Devolve (corpos, estado_inicial, procedencia, validacao).

    Valida a estrutura em vez de confiar: um arquivo truncado deve falhar aqui
    com uma mensagem clara, nao virar uma simulacao silenciosamente errada.
    """
    caminho = arquivo if os.path.isabs(arquivo) else os.path.join(PASTA, arquivo)
    try:
        with open(caminho, encoding="utf-8") as f:
            dados = json.load(f)
    except FileNotFoundError:
        raise EfemerideInvalida(
            f"arquivo de efemeride nao encontrado: {caminho}\n"
            "Gere-o com: python ferramentas/gerar_efemeride.py") from None
    except json.JSONDecodeError as e:
        raise EfemerideInvalida(f"efemeride corrompida ({caminho}): {e}") from None

    for campo in ("ordem", "corpos", "procedencia", "constantes_de440"):
        _exigir(campo in dados, f"efemeride sem o campo '{campo}'")

    ordem = dados["ordem"]
    _exigir(len(ordem) == 9, f"esperados 9 corpos, encontrados {len(ordem)}")
    _exigir(ordem[0] == "sol", "o primeiro corpo precisa ser o Sol")

    corpos, pos, vel, gm = [], [], [], []
    for chave in ordem:
        _exigir(chave in dados["corpos"], f"corpo '{chave}' ausente")
        c = dados["corpos"][chave]
        for campo in ("nome", "gm_au3_dia2", "raio_km",
                      "posicao_ua", "velocidade_ua_dia", "id_horizons"):
            _exigir(campo in c, f"corpo '{chave}' sem o campo '{campo}'")
        _exigir(len(c["posicao_ua"]) == 3 and len(c["velocidade_ua_dia"]) == 3,
                f"corpo '{chave}': posicao e velocidade precisam ser 3D")
        _exigir(c["gm_au3_dia2"] > 0, f"corpo '{chave}': GM precisa ser positivo")

        corpos.append(Corpo(chave=chave, nome=c["nome"], gm=c["gm_au3_dia2"],
                            raio_km=c["raio_km"], id_horizons=c["id_horizons"],
                            e_baricentro=(chave != "sol")))
        pos.append(c["posicao_ua"])
        vel.append(c["velocidade_ua_dia"])
        gm.append(c["gm_au3_dia2"])

    estado = EstadoSistema(np.array(pos), np.array(vel), np.array(gm), 0.0)
    return corpos, estado, dados["procedencia"], dados.get("validacao", {})


def indice_de(corpos, chave: str) -> int:
    for i, c in enumerate(corpos):
        if c.chave == chave:
            return i
    raise KeyError(f"corpo desconhecido: {chave}")
