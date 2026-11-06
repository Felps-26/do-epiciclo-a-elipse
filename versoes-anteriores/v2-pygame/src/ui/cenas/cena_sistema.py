"""
Desenha o Sistema Solar: grade, caminhos previstos, rastros, corpos e nomes.

Onde a escala visual entra: em UM lugar so, `_para_tela`, logo antes da
camera. Nada do que sai daqui volta para o estado fisico -- quem quiser o
numero de verdade pergunta ao EstadoSistema, nao a tela.

Sobre o tamanho dos discos: desenhar no tamanho real deixaria a Terra com
0,0001 pixel na visao geral. Entao o raio desenhado e uma funcao suave do raio
real, com um minimo que mantem o corpo clicavel. A Ajuda e as fichas explicam
que os tamanhos estao ampliados -- e ha uma opcao para ver o
tamanho real e constatar que os planetas somem.
"""

import math
import random

import numpy as np
import pygame

from src.dados.textos import ABREVIACOES
from src.fisica.efemerides import elipse_osculadora
from src.projecao.camera import Camera2D
from src.projecao.rotulos import Candidato, PosicionadorRotulos
from src.ui import desenho
from src.ui import formato as fmt

# Raio desenhado = RAIO_BASE * (raio_real / raio_da_terra) ** EXPOENTE
# O expoente comprime a diferenca entre Jupiter e Mercurio, que na realidade e
# de 29 vezes, para algo que cabe na tela sem sumir nem dominar.
RAIO_BASE_PX = 5.0
EXPOENTE_RAIO = 0.38
RAIO_MIN_PX = 3.0
RAIO_MAX_PX = 16.0
RAIO_SOL_PX = 11.0

ANEIS_UA = (1, 5, 10, 20, 30)
RAIO_TERRA_KM = 6371.0


