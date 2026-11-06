"""
Roteador de eventos: decide quem recebe cada clique e cada tecla.

Ordem de prioridade, por evento:

    1. modal aberto  -- consome tudo; o canvas nem enxerga
    2. tecla global  -- ESC, espaco, ?, 1/2/3
    3. widget sob o cursor
    4. canvas        -- so aqui nascem arrastar, zoom e clique em planeta

Tres armadilhas do pygame tratadas aqui:

  - `ev.rel` do MOUSEMOTION mente. Ele acumula enquanto o cursor esta fora da
    janela e entrega um salto enorme quando a janela recupera o foco. Usamos
    posicao absoluta e a diferenca em relacao ao inicio do arrasto.
  - O arrasto so nasce se o botao desceu sobre o canvas. Se desceu sobre um
    botao, aquele botao fica com o mouse capturado ate soltar -- e soltar fora
    dele cancela, que e o comportamento que todo mundo ja espera.
  - A roda do trackpad manda valores fracionarios em `precise_y`. Usar so
    `ev.y`, que e inteiro, faz o zoom andar aos trancos.
"""

import pygame

TECLAS_ATIVACAO = (pygame.K_RETURN, pygame.K_KP_ENTER, pygame.K_SPACE)


class Roteador:
    def __init__(self, foco):
        self.foco = foco
        self.id_hover = None
        self.id_pressionado = None
        self._widget_capturado = None
        self._arrastando = False
        self._pos_arrasto = None
        self._arrastou = False
        self._ultimo_clique = None
        self._secundario = None

    def _clique_planeta(self, chave, pos, acoes):
        from src.app.acoes import AbrirTela, Selecionar
        agora = pygame.time.get_ticks()
        if self._ultimo_clique:
            anterior, inicio, ponto = self._ultimo_clique
            perto = abs(pos[0] - ponto[0]) + abs(pos[1] - ponto[1]) <= 12
            if anterior == chave and agora - inicio <= 320 and perto:
                self._ultimo_clique = None
                acoes.append(AbrirTela("detalhes", chave))
                return
        self._ultimo_clique = (chave, agora, pos)
        acoes.append(Selecionar(chave))

    def indexar(self, raiz):
        """Refaz a ordem de tabulacao. Chamar apos relayout ou troca de tela."""
        self.foco.indexar(raiz.alcancaveis())

    def _por_id(self, raiz, id_widget):
        for w in raiz.alcancaveis():
            if w.id == id_widget:
                return w
        return None

    def processar(self, eventos, raiz, area_canvas, modal=None, atalhos=None,
                  area_lateral=None, planeta_em=None):
        """Converte eventos do pygame em acoes. Devolve a lista de acoes.

        `atalhos` e um objeto com `resolver(tecla, mods) -> Acao | None`.
        """
        acoes = []
        alvo = modal if modal is not None else raiz
        pos_mouse = pygame.mouse.get_pos()

        # Hover so vale quando a janela tem o foco do sistema. Sem isso o
        # ultimo botao sob o cursor fica iluminado com a janela em segundo plano.
        if pygame.mouse.get_focused():
            achado = alvo.em(pos_mouse) if hasattr(alvo, "em") else None
            self.id_hover = achado.id if achado else None
        else:
            self.id_hover = None

        if modal is not None:
            self._ultimo_clique = None
            self._arrastando = False

        for ev in eventos:
            if ev.type == pygame.QUIT:
                from src.app.acoes import Sair
                acoes.append(Sair())
                continue

            if ev.type == pygame.KEYDOWN:
                acoes.extend(self._tecla(ev, alvo, modal, atalhos))
                continue

            # SDL/pygame numera o botão direito como 3; aceitamos também 2
            # (botão secundário informado por alguns dispositivos).
            if ev.type == pygame.MOUSEBUTTONDOWN and ev.button in (2, 3):
                self._ultimo_clique = None
                self._secundario = None
                if modal is None:
                    w = alvo.em(ev.pos)
                    if w is not None and w.id.startswith("btn_planeta_"):
                        self._secundario = (ev.button, w.acao.chave, "lista")
                    elif (w is None and area_canvas.collidepoint(ev.pos)
                          and not (area_lateral is not None
                                   and area_lateral.collidepoint(ev.pos))
                          and planeta_em):
                        # None representa o fundo: soltar no fundo limpa B.
                        self._secundario = (ev.button, planeta_em(ev.pos), "canvas")
                continue

            if ev.type == pygame.MOUSEBUTTONUP and ev.button in (2, 3):
                if self._secundario and modal is None:
                    botao, chave, origem = self._secundario
                    w = alvo.em(ev.pos)
                    na_lista = w is not None and w.id.startswith("btn_planeta_")
                    no_canvas = (w is None and area_canvas.collidepoint(ev.pos)
                                 and not (area_lateral is not None
                                          and area_lateral.collidepoint(ev.pos)))
                    mesmo_alvo = ((origem == "lista" and na_lista
                                   and chave == w.acao.chave)
                                  or (origem == "canvas" and no_canvas
                                      and planeta_em and chave == planeta_em(ev.pos)))
                    if ev.button == botao and mesmo_alvo:
                        from src.app.acoes import CompararCom
                        acoes.append(CompararCom(chave))
                self._secundario = None
                continue

            if ev.type == pygame.MOUSEBUTTONDOWN and ev.button == 1:
                self.foco.esconder()
                if modal is not None and modal.iniciar_barra(ev.pos):
                    continue
                w = alvo.em(ev.pos) if hasattr(alvo, "em") else None
                if w is not None:
                    self.id_pressionado = w.id
                    self._widget_capturado = w
                    self.foco.definir(w.id, visivel=False)
                elif modal is not None:
                    # Clicar fora da caixa e um pedido de fechar.
                    if not modal.rect.collidepoint(ev.pos) and modal.acao_fechar:
                        acoes.append(modal.acao_fechar)
                elif area_canvas.collidepoint(ev.pos) and not (
                        area_lateral is not None and area_lateral.collidepoint(ev.pos)):
                    self._arrastando = True
                    self._pos_arrasto = ev.pos
                    self._arrastou = False
                continue

            if ev.type == pygame.MOUSEBUTTONUP and ev.button == 1:
                if self._widget_capturado is not None:
                    # So ativa se soltou em cima do mesmo widget.
                    if self._widget_capturado.acerta(ev.pos):
                        acao = self._widget_capturado.ao_clique(ev.pos)
                        if acao is not None:
                            if modal is None and self._widget_capturado.id.startswith("btn_planeta_"):
                                self._clique_planeta(acao.chave, ev.pos, acoes)
                            else:
                                self._ultimo_clique = None
                                acoes.append(acao)
                    self._widget_capturado = None
                    self.id_pressionado = None
                elif self._arrastando and not self._arrastou and modal is None:
                    chave = planeta_em(ev.pos) if planeta_em else None
                    if chave:
                        self._clique_planeta(chave, ev.pos, acoes)
                    else:
                        self._ultimo_clique = None
                        acoes.append(("clique_canvas", ev.pos))
                self._arrastando = False
                self._pos_arrasto = None
                if modal is not None:
                    modal._arrasto_barra = None
                continue

            if ev.type == pygame.MOUSEMOTION:
                if modal is not None:
                    modal.mover_barra(ev.pos)
                if self._arrastando and self._pos_arrasto is not None:
                    dx = ev.pos[0] - self._pos_arrasto[0]
                    dy = ev.pos[1] - self._pos_arrasto[1]
                    if abs(dx) + abs(dy) > 2:
                        self._arrastou = True
                        acoes.append(("arrastar_canvas", (dx, dy)))
                        self._pos_arrasto = ev.pos
                continue

            if ev.type == pygame.MOUSEWHEEL:
                delta = getattr(ev, "precise_y", None)
                if delta is None:
                    delta = float(ev.y)
                if abs(delta) < 1e-6:
                    continue
                if modal is not None:
                    modal.ao_roda(delta, pos_mouse)
                    continue
                w = alvo.em(pos_mouse) if hasattr(alvo, "em") else None
                acao = w.ao_roda(delta, pos_mouse) if w is not None else None
                if acao is not None:
                    acoes.append(acao)
                elif modal is None and area_lateral is not None \
                        and area_lateral.width and area_lateral.collidepoint(pos_mouse):
                    # A lateral tem prioridade sobre o canvas: quando ela
                    # esta sobreposta, os dois ocupam o mesmo lugar.
                    acoes.append(("roda_lateral", delta))
                elif modal is None and area_canvas.collidepoint(pos_mouse):
                    acoes.append(("roda_canvas", (delta, pos_mouse)))
                continue

        return acoes

    def _tecla(self, ev, alvo, modal, atalhos):
        acoes = []

        if ev.key == pygame.K_TAB:
            mods = ev.mod
            self.foco.avancar(para_tras=bool(mods & pygame.KMOD_SHIFT))
            return acoes

        # Widget focado tem a primeira chance: Enter, espaco, setas do grupo.
        if self.foco.id_atual:
            w = self._por_id(alvo, self.foco.id_atual)
            if w is not None:
                if modal is None and w.id.startswith("btn_planeta_"):
                    from src.app.acoes import AbrirTela, CompararCom
                    if ev.key == pygame.K_d:
                        return [AbrirTela("detalhes", w.acao.chave)]
                    if ev.key == pygame.K_RETURN and ev.mod & pygame.KMOD_SHIFT:
                        return [CompararCom(w.acao.chave)]
                acao = w.ao_tecla(ev.key, ev.mod)
                if acao is not None:
                    self.foco.visivel = True
                    acoes.append(acao)
                    return acoes

        if modal is not None:
            acao = modal.ao_tecla(ev.key, ev.mod)
            if acao is not None:
                acoes.append(acao)
                return acoes
            if ev.key == pygame.K_ESCAPE and modal.acao_fechar:
                acoes.append(modal.acao_fechar)
            return acoes

        paginas = {pygame.K_PAGEUP: 1, pygame.K_PAGEDOWN: -1,
                   pygame.K_HOME: "inicio", pygame.K_END: "fim"}
        if ev.key in paginas:
            return [("tecla_lateral", paginas[ev.key])]
        if atalhos is not None:
            acao = atalhos.resolver(ev.key, ev.mod)
            if acao is not None:
                acoes.append(acao)
        return acoes
