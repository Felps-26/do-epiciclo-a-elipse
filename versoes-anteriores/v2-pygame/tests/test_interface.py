"""
Percorre a interface inteira sem abrir janela, exercitando os cenarios que
alguem testaria a mao.

    .venv/bin/python -m tests.test_interface

Cobre: primeira abertura, selecionar cada planeta, pausar e acelerar, zoom,
arrastar, redimensionar a janela, voltar a visao geral, abrir cada caixa, ler
os dados numa janela pequena, e a garantia de que nada disso mexe na fisica.
"""

import os
import sys

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np                                             # noqa: E402
import pygame                                                  # noqa: E402

from src.app import acoes as A                                 # noqa: E402
from src.app.aplicacao import Aplicacao                        # noqa: E402
from src.dados import textos                                   # noqa: E402

falhas = []


def checar(cond, msg):
    print(("  [ok]    " if cond else "  [FALHA] ") + msg)
    if not cond:
        falhas.append(msg)


def quadros(app, n=3, dt=1 / 60):
    for _ in range(n):
        if not app.passo(dt):
            return False
    return True


print("=" * 78)
print("PERCURSO PELA INTERFACE")
print("=" * 78)

# Comeca sem preferencias, como na primeira abertura de verdade.
from unittest.mock import patch
with patch("src.dados.preferencias.carregar", return_value={}):
    app = Aplicacao(visivel=False, largura=1280, altura=800)

# ---------------------------------------------------------------------------
print("\n1. Primeira abertura")
checar(app.ui.tela_aberta == "tutorial",
       "a orientacao de primeiro uso aparece sozinha uma vez")
checar(len(textos.TUTORIAL) == 3, f"ela tem {len(textos.TUTORIAL)} passos")
checar(quadros(app, 5), "desenha com a orientacao aberta")
app.aplicar(A.Fechar())
checar(app.ui.tela_aberta is None and app.ui.tutorial_visto,
       "pode ser dispensada e nao volta")
checar(quadros(app, 5), "a simulacao segue utilizavel depois de dispensar")
checar(app.ui.modo == "sistema", "abre na visao geral do sistema completo")
visiveis = [w.id for w in app._raiz.alcancaveis()]
for essencial in ("btn_pausa", "btn_rapido", "btn_devagar", "grp_modo",
                  "btn_focar", "btn_ajuda"):
    checar(essencial in visiveis, f"controle sempre visivel: {essencial}")
checar("opt_trilhas" not in visiveis,
       "as opcoes secundarias comecam escondidas em Mais opcoes")

# ---------------------------------------------------------------------------
print("\n2. Selecionar cada planeta")
for corpo in app.corpos[1:]:
    app.aplicar(A.Selecionar(corpo.chave))
    ok = quadros(app, 2) and app.ui.selecionado == corpo.chave
    app.aplicar(A.AbrirTela("detalhes", corpo.chave))
    ok = ok and app.sobreposicao is not None and quadros(app, 2)
    app.aplicar(A.Fechar())
    checar(ok, f"{corpo.nome:<9} seleciona, mostra ficha e abre detalhes")

app.aplicar(A.Selecionar(None))
checar(app.ui.selecionado is None, "clicar no vazio limpa a selecao")

# ---------------------------------------------------------------------------
print("\n3. Pausar, acelerar e desacelerar")
app.aplicar(A.Selecionar("terra"))
quadros(app, 2)
t0 = app.estado.t_dias
app.aplicar(A.AlternarPausa())
quadros(app, 10)
checar(app.relogio.pausado and app.estado.t_dias == t0,
       "pausado: o tempo simulado nao anda")
app.aplicar(A.AlternarPausa())
quadros(app, 10)
checar(app.estado.t_dias > t0, "retomou: o tempo volta a andar")

v0 = app.relogio.dias_por_segundo
for _ in range(20):
    app.aplicar(A.MudarVelocidade(passo=+1))
checar(app.relogio.dias_por_segundo > v0
       and app.relogio.dias_por_segundo <= app.relogio.teto_dias_por_segundo,
       f"acelerou de {v0:.0f} ate {app.relogio.dias_por_segundo:,.0f} dias/s "
       f"(teto medido: {app.relogio.teto_dias_por_segundo:,.0f})")
