"""Cena espacial em pygame, com ordenação de segmentos e discos por profundidade.

Renderizador ortográfico inicial: a profundidade de cada segmento é aproximada
pelo ponto médio. Não substitui um buffer de profundidade por pixel.
"""

import numpy as np
import pygame

from src.fisica.efemerides import elipse_osculadora
from src.ui import desenho
from src.ui.cenas.cena_sistema import CenaSistema, ANEIS_UA


class CenaSistema3D(CenaSistema):
    def __init__(self, corpos, tema):
        super().__init__(corpos, tema)
        self._primitivas = []
        self._profundidades = np.zeros(len(corpos))

    @staticmethod
    def _visual(pontos, escala, sol):
        return escala.aplicar(pontos, origem=sol)

    def _para_tela(self, pos_ua, camera, escala_visual, sol_ua):
        return camera.mundo_para_tela(self._visual(pos_ua, escala_visual, sol_ua))

    def desenhar(self, tela, ctx, estado, camera, escala_visual, opcoes, **kwargs):
        self._primitivas = []
        visual = self._visual(estado.pos, escala_visual, estado.pos[0])
        self._profundidades = camera.coordenadas_camera(visual)[:, 2]
        super().desenhar(tela, ctx, estado, camera, escala_visual, opcoes, **kwargs)

    def _curva(self, pontos, camera, escala, sol, cor):
        visual = self._visual(pontos, escala, sol)
        px = camera.mundo_para_tela(visual)
        z = camera.coordenadas_camera(visual)[:, 2]
        for j in range(len(px)-1):
            if np.isfinite(px[j:j+2]).all():
                self._primitivas.append(((z[j]+z[j+1])/2, "linha",
                                         (px[j], px[j+1], cor)))

    def _grade(self, tela, ctx, camera, escala_visual, sol_ua):
        ang = np.linspace(0, 2*np.pi, 97)
        for raio in ANEIS_UA:
            pontos = sol_ua + raio*np.column_stack((np.cos(ang), np.sin(ang), np.zeros_like(ang)))
            self._curva(pontos, camera, escala_visual, sol_ua, self.tema.grade)

    def _orbitas(self, tela, estado, camera, escala_visual, sol_ua, selecionado):
        for i, corpo in enumerate(self.corpos):
            if i == 0:
                continue
            pontos = elipse_osculadora(estado, i, n_pontos=180)
            if len(pontos):
                self._curva(pontos, camera, escala_visual, sol_ua,
                            self.tema.cor_da_orbita(corpo.chave, selecionado == i))

    def _trilhas(self, tela, trilhas, camera, escala_visual, sol_ua):
        for i, corpo in enumerate(self.corpos):
            pontos = trilhas.pontos(i)
            if len(pontos) > 1:
                self._curva(pontos, camera, escala_visual, sol_ua,
                            self.tema.cor_da_trilha(corpo.chave))

    def _corpos(self, tela, pontos, selecionado, acompanhado):
        for i, z in enumerate(self._profundidades):
            self._primitivas.append((z, "corpo", i))
        for _, tipo, dado in sorted(self._primitivas, key=lambda item: item[0]):
            if tipo == "linha":
                p, q, cor = dado
                # Recorte geométrico antes do desenho, sem limitar cada vértice
                # independentemente (isso deformaria segmentos fora da tela).
                segmento = tela.get_clip().clipline(tuple(p), tuple(q))
                if segmento:
                    pygame.draw.aaline(tela, cor, *segmento)
            else:
                i = dado
                corpo, raio = self.corpos[i], self._raios_px[i]
                desenho.disco(tela, pontos[i], self.tema.cor_do_corpo(corpo.chave),
                              raio, halo=min(96, int(raio*3.4)) if i == 0 else 0,
                              contorno=self.tema.texto if i == selecionado else None)
        if acompanhado is not None:
            desenho.anel_tracejado(tela, pontos[acompanhado], self.tema.acento,
                                   self._raios_px[acompanhado]+9)

    def corpo_em(self, pos_px, alcance_extra=4):
        distancias = np.linalg.norm(self._pontos_tela-np.asarray(pos_px), axis=1)
        # Em discos sobrepostos, o visível mais próximo tem prioridade.
        for i in np.argsort(self._profundidades)[::-1]:
            if distancias[i] <= self._raios_px[i]:
                return int(i)
        candidatos = np.flatnonzero(distancias <= np.maximum(self._raios_px+alcance_extra, 16))
        if len(candidatos):
            return int(min(candidatos, key=lambda i: (distancias[i], -self._profundidades[i])))
        return None
