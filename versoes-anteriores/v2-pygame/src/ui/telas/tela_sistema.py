"""
A tela principal: barra de controles, simulação, painel lateral e rodapé.

Divisão em camadas de informação, do mais para o menos usado:

  barra superior  Reproduzir/Pausar, velocidade, modos, Focar, Ajuda
  canvas          a simulação, com zoom e arrastar
  lateral         data, planeta selecionado e "Mais opções" recolhido
  canvas          campo de visão discreto; aviso de atraso quando necessário

Só os controles da barra superior estão sempre visíveis. Trilhas, nomes,
escala comprimida e dados técnicos ficam em "Mais opções". Quem abre o
programa pela primeira vez vê cinco controles, não vinte.
"""

import numpy as np
import pygame

from src.app.acoes import (AbrirTela, Acompanhar, AjustarZoom, Alternar,
                           AlternarPausa, CompararCom, DefinirEscalaVisual,
                           MostrarDica, MudarVelocidade, Selecionar,
                           TrocarModo, VoltarAoInicio, AlternarVista,
                           VistaSuperior, AvancarPasso)
from src.dados import textos
from src.fisica.efemerides import (DIA_S, UA_KM, distancia_ao_sol_ua, elementos_osculadores,
                                   km_por_s, velocidade_orbital)
from src.fisica.relogio import rotulo_velocidade
from src.ui import desenho
from src.ui import formato as fmt
from src.ui.widgets.base import Container
from src.ui.widgets.botao import Botao, BotaoAlternavel, GrupoSegmentado, Rotulo
from src.ui.widgets.painel import PainelRecolhivel


