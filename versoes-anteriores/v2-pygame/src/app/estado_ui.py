"""
O que a interface esta mostrando. Nao contem fisica e nao importa pygame.

Separado do estado fisico de proposito: trocar de modo, abrir um painel ou
selecionar um planeta nao pode, por construcao, alterar uma posicao ou o
relogio.
"""

from dataclasses import asdict, dataclass, field


@dataclass
class EstadoUI:
    modo: str = "sistema"
    vista: str = "2d"
    selecionado: str | None = None
    acompanhado: str | None = None
    comparando: str | None = None
    escala_visual: str = "real"
    painel_aberto: bool = False
    lateral_aberta: bool = True
    escala_texto: float = 1.0
    tutorial_visto: bool = False
    tela_aberta: str | None = None       # "ajuda", "detalhes", "dica", ...
    argumento_tela: str | None = None
    opcoes: dict = field(default_factory=lambda: {
        "orbitas": True,
        "trilhas": True,
        "rotulos": True,
        "grade": True,
        "tamanho_real": False,
        "tecnico": False,
        "estrelas": False,
    })

    def alternar(self, opcao):
        self.opcoes[opcao] = not self.opcoes.get(opcao, False)
        return self.opcoes[opcao]

    def para_dicionario(self):
        return asdict(self)

    @classmethod
    def de_dicionario(cls, d):
        """Ignora chaves desconhecidas: um arquivo de preferencias de uma
        versao antiga nao deve impedir o programa de abrir."""
        if not isinstance(d, dict):
            return cls()
        campos = {f for f in cls.__dataclass_fields__}
        limpo = {k: v for k, v in d.items() if k in campos}
        e = cls(**{k: v for k, v in limpo.items() if k != "opcoes"})
        if e.vista not in ("2d", "3d"):
            e.vista = "2d"
        if isinstance(limpo.get("opcoes"), dict):
            for k, v in limpo["opcoes"].items():
                if k in e.opcoes and isinstance(v, bool):
                    e.opcoes[k] = v
        return e
