"""
Acoes: o que o usuario pediu, como dado.

Um widget nunca muda o estado do programa. Ele devolve uma Acao, e a tela
decide o que fazer com ela, num lugar so. Quando alguem precisar descobrir
"por que clicar aqui fez aquilo", ha um unico ponto para olhar.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Acao:
    """Base de todas as acoes."""


@dataclass(frozen=True)
class Sair(Acao):
    pass


@dataclass(frozen=True)
class AlternarPausa(Acao):
    pass


@dataclass(frozen=True)
class AlternarVista(Acao):
    pass


@dataclass(frozen=True)
class VistaSuperior(Acao):
    pass


@dataclass(frozen=True)
class AvancarPasso(Acao):
    pass


@dataclass(frozen=True)
class MudarVelocidade(Acao):
    passo: int = 0                  # +1 acelera, -1 desacelera
    valor: float | None = None      # ou um valor direto em dias por segundo


@dataclass(frozen=True)
class TrocarModo(Acao):
    modo: str                       # "sistema" | "internos" | "acompanhar"


@dataclass(frozen=True)
class Selecionar(Acao):
    chave: str | None               # chave do corpo, ou None para limpar


@dataclass(frozen=True)
class Acompanhar(Acao):
    chave: str | None


@dataclass(frozen=True)
class VoltarAoInicio(Acao):
    pass


@dataclass(frozen=True)
class Alternar(Acao):
    opcao: str                      # "orbitas", "trilhas", "rotulos", ...


@dataclass(frozen=True)
class AjustarZoom(Acao):
    fator: float
    ancora: tuple | None = None


@dataclass(frozen=True)
class AbrirTela(Acao):
    tela: str                       # "ajuda", "detalhes", "comparar", "atividades", "lab"
    argumento: str | None = None


@dataclass(frozen=True)
class Fechar(Acao):
    pass


@dataclass(frozen=True)
class MostrarDica(Acao):
    chave: str


@dataclass(frozen=True)
class DefinirEscalaVisual(Acao):
    chave: str                      # "real" | "raiz"


@dataclass(frozen=True)
class CompararCom(Acao):
    chave: str | None


@dataclass(frozen=True)
class Mensagem(Acao):
    """Retorno visivel de uma acao, para o usuario saber que algo aconteceu."""

    texto: str


@dataclass(frozen=True)
class MudarComparacao(Acao):
    lado: str
    passo: int = 1


@dataclass(frozen=True)
class InverterComparacao(Acao):
    pass
