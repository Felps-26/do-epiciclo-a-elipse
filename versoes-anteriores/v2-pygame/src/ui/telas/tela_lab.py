"""
Laboratório: como uma soma de ondas redesenha a elipse de um planeta.

Por que é uma tela separada e não um painel na visão geral:

  - Responde outra pergunta. A tela principal é "como o Sistema Solar se
    move"; aqui a pergunta é "como se reconstrói uma curva somando senos".
  - O relógio é outro. A simulação corre em dias; aqui o que corre é a fração
    da órbita. Juntar os dois na mesma tela exigiria dois relógios visíveis,
    o que confunde mais do que ensina.
  - Quem abriu o programa para ver os planetas não precisa de um gráfico de
    convergência em escala logarítmica na primeira tela.

O que liga as duas telas: a elipse daqui não vem de tabela nenhuma. Ela é
calculada a partir do estado da simulação no instante em que o laboratório é
aberto, e o cabeçalho diz qual é esse instante.
"""

import math

import pygame

from src.app.acoes import AbrirTela, Fechar, MudarVelocidade
from src.fisica.efemerides import elementos_osculadores
from src.fisica.fourier import PISO_RESIDUO_UA, TERMOS_INICIAL, SerieFourier
from src.fisica.kepler import OrbitaKepler
from src.projecao.camera import Camera2D, Quadro
from src.ui import desenho
from src.ui import formato as fmt
from src.ui.widgets.base import Container
from src.ui.widgets.botao import Botao, Rotulo

COR_KEPLER = (86, 200, 133)
COR_FOURIER = (236, 110, 132)
COR_DESVIO = (255, 226, 138)
RESIDUO_ALVO_PX = 60


