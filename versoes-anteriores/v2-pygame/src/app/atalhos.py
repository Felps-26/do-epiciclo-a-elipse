"""
Atalhos de teclado.

Complementam os botoes; nenhum deles e a unica forma de fazer alguma coisa.
A lista mostrada na ajuda (dados/textos.ATALHOS) e escrita a mao, entao
tests/test_atalhos.py confere que ela e o mapa abaixo nao saem de sincronia --
que e exatamente o que acontecia com o rodape da versao anterior.
"""

import pygame

from src.app.acoes import (AbrirTela, AjustarZoom, AlternarPausa, Fechar,
                           MudarVelocidade, Sair, TrocarModo, VoltarAoInicio,
                           AlternarVista, VistaSuperior, AvancarPasso)

# tecla -> (acao, chave na lista de ATALHOS da ajuda)
MAPA = {
    pygame.K_v: (lambda: AlternarVista(), "V"),
    pygame.K_t: (lambda: VistaSuperior(), "T"),
    pygame.K_PERIOD: (lambda: AvancarPasso(), "."),
    pygame.K_SPACE: (lambda: AlternarPausa(), "Espaço"),
    pygame.K_1: (lambda: TrocarModo("sistema"), "1, 2, 3"),
    pygame.K_2: (lambda: TrocarModo("internos"), "1, 2, 3"),
    pygame.K_3: (lambda: TrocarModo("acompanhar"), "1, 2, 3"),
    pygame.K_EQUALS: (lambda: AjustarZoom(1.25), "+ e -"),
    pygame.K_PLUS: (lambda: AjustarZoom(1.25), "+ e -"),
    pygame.K_KP_PLUS: (lambda: AjustarZoom(1.25), "+ e -"),
    pygame.K_MINUS: (lambda: AjustarZoom(0.8), "+ e -"),
    pygame.K_KP_MINUS: (lambda: AjustarZoom(0.8), "+ e -"),
    pygame.K_LEFTBRACKET: (lambda: MudarVelocidade(passo=-1), "[ e ]"),
    pygame.K_RIGHTBRACKET: (lambda: MudarVelocidade(passo=+1), "[ e ]"),
    pygame.K_h: (lambda: TrocarModo("sistema"), "H"),
    pygame.K_r: (lambda: VoltarAoInicio(), "R"),
    pygame.K_F1: (lambda: AbrirTela("ajuda"), "F1 ou ?"),
    pygame.K_SLASH: (lambda: AbrirTela("ajuda"), "F1 ou ?"),
    pygame.K_QUESTION: (lambda: AbrirTela("ajuda"), "F1 ou ?"),
    pygame.K_c: (lambda: AbrirTela("comparar"), "C"),
    pygame.K_d: (lambda: AbrirTela("detalhes"), "D"),
    pygame.K_s: (lambda: AbrirTela("captura"), "S"),
}

# Setas movem a vista; tratadas a parte porque dependem da direcao.
SETAS = {
    pygame.K_LEFT: (-1, 0), pygame.K_RIGHT: (1, 0),
    pygame.K_UP: (0, -1), pygame.K_DOWN: (0, 1),
}


class AtalhosLab:
    """Teclas do laboratorio. Complementam os botoes, nunca os substituem."""

    MAPA = {
        pygame.K_LEFT: lambda: AbrirTela("lab_menos"),
        pygame.K_RIGHT: lambda: AbrirTela("lab_mais"),
        pygame.K_SPACE: lambda: AbrirTela("lab_pausa"),
        pygame.K_a: lambda: AbrirTela("lab_ampliar"),
        pygame.K_ESCAPE: lambda: Fechar(),
    }

    def resolver(self, tecla, mods):
        fabrica = self.MAPA.get(tecla)
        return fabrica() if fabrica else None


class Atalhos:
    def resolver(self, tecla, mods):
        if tecla == pygame.K_ESCAPE:
            return None            # ESC so fecha caixa; nao encerra o programa
        if tecla == pygame.K_q and (mods & pygame.KMOD_META or mods & pygame.KMOD_CTRL):
            return Sair()
        entrada = MAPA.get(tecla)
        return entrada[0]() if entrada else None

    @staticmethod
    def teclas_documentadas():
        return {rotulo for _, rotulo in MAPA.values()} | {"Tab", "Enter",
                                                          "Setas", "Esc"}
