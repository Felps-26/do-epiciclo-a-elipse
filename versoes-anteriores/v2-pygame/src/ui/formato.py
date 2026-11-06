"""
Numeros escritos como se escreve em portugues.

Em portugues a virgula separa os decimais e o ponto separa os milhares --
exatamente o contrario do padrao do Python. Sem isso, "1.390 UA" na tela se
le como mil trezentos e noventa, quando o valor e um virgula trinta e nove.
Para um programa que existe para ser entendido, isso nao e detalhe.
"""


def numero(valor, casas=2):
    """1234.5 -> '1.234,5'"""
    if valor != valor:                       # NaN
        return "—"
    if valor in (float("inf"), float("-inf")):
        return "∞"
    texto = f"{valor:,.{casas}f}"
    # troca os separadores de uma vez, usando um marcador temporario
    return texto.replace(",", "\x00").replace(".", ",").replace("\x00", ".")


def inteiro(valor):
    return numero(valor, 0)


def ua(valor, casas=3):
    return f"{numero(valor, casas)} UA"


def km(valor):
    return f"{inteiro(valor)} km"


def km_por_s(valor, casas=1):
    return f"{numero(valor, casas)} km/s"


def dias(valor, casas=0):
    return f"{numero(valor, casas)} dias"


def anos(valor, casas=1):
    return f"{numero(valor, casas)} anos"


def graus(valor, casas=2):
    return f"{numero(valor, casas)}°"


def cientifico(valor, casas=2, unidade=""):
    """9.93e-06 -> '9,93e-06 UA'. A mantissa tambem leva virgula."""
    if valor != valor:
        return "—"
    texto = f"{valor:.{casas}e}".replace(".", ",")
    return f"{texto} {unidade}".strip()


def periodo_aproximado(dias_valor):
    """Periodo orbital em linguagem comum, sem sugerir precisao que nao ha."""
    if dias_valor != dias_valor:
        return "—"
    if dias_valor < 400:
        return f"cerca de {inteiro(dias_valor)} dias"
    a = dias_valor / 365.25
    if a < 10:
        return f"cerca de {numero(a, 1)} anos"
    return f"cerca de {inteiro(a)} anos"
