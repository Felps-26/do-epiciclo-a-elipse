"""Regressões de eventos, conteúdo rolável e dados vivos; sem rede ou janela."""
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
import numpy as np
import pygame

from src.app import acoes as A
from src.app.aplicacao import Aplicacao
from src.app.estado_ui import EstadoUI
from src.dados import preferencias
from src.dados.planetas import PLANETAS
from src.fisica.analise_sol import analisar_sol
from src.fisica.efemerides import distancia_ao_sol_ua, velocidade_orbital, km_por_s
from src.fisica.forcas import aceleracao
from src.ui import formato as fmt
from src.ui.cenas.cena_sistema import CenaSistema


class Interacoes(unittest.TestCase):
    def setUp(self):
        with patch.object(preferencias, "carregar", return_value={"tutorial_visto": True}):
            self.app = Aplicacao(visivel=False, largura=960, altura=600)
        self.app.relogio.pausado = True
        self.app.passo(0)
        self.addCleanup(self.app.janela.encerrar)

    def eventos(self, *eventos, instante=0):
        app = self.app
        with patch("pygame.time.get_ticks", return_value=instante):
            return app.roteador.processar(eventos, app._raiz, app.janela.areas.canvas,
                app.sobreposicao, app.atalhos, app.janela.areas.lateral, app.planeta_em)

    def clicar(self, pos, botao=1, instante=0):
        return self.eventos(
            pygame.event.Event(pygame.MOUSEBUTTONDOWN, pos=pos, button=botao),
            pygame.event.Event(pygame.MOUSEBUTTONUP, pos=pos, button=botao), instante=instante)

    def tecla(self, key, mod=0):
        return self.eventos(pygame.event.Event(pygame.KEYDOWN, key=key, mod=mod))

    def aplicar(self, acoes):
        for acao in acoes:
            self.app.aplicar(acao)
        self.app.passo(0)

    def widget(self, id_w):
        raiz = self.app.sobreposicao or self.app._raiz
        return next(w for w in raiz.alcancaveis() if w.id == id_w)

    def texto(self):
        return "\n".join((titulo or "") + "\n" + texto
                         for titulo, texto in self.app.sobreposicao.blocos)

    def preparar_canvas(self):
        app = self.app
        app.aplicar(A.DefinirEscalaVisual("raiz"))
        app.aplicar_modo("sistema", animado=False)
        app.passo(0)
        # Mercúrio e Netuno ficam fora da lateral sobreposta neste quadro.
        pontos = []
        for i in range(1, 9):
            pos = tuple(map(int, app.cena._pontos_tela[i]))
            if app.planeta_em(pos) == app.corpos[i].chave:
                pontos.append((app.corpos[i].chave, pos))
        self.assertGreaterEqual(len(pontos), 2)
        return pontos

    def test_caixas_rolam_ate_ultima_linha_em_texto_maior(self):
        app = self.app
        for escala in (1.0, 1.25):
            app.ui.escala_texto = escala
            app.janela.definir_escala_texto(escala)
            for tela in ("ajuda", "detalhes", "atividades"):
                app.abrir(tela, "terra" if tela == "detalhes" else None)
                app.passo(0)
                cx = app.sobreposicao
                self.assertGreater(cx.rolagem_maxima, 0)
                self.assertFalse(cx.rect.colliderect(app.tela.rect_campo))
                titulo, botoes = cx.rect.copy(), [w.rect.copy() for w in cx.itens]
                zoom = app.camera.px_por_ua
                self.eventos(pygame.event.Event(pygame.MOUSEWHEEL, y=-1, precise_y=-.25))
                self.assertGreater(cx.rolagem, 0)
                self.assertLess(cx.rolagem, 48)
                self.assertEqual(zoom, app.camera.px_por_ua)
                self.tecla(pygame.K_END)
                self.assertEqual(cx.rolagem, cx.rolagem_maxima)
                self.assertEqual(cx.altura_conteudo - cx.rolagem, cx.rect_conteudo.height)
                self.assertEqual(cx.rect_alca.bottom, cx.rect_barra.bottom)
                self.tecla(pygame.K_PAGEUP)
                self.assertLess(cx.rolagem, cx.rolagem_maxima)
                self.tecla(pygame.K_HOME)
                self.assertEqual(cx.rolagem, 0)
                self.assertEqual(cx.rect, titulo)
                self.assertEqual([w.rect for w in cx.itens], botoes)
                for w in cx.itens:
                    self.assertTrue(cx.rect.contains(w.rect))
                    self.assertFalse(w.rect.colliderect(cx.rect_conteudo))
                app.fechar()

    def test_arrastar_e_clicar_barra_sem_mover_camera(self):
        app = self.app
        app.abrir("ajuda")
        app.passo(0)
        cx = app.sobreposicao
        centro = app.camera.centro_ua.copy()
        self.eventos(pygame.event.Event(pygame.MOUSEBUTTONDOWN, button=1, pos=cx.rect_alca.center))
        self.eventos(pygame.event.Event(pygame.MOUSEMOTION, pos=cx.rect_barra.midbottom))
        self.eventos(pygame.event.Event(pygame.MOUSEBUTTONUP, button=1, pos=cx.rect_barra.midbottom))
        self.assertEqual(cx.rolagem, cx.rolagem_maxima)
        self.assertIsNone(cx._arrasto_barra)
        self.assertTrue(np.array_equal(centro, app.camera.centro_ua))
        self.clicar((cx.rect_barra.centerx, cx.rect_barra.y + 2))
        self.assertLess(cx.rolagem, cx.rolagem_maxima)

    def test_foco_fica_na_caixa_e_volta_ao_fechar(self):
        app = self.app
        app.foco.definir("btn_ajuda")
        app.abrir("ajuda")
        app.passo(0)
        for _ in range(4):
            self.tecla(pygame.K_TAB)
            self.assertEqual(app.foco.id_atual, "btn_fechar_ajuda")
        self.aplicar(self.tecla(pygame.K_ESCAPE))
        self.assertIsNone(app.sobreposicao)
        self.assertEqual(app.foco.id_atual, "btn_ajuda")

    def test_canvas_seleciona_a_b_e_compara_so_pelo_botao(self):
        app = self.app
        (a, pa), (b, pb) = self.preparar_canvas()[:2]
        self.aplicar(self.clicar(pa, instante=10))
        acoes = self.clicar(pb, botao=3, instante=100)
        self.assertEqual(acoes, [A.CompararCom(b)])
        self.aplicar(acoes)
        self.assertEqual((app.ui.selecionado, app.ui.comparando), (a, b))
        self.assertIsNone(app.ui.tela_aberta)
        self.assertIsNone(app.sobreposicao)
        self.aplicar(self.clicar(self.widget("btn_comparar").rect.center))
        self.assertEqual(app.ui.tela_aberta, "comparar")
        self.assertIn(app.nome(b), self.texto())
        self.assertIn(fmt.ua(distancia_ao_sol_ua(app.estado, app.indice(b)), 4), self.texto())

    def test_botao_2_tambem_seleciona_b_e_nao_arrasta(self):
        app = self.app
        chave, pos = self.preparar_canvas()[0]
        antes = app.camera.centro_ua.copy()
        self.eventos(pygame.event.Event(pygame.MOUSEBUTTONDOWN, pos=pos, button=2))
        self.assertEqual(self.eventos(pygame.event.Event(pygame.MOUSEMOTION,
            pos=(pos[0] + 80, pos[1] + 40))), [])
        acoes = self.eventos(pygame.event.Event(pygame.MOUSEBUTTONUP, pos=pos, button=2))
        self.assertEqual(acoes, [A.CompararCom(chave)])
        self.assertTrue(np.array_equal(antes, app.camera.centro_ua))

    def test_clique_direito_no_fundo_limpa_so_b(self):
        app = self.app
        (a, _), (b, _) = self.preparar_canvas()[:2]
        app.aplicar(A.Selecionar(a))
        app.aplicar(A.CompararCom(b))
        app.passo(0)
        canvas, lateral = app.janela.areas.canvas, app.janela.areas.lateral
        fundo = next((x, y) for y in range(canvas.y + 20, canvas.bottom - 20, 30)
                     for x in range(canvas.x + 20, canvas.right - 20, 30)
                     if not lateral.collidepoint(x, y)
                     and app._raiz.em((x, y)) is None
                     and app.planeta_em((x, y)) is None)
        for botao in (3, 2):
            app.aplicar(A.CompararCom(b))
            acoes = self.clicar(fundo, botao=botao)
            self.assertEqual(acoes, [A.CompararCom(None)])
            self.aplicar(acoes)
            self.assertEqual(app.ui.selecionado, a)
            self.assertIsNone(app.ui.comparando)
            self.assertIsNone(app.sobreposicao)

        app.aplicar(A.CompararCom(b))
        margem_lateral = (lateral.x + 2, lateral.y + 2)
        self.assertEqual(self.clicar(margem_lateral, botao=3), [])
        self.assertEqual(app.ui.comparando, b)

    def test_clique_duplo_canvas_nao_emite_cliques_simples(self):
        app = self.app
        chave, pos = self.preparar_canvas()[0]
        with patch.object(app, "abrir", wraps=app.abrir) as abrir:
            self.aplicar(self.clicar(pos, instante=100))
            self.assertEqual(app.ui.selecionado, chave)
            self.assertIsNone(app.ui.tela_aberta)
            acoes = self.clicar(pos, instante=280)
            self.assertEqual(acoes, [A.AbrirTela("detalhes", chave)])
            self.aplicar(acoes)
            self.assertEqual(abrir.call_count, 1)
        self.assertEqual(app.ui.tela_aberta, "detalhes")
        self.assertEqual(self.eventos(instante=1000), [])
        self.assertEqual(len(app.foco._pilha), 1)

    def test_clique_duplo_lista_e_simples_imediato(self):
        pos = self.widget("btn_planeta_terra").rect.center
        self.assertEqual(self.clicar(pos, instante=10), [A.Selecionar("terra")])
        self.assertEqual(self.eventos(instante=400), [])
        self.assertEqual(self.clicar(pos, instante=500), [A.Selecionar("terra")])
        self.assertEqual(self.clicar(pos, instante=700), [A.AbrirTela("detalhes", "terra")])

    def test_dois_alvos_distintos_nao_sao_duplo(self):
        pa = self.widget("btn_planeta_terra").rect.center
        pb = self.widget("btn_planeta_marte").rect.center
        self.assertEqual(self.clicar(pa, instante=10), [A.Selecionar("terra")])
        self.assertEqual(self.clicar(pb, instante=100), [A.Selecionar("marte")])
        self.assertEqual(self.eventos(instante=500), [])

    def test_arrasto_esquerdo_nao_seleciona(self):
        chave, pos = self.preparar_canvas()[0]
        self.eventos(pygame.event.Event(pygame.MOUSEBUTTONDOWN, button=1, pos=pos))
        fim = (pos[0] + 60, pos[1] + 30)
        acoes = self.eventos(pygame.event.Event(pygame.MOUSEMOTION, pos=fim))
        self.assertEqual(acoes, [("arrastar_canvas", (60, 30))])
        self.assertEqual(self.eventos(pygame.event.Event(pygame.MOUSEBUTTONUP, button=1, pos=fim)), [])
        self.assertEqual(self.eventos(instante=1000), [])

    def test_lista_teclado_seleciona_a_b_e_detalhes(self):
        app = self.app
        app.foco.definir("btn_planeta_terra")
        self.aplicar(self.tecla(pygame.K_RETURN))
        app.foco.definir("btn_planeta_marte")
        self.aplicar(self.tecla(pygame.K_RETURN, pygame.KMOD_SHIFT))
        self.assertIsNone(app.ui.tela_aberta)
        self.aplicar(self.tecla(pygame.K_c))
        self.assertEqual(app.ui.tela_aberta, "comparar")
        app.fechar()
        app.passo(0)
        app.foco.definir("btn_planeta_marte")
        self.aplicar(self.tecla(pygame.K_d))
        self.assertEqual(app.ui.argumento_tela, "marte")

    def test_escolher_segundo_atualiza_a_janela_existente(self):
        app = self.app
        app.aplicar(A.Selecionar("terra"))
        app.abrir("comparar")
        app.passo(0)
        cx = app.sobreposicao
        self.assertIn("Escolha A e B", self.texto())
        self.aplicar(self.clicar(self.widget("cmp_B").rect.center))
        self.assertIs(app.sobreposicao, cx)
        self.assertEqual(app.ui.comparando, "mercurio")
        self.assertIn("B · Mercúrio", self.texto())
        self.assertNotIn("Escolha A e B", self.texto())
        vistos = {app.ui.comparando}
        app.foco.definir("cmp_B")
        for _ in range(7):
            self.aplicar(self.tecla(pygame.K_RIGHT))
            vistos.add(app.ui.comparando)
        self.assertEqual(vistos, set(PLANETAS))

    def test_comparacao_viva_preserva_instancia_foco_rolagem(self):
        app = self.app
        app.aplicar(A.Selecionar("terra"))
        app.aplicar(A.CompararCom("marte"))
        app.abrir("comparar")
        app.passo(0)
        cx = app.sobreposicao
        controles = tuple(cx.itens)
        app.foco.definir("cmp_B")
        cx.rolar(60)
        rolagem = cx.rolagem
        antigo = self.texto()
        app.relogio.pausado = False
        app.relogio.dias_por_segundo = 300
        with patch.object(cx, "dispor_em", wraps=cx.dispor_em) as dispor:
            for _ in range(4):
                app.passo(.1)
            self.assertEqual(dispor.call_count, 0)
        self.assertIs(app.sobreposicao, cx)
        self.assertEqual(tuple(cx.itens), controles)
        self.assertEqual(app.foco.id_atual, "cmp_B")
        self.assertEqual(cx.rolagem, rolagem)
        self.assertNotEqual(self.texto(), antigo)
        self.assertIn(fmt.ua(distancia_ao_sol_ua(app.estado, 3), 4), self.texto())
        self.assertIn(fmt.km_por_s(km_por_s(velocidade_orbital(app.estado, 4)), 2), self.texto())
        app.relogio.pausado = True
        texto = self.texto()
        app.passo(.1)
        self.assertEqual(self.texto(), texto)

    def test_trocar_inverter_e_iguais(self):
        app = self.app
        app.aplicar(A.Selecionar("terra"))
        app.aplicar(A.CompararCom("marte"))
        app.abrir("comparar")
        app.passo(0)
        cx = app.sobreposicao
        self.aplicar(self.clicar(self.widget("btn_inverter_cmp").rect.center))
        self.assertEqual((app.ui.selecionado, app.ui.comparando), ("marte", "terra"))
        self.assertIn("A · Marte", self.texto())
        app.foco.definir("cmp_A")
        self.aplicar(self.tecla(pygame.K_LEFT))
        self.assertEqual(app.ui.selecionado, "terra")
        self.assertIn("A e B são iguais", self.texto())
        self.assertIs(app.sobreposicao, cx)
        self.aplicar(self.tecla(pygame.K_LEFT))
        self.assertIn("A · Vênus", self.texto())

    def test_focar_sol_e_abrir_sua_matematica(self):
        app = self.app
        app.aplicar(A.Selecionar("sol"))
        app.passo(0)
        self.assertEqual(self.widget("btn_focar").texto, "Focar Sol")
        self.aplicar(self.clicar(self.widget("btn_focar").rect.center))
        self.assertEqual(app.camera.seguindo, 0)
        for _ in range(30):
            app.passo(1 / 60)
        self.assertTrue(np.allclose(app.camera.centro_ua, app.estado.pos[0, :2]))
        self.assertLess(app.camera.raio_visivel_ua, 2)
        self.assertIsNone(app.sobreposicao)

        app.abrir("detalhes", "sol")
        app.passo(0)
        self.assertEqual(self.widget("btn_lab_daqui").texto, "Matemática do Sol")
        self.aplicar(self.clicar(self.widget("btn_lab_daqui").rect.center))
        self.assertEqual(app.ui.tela_aberta, "matematica_sol")
        self.assertEqual(app.tela_ativa, "sistema")
        self.assertIn("Aceleração gravitacional resultante", self.texto())
        self.assertIn("Contribuição de cada sistema planetário", self.texto())
        self.assertGreater(app.sobreposicao.rolagem_maxima, 0)

        cx = app.sobreposicao
        texto_antes = self.texto()
        app.relogio.pausado = False
        app.relogio.dias_por_segundo = 300
        app.passo(.1)
        self.assertIs(app.sobreposicao, cx)
        self.assertNotEqual(self.texto(), texto_antes)
        self.assertEqual(app.camera.seguindo, 0)

    def test_matematica_sol_soma_as_forcas_do_integrador(self):
        estado = self.app.estado
        analise = analisar_sol(estado)
        self.assertTrue(np.allclose(analise["aceleracao_ua_d2"],
                                    aceleracao(estado.pos, estado.gm)[0],
                                    rtol=1e-13, atol=0))
        self.assertTrue(np.allclose(analise["aceleracao_ua_d2"],
                                    analise["parcelas_ua_d2"].sum(axis=0),
                                    rtol=1e-13, atol=0))
        self.assertTrue(np.isfinite(analise["posicao_relativa_ua"]).all())
        self.assertTrue(np.isfinite(analise["velocidade_relativa_ua_d"]).all())

    def test_estrelas_reproduziveis_inofensivas_e_persistidas(self):
        app = self.app
        estado, vel = app.estado.pos.copy(), app.estado.vel.copy()
        pontos = app.cena._pontos_tela.copy()
        alvos = [app.cena.corpo_em(p) for p in pontos]
        img_sem = pygame.image.tobytes(app.janela.tela, "RGB")
        app.aplicar(A.Alternar("estrelas"))
        app.passo(0)
        self.assertFalse(img_sem == pygame.image.tobytes(app.janela.tela, "RGB"))
        self.assertTrue(np.array_equal(estado, app.estado.pos))
        self.assertTrue(np.array_equal(vel, app.estado.vel))
        self.assertTrue(np.array_equal(pontos, app.cena._pontos_tela))
        self.assertEqual(alvos, [app.cena.corpo_em(p) for p in pontos])
        outra = CenaSistema(app.corpos, app.cena.tema)
        self.assertEqual(outra.estrelas, app.cena.estrelas)
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(preferencias, "ARQUIVO", str(Path(tmp) / "preferencias.json")):
                app.salvar_preferencias()
                salvo = EstadoUI.de_dicionario(preferencias.carregar())
                self.assertTrue(salvo.opcoes["estrelas"])
                self.assertTrue(json.loads(Path(preferencias.ARQUIVO).read_text())["opcoes"]["estrelas"])
        self.assertFalse(EstadoUI.de_dicionario({"opcoes": {}}).opcoes["estrelas"])

    def test_campo_visao_zoom_modos_resize_e_compressao(self):
        app = self.app
        estado = app.estado.pos.copy()
        texto = app.tela.texto_campo
        app.aplicar(A.AjustarZoom(2))
        app.passo(0)
        self.assertNotEqual(texto, app.tela.texto_campo)
        for esc in ("real", "raiz"):
            app.aplicar(A.DefinirEscalaVisual(esc))
            for modo in ("internos", "sistema"):
                app.aplicar_modo(modo, animado=False)
                for tamanho in ((1280, 800), (960, 600)):
                    pygame.display.set_mode(tamanho, pygame.HIDDEN)
                    app.janela.tela = pygame.display.get_surface()
                    app.janela._layout_sujo = True
                    app.passo(0)
                    a = app.janela.areas
                    self.assertEqual(a.rodape.height, 0)
                    self.assertEqual(a.canvas.bottom, a.janela.bottom)
                    self.assertTrue(a.canvas.contains(app.tela.rect_campo))
                    self.assertFalse(a.lateral.colliderect(app.tela.rect_campo))
                    valor = app.camera.raio_visivel_ua * 2
                    self.assertIn(fmt.ua(valor, 3 if valor < 1 else 1), app.tela.texto_campo)
                    self.assertEqual("comprimido" in app.tela.texto_campo, esc == "raiz")
        self.assertTrue(np.array_equal(estado, app.estado.pos))

    def test_fichas_fontes_e_orbita_atual_separadas(self):
        app = self.app
        for chave in PLANETAS:
            app.abrir("detalhes", chave)
            app.passo(0)
            texto = self.texto()
            for esperado in ("Visão geral", "Características físicas", "Órbita", "Condições",
                             "Curiosidades", "dados externos", "baricentro", PLANETAS[chave]["fonte"]):
                self.assertIn(esperado, texto)
            cx = app.sobreposicao
            cx.rolar(40)
            app.relogio.pausado = False
            app.passo(.1)
            app.relogio.pausado = True
            self.assertIs(app.sobreposicao, cx)
            self.assertEqual(cx.rolagem, 40)
            self.assertIn(fmt.ua(distancia_ao_sol_ua(app.estado, app.indice(chave)), 4), self.texto())
        url = PLANETAS["mercurio"]["fonte"]
        self.assertEqual("".join(app.tipo.quebrar(url, "pequeno", 100)), url)

    def test_espaco_lateral_nao_arrasta_o_canvas(self):
        r = self.app.janela.areas.lateral
        p = (r.x + 2, r.bottom - 2)
        self.eventos(pygame.event.Event(pygame.MOUSEBUTTONDOWN, button=1, pos=p))
        self.assertEqual(self.eventos(pygame.event.Event(pygame.MOUSEMOTION,
                         pos=(p[0] + 40, p[1] - 60))), [])


    def test_lateral_rolada_nao_captura_clique_no_topo(self):
        app = self.app
        app.aplicar(A.Alternar("painel"))
        app.passo(0)
        ajuda = self.widget("btn_ajuda")
        for _ in range(12):
            app.aplicar(("roda_lateral", -2))
            app.passo(0)
            self.assertEqual(app._raiz.em(ajuda.rect.center).id, "btn_ajuda")
        self.aplicar(self.tecla(pygame.K_HOME))
        self.assertEqual(app.tela.rolagem_lateral, 0)
        self.aplicar(self.tecla(pygame.K_END))
        self.assertEqual(app.tela.rolagem_lateral, app.tela.rolagem_maxima)


if __name__ == "__main__":
    unittest.main(verbosity=2)
