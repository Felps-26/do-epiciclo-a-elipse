"""
Camera: a ponte entre o mundo em UA e a tela em pixels.

Aqui, e so aqui, o estado em tres dimensoes vira duas. A reducao e uma linha:

    xy = pos[:, :2]

ou seja, a tela mostra a projecao no plano da ecliptica e ignora z. A
coordenada z continua existindo no estado e continua influenciando a fisica.
Camera3D, em camera3d.py, reutiliza os controles e projeta uma base espacial.

Uma diferenca de projeto em relacao a versao anterior: a camera guarda
`px_por_ua` direto, em vez de um par `escala x zoom`. Com o par, "zoom 1,0"
significava coisas diferentes dependendo do planeta escolhido, e trocar de
alvo exigia reenquadrar. Com um numero so, nao ha ambiguidade.
"""

import math
from collections import namedtuple

import numpy as np

# A camera so precisa de x, y, largura e altura. Um pygame.Rect serve, e este
# namedtuple tambem -- e por isso que os testes da camera rodam sem abrir
# janela e sem importar pygame.
Quadro = namedtuple("Quadro", "x y width height")

# Limites de campo de visao, em UA de raio. Sao o que dita o zoom possivel.
RAIO_MAX_UA = 60.0      # afastar alem disso so mostra vazio
RAIO_MIN_UA = 0.001     # aproximar alem disso passa do tamanho dos planetas

# Alem deste valor absoluto em pixels, a coordenada e cortada. Motivo: com a
# camera colada em Mercurio, Netuno cai a milhoes de pixels do centro, e
# algumas primitivas do pygame ficam lentas ou estouram ao converter para int.
LIMITE_PX = 20000.0

# Duracao da transicao entre enquadramentos. Passado esse tempo a camera trava
# no alvo, em vez de ficar se aproximando para sempre.
DURACAO_TRANSICAO_S = 0.45


