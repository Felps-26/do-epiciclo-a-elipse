"""
Paleta e papeis de cor, com o contraste conferido por codigo.

A regra da WCAG 2.2 para contraste minimo pede 4,5:1 entre texto e fundo, e
3:1 para elementos graficos e texto grande. A funcao `contraste` abaixo
implementa a formula oficial, e tests/test_tema.py roda sobre todos os pares
que a interface realmente usa. Cor bonita que reprova nao entra.

Uma regra que saiu dessa conferencia e vale destacar:

    COR DE PLANETA NAO E COR DE TEXTO.

As cores de Marte (4,5:1) e Netuno (4,3:1) passam folgado como disco e como
linha de orbita, mas reprovam como texto. Entao o nome do planeta e escrito
sempre em `texto` (16:1), ao lado de um ponto na cor dele. De quebra isso
resolve o requisito de nao transmitir informacao so por cor: ha o ponto, ha o
nome escrito, e ha a posicao.
"""


def _canal(v):
    v = v / 255.0
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def luminancia(cor):
    """Luminancia relativa, conforme a definicao da WCAG."""
    r, g, b = cor[:3]
    return 0.2126 * _canal(r) + 0.7152 * _canal(g) + 0.0722 * _canal(b)


def contraste(a, b):
    """Razao de contraste entre duas cores. Vai de 1:1 a 21:1."""
    la, lb = luminancia(a), luminancia(b)
    claro, escuro = max(la, lb), min(la, lb)
    return (claro + 0.05) / (escuro + 0.05)


def escurecer(cor, fator):
    return tuple(max(0, min(255, int(c * fator))) for c in cor[:3])


def misturar(a, b, t):
    """Interpola entre duas cores. t = 0 devolve a, t = 1 devolve b."""
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


class Tema:
    """Cores por papel, nao por aparencia.

    Os nomes dizem para que serve, nao qual e a cor. Trocar a paleta inteira e
    mexer so aqui.
    """

    # -- superficies -------------------------------------------------------
    fundo = (12, 14, 22)            # o espaco
    painel = (18, 21, 32)           # barras e paineis
    painel_alto = (26, 30, 44)      # cartoes sobre painel, campos, hover
    sobreposicao = (6, 8, 14)       # escurecimento atras de um modal

    # -- texto -------------------------------------------------------------
    texto = (232, 234, 240)         # 16,0:1 no fundo
    texto_fraco = (152, 159, 178)   # 7,3:1 -- passa AA com folga
    texto_apagado = (120, 140, 180)  # 5,7:1 -- so para rotulos secundarios

    # -- linhas ------------------------------------------------------------
    borda = (58, 66, 88)            # decorativa; nao carrega informacao
    separador = (120, 140, 180)     # quando a linha significa alguma coisa
    grade = (40, 46, 64)            # aneis de distancia no fundo

    # -- estados -----------------------------------------------------------
    acento = (124, 174, 255)        # 8,6:1 -- selecao, controle ativo
    foco = (140, 190, 255)          # 10,0:1 -- anel de foco do teclado
    aviso = (255, 196, 92)          # 12,2:1 -- "nao esta acompanhando"
    sucesso = (120, 214, 160)       # 10,9:1

    # -- cor por corpo -----------------------------------------------------
    # Todas conferidas com no minimo 3:1 contra fundo e painel, que e o limite
    # da WCAG para elemento grafico. Usadas so em disco, orbita e trilha.
    corpos = {
        "sol":      (255, 199, 61),
        "mercurio": (181, 165, 142),
        "venus":    (235, 168, 92),
        "terra":    (96, 154, 245),
        "marte":    (208, 88, 72),
        "jupiter":  (206, 156, 112),
        "saturno":  (222, 199, 137),
        "urano":    (137, 214, 224),
        "netuno":   (76, 118, 217),
    }

    def cor_do_corpo(self, chave):
        return self.corpos.get(chave, self.texto_fraco)

    def cor_da_trilha(self, chave):
        """Trilha mais discreta que o disco, para nao competir com ele."""
        return misturar(self.fundo, self.cor_do_corpo(chave), 0.55)

    def cor_da_orbita(self, chave, destacada=False):
        return misturar(self.fundo, self.cor_do_corpo(chave),
                        0.55 if destacada else 0.30)


TEMA = Tema()

# Pares (frente, fundo) que a interface usa de verdade, com o limite exigido.
# tests/test_tema.py percorre esta lista. Quem adicionar cor nova adiciona
# aqui tambem, senao a conferencia nao cobre.
PARES_PARA_CONFERIR = [
    ("texto sobre fundo", TEMA.texto, TEMA.fundo, 4.5),
    ("texto sobre painel", TEMA.texto, TEMA.painel, 4.5),
    ("texto sobre painel alto", TEMA.texto, TEMA.painel_alto, 4.5),
    ("texto fraco sobre fundo", TEMA.texto_fraco, TEMA.fundo, 4.5),
    ("texto fraco sobre painel", TEMA.texto_fraco, TEMA.painel, 4.5),
    ("texto fraco sobre painel alto", TEMA.texto_fraco, TEMA.painel_alto, 4.5),
    ("texto apagado sobre fundo", TEMA.texto_apagado, TEMA.fundo, 4.5),
    ("texto apagado sobre painel", TEMA.texto_apagado, TEMA.painel, 4.5),
    ("acento sobre fundo", TEMA.acento, TEMA.fundo, 4.5),
    ("acento sobre painel", TEMA.acento, TEMA.painel, 4.5),
    ("acento sobre painel alto", TEMA.acento, TEMA.painel_alto, 4.5),
    ("aviso sobre fundo", TEMA.aviso, TEMA.fundo, 4.5),
    ("aviso sobre painel", TEMA.aviso, TEMA.painel, 4.5),
    ("sucesso sobre painel", TEMA.sucesso, TEMA.painel, 4.5),
    ("anel de foco sobre fundo", TEMA.foco, TEMA.fundo, 3.0),
    ("anel de foco sobre painel", TEMA.foco, TEMA.painel, 3.0),
    ("anel de foco sobre painel alto", TEMA.foco, TEMA.painel_alto, 3.0),
    ("separador sobre painel", TEMA.separador, TEMA.painel, 3.0),
] + [
    (f"disco de {k} sobre fundo", c, TEMA.fundo, 3.0)
    for k, c in TEMA.corpos.items()
] + [
    (f"ponto de {k} sobre painel", c, TEMA.painel, 3.0)
    for k, c in TEMA.corpos.items()
]
