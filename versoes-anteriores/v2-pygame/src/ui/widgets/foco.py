"""
Foco do teclado: quem recebe Enter, e quando o anel aparece.

Copia o comportamento que o navegador chama de :focus-visible. O anel de foco
aparece quando a pessoa usa o teclado e some quando ela usa o mouse. Sem isso,
ou o anel nunca aparece (e quem navega por teclado se perde), ou ele aparece a
cada clique (e polui a tela para todo mundo).
"""


class GerenteFoco:
    def __init__(self):
        self.id_atual = None
        self.visivel = False
        self._ordem = []
        self._pilha = []          # foco salvo quando um modal abre

    def indexar(self, widgets):
        """Define a ordem de tabulacao: ordem de leitura, de cima para baixo.

        Se o widget que tinha o foco sumiu (painel recolhido, tela trocada), o
        foco volta para o comeco em vez de ficar apontando para o nada.
        """
        self._ordem = [w.id for w in widgets if w.focavel and w.visivel and w.habilitado]
        if self.id_atual not in self._ordem:
            self.id_atual = None

    def avancar(self, para_tras=False):
        if not self._ordem:
            self.id_atual = None
            return
        self.visivel = True
        if self.id_atual not in self._ordem:
            self.id_atual = self._ordem[-1 if para_tras else 0]
            return
        i = self._ordem.index(self.id_atual)
        self.id_atual = self._ordem[(i - 1 if para_tras else i + 1) % len(self._ordem)]

    def definir(self, id_widget, visivel=True):
        self.id_atual = id_widget
        self.visivel = visivel

    def esconder(self):
        """Chamado a cada clique de mouse: o anel some, o foco logico fica."""
        self.visivel = False

    def empilhar(self):
        """Guarda o foco antes de abrir um modal."""
        self._pilha.append((self.id_atual, self.visivel))
        self.id_atual = None

    def desempilhar(self):
        """Devolve o foco a quem abriu o modal, ao fecha-lo."""
        if self._pilha:
            self.id_atual, self.visivel = self._pilha.pop()
