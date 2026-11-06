"""
Fontes, medidas de texto e cache de superficies.

Duas coisas resolvidas aqui, ambas medidas neste projeto:

1. `font.render()` custa cerca de 4,4 microssegundos; desenhar uma superficie
   ja pronta custa 0,17. Com umas oitenta strings por quadro a 60 quadros por
   segundo, a diferenca e de 21 ms/s contra 0,8 ms/s. Por isso o cache -- e
   por isso quem formata numero deve arredondar antes, para a string se
   repetir entre quadros e o cache valer de alguma coisa.

2. O tamanho passado para a fonte nao e a altura em pixels. Tamanho 16 devolve
   altura 13 e entrelinha 15. Espacamento vertical sai sempre de
   `entrelinha()`, nunca de um numero solto somado na mao.

Sobre a fonte: a embutida no pygame (freesansbold) so existe em negrito e fica
pesada em tamanho pequeno. Preferimos uma fonte do sistema, com uma cadeia de
alternativas, e caimos na embutida se nada resolver.

Aviso para quem for escrever texto de interface: setas como -> nao existem nem
na fonte do sistema nem na embutida, e sairiam como quadradinho. Acentos do
portugues, x de multiplicacao, grau e reticencias existem nas duas.
"""

import pygame

FAMILIAS = ["Helvetica Neue", "Helvetica", "Arial", "Segoe UI",
            "DejaVu Sans", "Liberation Sans", "Verdana"]

# papel -> tamanho base em pixels logicos
PAPEIS = {
    "micro": 13,
    "pequeno": 15,
    "corpo": 17,
    "dado": 19,
    "titulo": 22,
    "titulo_grande": 28,
}


