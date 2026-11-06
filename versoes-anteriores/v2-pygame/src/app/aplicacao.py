"""
O laço principal: eventos, física, desenho.

Ordem de cada quadro, e o motivo de ser essa:

    1. ler eventos e transformar em ações
    2. aplicar as ações (podem mudar câmera, modo, velocidade)
    3. avançar a física pelo tempo real decorrido
    4. mover a câmera para os alvos
    5. desenhar

A física vem depois das ações para que apertar "pausar" tenha efeito no mesmo
quadro. E vem antes de desenhar para que a data escrita na tela corresponda às
posições desenhadas, e não às do quadro anterior.
"""

import datetime
import os
import time

import numpy as np
import pygame

from src.app import acoes as A
from src.app.atalhos import SETAS, Atalhos, AtalhosLab
from src.app.estado_ui import EstadoUI
from src.dados import preferencias, textos
from src.dados.catalogo import carregar, indice_de
from src.fisica import calibragem
from src.fisica.efemerides import elementos_osculadores
from src.fisica.integrador import PASSO_PADRAO_DIAS, Yoshida4
from src.fisica.relogio import Relogio, VELOCIDADE_INICIAL
from src.fisica.simulador import Simulador
from src.fisica.trilha import ConjuntoTrilhas
from src.projecao.camera import Camera2D
from src.projecao.camera3d import Camera3D
from src.projecao.enquadramento import alvo_de_camera
from src.projecao.escala_visual import ESCALAS
from src.ui import desenho
from src.ui import formato as fmt
from src.ui.cenas.cena_sistema import CenaSistema
from src.ui.cenas.cena_sistema3d import CenaSistema3D
from src.ui.eventos import Roteador
from src.ui.janela import Janela
from src.ui.telas.tela_lab import TelaLab
from src.ui.telas.tela_sistema import TelaSistema
from src.ui.tema import TEMA
from src.ui.tipografia import Tipografia
from src.ui.widgets.base import Contexto
from src.ui.widgets.foco import GerenteFoco

FPS = 60
# Caminho absoluto: assim as capturas caem sempre na pasta do projeto, mesmo
# que o programa seja aberto a partir de outro diretorio.
PASTA_SAIDA = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "saida")


