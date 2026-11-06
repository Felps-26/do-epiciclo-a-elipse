"""Geometria espacial e regressões da integração 2D/3D, sem persistência."""

import os
import unittest
from unittest.mock import patch

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

import numpy as np
import pygame

from src.app import acoes as A
from src.app.aplicacao import Aplicacao
from src.app.estado_ui import EstadoUI
from src.projecao.camera import Camera2D, Quadro
from src.projecao.camera3d import Camera3D
from src.projecao.escala_visual import EscalaRaiz


class Geometria3D(unittest.TestCase):
    def setUp(self):
        self.camera = Camera3D(Quadro(20, 30, 800, 600))

    def test_base_ortonormal_ate_os_polos(self):
        for elevacao in (-np.pi/2, 0, .7, np.pi/2):
            self.camera.azimute = 1.2
            self.camera.elevacao = elevacao
            np.testing.assert_allclose(self.camera.base @ self.camera.base.T,
                                       np.eye(3), atol=1e-14)
            self.assertAlmostEqual(np.linalg.det(self.camera.base), 1)

    def test_z_visivel_e_superior_equivalente_a_2d(self):
        cam = self.camera
        pontos = np.array([[1., 2., 0.], [1., 2., 5.]])
        self.assertFalse(np.allclose(*cam.mundo_para_tela(pontos)))
        cam.vista_superior()
        plana = Camera2D(cam.quadro)
        np.testing.assert_allclose(cam.mundo_para_tela(pontos),
                                   plana.mundo_para_tela(pontos), atol=1e-12)

    def test_zoom_ancorado_e_resize(self):
        cam = self.camera
        ponto = (290, 225)
        mundo = cam.tela_para_mundo(ponto)
        cam.aplicar_zoom(2, ponto)
        np.testing.assert_allclose(cam.mundo_para_tela(mundo), ponto)
        campo = cam.raio_visivel_ua
        cam.definir_quadro(Quadro(0, 0, 400, 400))
        self.assertAlmostEqual(cam.raio_visivel_ua, campo)

    def test_acompanhar_alvo_movel_orbitar_e_zoom(self):
        cam = self.camera
        pos = np.array([[2., -1., 3.]])
        cam.seguir(0)
        cam.ir_para(pos[0])
        for _ in range(60):
            pos += [0.1, .2, -.3]
            cam.atualizar(1/60, pos)
        cam.arrastar(30, -20)
        cam.aplicar_zoom(2, (100, 100))
        cam.atualizar(0, pos)
        np.testing.assert_allclose(cam.centro_ua, pos[0])
        np.testing.assert_allclose(cam.mundo_para_tela(pos[0]), (420, 330))
        self.assertEqual(cam.seguindo, 0)
        cam.deslocar(10, 20)
        self.assertIsNone(cam.seguindo)

    def test_compressao_3d_preserva_direcao_e_origem(self):
        origem = np.array([1., 2., 3.])
        pontos = np.array([origem, origem+[3, 4, 12]])
        antes = pontos.copy()
        visual = EscalaRaiz().aplicar(pontos, origem)
        np.testing.assert_array_equal(pontos, antes)
        np.testing.assert_allclose(visual[0], origem)
        np.testing.assert_allclose(visual[1]-origem, (pontos[1]-origem)/np.sqrt(13))