class Tipografia:
    """Fornece fontes por papel e desenha texto com cache."""

    def __init__(self, escala=1.0):
        self.escala = float(escala)
        self._fontes = {}
        self._cache = {}
        self._larguras = {}
        self._carregar()

    # Caractere de uso privado: nenhuma fonte real tem glifo para ele, entao o
    # que a fonte desenha nele e o simbolo de "faltou". Serve de gabarito.
    _AUSENTE = "\uE000"
    _EXIGIDOS = "çãõáéíóúâêôàü"

    @classmethod
    def _tem_acentos(cls, fonte):
        """Verifica se a fonte tem os acentos do portugues de verdade.

        Comparar a LARGURA de "ação" com a de "acao" nao funciona -- as duas
        podem coincidir por acaso. O que funciona e comparar os pixels de cada
        acentuado com os do caractere que a fonte usa quando falta o glifo.
        """
        try:
            ausente = pygame.image.tobytes(
                fonte.render(cls._AUSENTE, True, (255, 255, 255)), "RGBA")
            for ch in cls._EXIGIDOS:
                img = fonte.render(ch, True, (255, 255, 255))
                if pygame.image.tobytes(img, "RGBA") == ausente:
                    return False
            return True
        except Exception:                                  # noqa: BLE001
            return False

    def _carregar(self):
        self._fontes.clear()
        for papel, base in PAPEIS.items():
            tam = max(10, int(round(base * self.escala)))
            fonte = None
            try:
                candidata = pygame.font.SysFont(FAMILIAS, tam)
                if candidata and self._tem_acentos(candidata):
                    fonte = candidata
            except Exception:                              # noqa: BLE001
                fonte = None
            # A embutida do pygame tambem cobre o portugues; so e mais feia.
            self._fontes[papel] = fonte or pygame.font.Font(None, tam)

    def definir_escala(self, escala):
        """Usado pela opcao "Texto maior". Recarrega tudo e limpa o cache."""
        if abs(escala - self.escala) < 1e-9:
            return
        self.escala = float(escala)
        self._cache.clear()
        self._larguras.clear()
        self._carregar()

    def fonte(self, papel="corpo"):
        return self._fontes[papel]

    def altura(self, papel="corpo"):
        return self._fontes[papel].get_height()

    def entrelinha(self, papel="corpo"):
        """Espacamento correto entre linhas deste papel."""
        return self._fontes[papel].get_linesize()

    def largura(self, texto, papel="corpo"):
        chave = (texto, papel)
        if chave not in self._larguras:
            if len(self._larguras) > 4096:
                self._larguras.clear()
            self._larguras[chave] = self._fontes[papel].size(texto)[0]
        return self._larguras[chave]

    def tamanho(self, texto, papel="corpo"):
        return self._fontes[papel].size(texto)

    # -- desenho -----------------------------------------------------------

    def superficie(self, texto, papel="corpo", cor=(255, 255, 255)):
        chave = (texto, papel, cor)
        s = self._cache.get(chave)
        if s is None:
            if len(self._cache) > 1024:
                self._cache.clear()
            s = self._fontes[papel].render(texto, True, cor)
            self._cache[chave] = s
        return s

    def desenhar(self, tela, texto, x, y, cor, papel="corpo", ancora="esquerda"):
        """Desenha e devolve o retangulo ocupado.

        `ancora` aceita esquerda, direita e centro. Ter isso aqui evita o
        padrao de calcular largura na mao em cada chamada, que e onde nascem
        os textos que passam por cima um do outro.
        """
        s = self.superficie(texto, papel, cor)
        if ancora == "direita":
            x -= s.get_width()
        elif ancora == "centro":
            x -= s.get_width() // 2
        tela.blit(s, (int(x), int(y)))
        return pygame.Rect(int(x), int(y), s.get_width(), s.get_height())

    # -- ajuste a largura disponivel --------------------------------------

    def encurtar(self, texto, papel, largura_max):
        """Corta o texto com reticencias ate caber. Nunca devolve texto que
        estoura o espaco -- e a garantia de que nada aparece cortado na tela."""
        if self.largura(texto, papel) <= largura_max:
            return texto
        retic = "…"
        if self.largura(retic, papel) > largura_max:
            return ""
        baixo, alto = 0, len(texto)
        while baixo < alto:
            meio = (baixo + alto + 1) // 2
            if self.largura(texto[:meio] + retic, papel) <= largura_max:
                baixo = meio
            else:
                alto = meio - 1
        return texto[:baixo].rstrip() + retic

    def quebrar(self, texto, papel, largura_max):
        """Quebra texto sem descartar caracteres, inclusive URLs nas fontes."""
        linhas = []
        for paragrafo in texto.split("\n"):
            if not paragrafo.strip():
                linhas.append("")
                continue
            atual = ""
            for palavra in paragrafo.split():
                tentativa = f"{atual} {palavra}".strip()
                if self.largura(tentativa, papel) <= largura_max:
                    atual = tentativa
                    continue
                if atual:
                    linhas.append(atual)
                while self.largura(palavra, papel) > largura_max and len(palavra) > 1:
                    baixo, alto = 1, len(palavra)
                    while baixo < alto:
                        meio = (baixo + alto + 1) // 2
                        if self.largura(palavra[:meio], papel) <= largura_max:
                            baixo = meio
                        else:
                            alto = meio - 1
                    linhas.append(palavra[:baixo])
                    palavra = palavra[baixo:]
                atual = palavra
            if atual:
                linhas.append(atual)
        return linhas

    def altura_do_bloco(self, texto, papel, largura_max):
        """Quanto espaco vertical o texto vai ocupar. Medido ANTES de desenhar,
        para o painel crescer ou rolar em vez de vazar."""
        return len(self.quebrar(texto, papel, largura_max)) * self.entrelinha(papel)

    def desenhar_bloco(self, tela, texto, x, y, largura_max, cor, papel="corpo"):
        entre = self.entrelinha(papel)
        for i, linha in enumerate(self.quebrar(texto, papel, largura_max)):
            if linha:
                self.desenhar(tela, linha, x, y + i * entre, cor, papel)
        return y + len(self.quebrar(texto, papel, largura_max)) * entre