checar(app.relogio.no_maximo(), "o botao de acelerar desativa no teto")

antes = app.estado.t_dias
quadros(app, 30)
avanco = app.estado.t_dias - antes
checar(avanco > 0 and abs(avanco % 0.5) < 1e-9,
       f"na velocidade maxima avancou {avanco} dias, multiplo exato do passo")
checar(app.relogio.data_curta() ==
       (app.epoca + __import__("datetime").timedelta(days=app.estado.t_dias)).strftime("%d/%m/%Y"),
       f"a data exibida ({app.relogio.data_curta()}) corresponde ao estado fisico")

for _ in range(20):
    app.aplicar(A.MudarVelocidade(passo=-1))
checar(app.relogio.no_minimo(), "desacelerou ate o minimo")
app.aplicar(A.MudarVelocidade(valor=30.0))

# ---------------------------------------------------------------------------
print("\n4. Velocidade impossivel e avisada, nao disfarcada")
rel = app.sim.avancar(1 / 60, 10_000_000)
checar(rel.atrasado, "pedido absurdo marca atraso")
checar(rel.dias_dados == app.sim.passos_max_por_quadro * app.sim.dt_dias,
       f"entregou o orcamento inteiro ({rel.dias_dados} dias) e nada alem")
checar(textos.RODAPE["atrasado"], "existe texto de aviso para mostrar na tela")

# ---------------------------------------------------------------------------
print("\n5. Zoom e arrastar")
campo0 = app.camera.raio_visivel_ua
for _ in range(8):
    app.aplicar(("roda_canvas", (1.0, app.janela.areas.canvas.center)))
checar(app.camera.raio_visivel_ua < campo0,
       f"aproximou: campo de {campo0:.1f} para {app.camera.raio_visivel_ua:.3f} UA")
for _ in range(16):
    app.aplicar(("roda_canvas", (-1.0, app.janela.areas.canvas.center)))
checar(app.camera.raio_visivel_ua > campo0, "afastou de volta")
checar(quadros(app, 3), "desenha em qualquer nivel de zoom")

centro0 = app.camera.centro_ua.copy()
app.aplicar(("arrastar_canvas", (120, -60)))
checar(not np.allclose(centro0, app.camera.centro_ua), "arrastar move a vista")

# ---------------------------------------------------------------------------
print("\n6. Modos de exploracao e foco em planeta")
pos_antes = app.estado.pos.copy()
t_antes = app.estado.t_dias
for modo in ("internos", "sistema"):
    app.aplicar(A.TrocarModo(modo))
    checar(quadros(app, 2) and app.ui.modo == modo,
           f"modo {textos.MODOS[modo]}")
app.aplicar(A.Acompanhar("marte"))
checar(app.ui.acompanhado == "marte" and app.camera.seguindo is not None,
       "acompanha Marte")
quadros(app, 40)          # a transicao de camera leva 0,45 s
checar(not app.camera.em_transicao, "a transicao de camera termina")
centro_tela = np.array(app.janela.areas.canvas.center)
d = np.linalg.norm(app.camera.mundo_para_tela(app.estado.pos[4]) - centro_tela)
checar(d < 1.0, f"Marte fica travado no centro do quadro (desvio {d:.2f} px)")
app.aplicar(A.MudarVelocidade(valor=3650.0))
quadros(app, 30)
d = np.linalg.norm(app.camera.mundo_para_tela(app.estado.pos[4]) - centro_tela)
checar(d < 1.0, f"e continua no centro a 3650 dias/s (desvio {d:.2f} px)")
app.aplicar(A.MudarVelocidade(valor=30.0))
app.aplicar(A.Acompanhar(None))
checar(app.ui.acompanhado is None and app.ui.modo == "sistema",
       "soltar a camera volta para a visao geral")
checar(app.estado.t_dias > t_antes, "o relogio nao parou durante as trocas")

