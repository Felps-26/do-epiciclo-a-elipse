"""Câmera orbital ortográfica. Geometria em UA, sem dependência gráfica."""

import numpy as np

from src.projecao.camera import Camera2D


class Camera3D(Camera2D):
    """Mesmos controles de enquadramento da 2D, com base espacial ortonormal.

    Profundidade positiva aponta para o observador. A projeção ortográfica
    preserva a escala no plano da tela; não simula perspectiva.
    """

    def __init__(self, quadro, centro_ua=(0, 0, 0), raio_ua=32):
        super().__init__(quadro, centro_ua, raio_ua)
        self.centro_ua = np.asarray(centro_ua, dtype=float).copy()
        self._alvo_centro = self.centro_ua.copy()
        self.azimute = 0.0
        self.elevacao = np.radians(35.0)

    @property
    def base(self):
        a, e = self.azimute, self.elevacao
        direita = np.array([np.cos(a), np.sin(a), 0.0])
        cima = np.array([-np.sin(a)*np.sin(e), np.cos(a)*np.sin(e), np.cos(e)])
        return np.array([direita, cima, np.cross(direita, cima)])

    def coordenadas_camera(self, pontos):
        return (np.asarray(pontos, dtype=float) - self.centro_ua) @ self.base.T

    def mundo_para_tela(self, pos_ua):
        p = self.coordenadas_camera(pos_ua)
        centro = np.array([self.quadro.x + self.quadro.width/2,
                           self.quadro.y + self.quadro.height/2])
        return centro + p[..., :2] * [self.px_por_ua, -self.px_por_ua]

    def tela_para_mundo(self, ponto_px):
        """Inversa no plano que passa pelo alvo e é paralelo à tela."""
        x = (ponto_px[0] - self.quadro.x - self.quadro.width/2) / self.px_por_ua
        y = (self.quadro.y + self.quadro.height/2 - ponto_px[1]) / self.px_por_ua
        return self.centro_ua + x*self.base[0] + y*self.base[1]

    def arrastar(self, dx_px, dy_px):
        """Orbita em torno do alvo; mantém o acompanhamento."""
        self.azimute = (self.azimute - dx_px*0.006) % (2*np.pi)
        self.elevacao = float(np.clip(self.elevacao + dy_px*0.006, -np.pi/2, np.pi/2))

    def deslocar(self, dx_px, dy_px):
        self.seguir(None)
        self.centro_ua += (-dx_px*self.base[0] + dy_px*self.base[1]) / self.px_por_ua
        self._alvo_centro = self.centro_ua.copy()
        self._transicao = 0.0

    def aplicar_zoom(self, fator, ancora_px=None):
        # Ao acompanhar, o corpo deve continuar no centro mesmo após o zoom.
        if self.seguindo is not None:
            ancora_px = None
        super().aplicar_zoom(fator, ancora_px)

    def vista_superior(self):
        self.azimute = 0.0
        self.elevacao = np.pi/2