class Camera2D:
    """Converte (x,y,z) em UA para (x,y) em pixels, e de volta."""

    def __init__(self, quadro, centro_ua=(0.0, 0.0), raio_ua=32.0):
        self.quadro = quadro                       # retangulo de desenho
        self.centro_ua = np.array(centro_ua[:2], dtype=float)
        self.px_por_ua = 1.0
        self._alvo_centro = self.centro_ua.copy()
        self._alvo_px_por_ua = None
        self.seguindo = None                       # indice do corpo acompanhado
        self._travado = False                      # ja alcancou o corpo seguido
        self._transicao = 0.0                      # segundos restantes de animacao
        self.enquadrar(raio_ua, animado=False)

    # -- geometria do quadro ----------------------------------------------

    @property
    def _meia_extensao_px(self):
        return min(self.quadro.width, self.quadro.height) / 2.0

    @property
    def raio_visivel_ua(self):
        """Metade do menor lado do quadro, em UA. O 'campo de visao'."""
        return self._meia_extensao_px / self.px_por_ua

    def _limites_escala(self):
        m = self._meia_extensao_px
        return m / RAIO_MAX_UA, m / RAIO_MIN_UA

    def definir_quadro(self, quadro):
        """Chamado quando a janela muda de tamanho. Preserva o campo de visao.

        Ajusta px_por_ua na mao em vez de chamar enquadrar(): enquadrar aplica
        uma folga de borda, e passar por ele a cada redimensionamento faria a
        vista abrir 6% de cada vez, acumulando.
        """
        raio = self.raio_visivel_ua
        self.quadro = quadro
        lo, hi = self._limites_escala()
        self.px_por_ua = min(max(self._meia_extensao_px / raio, lo), hi)
        self._alvo_px_por_ua = None

    # -- conversoes --------------------------------------------------------

    def mundo_para_tela(self, pos_ua):
        """(N,3) ou (N,2) ou (2,)/(3,) em UA -> (N,2) em pixels, float.

        Devolve float de proposito: quem desenha faz o int() no ultimo
        instante, depois de tratar valores nao finitos. int(inf) levanta
        OverflowError, e era assim que a versao anterior quebrava.
        """
        p = np.asarray(pos_ua, dtype=float)
        unico = p.ndim == 1
        p = np.atleast_2d(p)[:, :2]                # <- a projecao 3D -> 2D

        k = self.px_por_ua
        cx = self.quadro.x + self.quadro.width / 2.0
        cy = self.quadro.y + self.quadro.height / 2.0

        saida = np.empty((len(p), 2))
        saida[:, 0] = cx + (p[:, 0] - self.centro_ua[0]) * k
        saida[:, 1] = cy - (p[:, 1] - self.centro_ua[1]) * k   # y da tela cresce para baixo
        return saida[0] if unico else saida

    def tela_para_mundo(self, ponto_px):
        """Pixel -> UA, no plano da ecliptica. Inversa exata de mundo_para_tela."""
        k = self.px_por_ua
        cx = self.quadro.x + self.quadro.width / 2.0
        cy = self.quadro.y + self.quadro.height / 2.0
        return np.array([self.centro_ua[0] + (ponto_px[0] - cx) / k,
                         self.centro_ua[1] + (cy - ponto_px[1]) / k])

    @staticmethod
    def sanear(pontos_px):
        """Deixa as coordenadas seguras para o pygame: sem NaN, sem infinito,
        sem magnitude absurda. Devolve inteiros prontos para desenhar."""
        p = np.nan_to_num(np.asarray(pontos_px, dtype=float),
                          nan=0.0, posinf=LIMITE_PX, neginf=-LIMITE_PX)
        return np.clip(p, -LIMITE_PX, LIMITE_PX)

    # -- controles ---------------------------------------------------------

    def enquadrar(self, raio_ua, folga=0.06, animado=True):
        """Ajusta o zoom para caber um circulo de `raio_ua` no quadro."""
        raio_ua = max(RAIO_MIN_UA, float(raio_ua))
        escala = self._meia_extensao_px / (raio_ua * (1.0 + folga))
        lo, hi = self._limites_escala()
        escala = min(max(escala, lo), hi)
        if animado:
            self._alvo_px_por_ua = escala
            self._transicao = DURACAO_TRANSICAO_S
        else:
            self.px_por_ua = escala
            self._alvo_px_por_ua = None

    def aplicar_zoom(self, fator, ancora_px=None):
        """Zoom mantendo imovel o ponto do mundo sob o cursor.

        Sem essa ancora, qualquer zoom puxaria a vista para o centro do quadro
        e a sensacao seria de que o mapa foge do cursor.
        """
        if ancora_px is None:
            ancora_px = (self.quadro.x + self.quadro.width / 2.0,
                         self.quadro.y + self.quadro.height / 2.0)
        antes = self.tela_para_mundo(ancora_px)

        lo, hi = self._limites_escala()
        nova = min(max(self.px_por_ua * fator, lo), hi)
        if nova == self.px_por_ua:
            return
        self.px_por_ua = nova
        self._alvo_px_por_ua = None

        depois = self.tela_para_mundo(ancora_px)
        self.centro_ua += antes - depois
        self._alvo_centro = self.centro_ua.copy()

    def arrastar(self, dx_px, dy_px):
        """Move a vista junto com o mouse. Cancela o acompanhamento."""
        self.seguindo = None
        self._travado = False
        self.centro_ua[0] -= dx_px / self.px_por_ua
        self.centro_ua[1] += dy_px / self.px_por_ua
        self._alvo_centro = self.centro_ua.copy()

    def ir_para(self, centro_ua, animado=True):
        self._travado = False
        alvo = np.asarray(centro_ua, dtype=float)[:self.centro_ua.size]
        if animado:
            self._alvo_centro = alvo
            self._transicao = DURACAO_TRANSICAO_S
        else:
            self.centro_ua = alvo.copy()
            self._alvo_centro = alvo.copy()

    def seguir(self, indice):
        """Acompanha um corpo. None solta a camera."""
        if indice != self.seguindo:
            self._travado = False
        self.seguindo = indice
        if indice is None:
            self._travado = False

    def atualizar(self, dt_s, posicoes_ua=None, suave=True):
        """Aproxima a camera dos alvos. Chamado uma vez por quadro.

        Usa aproximacao exponencial, que chega perto rapido e desacelera no
        fim -- e o que faz a transicao entre "sistema completo" e "planetas
        internos" parecer um movimento e nao um corte.
        """
        if self.seguindo is not None and posicoes_ua is not None:
            self._alvo_centro = np.asarray(posicoes_ua[self.seguindo], dtype=float)[:self.centro_ua.size]
            if self._travado:
                self.centro_ua = self._alvo_centro.copy()

        if not suave or self._transicao <= 0.0:
            self._encerrar_transicao()
            return

        # Por que a transicao tem PRAZO, e nao so um criterio de proximidade:
        #
        # um amortecimento exponencial nunca alcanca um alvo em movimento. Ele
        # estabiliza a uma distancia proporcional a velocidade do alvo --
        # medimos 11 pixels com Marte a 30 dias por segundo e 237 a 3650. Pior:
        # durante a aproximacao o zoom cresce na mesma taxa em que o erro
        # diminui, entao o erro EM PIXELS nem chega a encolher. O planeta
        # "acompanhado" ficava permanentemente fora do centro.
        #
        # Com prazo fixo, a entrada no modo continua suave e, terminado o
        # prazo, a camera gruda no corpo e ele fica parado no centro.
        self._transicao = max(0.0, self._transicao - dt_s)
        if self._transicao <= 0.0:
            self._encerrar_transicao()
            return

        peso = 1.0 - math.exp(-dt_s / 0.16)        # ~constante de tempo de 0,16 s
        self.centro_ua += (self._alvo_centro - self.centro_ua) * peso

        if self._alvo_px_por_ua is not None:
            # Interpola o LOGARITMO da escala. Interpolando linearmente, uma
            # transicao de 30 UA para 0,4 UA passaria quase todo o tempo ainda
            # afastada e depois saltaria -- parece defeito, nao movimento.
            atual, alvo = math.log(self.px_por_ua), math.log(self._alvo_px_por_ua)
            self.px_por_ua = math.exp(atual + (alvo - atual) * peso)

    def _encerrar_transicao(self):
        """Assenta a camera exatamente no alvo e trava, se estiver seguindo."""
        self._transicao = 0.0
        self.centro_ua = self._alvo_centro.copy()
        if self._alvo_px_por_ua is not None:
            self.px_por_ua = self._alvo_px_por_ua
            self._alvo_px_por_ua = None
        self._travado = self.seguindo is not None

    @property
    def em_transicao(self):
        return self._transicao > 0.0