class Aplicacao:
    def __init__(self, visivel=True, largura=None, altura=None):
        self.corpos, estado, self.procedencia, self.validacao = carregar()
        self.estado_inicial = estado.copia()
        self.estado = estado

        self.epoca = datetime.date.fromisoformat(
            self.procedencia["epoca"]["calendario_tdb"])

        # Mede a máquina antes de oferecer velocidades que ela não sustenta.
        integrador = Yoshida4()
        passos_s = calibragem.medir_passos_por_segundo(self.estado, integrador)
        self.passos_max = calibragem.passos_max_por_quadro(passos_s)
        teto = calibragem.teto_dias_por_segundo(passos_s)

        self.sim = Simulador(self.estado, integrador, PASSO_PADRAO_DIAS,
                             self.passos_max)
        self.relogio = Relogio(self.epoca, 0.0, VELOCIDADE_INICIAL,
                               pausado=False, teto_dias_por_segundo=teto)

        periodos = [None] + [elementos_osculadores(self.estado, i)["periodo_dias"]
                             for i in range(1, len(self.corpos))]
        self.trilhas = ConjuntoTrilhas(periodos)

        self.ui = EstadoUI.de_dicionario(preferencias.carregar())
        self.janela = Janela(largura, altura, self.ui.escala_texto)
        if not visivel:
            pygame.display.set_mode(self.janela.tamanho, pygame.HIDDEN)
            self.janela.tela = pygame.display.get_surface()

        self.tipo = Tipografia(self.janela.metricas().escala)
        self.cena = CenaSistema(self.corpos, TEMA)
        self.tela = TelaSistema(self.corpos, TEMA)
        self.lab = TelaLab(TEMA)
        self.tela_ativa = "sistema"          # "sistema" ou "lab"
        self._pausado_antes_do_lab = False
        self.foco = GerenteFoco()
        self.roteador = Roteador(self.foco)
        self.atalhos = Atalhos()
        self.atalhos_lab = AtalhosLab()
        self.sobreposicao = None          # modal aberto, se houver

        self.camera = Camera2D(self.janela.areas.canvas, self.estado.pos[0][:2], 31.5)
        self._camera2d = self.camera
        self._camera3d = Camera3D(self.janela.areas.canvas, self.estado.pos[0], 31.5)
        self._cena2d = self.cena
        self._cena3d = CenaSistema3D(self.corpos, TEMA)
        if self.ui.vista == "3d":
            self.camera, self.cena = self._camera3d, self._cena3d
        self.relatorio = None
        self.mensagem = ""
        self._mensagem_ate = 0.0
        self._relogio_pygame = pygame.time.Clock()
        self._raiz = None
        self._sujo = True

        self.aplicar_modo(self.ui.modo, animado=False)
        if not self.ui.tutorial_visto:
            self.abrir("tutorial")

    # -- ajuda a acessar corpos -------------------------------------------

    def indice(self, chave):
        if not chave:
            return None
        try:
            return indice_de(self.corpos, chave)
        except KeyError:
            return None

    def nome(self, chave):
        i = self.indice(chave)
        return self.corpos[i].nome if i is not None else ""

    # -- ações -------------------------------------------------------------

    def avisar(self, texto):
        """Resposta visível depois de uma ação. Some sozinha."""
        self.mensagem = texto
        self._mensagem_ate = time.monotonic() + 2.6

    def aplicar_modo(self, modo, animado=True):
        self.ui.modo = modo
        idx = self.indice(self.ui.acompanhado or self.ui.selecionado)
        afelio = None
        if modo == "acompanhar" and idx is not None:
            # O Sol nao orbita a si mesmo: sua distancia heliocentrica e zero.
            if idx != 0:
                afelio = elementos_osculadores(self.estado, idx)["afelio"]
            self.camera.seguir(idx)
            self.ui.acompanhado = self.corpos[idx].chave
        else:
            self.camera.seguir(None)
            if modo != "acompanhar":
                self.ui.acompanhado = None
        centro, raio = alvo_de_camera(modo, self.estado, idx, afelio)
        alvo = idx if modo == "acompanhar" and idx is not None else 0
        centro = self._posicoes_visuais()[alvo]
        if self.ui.escala_visual == "raiz":
            raio = ESCALAS["raiz"].raio(raio)
        self.camera.ir_para(centro, animado)
        self.camera.enquadrar(raio, animado=animado)
        self._sujo = True

    def _posicoes_visuais(self):
        if self.ui.vista == "3d":
            return ESCALAS[self.ui.escala_visual].aplicar(
                self.estado.pos, origem=self.estado.pos[0])
        return ESCALAS[self.ui.escala_visual].aplicar(
            self.estado.pos[:, :2], origem=self.estado.pos[0, :2])

    def _alternar_vista(self):
        anterior = self.camera
        self.ui.vista = "3d" if self.ui.vista == "2d" else "2d"
        self.camera, self.cena = ((self._camera3d, self._cena3d)
                                 if self.ui.vista == "3d"
                                 else (self._camera2d, self._cena2d))
        self.camera.definir_quadro(self.janela.areas.canvas)
        self.camera.px_por_ua = anterior.px_por_ua
        self.camera._alvo_px_por_ua = None
        self.camera._transicao = 0.0
        self.camera.seguir(anterior.seguindo)
        centro = np.zeros(self.camera.centro_ua.size)
        n = min(len(centro), anterior.centro_ua.size)
        centro[:n] = anterior.centro_ua[:n]
        if anterior.seguindo is not None:
            centro = self._posicoes_visuais()[anterior.seguindo]
        self.camera.ir_para(centro, animado=False)
        self._sujo = True
        self.avisar("3D: arraste para orbitar · setas deslocam · T: vista superior"
                    if self.ui.vista == "3d" else "Vista 2D da eclíptica")

    def aplicar(self, acao):
        ui = self.ui

        if isinstance(acao, tuple):                  # eventos crus do canvas
            tipo, dado = acao
            if tipo == "arrastar_canvas":
                self.camera.arrastar(*dado)
                if ui.modo == "acompanhar" and ui.vista == "2d":
                    ui.modo = "sistema"
                    ui.acompanhado = None
                    self._sujo = True
            elif tipo == "roda_canvas":
                delta, pos = dado
                self.camera.aplicar_zoom(1.15 ** delta, pos)
            elif tipo == "roda_lateral":
                if self.tela.rolar_lateral(dado):
                    self._sujo = True
            elif tipo == "tecla_lateral":
                if dado == "inicio":
                    self.tela.rolagem_lateral = 0
                elif dado == "fim":
                    self.tela.rolagem_lateral = self.tela.rolagem_maxima
                else:
                    self.tela.rolar_lateral(dado, self.janela.areas.lateral.height * .8)
                self._sujo = True
            elif tipo == "clique_canvas":
                self._clique_no_canvas(dado)
            return True

        if isinstance(acao, A.Sair):
            return False

        if isinstance(acao, A.AlternarVista):
            self._alternar_vista()

        elif isinstance(acao, A.VistaSuperior):
            if ui.vista == "3d":
                self.camera.vista_superior()
                self.avisar("Vista superior · arraste para inclinar novamente")

        elif isinstance(acao, A.AvancarPasso):
            self.relogio.pausado = True
            from src.fisica.integrador import avancar
            avancar(self.estado, self.sim.integrador, self.sim.dt_dias, 1)
            self.relogio.t_dias = self.estado.t_dias
            self.trilhas.registrar(self.estado.pos, self.estado.t_dias)
            self._sujo = True

        elif isinstance(acao, A.AlternarPausa):
            self.relogio.pausado = not self.relogio.pausado
            self.avisar("Pausado" if self.relogio.pausado else "Rodando")
            self._sujo = True

        elif isinstance(acao, A.MudarVelocidade):
            if acao.valor is not None:
                self.relogio.dias_por_segundo = acao.valor
            else:
                self.relogio.acelerar(acao.passo)
            from src.fisica.relogio import rotulo_velocidade
            self.avisar(rotulo_velocidade(self.relogio.dias_por_segundo))
            self._sujo = True

        elif isinstance(acao, A.TrocarModo):
            if acao.modo == "acompanhar" and not (ui.acompanhado or ui.selecionado):
                self.avisar("Escolha um planeta primeiro")
            else:
                self.aplicar_modo(acao.modo)
                self.avisar(textos.MODOS[acao.modo])

        elif isinstance(acao, A.Selecionar):
            ui.selecionado = acao.chave
            if acao.chave:
                self.avisar(f"{self.nome(acao.chave)} selecionado como A")
            self._sujo = True

        elif isinstance(acao, A.Acompanhar):
            if acao.chave:
                ui.selecionado = acao.chave
                ui.acompanhado = acao.chave
                self.aplicar_modo("acompanhar")
                self.avisar(f"Acompanhando {self.nome(acao.chave)}")
            else:
                ui.acompanhado = None
                self.aplicar_modo("sistema")
                self.avisar("Câmera solta")

        elif isinstance(acao, A.VoltarAoInicio):
            self.estado = self.estado_inicial.copia()
            self.sim.reiniciar(self.estado)
            self.relogio.t_dias = 0.0
            self.trilhas.limpar()
            self.aplicar_modo(ui.modo, animado=False)
            self.avisar(f"Voltou para {self.relogio.data_curta()}")

        elif isinstance(acao, A.Alternar):
            if acao.opcao == "painel":
                ui.painel_aberto = not ui.painel_aberto
                self.tela.rolagem_lateral = 0.0
            elif acao.opcao == "texto_maior":
                ui.escala_texto = 1.0 if ui.escala_texto > 1.0 else 1.25
                self.janela.definir_escala_texto(ui.escala_texto)
                self.tipo.definir_escala(self.janela.metricas().escala)
                desenho.limpar_caches()
                self.avisar("Texto maior" if ui.escala_texto > 1 else "Texto normal")
            else:
                ligado = ui.alternar(acao.opcao)
                self.avisar(f"{textos.OPCOES.get(acao.opcao, acao.opcao)}: "
                            f"{'ligado' if ligado else 'desligado'}")
            self._sujo = True

        elif isinstance(acao, A.DefinirEscalaVisual):
            ui.escala_visual = acao.chave
            self.aplicar_modo(ui.modo, animado=False)
            self.avisar(ESCALAS[acao.chave].rotulo)
            self._sujo = True

        elif isinstance(acao, A.AjustarZoom):
            self.camera.aplicar_zoom(acao.fator, acao.ancora)

        elif isinstance(acao, A.AbrirTela) and acao.tela.startswith("lab_"):
            if acao.tela == "lab_mais":
                self.lab.mudar_termos(+1)
            elif acao.tela == "lab_menos":
                self.lab.mudar_termos(-1)
            elif acao.tela == "lab_pausa":
                self.lab.tocando = not self.lab.tocando
            elif acao.tela == "lab_ampliar":
                self.lab.amplificar = not self.lab.amplificar
                if self.lab.amplificar:
                    self.avisar("Diferença ampliada")
            self._sujo = True

        elif isinstance(acao, A.AbrirTela):
            if acao.tela == "captura":
                self.avisar("Imagem salva em " + self.capturar())
            elif acao.tela == "escolher_planeta":
                self.avisar("Clique em um planeta ou escolha na lista")
            else:
                self.abrir(acao.tela, acao.argumento)

        elif isinstance(acao, A.MostrarDica):
            self.abrir("dica", acao.chave)

        elif isinstance(acao, A.CompararCom):
            if self.indice(acao.chave) != 0:
                ui.comparando = acao.chave
                if acao.chave:
                    self.avisar(f"{self.nome(acao.chave)} selecionado como B")
                self._sujo = True

        elif isinstance(acao, A.MudarComparacao):
            campo = "selecionado" if acao.lado == "A" else "comparando"
            chaves = [c.chave for c in self.corpos[1:]]
            atual = getattr(ui, campo)
            idx = chaves.index(atual) if atual in chaves else (-1 if acao.passo > 0 else 0)
            setattr(ui, campo, chaves[(idx + acao.passo) % len(chaves)])
            self._sujo = True

        elif isinstance(acao, A.InverterComparacao):
            ui.selecionado, ui.comparando = ui.comparando, ui.selecionado
            self._sujo = True

        elif isinstance(acao, A.Fechar):
            if self.tela_ativa == "lab":
                self.sair_do_lab()
            else:
                self.fechar()

        elif isinstance(acao, A.Mensagem):
            self.avisar(acao.texto)

        return True

    def planeta_em(self, pos):
        # A lateral sobreposta nunca deixa o clique atravessar para o canvas.
        if self.janela.areas.lateral.collidepoint(pos):
            return None
        i = self.cena.corpo_em(pos)
        if i is not None:
            return self.corpos[i].chave
        return self.cena.rotulo_em(pos)

    def _clique_no_canvas(self, pos):
        self.aplicar(A.Selecionar(self.planeta_em(pos)))

    # -- sobreposições -----------------------------------------------------

    def abrir_lab(self, chave=None):
        """Abre a matematica do Sol ou a elipse do planeta escolhido."""
        chave = chave or self.ui.selecionado
        if chave == "sol":
            self.abrir("matematica_sol")
            return
        i = self.indice(chave)
        if i is None:
            self.avisar("Escolha um planeta para ver a matemática dele")
            return
        self._pausado_antes_do_lab = self.relogio.pausado
        self.relogio.pausado = True          # o relogio para, e nao se perde
        self.lab.carregar(i, chave, self.corpos[i].nome, self.estado,
                          self.relogio.data_curta())
        self.tela_ativa = "lab"
        self.sobreposicao = None
        self.ui.tela_aberta = None
        self._raiz = None
        self._sujo = True

    def sair_do_lab(self):
        self.tela_ativa = "sistema"
        self.relogio.pausado = self._pausado_antes_do_lab
        self._raiz = None
        self._sujo = True
        self.avisar("De volta ao Sistema Solar")

    def abrir(self, tela, argumento=None):
        from src.ui.telas.sobreposicoes import construir
        if tela == "lab":
            self.abrir_lab(argumento)
            return
        ja_aberta = self.sobreposicao is not None
        if tela == "detalhes" and argumento:
            self.ui.selecionado = argumento
        self.ui.tela_aberta = tela
        self.ui.argumento_tela = argumento
        self.sobreposicao = construir(self, tela, argumento)
        if self.sobreposicao is not None and not ja_aberta:
            self.foco.empilhar()
        self._sujo = True

    def fechar(self):
        if self.ui.tela_aberta == "tutorial":
            self.ui.tutorial_visto = True
        self.ui.tela_aberta = None
        self.ui.argumento_tela = None
        self.sobreposicao = None
        self.foco.desempilhar()
        self._sujo = True

    # -- captura -----------------------------------------------------------

    def capturar(self, nome=None):
        os.makedirs(PASTA_SAIDA, exist_ok=True)
        nome = nome or f"sistema_solar_{time.strftime('%Y%m%d_%H%M%S')}.png"
        caminho = os.path.join(PASTA_SAIDA, nome)
        pygame.image.save(self.janela.tela, caminho)
        # Salvar trava o quadro por dezenas de milissegundos. Sem descartar
        # este tick, o dt inflado viraria um salto na data simulada.
        self._relogio_pygame.tick()
        return caminho

    # -- laço --------------------------------------------------------------

    def _dispor_modal(self, ctx):
        modal = self.sobreposicao
        chave = (self.janela.tamanho, ctx.metricas.escala)
        if getattr(modal, "_layout_chave", None) != chave:
            modal.dispor_em(self.janela.areas, ctx)
            modal._layout_chave = chave

    def _contexto(self):
        return Contexto(tela=self.janela.tela, tema=TEMA, tipo=self.tipo,
                        metricas=self.janela.areas.metricas,
                        mouse=pygame.mouse.get_pos(),
                        id_hover=self.roteador.id_hover,
                        id_foco=self.foco.id_atual,
                        id_pressionado=self.roteador.id_pressionado,
                        foco_visivel=self.foco.visivel)

    def passo(self, dt_real):
        """Um quadro completo. Devolve False quando é hora de sair."""
        eventos = pygame.event.get()
        for ev in eventos:
            if self.janela.tratar_evento(ev):
                self._sujo = True

        if self.janela.atualizar_layout():
            self.camera.definir_quadro(self.janela.areas.canvas)
            self.tipo.definir_escala(self.janela.metricas().escala)
            desenho.limpar_caches()
            self._sujo = True

        ctx = self._contexto()
        if self.tela_ativa == "lab":
            return self._passo_lab(ctx, eventos, dt_real)

        if self._raiz is None or self._sujo:
            self._raiz = self.tela.montar(ctx, self.janela.areas, self.ui,
                                          self.relogio)
            if self.sobreposicao is not None:
                self._dispor_modal(ctx)
                self.roteador.indexar(self.sobreposicao)
            else:
                self.roteador.indexar(self._raiz)
            self.janela.definir_lateral(self.ui.lateral_aberta)
            self._sujo = False

        for acao in self.roteador.processar(eventos, self._raiz,
                                            self.janela.areas.canvas,
                                            self.sobreposicao, self.atalhos,
                                            self.janela.areas.lateral,
                                            self.planeta_em):
            if not self.aplicar(acao):
                return False

        # Setas movem a vista; ficam aqui porque dependem de estarem seguradas.
        teclas = pygame.key.get_pressed()
        if self.sobreposicao is None:
            dx = dy = 0
            for tecla, (ex, ey) in SETAS.items():
                if teclas[tecla]:
                    dx -= ex
                    dy -= ey
            if dx or dy:
                passo_px = 420 * dt_real
                deslocar = (self.camera.deslocar if self.ui.vista == "3d"
                            else self.camera.arrastar)
                deslocar(dx * passo_px, dy * passo_px)
                self.ui.acompanhado = None
                if self.ui.modo == "acompanhar":
                    self.ui.modo = "sistema"
                self._sujo = True

        if not self.relogio.pausado:
            self.relatorio = self.sim.avancar(dt_real, self.relogio.dias_por_segundo)
            self.relogio.t_dias = self.estado.t_dias
            self.trilhas.registrar(self.estado.pos, self.estado.t_dias)
            self._sujo = True
        else:
            self.relatorio = None

        self.camera.atualizar(dt_real, self._posicoes_visuais())
        # Eventos podem abrir uma caixa ou mudar seus dados neste quadro.
        # Relayout só muda geometria; a instância, o foco e a rolagem persistem.
        if self.sobreposicao is not None:
            if self._sujo or not self.sobreposicao.rect.width:
                self._dispor_modal(ctx)
                self.roteador.indexar(self.sobreposicao)
            self.sobreposicao.atualizar(self, ctx)
        self.desenhar(self._contexto())
        return True

    def _passo_lab(self, ctx, eventos, dt_real):
        """Um quadro do laboratorio. A simulacao fica parada aqui."""
        if self._raiz is None or self._sujo:
            self._raiz = self.lab.montar(ctx, self.janela.areas)
            self.roteador.indexar(self._raiz)
            self._sujo = False

        for acao in self.roteador.processar(eventos, self._raiz,
                                            self.janela.areas.canvas,
                                            None, self.atalhos_lab):
            if isinstance(acao, tuple):
                continue                      # o laboratorio nao tem pan nem zoom
            if not self.aplicar(acao):
                return False

        self.lab.avancar(dt_real)
        self.lab.desenhar(ctx, self.janela.areas)
        if self.mensagem and time.monotonic() < self._mensagem_ate:
            self._desenhar_mensagem(ctx, self.janela.areas)
        self.janela.apresentar()
        return True

    def desenhar(self, ctx):
        tela = self.janela.tela
        areas = self.janela.areas
        tela.fill(TEMA.fundo)

        obstaculos = [areas.topo, areas.rodape]
        obstaculos.extend(w.rect for w in self.tela.barra.itens if w.id == "btn_vista")
        if areas.lateral.width:
            obstaculos.append(areas.lateral)
        if self.tela.rect_ficha.width:
            obstaculos.append(self.tela.rect_ficha)

        self.cena.desenhar(
            tela, ctx, self.estado, self.camera, ESCALAS[self.ui.escala_visual],
            self.ui.opcoes, selecionado=self.indice(self.ui.selecionado),
            acompanhado=self.indice(self.ui.acompanhado),
            comparando=self.indice(self.ui.comparando),
            trilhas=self.trilhas, obstaculos=obstaculos)

        self.tela.desenhar_quadro(ctx, areas, self.ui, self.relogio,
                                  self.estado, self.camera, self.cena,
                                  self.relatorio)

        if self.ui.opcoes.get("tecnico"):
            self._desenhar_tecnico(ctx, areas)

        if self.mensagem and time.monotonic() < self._mensagem_ate:
            self._desenhar_mensagem(ctx, areas)

        if self.sobreposicao is not None:
            self.sobreposicao.desenhar_fundo(ctx, areas)
            self.sobreposicao.desenhar(ctx)
            # Fica abaixo da caixa, legível mesmo com o véu do modal.
            self.tela.desenhar_campo(ctx, areas, self.ui, self.camera)

        self.janela.apresentar()

    def _desenhar_mensagem(self, ctx, areas):
        """Retorno curto no canto do canvas, para cada ação ter resposta."""
        m = areas.metricas
        largura = ctx.tipo.largura(self.mensagem, "pequeno") + m.px(24)
        r = pygame.Rect(areas.canvas.centerx - largura // 2,
                        areas.canvas.bottom - m.px(56), largura, m.px(32))
        desenho.caixa(ctx.tela, r, TEMA.painel_alto, TEMA.separador, 1, raio=m.px(8))
        ctx.tipo.desenhar(ctx.tela, self.mensagem, r.centerx,
                          r.centery - ctx.tipo.altura("pequeno") // 2,
                          TEMA.texto, "pequeno", "centro")

    def _desenhar_tecnico(self, ctx, areas):
        m = areas.metricas
        e = self.estado
        linhas = [
            f"integrador Yoshida 4a ordem, passo fixo de {self.sim.dt_dias} dia",
            f"orçamento {self.sim.passos_max_por_quadro} passos/quadro "
            f"(teto {fmt.inteiro(self.relogio.teto_dias_por_segundo)} dias/s)",
            f"t = {fmt.numero(e.t_dias, 1)} dias desde "
            f"{self.procedencia['epoca']['calendario_tdb']}",
            f"energia {e.energia():.9e}",
            f"|L| {np.linalg.norm(e.momento_angular()):.9e}",
            f"{self._relogio_pygame.get_fps():.0f} quadros/s",
        ]
        if self.relatorio:
            linhas.append(f"último quadro: {self.relatorio.passos} passos, "
                          f"{self.relatorio.ms_gastos:.2f} ms")
        largura = max(ctx.tipo.largura(s, "micro") for s in linhas) + m.px(20)
        altura = len(linhas) * ctx.tipo.entrelinha("micro") + m.px(16)
        r = pygame.Rect(areas.canvas.x + m.px(12), areas.canvas.y + m.px(12),
                        largura, altura)
        desenho.caixa(ctx.tela, r, TEMA.painel, TEMA.borda, 1, raio=m.px(8))
        y = r.y + m.px(8)
        for s in linhas:
            ctx.tipo.desenhar(ctx.tela, s, r.x + m.px(10), y, TEMA.texto_fraco,
                              "micro")
            y += ctx.tipo.entrelinha("micro")

    def rodar(self):
        dt = 1.0 / FPS
        try:
            while self.passo(dt):
                # O dt e limitado: se a janela ficar em segundo plano ou a
                # maquina engasgar, um quadro longo nao pode virar um salto
                # enorme na data simulada.
                dt = min(self._relogio_pygame.tick(FPS) / 1000.0, 0.1)
        except KeyboardInterrupt:
            pass
        finally:
            self.salvar_preferencias()
            self.janela.encerrar()

    def salvar_preferencias(self):
        d = self.ui.para_dicionario()
        d["selecionado"] = None
        d["acompanhado"] = None
        d["comparando"] = None
        d["tela_aberta"] = None
        d["argumento_tela"] = None
        preferencias.salvar(d)
