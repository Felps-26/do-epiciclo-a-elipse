"""Dados externos congelados; nunca alimentam o integrador.

Fonte dos números: NASA/NSSDCA Planetary Fact Sheet (18/03/2025),
consultada em 21/09/2026. A contagem de luas é desse retrato, não um censo
atual. Atmosferas e temperaturas dos gigantes: fichas individuais NSSDCA.
Raio médio volumétrico: catálogo JPL já distribuído com o projeto.
"""

FONTE_TABELA = "https://nssdc.gsfc.nasa.gov/planetary/factsheet/"
FONTE_NOTAS = FONTE_TABELA + "fact_notes.html"
DATA_TABELA = "18/03/2025"
CONSULTA = "21/09/2026"

# massa (10^24 kg), aceleração efetiva equatorial (m/s²), rotação sideral (h),
# dia solar médio (h), temperatura (°C), luas na tabela, anéis, atmosfera.
_DADOS = {
    "mercurio": (.330, 3.7, 1407.6, 4222.6, 167, 0, False,
                 "Exosfera muito tênue, com sódio, magnésio e oxigênio.", "mercury"),
    "venus": (4.87, 8.9, -5832.5, 2802.0, 464, 0, False,
              "Predomina dióxido de carbono (96,5%), seguido de nitrogênio.", "venus"),
    "terra": (5.97, 9.8, 23.9, 24.0, 15, 1, False,
              "Ar seco: cerca de 78% de nitrogênio e 21% de oxigênio.", "earth"),
    "marte": (.642, 3.7, 24.6, 24.7, -65, 2, False,
              "Atmosfera tênue, principalmente dióxido de carbono.", "mars"),
    "jupiter": (1898, 23.1, 9.9, 9.9, -108, 95, True,
                "Principalmente hidrogênio e hélio; traços de metano.", "jupiter"),
    "saturno": (568, 9.0, 10.7, 10.7, -139, 274, True,
                "Principalmente hidrogênio e hélio; traços de metano.", "saturn"),
    "urano": (86.8, 8.7, -17.2, 17.2, -197, 28, True,
              "Hidrogênio e hélio, com metano (cerca de 2,3%).", "uranus"),
    "netuno": (102, 11.0, 16.1, 16.1, -201, 16, True,
               "Hidrogênio e hélio, com metano (cerca de 1,5%).", "neptune"),
}

PLANETAS = {}
for chave, valores in _DADOS.items():
    massa, gravidade, rotacao, dia, temperatura, luas, aneis, atmosfera, slug = valores
    PLANETAS[chave] = dict(
        massa_1e24kg=massa, gravidade=gravidade, rotacao_h=rotacao,
        dia_solar_h=dia, temperatura_c=temperatura, luas=luas, aneis=aneis,
        atmosfera=atmosfera, fonte=FONTE_TABELA + slug + "fact.html",
        temperatura_referencia=("a 1 bar na atmosfera; não é uma superfície sólida"
                                if aneis else "média de superfície da ficha"),
    )