class TelaSistema:
    def __init__(self, corpos, tema):
        self.corpos = corpos
        self.tema = tema
        self.raiz = Container("raiz")
        self.barra = Container("barra")
        self.lateral = Container("lateral")
        self.painel_opcoes = None
        self._botoes_planeta = []
        self.rect_ficha = pygame.Rect(0, 0, 0, 0)
        self.rolagem_lateral = 0.0
        self.rolagem_maxima = 0.0
        self.rect_campo = pygame.Rect(0, 0, 0, 0)
        self.texto_campo = ""
        self.mensagem = ""
        self.mensagem_ate = 0.0

    def rolar_lateral(self, delta, passo=48):
        """Roda do mouse sobre o painel lateral."""
        antes = self.rolagem_lateral
        self.rolagem_lateral = max(0.0, min(self.rolagem_maxima,
                                            self.rolagem_lateral - delta * passo))
        return self.rolagem_lateral != antes

    # -- construção dos controles -----------------------------------------

    def montar(self, ctx, areas, estado_ui, relogio, sim_atrasado=False):
        """Recria os widgets com as posições desta janela.

        Refeito a cada relayout em vez de guardado: com nove planetas e uns
        vinte controles o custo é irrelevante, e garante que nada fique
        apontando para um retângulo de um tamanho de janela antigo.
        """
        m = areas.metricas
        self.barra.itens = []
        self.lateral.itens = []
        self.rect_ficha = pygame.Rect(0, 0, 0, 0)

        self._montar_barra(ctx, areas, estado_ui, relogio)
        self._montar_lateral(ctx, areas, estado_ui, relogio)
        vista = Botao("btn_vista",
                      "Vista 3D" if estado_ui.vista == "2d" else "Vista 2D",
                      AlternarVista(), papel="pequeno",
                      dica="V alterna; em 3D arraste para orbitar e use as setas para deslocar")
        vista.dispor(pygame.Rect(areas.canvas.x + m.px(12),
                                 areas.canvas.bottom - m.px(82),
                                 m.px(120), m.alvo_min))
        self.barra.itens.append(vista)

        self.raiz.itens = [self.barra, self.lateral]
        return self.raiz

    def _montar_barra(self, ctx, areas, ui, relogio):
        m = areas.metricas
        t = areas.topo
        y = t.y + (t.height - m.alvo_primario) // 2
        x = m.u * 2
        compacto = areas.classe_largura == "estreito"

        def coloca(w, largura=None):
            nonlocal x
            lw, lh = w.medir(ctx)
            lw = largura or lw
            w.dispor(pygame.Rect(x, y, lw, m.alvo_primario))
            self.barra.itens.append(w)
            x += lw + m.u
            return w

        rotulo = textos.BOTOES["continuar" if relogio.pausado else "pausar"]
        coloca(Botao("btn_pausa", rotulo, AlternarPausa(), primario=True,
                     ativo=relogio.pausado,
                     dica="Para e retoma o tempo da simulação"))

        b = coloca(Botao("btn_devagar", "−", MudarVelocidade(passo=-1),
                         dica=textos.BOTOES["mais_devagar"]), m.px(44))
        b.habilitado = not relogio.no_minimo()

        largura_vel = m.px(150 if not compacto else 128)
        texto_vel = rotulo_velocidade(relogio.dias_por_segundo)
        if compacto:
            # "30 dias por segundo" nao cabe; "30 dias/s" cabe e diz o mesmo.
            texto_vel = texto_vel.replace(" por segundo", "/s")
        rot = Rotulo("rot_velocidade", texto_vel,
                     "pequeno", self.tema.aviso if relogio.pausado else self.tema.texto,
                     "centro")
        rot.dispor(pygame.Rect(x, y, largura_vel, m.alvo_primario))
        self.barra.itens.append(rot)
        x += largura_vel + m.u

        b = coloca(Botao("btn_rapido", "+", MudarVelocidade(passo=+1),
                         dica=textos.BOTOES["mais_rapido"]), m.px(44))
        b.habilitado = not relogio.no_maximo()

        if not compacto:
            opcoes = [("sistema", textos.MODOS["sistema"]),
                      ("internos", textos.MODOS["internos"])]
            coloca(GrupoSegmentado("grp_modo", opcoes, ui.modo,
                                   lambda c: TrocarModo(c),
                                   dica="Muda só o enquadramento da câmera"))
        else:
            coloca(Botao("btn_visao", textos.BOTOES["visao_geral"],
                         TrocarModo("sistema"), ativo=ui.modo == "sistema"))

        # Foco em planeta: rótulo muda conforme há ou não um alvo.
        alvo = ui.acompanhado or ui.selecionado
        nome_alvo = next((c.nome for c in self.corpos if c.chave == alvo), None)
        if ui.acompanhado:
            coloca(Botao("btn_focar", f"Soltar {nome_alvo}", Acompanhar(None),
                         ativo=True, dica="A câmera para de viajar com o planeta"))
        else:
            coloca(Botao("btn_focar",
                         f"Focar {nome_alvo}" if nome_alvo else textos.BOTOES["focar"],
                         Acompanhar(alvo) if alvo else AbrirTela("escolher_planeta"),
                         dica="A câmera passa a viajar junto com o planeta"))

        # Ajuda encostada à direita, longe dos controles de uso frequente.
        for chave, rotulo_b, acao in (
                ("btn_ajuda", textos.BOTOES["ajuda"], AbrirTela("ajuda")),):
            w = Botao(chave, rotulo_b, acao, dica="Explicações e atalhos")
            lw, _ = w.medir(ctx)
            w.dispor(pygame.Rect(areas.janela.right - lw - m.u * 2, y, lw,
                                 m.alvo_primario))
            self.barra.itens.append(w)

    def _montar_lateral(self, ctx, areas, ui, relogio):
        if not areas.lateral.width:
            return
        m = areas.metricas
        r = areas.lateral
        self.lateral.recorte = r
        x = r.x + m.px(14)
        largura = r.width - m.px(28)
        topo_conteudo = r.y + m.px(12)
        y = topo_conteudo - int(self.rolagem_lateral)

        # Data e equivalência de tempo.
        y += m.px(4)
        cab = Rotulo("rot_data", relogio.data_formatada(), "dado", self.tema.texto)
        cab.dispor(pygame.Rect(x, y, largura, ctx.tipo.entrelinha("dado")))
        self.lateral.itens.append(cab)
        y += ctx.tipo.entrelinha("dado") + m.px(2)

        eq = Rotulo("rot_equiv", relogio.equivalencia(), "micro",
                    self.tema.aviso if relogio.pausado else self.tema.texto_fraco)
        eq.dispor(pygame.Rect(x, y, largura, ctx.tipo.entrelinha("micro")))
        self.lateral.itens.append(eq)
        y += ctx.tipo.entrelinha("micro") + m.px(14)

        # Lista de planetas: sempre visível, é a forma mais direta de escolher.
        titulo = Rotulo("rot_planetas", "Planetas", "pequeno", self.tema.texto_fraco)
        titulo.dispor(pygame.Rect(x, y, largura, ctx.tipo.entrelinha("pequeno")))
        self.lateral.itens.append(titulo)
        y += ctx.tipo.entrelinha("pequeno") + m.px(6)

        self._botoes_planeta = []
        colunas = 2
        larg_col = (largura - m.px(6)) // colunas
        alt = m.alvo_min
        for i, corpo in enumerate(self.corpos):
            if corpo.chave == "sol":
                continue
            k = i - 1
            bx = x + (k % colunas) * (larg_col + m.px(6))
            by = y + (k // colunas) * (alt + m.px(6))
            marcas = ("A" if ui.selecionado == corpo.chave else "") + ("B" if ui.comparando == corpo.chave else "")
            b = Botao(f"btn_planeta_{corpo.chave}",
                      (marcas + " · " if marcas else "") + corpo.nome,
                      Selecionar(corpo.chave), papel="pequeno",
                      cor_ponto=self.tema.cor_do_corpo(corpo.chave),
                      ativo=(ui.selecionado == corpo.chave),
                      dica=f"Mostra os dados de {corpo.nome}")
            b.dispor(pygame.Rect(bx, by, larg_col, alt))
            self.lateral.itens.append(b)
            self._botoes_planeta.append(b)
        y += ((len(self.corpos) - 1 + colunas - 1) // colunas) * (alt + m.px(6))
        y += m.px(8)

        self._ficha_y = None
        if ui.selecionado and not ui.painel_aberto:
            self._ficha_y = y
            y += m.px(184)

        for id_b, texto, acao in (
                ("btn_detalhes", "Ver detalhes", AbrirTela("detalhes", ui.selecionado)),
                ("btn_comparar", "Comparar planetas", AbrirTela("comparar"))):
            b = Botao(id_b, texto, acao, papel="pequeno")
            b.habilitado = bool(ui.selecionado) if id_b == "btn_detalhes" else True
            b.dispor(pygame.Rect(x, y, largura, m.alvo_min))
            self.lateral.itens.append(b)
            y += m.alvo_min + m.px(6)

        # "Mais opções": tudo o que não é essencial mora aqui dentro.
        itens = []
        alt_op = m.alvo_min
        oy = y + alt_op + m.px(6)
        def secao(id_s, titulo):
            nonlocal oy
            oy += m.px(10)
            w = Rotulo(id_s, titulo, "pequeno", self.tema.acento)
            w.dispor(pygame.Rect(x + m.px(4), oy, largura - m.px(8), m.px(26)))
            itens.append(w)
            oy += m.px(32)

        secao("sec_cena", "CENA E FUNDO")
        for chave, rotulo, acao in (
                ("btn_superior", "Vista superior (T)", VistaSuperior()),
                ("btn_passo", "Avançar 0,5 dia (.)", AvancarPasso())):
            w = Botao(chave, rotulo, acao, papel="pequeno")
            w.habilitado = chave != "btn_superior" or ui.vista == "3d"
            w.dispor(pygame.Rect(x, oy, largura, alt_op))
            itens.append(w)
            oy += alt_op + m.px(2)
        for chave in ("orbitas", "trilhas", "rotulos", "grade", "estrelas", "tamanho_real"):
            if chave == "tamanho_real":
                secao("sec_escala", "ESCALA DO DESENHO")
            w = BotaoAlternavel(f"opt_{chave}", textos.OPCOES[chave],
                                Alternar(chave), ui.opcoes.get(chave, False),
                                dica=textos.AJUDA_OPCOES[chave])
            w.dispor(pygame.Rect(x, oy, largura, alt_op))
            itens.append(w)
            oy += alt_op + m.px(2)

        w = BotaoAlternavel("opt_comprimir", textos.OPCOES["comprimir"],
                            DefinirEscalaVisual(
                                "real" if ui.escala_visual == "raiz" else "raiz"),
                            ui.escala_visual == "raiz",
                            dica=textos.AJUDA_OPCOES["comprimir"])
        w.dispor(pygame.Rect(x, oy, largura, alt_op))
        itens.append(w)
        oy += alt_op + m.px(2)

        secao("sec_leitura", "LEITURA E DADOS")
        w = BotaoAlternavel("opt_texto_maior", textos.OPCOES["texto_maior"],
                            Alternar("texto_maior"), ui.escala_texto > 1.0,
                            dica=textos.AJUDA_OPCOES["texto_maior"])
        w.dispor(pygame.Rect(x, oy, largura, alt_op))
        itens.append(w)
        oy += alt_op + m.px(2)

        w = BotaoAlternavel("opt_tecnico", textos.OPCOES["tecnico"],
                            Alternar("tecnico"), ui.opcoes.get("tecnico", False),
                            dica=textos.AJUDA_OPCOES["tecnico"])
        w.dispor(pygame.Rect(x, oy, largura, alt_op))
        itens.append(w)
        oy += alt_op + m.px(8)

        secao("sec_explorar", "EXPLORAR")
        for chave, rotulo_b, acao in (
                ("btn_atividades", textos.BOTOES["atividades"], AbrirTela("atividades")),
                ("btn_lab", textos.BOTOES["laboratorio"], AbrirTela("lab")),
                ("btn_inicio", textos.BOTOES["inicio"], VoltarAoInicio())):
            b = Botao(chave, rotulo_b, acao, papel="pequeno")
            b.dispor(pygame.Rect(x, oy, largura, alt_op))
            itens.append(b)
            oy += alt_op + m.px(4)

        self.painel_opcoes = PainelRecolhivel(
            "painel_opcoes", textos.BOTOES["mais_opcoes"], itens,
            aberto=ui.painel_aberto, acao_alternar=Alternar("painel"))
        self.painel_opcoes.dispor_cabecalho(
            pygame.Rect(x, y, largura, max(alt_op, r.bottom - y)), alt_op)
        self.lateral.itens.append(self.painel_opcoes)

        # Altura do conteudo e limite de rolagem. Sem isto, com "Mais opcoes"
        # aberto numa janela baixa, os ultimos botoes ficavam fora da tela sem
        # nenhuma forma de alcanca-los.
        fim = (oy if ui.painel_aberto else y + alt_op)
        altura_conteudo = fim - topo_conteudo + int(self.rolagem_lateral)
        reserva = m.px(12)
        self.rolagem_maxima = max(0.0, altura_conteudo - (r.height - reserva))
        self.rolagem_lateral = min(self.rolagem_lateral, self.rolagem_maxima)

        # Quem ficou fora da area visivel some do desenho e da tabulacao, para
        # nao ser clicado nem alcancado por Tab enquanto esta invisivel.
        def dentro(rect):
            return rect.bottom > r.y and rect.y < r.bottom

        for w in self.lateral.itens:
            if w is not self.painel_opcoes:
                w.visivel = dentro(w.rect)

        conteudo_visivel = False
        if self.painel_opcoes.aberto:
            for w in self.painel_opcoes.conteudo.itens:
                w.visivel = dentro(w.rect)
                conteudo_visivel = conteudo_visivel or w.visivel

        # O painel continua "visivel" enquanto qualquer filho estiver na tela,
        # senao rolar para baixo tiraria o cabecalho de vista e levaria junto
        # todos os controles de dentro dele.
        self.painel_opcoes.cabecalho_visivel = dentro(self.painel_opcoes.rect_cabecalho)
        self.painel_opcoes.visivel = (self.painel_opcoes.cabecalho_visivel
                                      or conteudo_visivel)
        self.painel_opcoes.focavel = self.painel_opcoes.cabecalho_visivel

    # -- desenho -----------------------------------------------------------

    def desenhar_quadro(self, ctx, areas, ui, relogio, estado, camera, cena,
                        relatorio=None):
        t = self.tema
        tela = ctx.tela

        desenho.caixa(tela, areas.topo, t.painel, None)
        pygame.draw.line(tela, t.borda, (areas.topo.x, areas.topo.bottom - 1),
                         (areas.topo.right, areas.topo.bottom - 1))
        if areas.lateral.width:
            desenho.caixa(tela, areas.lateral, t.painel, None)
            pygame.draw.line(tela, t.borda,
                             (areas.lateral.x, areas.lateral.y),
                             (areas.lateral.x, areas.lateral.bottom))

        self.barra.desenhar(ctx)
        if areas.lateral.width:
            recorte = tela.get_clip()
            tela.set_clip(areas.lateral)
            self.lateral.desenhar(ctx)
            self._desenhar_ficha(ctx, areas, ui, estado, camera, cena)
            tela.set_clip(recorte)
            self._desenhar_indicador_rolagem(ctx, areas)
        self._desenhar_rodape(ctx, areas, ui, camera, cena, relatorio, estado)

    def _desenhar_indicador_rolagem(self, ctx, areas):
        """Barra fina mostrando que ha mais conteudo. Sem ela, a rolagem e
        invisivel e ninguem descobre que existe."""
        if self.rolagem_maxima <= 0:
            return
        m = areas.metricas
        r = areas.lateral
        altura = max(m.px(30), int(r.height * r.height /
                                   (r.height + self.rolagem_maxima)))
        fracao = self.rolagem_lateral / self.rolagem_maxima
        y = r.y + int((r.height - altura) * fracao)
        pygame.draw.rect(ctx.tela, self.tema.separador,
                         (r.right - m.px(5), y, m.px(3), altura),
                         border_radius=m.px(2))

    def _desenhar_ficha(self, ctx, areas, ui, estado, camera, cena):
        """Ficha curta do planeta selecionado, embaixo da lateral."""
        if not ui.selecionado:
            return
        i = next((k for k, c in enumerate(self.corpos)
                  if c.chave == ui.selecionado), None)
        if i is None:
            return
        m = areas.metricas
        corpo = self.corpos[i]
        largura = areas.lateral.width - m.px(28)
        x = areas.lateral.x + m.px(14)

        altura = m.px(168)
        y = self._ficha_y
        if y is None or (self.painel_opcoes and self.painel_opcoes.aberto):
            return               # sem espaço: o painel aberto tem prioridade
        rect = pygame.Rect(x, y, largura, altura)
        self.rect_ficha = rect
        desenho.caixa(ctx.tela, rect, self.tema.painel_alto, self.tema.borda,
                      1, raio=m.px(10))

        px = x + m.px(12)
        py = y + m.px(10)
        pygame.draw.circle(ctx.tela, self.tema.cor_do_corpo(corpo.chave),
                           (px + m.px(6), py + m.px(9)), m.px(6))
        ctx.tipo.desenhar(ctx.tela, corpo.nome, px + m.px(20), py,
                          self.tema.texto, "titulo")
        py += ctx.tipo.entrelinha("titulo") + m.px(4)

        if i == 0:
            centro = estado.centro_de_massa()
            velocidade_cm = estado.momento_linear() / np.sum(estado.gm)
            linhas = [
                ("ao centro de massa", fmt.km(np.linalg.norm(estado.pos[0] - centro) * UA_KM)),
                ("velocidade relativa", fmt.numero(
                    np.linalg.norm(estado.vel[0] - velocidade_cm) * UA_KM * 1000 / DIA_S, 2) + " m/s"),
                ("período orbital", "não há período único"),
            ]
        else:
            el = elementos_osculadores(estado, i)
            linhas = [
                ("distância ao Sol", fmt.ua(distancia_ao_sol_ua(estado, i))),
                ("velocidade", fmt.km_por_s(km_por_s(velocidade_orbital(estado, i)))),
                ("uma volta leva", fmt.periodo_aproximado(el["periodo_dias"])),
            ]
        for nome, valor in linhas:
            ctx.tipo.desenhar(ctx.tela, nome, px, py, self.tema.texto_fraco, "micro")
            ctx.tipo.desenhar(ctx.tela, valor, x + largura - m.px(12), py,
                              self.tema.texto, "pequeno", "direita")
            py += ctx.tipo.entrelinha("pequeno") + m.px(2)

        py += m.px(2)
        from src.dados.fichas import ficha
        frase = ficha(corpo.chave)["frase"]
        ctx.tipo.desenhar_bloco(ctx.tela, frase, px, py, largura - m.px(24),
                                self.tema.texto_fraco, "micro")

    def _desenhar_rodape(self, ctx, areas, ui, camera, cena, relatorio, estado):
        """Indicador sobre o canvas, calculado da câmera a cada quadro."""
        self.desenhar_campo(ctx, areas, ui, camera)
        if relatorio is not None and relatorio.atrasado:
            ctx.tipo.desenhar(ctx.tela, "! " + textos.RODAPE["atrasado"],
                self.rect_campo.x, self.rect_campo.y - areas.metricas.px(22),
                self.tema.aviso, "micro")

    def desenhar_campo(self, ctx, areas, ui, camera):
        t, m = self.tema, areas.metricas
        campo = camera.raio_visivel_ua * 2
        self.texto_campo = "campo de visão: " + fmt.ua(campo, 3 if campo < 1 else 1)
        if ui.vista == "3d":
            self.texto_campo = "3D ortográfica · " + self.texto_campo
        if ui.escala_visual == "raiz":
            self.texto_campo += " visuais · comprimido"
        largura = ctx.tipo.largura(self.texto_campo, "micro") + m.px(20)
        self.rect_campo = pygame.Rect(areas.canvas.x + m.px(12),
            areas.canvas.bottom - m.px(30), largura, m.px(22))
        desenho.caixa(ctx.tela, self.rect_campo, t.painel, t.borda, 1, raio=m.px(8))
        ctx.tipo.desenhar(ctx.tela, self.texto_campo,
            self.rect_campo.x + m.px(10),
            self.rect_campo.centery - ctx.tipo.altura("micro") // 2, t.texto, "micro")
