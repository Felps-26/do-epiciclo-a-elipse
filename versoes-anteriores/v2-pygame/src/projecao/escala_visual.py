"""
Escala visual: o unico lugar onde as distancias desenhadas podem deixar de ser
proporcionais as distancias reais.

Por que isso existe: Netuno esta 77 vezes mais longe do Sol que Mercurio. Numa
area de 400 pixels de raio mostrando o sistema inteiro em escala real, a
orbita de Mercurio tem 5 pixels e a separacao entre Mercurio e Venus fica em
4 pixels. Da para ver que ha alguma coisa ali, mas nao da para explorar.

Por que e opcional e desligada por padrao: comprimir distancias e uma mentira
util, e mentira util precisa vir com etiqueta. Quando ligada, a interface
identifica a compressao no campo de visao e explica a escala na Ajuda e
nas fichas. Uma regua linear seria enganosa; os dados fisicos das fichas
continuam expressos em distancia real.

A REGRA QUE NAO SE QUEBRA: este modulo mexe em coordenadas de desenho e so.
Nada daqui volta para o estado fisico. O pacote src/fisica nao pode nem
importar este arquivo -- tests/test_arquitetura.py verifica isso.
"""

import numpy as np

R_REFERENCIA_UA = 1.0      # distancia que fica inalterada na compressao
_R_MINIMO = 1e-9           # evita divisao por zero no centro


class EscalaReal:
    """Sem compressao: um UA e sempre um UA. O padrao."""

    chave = "real"
    rotulo = "Distâncias reais"
    descricao = "As distâncias na tela são proporcionais às distâncias de verdade."
    comprime = False

    def aplicar(self, xy_ua, origem=None):
        return np.asarray(xy_ua, dtype=float)


class EscalaRaiz:
    """Comprime o raio pela raiz quadrada, preservando o angulo.

        r_desenhado = R_ref * sqrt(r_real / R_ref)

    O angulo nao muda, entao a posicao angular dos planetas continua correta:
    se Marte esta em oposicao, ele aparece em oposicao. O que muda e so o
    quanto ele parece longe.

    Com R_ref = 1 UA: Mercurio 0,39 -> 0,62 e Netuno 30,1 -> 5,5. A razao
    entre o mais longe e o mais perto cai de 77:1 para 8,8:1, e os oito
    planetas cabem na mesma tela com folga visivel entre eles.
    """

    chave = "raiz"
    rotulo = "Distâncias comprimidas (raiz quadrada)"
    descricao = ("Os planetas distantes são aproximados para caberem juntos. "
                 "A simulação continua usando as distâncias reais.")
    comprime = True

    def __init__(self, r_referencia=R_REFERENCIA_UA):
        self.r_referencia = float(r_referencia)

    def aplicar(self, xy_ua, origem=None):
        """xy_ua: (N,D) ou (D,), D=2 ou 3. `origem` e o centro radial,
        medido -- o Sol, nao a origem do referencial, que e o baricentro."""
        p = np.asarray(xy_ua, dtype=float)
        unico = p.ndim == 1
        p = np.atleast_2d(p)

        o = (np.zeros(p.shape[1]) if origem is None
             else np.asarray(origem, dtype=float)[:p.shape[1]])
        d = p - o
        r = np.linalg.norm(d, axis=1)

        fator = np.ones_like(r)
        vale = r > _R_MINIMO
        r_novo = self.r_referencia * np.sqrt(r[vale] / self.r_referencia)
        fator[vale] = r_novo / r[vale]

        resultado = o + d * fator[:, None]
        return resultado[0] if unico else resultado

    def raio(self, r_ua):
        """Converte uma distancia solta (para a grade de aneis rotulados)."""
        r = np.asarray(r_ua, dtype=float)
        return self.r_referencia * np.sqrt(np.maximum(r, 0.0) / self.r_referencia)


ESCALAS = {e.chave: e for e in (EscalaReal(), EscalaRaiz())}
PADRAO = "real"