# ---------------------------------------------------------------------------
print("\n7. Escala comprimida: muda o desenho, nao os numeros")
from src.fisica.efemerides import distancia_ao_sol_ua                # noqa: E402
app.relogio.pausado = True            # senao o teste mede o tempo passando
quadros(app, 2)
d_real = distancia_ao_sol_ua(app.estado, 8)
pos_fisica = app.estado.pos.copy()
app.aplicar(A.DefinirEscalaVisual("raiz"))
quadros(app, 3)
checar(app.ui.escala_visual == "raiz", "compressao ligada")
checar(np.array_equal(app.estado.pos, pos_fisica),
       "nenhuma posicao fisica foi alterada")
checar(abs(distancia_ao_sol_ua(app.estado, 8) - d_real) < 1e-12,
       f"a distancia de Netuno continua {d_real:.3f} UA")
checar("comprimido" in app.tela.texto_campo and app.janela.areas.rodape.height == 0,
       "campo identifica compressao e canvas ocupa a antiga faixa")
app.aplicar(A.DefinirEscalaVisual("real"))
quadros(app, 2)
app.relogio.pausado = False

# ---------------------------------------------------------------------------
print("\n8. Todas as caixas abrem, desenham e fecham")
app.aplicar(A.Selecionar("jupiter"))
app.aplicar(A.CompararCom("terra"))
for tela in ("ajuda", "tutorial", "detalhes", "comparar", "atividades"):
    app.abrir(tela, "jupiter" if tela == "detalhes" else None)
    ok = app.sobreposicao is not None and quadros(app, 3)
    n_botoes = len(app.sobreposicao.itens) if app.sobreposicao else 0
    app.aplicar(A.Fechar())
    ok = ok and app.sobreposicao is None
    checar(ok, f"caixa '{tela}' abre com {n_botoes} botao(oes), desenha e fecha")

for chave in textos.DICAS:
    app.aplicar(A.MostrarDica(chave))
    ok = app.sobreposicao is not None and quadros(app, 2)
    app.aplicar(A.Fechar())
    checar(ok, f"dica '{chave}' abre sob demanda")

# ---------------------------------------------------------------------------
print("\n8b. Laboratorio Kepler x Fourier (tela separada, nao caixa)")
app.aplicar(A.Selecionar("mercurio"))
quadros(app, 2)
t_antes = app.estado.t_dias
pausado_antes = app.relogio.pausado
app.aplicar(A.AbrirTela("lab"))
checar(app.tela_ativa == "lab" and app.lab.nome == "Mercúrio",
       f"abre no planeta escolhido ({app.lab.nome})")
checar(app.relogio.pausado, "a simulacao pausa enquanto o laboratorio esta aberto")
checar(app.lab.data == app.relogio.data_curta(),
       f"a elipse vem da simulacao em {app.lab.data}, nao de tabela")
checar(quadros(app, 30), "o laboratorio desenha")
checar(app.estado.t_dias == t_antes,
       "o relogio da simulacao nao andou enquanto o laboratorio estava aberto")
checar(app.lab.t > 0, f"a fase da orbita do laboratorio corre ({app.lab.t:.2f})")

erro_antes = app.lab.serie.erro(app.lab.n)[0]
for _ in range(4):
    app.aplicar(A.AbrirTela("lab_mais"))
quadros(app, 2)
erro_depois = app.lab.serie.erro(app.lab.n)[0]
checar(erro_depois < erro_antes / 10,
       f"mais ondas, menos desvio: {erro_antes:.1e} -> {erro_depois:.1e} UA "
       f"com {app.lab.n} ondas")
app.aplicar(A.AbrirTela("lab_ampliar"))
checar(app.lab.amplificar and quadros(app, 3), "ampliar a diferenca desenha")
app.aplicar(A.AbrirTela("lab_pausa"))
checar(not app.lab.tocando, "o laboratorio pausa")
ids_lab = [w.id for w in app._raiz.alcancaveis()]
checar(len(ids_lab) >= 5, f"controles do laboratorio: {ids_lab}")
app.aplicar(A.Fechar())
quadros(app, 3)
checar(app.tela_ativa == "sistema", "volta para o Sistema Solar")
checar(app.relogio.pausado == pausado_antes,
       "e o relogio volta ao estado em que estava")