class CenaSistema:
    def __init__(self, corpos, tema):
        self.corpos = corpos
        self.tema = tema
        self.posicionador = PosicionadorRotulos()
        self._rotulos = []
        self._pontos_tela = np.zeros((len(corpos), 2))
        self._raios_px = np.zeros(len(corpos))
        rng = random.Random(20260101)
        self.estrelas = tuple((rng.random(), rng.random(), rng.randrange(38, 76))
                             for _ in range(180))

    # -- conversoes --------------------------------------------------------

    def _para_tela(self, pos_ua, camera, escala_visual, sol_ua):
        """O unico ponto onde a escala visual e aplicada."""
        xy = np.atleast_2d(np.asarray(pos_ua, dtype=float))[:, :2]
        if escala_visual.comprime:
            xy = escala_visual.aplicar(xy, origem=sol_ua[:2])
        return camera.mundo_para_tela(xy)

    def raio_desenhado(self, i, tamanho_real=False, camera=None):
        corpo = self.corpos[i]
        if tamanho_real and camera is not None:
            return max(0.5, corpo.raio_ua * camera.px_por_ua)
        if corpo.chave == "sol":
            return RAIO_SOL_PX
        rel = corpo.raio_km / RAIO_TERRA_KM
        return float(np.clip(RAIO_BASE_PX * rel ** EXPOENTE_RAIO,
                             RAIO_MIN_PX, RAIO_MAX_PX))

    def ampliacao(self, i, camera):
        """Quantas vezes o disco esta maior que o tamanho real, para avisar."""
        real = self.corpos[i].raio_ua * camera.px_por_ua
        return self.raio_desenhado(i) / real if real > 1e-12 else float("inf")

    def corpo_em(self, pos_px, alcance_extra=4):
        """Qual corpo foi clicado. Alvo minimo generoso: Mercurio tem 3 px de
        disco e precisa continuar clicavel."""
        melhor, melhor_d = None, 1e18
        for i in range(len(self.corpos)):
            alvo = max(self._raios_px[i] + alcance_extra, 16.0)
            d = float(np.hypot(*(np.array(pos_px) - self._pontos_tela[i])))
            if d <= alvo and d < melhor_d:
                melhor, melhor_d = i, d
        return melhor

    def rotulo_em(self, pos_px):
        for r in self._rotulos:
            if r.modo != "ponto" and r.rect.collidepoint(pos_px):
                return r.chave
        return None

    # -- desenho -----------------------------------------------------------

    def desenhar(self, tela, ctx, estado, camera, escala_visual, opcoes,
                 selecionado=None, acompanhado=None, trilhas=None,
                 obstaculos=(), comparando=None):
        t = self.tema
        quadro = camera.quadro
        antigo = tela.get_clip()
        tela.set_clip(quadro)

        if opcoes.get("estrelas", False):
            for x, y, brilho in self.estrelas:
                tela.set_at((quadro.x + int(x * quadro.width),
                             quadro.y + int(y * quadro.height)),
                            (brilho, brilho, min(100, brilho + 12)))

        sol_ua = estado.pos[0]
        pontos = self._para_tela(estado.pos, camera, escala_visual, sol_ua)
        self._pontos_tela = pontos
        self._raios_px = np.array([
            self.raio_desenhado(i, opcoes.get("tamanho_real"), camera)
            for i in range(len(self.corpos))])

        if opcoes.get("grade", True):
            self._grade(tela, ctx, camera, escala_visual, sol_ua)
        if opcoes.get("orbitas", True):
            self._orbitas(tela, estado, camera, escala_visual, sol_ua, selecionado)
        if opcoes.get("trilhas", True) and trilhas is not None:
            self._trilhas(tela, trilhas, camera, escala_visual, sol_ua)

        self._corpos(tela, pontos, selecionado, acompanhado)

        if opcoes.get("rotulos", True):
            self._nomes(tela, ctx, pontos, quadro, selecionado, acompanhado,
                        obstaculos, comparando)
        else:
            self._rotulos = []

        for letra, i, cor in (("A", selecionado, t.acento),
                              ("B", comparando, t.aviso)):
            if i is not None and i > 0:
                raio = self._raios_px[i]
                desenho.anel(tela, pontos[i], cor, raio + 5, 2)
                x, y = pontos[i]
                y += raio + (20 if letra == "B" and comparando == selecionado else 5)
                ctx.tipo.desenhar(tela, letra, x, y, t.texto, "pequeno", "centro")
        tela.set_clip(antigo)

    def _grade(self, tela, ctx, camera, escala_visual, sol_ua):
        """Aneis de distancia. Com a escala comprimida eles ficam visivelmente
        desiguais, o que por si so mostra que a escala mudou."""
        centro = camera.mundo_para_tela(
            escala_visual.aplicar(np.atleast_2d(sol_ua[:2]), origem=sol_ua[:2])[0]
            if escala_visual.comprime else sol_ua[:2])
        for ua in ANEIS_UA:
            r_desenho = escala_visual.raio(ua) if escala_visual.comprime else ua
            raio_px = r_desenho * camera.px_por_ua
            if raio_px < 18 or raio_px > 6000:
                continue
            desenho.anel(tela, centro, self.tema.grade, raio_px, 1)
            rotulo = f"{ua} UA"
            ctx.tipo.desenhar(tela, rotulo, centro[0] + raio_px * 0.7071 + 4,
                              centro[1] - raio_px * 0.7071 - 4,
                              self.tema.grade, "micro")

    def _orbitas(self, tela, estado, camera, escala_visual, sol_ua, selecionado):
        for i, corpo in enumerate(self.corpos):
            if corpo.chave == "sol":
                continue
            pontos_ua = elipse_osculadora(estado, i, n_pontos=180)
            if len(pontos_ua) == 0:
                continue
            px = self._para_tela(pontos_ua, camera, escala_visual, sol_ua)
            destacada = selecionado == i
            desenho.curva(tela, px,
                          self.tema.cor_da_orbita(corpo.chave, destacada),
                          fechada=True)

    def _trilhas(self, tela, trilhas, camera, escala_visual, sol_ua):
        for i, corpo in enumerate(self.corpos):
            pts = trilhas.pontos(i)
            if len(pts) < 2:
                continue
            px = self._para_tela(pts, camera, escala_visual, sol_ua)
            desenho.curva(tela, px, self.tema.cor_da_trilha(corpo.chave))

    def _corpos(self, tela, pontos, selecionado, acompanhado):
        for i, corpo in enumerate(self.corpos):
            cor = self.tema.cor_do_corpo(corpo.chave)
            raio = float(self._raios_px[i])
            halo = int(raio * 3.4) if corpo.chave == "sol" else 0
            contorno = self.tema.texto if selecionado == i else None
            desenho.disco(tela, pontos[i], cor, raio, halo=halo, contorno=contorno)
            if acompanhado == i:
                # Tracejado alem da cor: quem nao distingue as cores ainda ve.
                desenho.anel_tracejado(tela, pontos[i], self.tema.acento,
                                       raio + 9, traços=14, espessura=2)

    def _nomes(self, tela, ctx, pontos, quadro, selecionado, acompanhado,
               obstaculos, comparando=None):
        t = self.tema
        papel = "micro"

        def medir(texto):
            return (ctx.tipo.largura(texto, papel), ctx.tipo.altura(papel))

        candidatos = []
        for i, corpo in enumerate(self.corpos):
            prioridade = float(self._raios_px[i])
            if i == acompanhado:
                prioridade += 1000
            if i in (selecionado, comparando):
                prioridade += 500
            marca = "/".join(letra for letra, idx in (("A", selecionado), ("B", comparando))
                             if idx == i and i > 0)
            prefixo = marca + " · " if marca else ""
            candidatos.append(Candidato(
                chave=corpo.chave, nome=prefixo + corpo.nome,
                abreviacao=prefixo + ABREVIACOES.get(corpo.chave, corpo.nome[:4] + "."),
                ponto=(float(pontos[i][0]), float(pontos[i][1])),
                raio=float(self._raios_px[i]), prioridade=prioridade,
                selecionado=(i in (selecionado, acompanhado, comparando))))

        self._rotulos = self.posicionador.posicionar(
            candidatos, medir, quadro, list(obstaculos))

        for r in self._rotulos:
            cor_corpo = t.cor_do_corpo(r.chave)
            if r.modo == "ponto":
                pygame.draw.circle(tela, cor_corpo,
                                   (int(r.ancora[0]), int(r.ancora[1])), 3)
                continue
            if r.guia:
                pygame.draw.line(tela, t.borda,
                                 (int(r.ancora[0]), int(r.ancora[1])),
                                 r.rect.center, 1)
            fundo = pygame.Surface(r.rect.size, pygame.SRCALPHA)
            fundo.fill((*t.fundo, 170))
            tela.blit(fundo, r.rect.topleft)
            # O nome vai em cor de texto, nunca na cor do planeta: as cores de
            # Marte e Netuno nao alcancam 4,5:1 de contraste como texto.
            ctx.tipo.desenhar(tela, r.texto, r.rect.x + 4,
                              r.rect.centery - ctx.tipo.altura(papel) // 2,
                              t.texto, papel)
            pygame.draw.rect(tela, cor_corpo,
                             (r.rect.x, r.rect.y + 2, 2, r.rect.height - 4))

    # -- barra de escala ---------------------------------------------------

    def barra_escala(self, tela, ctx, camera, escala_visual, x, y, largura_max=220):
        """Regua dizendo quanto vale uma distancia na tela.

        Com a escala comprimida a regua e substituida por um aviso: uma regua
        linear sobre uma escala nao-linear seria uma mentira grafica.
        """
        t = self.tema
        if escala_visual.comprime:
            from src.dados.textos import RODAPE
            ctx.tipo.desenhar(tela, RODAPE["escala_nao_linear"], x, y - 6,
                              t.aviso, "micro")
            return

        melhor = None
        for valor in (0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 20, 50):
            px = valor * camera.px_por_ua
            if 60 <= px <= largura_max:
                melhor = (valor, px)
        if melhor is None:
            valor = max(0.001, 100 / camera.px_por_ua)
            melhor = (valor, valor * camera.px_por_ua)

        valor, comp = melhor
        comp = int(comp)
        pygame.draw.line(tela, t.texto_fraco, (x, y), (x + comp, y), 1)
        pygame.draw.line(tela, t.texto_fraco, (x, y - 4), (x, y + 4), 1)
        pygame.draw.line(tela, t.texto_fraco, (x + comp, y - 4), (x + comp, y + 4), 1)
        rotulo = fmt.ua(valor, 0 if valor >= 1 else 2)
        ctx.tipo.desenhar(tela, rotulo, x + comp + 8,
                          y - ctx.tipo.altura("micro") // 2, t.texto_fraco, "micro")