class TelaLab:
    """Estado e desenho do laboratório. Não mexe na simulação."""

    def __init__(self, tema):
        self.tema = tema
        self.chave = None
        self.nome = ""
        self.data = ""
        self.orbita = None
        self.serie = None
        self.n = TERMOS_INICIAL
        self.t = 0.0
        self.tocando = True
        self.amplificar = False
        self.marcas = None
        self.raiz = Container("lab_raiz")
        self._cam = None

    # -- entrada e saída ---------------------------------------------------

    def carregar(self, indice, chave, nome, estado, data_texto):
        """Prepara a elipse a partir do estado atual da simulação."""
        el = elementos_osculadores(estado, indice)
        self.chave = chave
        self.nome = nome
        self.orbita = OrbitaKepler.de_elementos(el, nome)
        self.serie = SerieFourier(self.orbita.curva())
        self.marcas = self.orbita.curva(16)
        self.data = data_texto
        self.t = 0.0
        self.convergencia = self.serie.convergencia()
        self.n_piso = self.serie.harmonicos_ate_o_piso()

    def mudar_termos(self, d):
        novo = int(max(0, min(self.serie.termos_max, self.n + d)))
        mudou = novo != self.n
        self.n = novo
        return mudou

    def avancar(self, dt_s):
        if self.tocando and self.orbita:
            self.t = (self.t + dt_s / 6.0) % 1.0

    # -- construção dos controles -----------------------------------------

    def montar(self, ctx, areas):
        m = areas.metricas
        t = areas.topo
        y = t.y + (t.height - m.alvo_primario) // 2
        x = m.u * 2
        self.raiz.itens = []

        def coloca(w, largura=None):
            nonlocal x
            lw = largura or w.medir(ctx)[0]
            w.dispor(pygame.Rect(x, y, lw, m.alvo_primario))
            self.raiz.itens.append(w)
            x += lw + m.u

        coloca(Botao("lab_voltar", "Voltar ao Sistema Solar", Fechar(),
                     primario=True))
        coloca(Botao("lab_menos", "−", AbrirTela("lab_menos"),
                     dica="Uma onda a menos"), m.px(44))
        rot = Rotulo("lab_n", f"{self.n} onda" + ("s" if self.n != 1 else ""),
                     "pequeno", self.tema.texto, "centro")
        rot.dispor(pygame.Rect(x, y, m.px(110), m.alvo_primario))
        self.raiz.itens.append(rot)
        x += m.px(110) + m.u
        coloca(Botao("lab_mais", "+", AbrirTela("lab_mais"),
                     dica="Uma onda a mais"), m.px(44))
        coloca(Botao("lab_pausa", "Continuar" if not self.tocando else "Pausar",
                     AbrirTela("lab_pausa"), ativo=not self.tocando))
        coloca(Botao("lab_ampliar", "Ampliar a diferença",
                     AbrirTela("lab_ampliar"), ativo=self.amplificar,
                     dica="Estica o desvio para ele ficar visível"))
        return self.raiz

    # -- desenho -----------------------------------------------------------

    def desenhar(self, ctx, areas):
        tela, t, m = ctx.tela, self.tema, areas.metricas
        tela.fill(t.fundo)

        desenho.caixa(tela, areas.topo, t.painel, None)
        pygame.draw.line(tela, t.borda, (areas.topo.x, areas.topo.bottom - 1),
                         (areas.topo.right, areas.topo.bottom - 1))
        desenho.caixa(tela, areas.rodape, t.painel, None)
        if areas.lateral.width:
            desenho.caixa(tela, areas.lateral, t.painel, None)
            pygame.draw.line(tela, t.borda, (areas.lateral.x, areas.lateral.y),
                             (areas.lateral.x, areas.lateral.bottom))

        self.raiz.desenhar(ctx)
        if self.orbita is None:
            return

        self._desenhar_curvas(ctx, areas)
        if areas.lateral.width:
            recorte = tela.get_clip()
            tela.set_clip(areas.lateral)
            self._desenhar_lateral(ctx, areas)
            tela.set_clip(recorte)
        self._desenhar_rodape(ctx, areas)

    def _camera(self, areas):
        q = Quadro(areas.canvas.x, areas.canvas.y,
                   areas.canvas.width, areas.canvas.height)
        cam = Camera2D(q, (0.0, 0.0), self.orbita.r_afelio)
        cam.enquadrar(self.orbita.r_afelio, folga=0.12, animado=False)
        return cam

    def _desenhar_curvas(self, ctx, areas):
        tela = ctx.tela
        cam = self._camera(areas)
        self._cam = cam
        recorte = tela.get_clip()
        tela.set_clip(areas.canvas)

        curva_k = self.orbita.curva()
        desenho.curva(tela, cam.mundo_para_tela(curva_k), COR_KEPLER, fechada=True)

        # Quanto esticar o desvio para ele ficar visível na tela.
        _, err_max = self.serie.erro(self.n)
        no_piso = err_max <= PISO_RESIDUO_UA
        fator = 1.0 if no_piso else max(
            1.0, RESIDUO_ALVO_PX / max(err_max * cam.px_por_ua, 1e-12))
        ampliando = self.amplificar and not no_piso and self.n > 0

        if self.n > 0:
            curva_f = self.serie.curva_reconstruida(self.n)
            if ampliando:
                curva_f = curva_k + fator * (curva_f - curva_k)
            desenho.curva(tela, cam.mundo_para_tela(curva_f), COR_FOURIER,
                          fechada=True)

        for x, y in self.marcas:
            pygame.draw.circle(tela, self.tema.texto_apagado,
                               [int(v) for v in cam.mundo_para_tela((x, y))], 3)

        desenho.disco(tela, cam.mundo_para_tela((0.0, 0.0)), self.tema.corpos["sol"],
                      9, halo=26)

        xk, yk = (float(v) for v in self.orbita.posicao(self.t))
        xf, yf = (float(v) for v in self.serie.posicao(self.t, self.n))
        self._desvio_agora = float(math.hypot(xk - xf, yk - yf))
        if ampliando:
            xf, yf = xk + fator * (xf - xk), yk + fator * (yf - yk)

        desenho.linha(tela, cam.mundo_para_tela((xk, yk)),
                      cam.mundo_para_tela((xf, yf)), COR_DESVIO)
        desenho.disco(tela, cam.mundo_para_tela((xk, yk)),
                      self.tema.cor_do_corpo(self.chave), 7)
        desenho.disco(tela, cam.mundo_para_tela((xf, yf)), COR_FOURIER, 5)

        self._fator = fator
        self._ampliando = ampliando
        self._no_piso = no_piso
        tela.set_clip(recorte)

    def _desenhar_lateral(self, ctx, areas):
        t, m = self.tema, areas.metricas
        r = areas.lateral
        x = r.x + m.px(14)
        largura = r.width - m.px(28)
        y = r.y + m.px(12)

        ctx.tipo.desenhar(ctx.tela, self.nome or "", x, y, t.texto, "titulo")
        y += ctx.tipo.entrelinha("titulo") + m.px(2)
        y = ctx.tipo.desenhar_bloco(
            ctx.tela, f"Elipse calculada a partir da simulação em {self.data}.",
            x, y, largura, t.texto_fraco, "micro") + m.px(10)

        el = (("semieixo maior", fmt.ua(self.orbita.a, 4)),
              ("excentricidade", fmt.numero(self.orbita.e, 5)),
              ("uma volta leva", fmt.periodo_aproximado(self.orbita.periodo_dias)))
        for nome, valor in el:
            ctx.tipo.desenhar(ctx.tela, nome, x, y, t.texto_fraco, "micro")
            ctx.tipo.desenhar(ctx.tela, valor, x + largura, y, t.texto,
                              "pequeno", "direita")
            y += ctx.tipo.entrelinha("pequeno") + m.px(2)
        y += m.px(10)

        med, mx = self.serie.erro(self.n)
        ctx.tipo.desenhar(ctx.tela, f"Somando {self.n} onda"
                          + ("s" if self.n != 1 else ""), x, y, t.texto, "corpo")
        y += ctx.tipo.entrelinha("corpo") + m.px(4)
        if self.n == 0:
            y = ctx.tipo.desenhar_bloco(
                ctx.tela, "Sem nenhuma onda sobra só o ponto médio da órbita.",
                x, y, largura, t.texto_fraco, "micro")
        else:
            for nome, valor in (("desvio médio", fmt.cientifico(med, 2, "UA")),
                                ("desvio máximo", fmt.cientifico(mx, 2, "UA")),
                                ("agora",
                                 fmt.cientifico(self._desvio_agora, 2, "UA"))):
                ctx.tipo.desenhar(ctx.tela, nome, x, y, t.texto_fraco, "micro")
                ctx.tipo.desenhar(ctx.tela, valor, x + largura, y, t.texto,
                                  "pequeno", "direita")
                y += ctx.tipo.entrelinha("pequeno") + m.px(2)
        y += m.px(8)

        if self.amplificar and self._no_piso:
            y = ctx.tipo.desenhar_bloco(
                ctx.tela, "O desvio já é menor que a precisão do computador — "
                          "não há o que ampliar.", x, y, largura, t.aviso, "micro")
        elif self._ampliando:
            ctx.tipo.desenhar(ctx.tela, f"desvio esticado {self._fator:.0f}×",
                              x, y, COR_DESVIO, "pequeno")
            y += ctx.tipo.entrelinha("pequeno") + m.px(2)
            y = ctx.tipo.desenhar_bloco(
                ctx.tela, "A curva rosa mostra a diferença aumentada, não a "
                          "posição calculada.", x, y, largura, t.texto_fraco, "micro")
        y += m.px(10)

        for cor, rotulo in ((COR_KEPLER, "elipse de Kepler"),
                            (COR_FOURIER, f"soma de {self.n} onda"
                             + ("s" if self.n != 1 else "")),
                            (COR_DESVIO, "diferença entre as duas"),
                            (t.texto_apagado, "marcas de tempo igual")):
            pygame.draw.rect(ctx.tela, cor, (x, y + m.px(4), m.px(10), m.px(10)))
            ctx.tipo.desenhar(ctx.tela, rotulo, x + m.px(18), y, t.texto_fraco,
                              "micro")
            y += ctx.tipo.entrelinha("micro") + m.px(5)

        y += m.px(6)
        if y < r.bottom - m.px(160):
            self._grafico(ctx, pygame.Rect(x, y, largura,
                                           min(m.px(150), r.bottom - y - m.px(12))))

    def _grafico(self, ctx, g):
        """Erro contra número de ondas, em escala logarítmica.

        O log é obrigatório: o erro cai de ~0,1 UA para ~1e-16 UA, quinze
        ordens de grandeza. Em escala linear tudo, menos o primeiro ponto,
        seria uma linha colada no eixo.
        """
        t, m = self.tema, ctx.metricas
        desenho.caixa(ctx.tela, g, t.painel_alto, t.borda, 1, raio=m.px(8))
        ctx.tipo.desenhar(ctx.tela, "desvio médio × número de ondas",
                          g.x + m.px(8), g.y + m.px(6), t.texto_fraco, "micro")

        area = pygame.Rect(g.x + m.px(34), g.y + m.px(24),
                           g.width - m.px(44), g.height - m.px(44))
        ns, med, _ = self.convergencia
        piso = math.log10(PISO_RESIDUO_UA)
        vals = [max(math.log10(v), piso) if v > 0 else piso for v in med]
        baixo, alto = piso, max(math.ceil(max(vals)), piso + 1)

        def ponto(n, logv):
            fx = (n - 1) / max(1, len(ns) - 1)
            fy = (logv - baixo) / (alto - baixo)
            return (area.x + fx * area.width, area.bottom - fy * area.height)

        d = baixo
        while d <= alto:
            yy = ponto(1, d)[1]
            pygame.draw.line(ctx.tela, t.borda, (area.x, yy), (area.right, yy))
            ctx.tipo.desenhar(ctx.tela, f"1e{int(d)}", g.x + m.px(4), yy - m.px(7),
                              t.texto_apagado, "micro")
            d += 4

        desenho.curva(ctx.tela, [ponto(n, v) for n, v in zip(ns, vals)], COR_FOURIER)
        if 1 <= self.n <= len(ns):
            p = ponto(self.n, vals[self.n - 1])
            pygame.draw.line(ctx.tela, t.separador, (p[0], area.y), (p[0], area.bottom))
            pygame.draw.circle(ctx.tela, COR_DESVIO, (int(p[0]), int(p[1])), 4)
        ctx.tipo.desenhar(ctx.tela, "1", area.x, area.bottom + m.px(4),
                          t.texto_apagado, "micro")
        ctx.tipo.desenhar(ctx.tela, str(len(ns)), area.right, area.bottom + m.px(4),
                          t.texto_apagado, "micro", "direita")

    def _desenhar_rodape(self, ctx, areas):
        t, m = self.tema, areas.metricas
        r = areas.rodape
        y = r.centery - ctx.tipo.altura("micro") // 2
        texto = ("Esta tela não é a simulação: é a elipse de dois corpos do "
                 "planeta, redesenhada somando ondas. A simulação ficou pausada.")
        ctx.tipo.desenhar(ctx.tela, texto, r.x + m.px(16), y, t.texto_fraco, "micro")
        if self.n_piso:
            ctx.tipo.desenhar(
                ctx.tela, f"com {self.n_piso} ondas o desvio some no arredondamento "
                          "do computador",
                r.right - m.px(16), y, t.texto_apagado, "micro", "direita")