checar(app.estado.t_dias > t_antes, "a simulacao volta a correr")

app.abrir("detalhes", "saturno")
quadros(app, 2)
checar(any(w.id == "btn_lab_daqui" for w in app.sobreposicao.itens),
       "a ficha de detalhes tem entrada para o laboratorio")
w = next(w for w in app.sobreposicao.itens if w.id == "btn_lab_daqui")
app.aplicar(w.ao_clique(w.rect.center))
quadros(app, 3)
checar(app.tela_ativa == "lab" and app.lab.nome == "Saturno",
       "e ela abre o laboratorio ja no planeta certo")
app.aplicar(A.Fechar())
quadros(app, 3)

print("\n9. Mais opcoes e cada alternavel")
app.aplicar(A.Alternar("painel"))
checar(app.ui.painel_aberto and quadros(app, 2), "o painel Mais opcoes abre")
ids = [w.id for w in app._raiz.alcancaveis()]
ids_opcoes = {w.id for w in app.tela.painel_opcoes.conteudo.itens}
for chave in ("orbitas", "trilhas", "rotulos", "grade", "tamanho_real", "estrelas"):
    checar(f"opt_{chave}" in ids_opcoes, f"opcao '{textos.OPCOES[chave]}' existe no painel rolavel")
for chave in ("orbitas", "trilhas", "rotulos", "grade", "tamanho_real"):
    antes = app.ui.opcoes[chave]
    app.aplicar(A.Alternar(chave))
    ok = app.ui.opcoes[chave] != antes and quadros(app, 2)
    app.aplicar(A.Alternar(chave))
    checar(ok, f"'{textos.OPCOES[chave]}' liga e desliga, e a tela redesenha")
app.aplicar(A.Alternar("tecnico"))
checar(quadros(app, 2), "o painel de dados tecnicos desenha")
app.aplicar(A.Alternar("tecnico"))
app.aplicar(A.Alternar("painel"))
checar(not app.ui.painel_aberto, "e o painel fecha de novo")

# ---------------------------------------------------------------------------
print("\n10. Redimensionar a janela")
pos_antes = app.estado.pos.copy()
for w, h in ((960, 600), (1024, 640), (1440, 900), (1920, 1080), (1000, 620),
             (1280, 800)):
    pygame.display.set_mode((w, h), pygame.HIDDEN)
    app.janela.tela = pygame.display.get_surface()
    app.janela._layout_sujo = True
    ok = quadros(app, 3)
    a = app.janela.areas
    dentro = (a.canvas.width > 0 and a.canvas.height > 0
              and a.topo.height + a.canvas.height + a.rodape.height == h)
    checar(ok and dentro,
           f"{w}x{h}: canvas {a.canvas.width}x{a.canvas.height}, "
           f"lateral {a.lateral.width}px"
           + (" (sobreposta)" if a.lateral_sobreposta else ""))
checar(np.array_equal(app.estado.pos, pos_antes) or app.estado.t_dias > 0,
       "redimensionar nao corrompe o estado fisico")

print("\n11. Janela pequena: os dados continuam legiveis")
pygame.display.set_mode((960, 600), pygame.HIDDEN)
app.janela.tela = pygame.display.get_surface()
app.janela._layout_sujo = True
app.aplicar(A.Selecionar("netuno"))
quadros(app, 3)
a = app.janela.areas
checar(a.lateral.width >= 260 or a.lateral_sobreposta,
       f"a lateral continua utilizavel ({a.lateral.width}px)")
app.abrir("detalhes", "netuno")
ok = quadros(app, 2) and app.janela.areas.janela.contains(app.sobreposicao.rect)
checar(ok, "a caixa de detalhes cabe inteira numa janela de 960x600")
app.aplicar(A.Fechar())

