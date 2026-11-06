"""
Coloca os nomes dos planetas sem que eles se empilhem uns sobre os outros.

O problema aparece o tempo todo: na visao geral os quatro planetas internos
ficam a poucos pixels de distancia, e quando dois planetas se cruzam os nomes
se sobrepoem exatamente no momento em que a pessoa esta olhando para eles.

O algoritmo e guloso e simples -- sao nove corpos, nao vale complicar:

  1. descarta quem esta fora da area de desenho;
  2. ordena por prioridade: acompanhado, selecionado, maior, mais proximo do Sol;
  3. para cada um, testa oito posicoes em volta do corpo, na ordem de
     preferencia, e fica com a primeira que nao bate em nada;
  4. se nenhuma serve, tenta empurrar na vertical;
  5. se ainda nao serve, abrevia o nome; depois vira so um ponto.

Dois detalhes que fazem diferenca na pratica:

  - HISTERESE. Se o corpo ja tinha rotulo no quadro anterior, aquela posicao
    ganha preferencia. Sem isso os nomes ficam pulando de lado quando os
    planetas se aproximam, e a tela parece nervosa.
  - OBSTACULOS DA INTERFACE. Os retangulos dos paineis entram na conta. E o
    que impede o nome de Netuno de ser desenhado por baixo do painel lateral.

O corpo selecionado nunca e rebaixado: ele escolhe primeiro e os outros se
ajeitam em volta.
"""

from dataclasses import dataclass

import pygame

# (dx, dy) em unidades do deslocamento, na ordem de preferencia.
DIRECOES = ((1, 0), (-1, 0), (0, -1), (0, 1),
            (1, -1), (-1, -1), (1, 1), (-1, 1))
EMPURROES = (0, -14, 14, -28, 28, -42, 42)


@dataclass
class Candidato:
    chave: str
    nome: str
    abreviacao: str
    ponto: tuple           # centro do corpo, em pixels
    raio: float            # raio desenhado, em pixels
    prioridade: float
    selecionado: bool = False


@dataclass
class RotuloColocado:
    chave: str
    texto: str
    rect: pygame.Rect
    ancora: tuple
    modo: str              # "completo" | "abreviado" | "ponto"
    guia: bool


class PosicionadorRotulos:
    def __init__(self, folga=4):
        self.folga = folga
        self._anterior = {}        # chave -> indice da direcao usada

    def limpar(self):
        self._anterior.clear()

    def posicionar(self, candidatos, medir, quadro, obstaculos=()):
        """`medir(texto) -> (largura, altura)`. Devolve a lista colocada."""
        visiveis = [c for c in candidatos
                    if quadro.inflate(80, 80).collidepoint(c.ponto)]
        visiveis.sort(key=lambda c: -c.prioridade)

        ocupados = list(obstaculos)
        saida = []

        for cand in visiveis:
            colocado = self._colocar_um(cand, medir, quadro, ocupados)
            saida.append(colocado)
            if colocado.modo != "ponto":
                ocupados.append(colocado.rect)
            # O proprio disco do corpo tambem e obstaculo para os proximos.
            r = max(3, int(cand.raio))
            ocupados.append(pygame.Rect(cand.ponto[0] - r, cand.ponto[1] - r,
                                        2 * r, 2 * r))
        return saida

    def _colocar_um(self, cand, medir, quadro, ocupados):
        for modo, texto in (("completo", cand.nome), ("abreviado", cand.abreviacao)):
            if modo == "abreviado" and cand.selecionado:
                break                      # o selecionado nunca e abreviado
            largura, altura = medir(texto)
            ordem = self._ordem_de_direcoes(cand.chave)
            for i in ordem:
                dx, dy = DIRECOES[i]
                for empurrao in EMPURROES:
                    rect = self._rect_em(cand, dx, dy, largura, altura, empurrao)
                    if not self._cabe(rect, quadro):
                        continue
                    if any(rect.colliderect(o) for o in ocupados):
                        continue
                    self._anterior[cand.chave] = i
                    dist = abs(rect.centerx - cand.ponto[0]) + \
                        abs(rect.centery - cand.ponto[1])
                    return RotuloColocado(cand.chave, texto, rect, cand.ponto,
                                          modo, guia=dist > cand.raio + 26)
            if cand.selecionado:
                # Selecionado sempre aparece por extenso, mesmo apertado.
                rect = self._rect_em(cand, 1, 0, largura, altura, 0)
                rect.clamp_ip(quadro)
                self._anterior[cand.chave] = 0
                return RotuloColocado(cand.chave, texto, rect, cand.ponto,
                                      "completo", guia=True)

        self._anterior.pop(cand.chave, None)
        return RotuloColocado(cand.chave, "", pygame.Rect(cand.ponto, (0, 0)),
                              cand.ponto, "ponto", guia=False)

    def _ordem_de_direcoes(self, chave):
        """Direcao usada no quadro anterior vem primeiro: e a histerese."""
        ordem = list(range(len(DIRECOES)))
        anterior = self._anterior.get(chave)
        if anterior is not None:
            ordem.remove(anterior)
            ordem.insert(0, anterior)
        return ordem

    def _rect_em(self, cand, dx, dy, largura, altura, empurrao):
        d = cand.raio + 8
        cx = cand.ponto[0] + dx * (d + largura / 2 if dx else 0)
        cy = cand.ponto[1] + dy * (d + altura / 2 if dy else 0) + empurrao
        rect = pygame.Rect(0, 0, largura + 2 * self.folga, altura + self.folga)
        rect.center = (int(cx), int(cy))
        return rect

    def _cabe(self, rect, quadro):
        return quadro.contains(rect)