class Integracao3D(unittest.TestCase):
    def setUp(self):
        with patch("src.dados.preferencias.carregar", return_value={"tutorial_visto": True}), \
             patch("src.fisica.calibragem.medir_passos_por_segundo", return_value=10000):
            self.app = Aplicacao(visivel=False, largura=960, altura=600)
        self.addCleanup(self.app.janela.encerrar)
        self.app.relogio.pausado = True
        self.app.passo(0)

    def test_vista_e_camera_nao_alteram_estado(self):
        app = self.app
        antes = app.estado.copia()
        for _ in range(3):
            app.aplicar(A.AlternarVista())
            app.aplicar(("arrastar_canvas", (30, 25)))
            app.aplicar(A.AjustarZoom(1.1))
            app.passo(0)
        np.testing.assert_array_equal(app.estado.pos, antes.pos)
        np.testing.assert_array_equal(app.estado.vel, antes.vel)
        self.assertEqual(app.estado.t_dias, antes.t_dias)
        self.assertEqual(app.sim.dt_dias, .5)

    def test_foco_com_compressao_usa_alvo_visual_em_3d(self):
        app = self.app
        app.aplicar(A.AlternarVista())
        app.aplicar(A.DefinirEscalaVisual("raiz"))
        app.aplicar(A.Acompanhar("netuno"))
        app.passo(1)
        q = app.camera.quadro
        np.testing.assert_allclose(app.cena._pontos_tela[8], q.center, atol=1e-10)
        app.aplicar(("arrastar_canvas", (40, 20)))
        app.aplicar(A.AjustarZoom(2, (100, 100)))
        app.passo(0)
        self.assertEqual(app.ui.acompanhado, "netuno")
        np.testing.assert_allclose(app.cena._pontos_tela[8], q.center, atol=1e-10)
        app.aplicar(A.AlternarVista())
        app.passo(0)
        self.assertEqual(app.ui.vista, "2d")
        np.testing.assert_allclose(app.cena._pontos_tela[8], q.center, atol=1e-10)

    def test_selecao_prioriza_disco_na_frente(self):
        app = self.app
        app.aplicar(A.AlternarVista())
        app.passo(0)
        cena = app.cena
        cena._pontos_tela[:] = (10000, 10000)
        cena._pontos_tela[1:3] = (300, 300)
        cena._raios_px[1:3] = 10
        cena._profundidades[1:3] = (-10, 10)
        self.assertEqual(cena.corpo_em((300, 300)), 2)
        cena._profundidades[1:3] = (10, -10)
        self.assertEqual(cena.corpo_em((300, 300)), 1)

    def test_passo_exato_pausa_e_retorno_do_lab(self):
        app = self.app
        app.aplicar(A.AlternarVista())
        pos, vel = app.sim.integrador.passo(app.estado.pos.copy(), app.estado.vel.copy(),
                                          app.estado.gm, .5)
        app.aplicar(A.AvancarPasso())
        app.passo(0)
        np.testing.assert_array_equal(app.estado.pos, pos)
        np.testing.assert_array_equal(app.estado.vel, vel)
        self.assertTrue(app.relogio.pausado)
        self.assertEqual(app.estado.t_dias, .5)
        self.assertEqual(app.relogio.t_dias, .5)
        antes = app.estado.copia()
        camera = app.camera
        app.aplicar(A.Selecionar("mercurio"))
        app.abrir_lab()
        app.passo(.1)
        app.sair_do_lab()
        app.passo(0)
        self.assertIs(app.camera, camera)
        self.assertEqual(app.ui.vista, "3d")
        np.testing.assert_array_equal(app.estado.pos, antes.pos)
        self.assertEqual(app.estado.t_dias, .5)

    def test_botao_e_teclas_passam_pelo_roteador(self):
        app = self.app
        botao = next(w for w in app._raiz.alcancaveis() if w.id == "btn_vista")
        eventos = [pygame.event.Event(tipo, pos=botao.rect.center, button=1)
                   for tipo in (pygame.MOUSEBUTTONDOWN, pygame.MOUSEBUTTONUP)]
        acoes = app.roteador.processar(eventos, app._raiz, app.camera.quadro,
                                      atalhos=app.atalhos)
        self.assertIn(A.AlternarVista(), acoes)
        for acao in acoes:
            app.aplicar(acao)
        app.passo(0)
        self.assertEqual(app.ui.vista, "3d")
        eventos = [pygame.event.Event(pygame.KEYDOWN, key=pygame.K_t, mod=0)]
        acoes = app.roteador.processar(eventos, app._raiz, app.camera.quadro,
                                      atalhos=app.atalhos)
        self.assertIn(A.VistaSuperior(), acoes)

    def test_ordenacao_visual_concorda_com_selecao(self):
        app = self.app
        app.aplicar(A.AlternarVista())
        estado = app.estado.copia()
        estado.pos[:] = [1000, 1000, 1000]
        centro = app.camera.centro_ua.copy()
        normal = app.camera.base[2]
        opcoes = {"grade": False, "orbitas": False, "trilhas": False, "rotulos": False}
        from src.projecao.escala_visual import ESCALAS
        for frente, atras in ((1, 2), (2, 1)):
            estado.pos[frente] = centro + normal
            estado.pos[atras] = centro - normal
            app.janela.tela.fill((0, 0, 0))
            app.cena.desenhar(app.janela.tela, app._contexto(), estado,
                             app.camera, ESCALAS["real"], opcoes)
            ponto = app.camera.quadro.center
            cor = app.cena.tema.cor_do_corpo(app.corpos[frente].chave)
            self.assertEqual(tuple(app.janela.tela.get_at(ponto))[:3], tuple(cor))
            self.assertEqual(app.cena.corpo_em(ponto), frente)

    def test_resize_e_opcoes_em_3d(self):
        app = self.app
        app.aplicar(A.AlternarVista())
        for tamanho in ((960, 600), (1280, 800)):
            pygame.display.set_mode(tamanho, pygame.HIDDEN)
            app.janela.tela = pygame.display.get_surface()
            app.janela.atualizar_layout(forcar=True)
            app.camera.definir_quadro(app.janela.areas.canvas)
            for esc in ("real", "raiz"):
                app.aplicar(A.DefinirEscalaVisual(esc))
                app.aplicar(A.AjustarZoom(1000000))
                app.passo(0)
                self.assertTrue(np.isfinite(app.cena._pontos_tela).all())
                app.aplicar(A.TrocarModo("sistema"))
                app.passo(1)
                self.assertIn("3D ortográfica", app.tela.texto_campo)

    def test_preferencia_vista_validada(self):
        self.assertEqual(EstadoUI.de_dicionario({"vista": "invalida"}).vista, "2d")
        ui = EstadoUI(vista="3d")
        self.assertEqual(EstadoUI.de_dicionario(ui.para_dicionario()).vista, "3d")


if __name__ == "__main__":
    unittest.main(verbosity=2)