print("\n12. Voltar ao inicio")
pygame.display.set_mode((1280, 800), pygame.HIDDEN)
app.janela.tela = pygame.display.get_surface()
app.janela._layout_sujo = True
quadros(app, 2)
app.aplicar(A.MudarVelocidade(valor=3650.0))
quadros(app, 40)
checar(app.estado.t_dias > 100, f"avancou ate {app.relogio.data_curta()}")
app.aplicar(A.VoltarAoInicio())
checar(app.estado.t_dias == 0.0, "o relogio voltou a zero")
checar(np.array_equal(app.estado.pos, app.estado_inicial.pos),
       "as posicoes voltaram exatamente as da epoca inicial")
checar(app.relogio.data_curta() == "01/01/2026",
       f"a data voltou para {app.relogio.data_curta()}")
checar(quadros(app, 3), "e a simulacao continua rodando a partir dali")

print("\n13. Todo controle visivel responde a um clique de verdade")
# Nao basta chamar a acao na mao: e preciso passar pelo teste de acerto, que
# e onde os alternaveis dentro de "Mais opcoes" ficaram sem resposta porque o
# percurso nao descia no painel.
if not app.ui.painel_aberto:
    app.aplicar(A.Alternar("painel"))
quadros(app, 3)
checar(app.ui.painel_aberto, "Mais opcoes esta aberto para este bloco")
testados = sem_acao = 0
for rolagem in (0, -3, -3, -3, -3, -3, -3, -3, -3):
    if rolagem:
        app.aplicar(("roda_lateral", rolagem))
    quadros(app, 2)
    for w in list(app._raiz.alcancaveis()):
        if not (w.visivel and w.habilitado and w.rect.width):
            continue
        alvo = (w.rect_cabecalho.center if hasattr(w, "rect_cabecalho")
                and w.cabecalho_visivel else w.rect.center)
        if w not in app.tela.barra.itens and not app.janela.areas.lateral.collidepoint(alvo):
            continue   # pedaço recortado de um controle parcialmente visível
        achado = app._raiz.em(alvo)
        if achado is None or achado.id != w.id:
            sem_acao += 1
            checar(False, f"'{w.id}' esta visivel mas o clique nao chega nele "
                          f"(chegou em {achado.id if achado else 'nada'})")
            continue
        testados += 1
        if achado.ao_clique(alvo) is None and not isinstance(achado, type(w)):
            sem_acao += 1
checar(testados > 20 and sem_acao == 0,
       f"{testados} controles visiveis recebem clique no lugar certo")

ids_no_fim = {w.id for w in app._raiz.alcancaveis()}
for chave in ("comprimir", "texto_maior", "tecnico"):
    checar(f"opt_{chave}" in ids_no_fim,
           f"rolando a lateral chega-se a '{textos.OPCOES[chave]}'")
for chave in ("btn_atividades", "btn_lab", "btn_inicio"):
    checar(chave in ids_no_fim, f"rolando a lateral chega-se a '{chave}'")
checar(app.tela.rolagem_maxima > 0, "a lateral indica que ha mais conteudo")
while app.tela.rolagem_lateral > 0:
    app.aplicar(("roda_lateral", 3))
quadros(app, 2)
checar(app.tela.rolagem_lateral == 0, "e rola de volta ao topo")
if app.ui.painel_aberto:
    app.aplicar(A.Alternar("painel"))
quadros(app, 2)

print("\n14. Teclado: tudo alcancavel por Tab")
app.foco.indexar(app._raiz.alcancaveis())
vistos = set()
for _ in range(60):
    app.foco.avancar()
    if app.foco.id_atual in vistos:
        break
    vistos.add(app.foco.id_atual)
checar(len(vistos) >= 6, f"{len(vistos)} controles alcancaveis por Tab")
checar(app.foco.visivel, "o anel de foco aparece ao usar o teclado")
app.foco.esconder()
checar(not app.foco.visivel, "e some ao usar o mouse")

print("\n" + "=" * 78)
if falhas:
    print(f"RESULTADO: {len(falhas)} falha(s):")
    for f in falhas:
        print("   - " + f)
else:
    print("RESULTADO: todos os cenarios passaram.")
print("=" * 78)
raise SystemExit(1 if falhas else 0)
