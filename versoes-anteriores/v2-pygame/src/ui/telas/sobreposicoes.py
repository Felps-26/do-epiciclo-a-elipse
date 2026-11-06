"""
As caixas que abrem por cima: ajuda, orientação inicial, dicas, detalhes
científicos, comparação entre planetas e atividades.

Todas seguem a mesma regra: aparecem porque o usuário pediu, fecham com Esc ou
com o botão, e prendem o foco do teclado enquanto estão abertas. A comparação
abre somente pelo controle Comparar planetas ou pelo atalho C.
A orientação inicial pode ser dispensada para sempre no primeiro clique.
"""

import numpy as np
import pygame

from src.app.acoes import (AbrirTela, Acompanhar, Fechar, MostrarDica,
                           MudarComparacao, InverterComparacao)
from src.dados import textos
from src.dados.fichas import ficha
from src.fisica.analise_sol import analisar_sol
from src.fisica.efemerides import (distancia_ao_sol_ua,
                                   DIA_S, UA_KM, elementos_osculadores, km_por_s,
                                   velocidade_orbital)
from src.ui import formato as fmt
from src.ui.widgets.botao import Botao
from src.ui.widgets.modal import Modal


class Caixa(Modal):
    """Modal com corpo de texto em blocos e botões no rodapé."""

    def __init__(self, id_widget, titulo, blocos=(), botoes=(), largura=560,
                 altura=430):
        super().__init__(id_widget, titulo, [], largura, altura, Fechar())
        self.blocos = list(blocos)          # [(subtitulo|None, texto)]
        self.botoes = list(botoes)

    def dispor_em(self, areas, ctx):
        super().dispor_em(areas, ctx)
        m = areas.metricas
        # O rodapé quebra em linhas; nunca invade o título nem sai da janela.
        antigos = {b.id: b for b in self.itens}
        linhas, linha, usado = [], [], 0
        limite = self.rect.width - m.px(40)
        for id_b, rotulo, acao in self.botoes:
            b = antigos.get(id_b) or Botao(id_b, rotulo, acao,
                                           primario=(acao == Fechar()))
            b.texto, b.acao = rotulo, acao
            largura = min(limite, max(b.medir(ctx)[0], m.px(100)))
            if linha and usado + largura > limite:
                linhas.append(linha)
                linha, usado = [], 0
            linha.append((b, largura))
            usado += largura + m.u
        if linha:
            linhas.append(linha)
        y = self.rect.bottom - m.px(14) - len(linhas) * (m.alvo_min + m.u)
        self.itens = []
        self.rect_conteudo.height = max(1, y - self.rect_conteudo.y - m.px(8))
        for linha in linhas:
            x = self.rect.right - m.px(20) - sum(w + m.u for _, w in linha) + m.u
            for b, largura in linha:
                b.dispor(pygame.Rect(x, y, largura, m.alvo_min))
                self.itens.append(b)
                x += largura + m.u
            y += m.alvo_min + m.u
        self._medir_blocos(ctx)

    def _medir_blocos(self, ctx):
        altura = 0
        for subtitulo, texto in self.blocos:
            if subtitulo:
                altura += ctx.tipo.altura_do_bloco(subtitulo, "corpo",
                                                   self.rect_conteudo.width)
                altura += ctx.metricas.px(2)
            altura += ctx.tipo.altura_do_bloco(texto, "pequeno",
                                               self.rect_conteudo.width)
            altura += ctx.metricas.px(10)
        self.medir_rolagem(altura, ctx)

    def atualizar(self, app, ctx):
        if getattr(self, "dados_ao_vivo", None):
            blocos = self.dados_ao_vivo(app)
            if blocos != self.blocos:
                self.blocos = blocos
                self._medir_blocos(ctx)

    def desenhar(self, ctx):
        super().desenhar(ctx)
        m = ctx.metricas
        r = self.rect_conteudo
        antigo = ctx.tela.get_clip()
        ctx.tela.set_clip(r)
        y = r.y - int(self.rolagem)
        for subtitulo, texto in self.blocos:
            if y > r.bottom:
                break
            if subtitulo:
                y = ctx.tipo.desenhar_bloco(ctx.tela, subtitulo, r.x, y,
                                            r.width, ctx.tema.texto, "corpo")
                y += m.px(2)
            y = ctx.tipo.desenhar_bloco(ctx.tela, texto, r.x, y, r.width,
                                        ctx.tema.texto_fraco, "pequeno")
            y += m.px(10)
        ctx.tela.set_clip(antigo)
        self.desenhar_barra(ctx)


def _caixa_ajuda(app):
    blocos = [(None, "Esta é uma simulação do Sol e dos oito planetas se "
                     "atraindo pela gravidade. Todos se movem no mesmo "
                     "relógio: Mercúrio dá muitas voltas enquanto Netuno "
                     "completa uma.")]
    blocos.append(("Controles e leitura", textos.CONTROLES))
    blocos.append(("Escala e campo de visão", textos.ESCALA_FICHA))
    for chave in ("calcula", "simplifica", "nao_inclui"):
        titulo, texto = textos.HONESTIDADE[chave]
        blocos.append((titulo, texto))
    blocos.append(("Atalhos de teclado",
                   "\n".join(f"{t} — {d}" for t, d in textos.ATALHOS)))
    return Caixa("cx_ajuda", "Como usar", blocos,
                 [("btn_fechar_ajuda", textos.BOTOES["fechar"], Fechar())],
                 largura=620, altura=520)


def _caixa_tutorial(app):
    blocos = [(None, "Três coisas para experimentar. Você pode fechar e "
                     "explorar por conta própria a qualquer momento.")]
    for i, (titulo, texto) in enumerate(textos.TUTORIAL, 1):
        blocos.append((f"{i}. {titulo}", texto))
    return Caixa("cx_tutorial", "Bem-vindo ao Sistema Solar", blocos,
                 [("btn_tut_ok", textos.BOTOES["entendi"], Fechar())],
                 largura=560, altura=430)


def _caixa_dica(app, chave):
    titulo, texto = textos.DICAS.get(
        chave, ("Dica", "Esta explicação ainda não existe."))
    outras = [(f"btn_dica_{k}", "Outra dica", MostrarDica(k))
              for k in list(textos.DICAS) if k != chave][:1]
    return Caixa("cx_dica", titulo, [(None, texto)],
                 outras + [("btn_fechar_dica", textos.BOTOES["fechar"], Fechar())],
                 largura=560, altura=380)


def _blocos_detalhes(app, chave):
    from src.dados.planetas import PLANETAS, FONTE_TABELA, FONTE_NOTAS, DATA_TABELA
    i = app.indice(chave)
    corpo = app.corpos[i]
    f = ficha(chave)
    dados = PLANETAS.get(chave)
    blocos = [("Visão geral", f["frase"])]
    if dados:
        rotacao = fmt.numero(abs(dados['rotacao_h']), 1)
        sentido = " (retrógrada)" if dados['rotacao_h'] < 0 else ""
        blocos.append(("Características físicas — dados externos do planeta",
            f"Raio médio volumétrico: {fmt.km(corpo.raio_km)} (JPL).\n"
            f"Diâmetro médio: {fmt.km(2 * corpo.raio_km)} (2 × raio).\n"
            f"Massa do planeta: {fmt.numero(dados['massa_1e24kg'], 3)} × 10²⁴ kg.\n"
            f"Gravidade efetiva no equador: {fmt.numero(dados['gravidade'], 1)} m/s²"
            + (" (nível de 1 bar)." if dados['aneis'] else ".") + "\n"
            f"Rotação sideral: {rotacao} h{sentido}.\n"
            f"Dia solar médio: {fmt.numero(dados['dia_solar_h'], 1)} h."))
    if i:
        el = elementos_osculadores(app.estado, i)
        medidas = (
            f"Instante: {app.relogio.data_curta()} — t = {fmt.numero(app.estado.t_dias, 1)} dias.\n"
            f"Distância ao Sol agora: {fmt.ua(distancia_ao_sol_ua(app.estado, i), 4)}.\n"
            f"Velocidade relativa ao Sol: {fmt.km_por_s(km_por_s(velocidade_orbital(app.estado, i)), 2)}.\n"
            f"Ano (período osculador): {fmt.dias(el['periodo_dias'])} "
            f"({fmt.anos(el['periodo_dias'] / 365.25, 2)}).\n"
            f"Semieixo maior: {fmt.ua(el['a'], 4)}; excentricidade: {fmt.numero(el['e'], 5)}.\n"
            f"Periélio: {fmt.ua(el['perielio'], 4)}; afélio: {fmt.ua(el['afelio'], 4)}.\n"
            f"Inclinação à eclíptica J2000: {fmt.graus(el['inclinacao_graus'])}.\n\n"
            "Medidas do baricentro do sistema planetário, não do centro do planeta. "
            "A elipse osculadora supõe apenas Sol e sistema planetário a partir de agora; "
            "seus elementos e seu período mudam com as perturbações dos outros corpos.")
        blocos.append(("Órbita — estado atual da simulação", medidas))
    else:
        blocos.append(("No modelo", "O Sol se move no referencial baricêntrico. "
                       "Não tem uma órbita heliocêntrica nem um período único. "
                       "Abra Matemática do Sol para ver o efeito gravitacional "
                       "dos oito sistemas planetários no instante atual."))
    if dados:
        blocos.append(("Condições — dados externos",
            f"Temperatura de referência: {dados['temperatura_c']} °C "
            f"({dados['temperatura_referencia']}). Não é previsão de clima.\n"
            f"Atmosfera: {dados['atmosfera']}\n"
            f"Luas: {dados['luas']} na tabela de {DATA_TABELA}; a contagem pode mudar.\n"
            f"Anéis: {'sim' if dados['aneis'] else 'não'}. Luas e anéis não são desenhados nem integrados separadamente."))
    blocos.extend([("Curiosidades e contexto", f["curiosidade"]),
                   ("Como interpretar o desenho", textos.ESCALA_FICHA)])
    if dados:
        blocos.append(("Fontes dos dados externos",
            "NASA/NSSDCA, Planetary Fact Sheet, tabela de " + DATA_TABELA +
            ". Consulta: 21/09/2026. Valores arredondados, mantidos offline.\n" +
            FONTE_TABELA + "\nAtmosfera e temperatura dos gigantes: " + dados['fonte'] +
            "\nDefinições: " + FONTE_NOTAS +
            "\nRaio: JPL Horizons, procedência em efemeride_2026-01-01.json. "
            "A massa desta ficha é do planeta; a GM usada na física é do sistema inteiro."))
    return blocos


def _caixa_detalhes(app, chave):
    i = app.indice(chave)
    if i is None:
        return _caixa_ajuda(app)
    corpo = app.corpos[i]
    cx = Caixa("cx_detalhes", corpo.nome,
        _blocos_detalhes(app, chave),
        [("btn_acompanhar", "Acompanhar", Acompanhar(chave)),
         ("btn_lab_daqui", "Matemática do Sol" if chave == "sol" else
          "Matemática da órbita", AbrirTela("lab", chave)),
         ("btn_fechar_det", "Fechar", Fechar())], largura=720, altura=620)
    cx.dados_ao_vivo = lambda app: _blocos_detalhes(app, chave)
    return cx


def _blocos_matematica_sol(app):
    estado = app.estado
    analise = analisar_sol(estado)
    pos = analise["posicao_relativa_ua"]
    vel = analise["velocidade_relativa_ua_d"]
    acel = analise["aceleracao_ua_d2"]
    conversao_acel = UA_KM * 1000 / DIA_S ** 2
    parcelas = analise["parcelas_ua_d2"]
    contribuicoes = sorted(
        ((app.corpos[i].nome, np.linalg.norm(parcelas[i - 1]) * conversao_acel)
         for i in range(1, len(app.corpos))), key=lambda item: item[1], reverse=True)
    return [
        ("O que está sendo medido",
         f"{app.relogio.data_curta()} — t = {fmt.numero(estado.t_dias, 1)} dias. "
         "Valores do estado 3D atual, relativos ao centro de massa dos nove "
         "corpos simulados. Esse centro não coincide exatamente com a origem "
         "da efeméride JPL, que inclui outros corpos."),
        ("Posição e velocidade do Sol",
         f"Distância ao centro de massa: {fmt.km(np.linalg.norm(pos) * UA_KM)}.\n"
         f"Velocidade relativa: {fmt.numero(np.linalg.norm(vel) * UA_KM * 1000 / DIA_S, 2)} m/s.\n"
         "Componentes x, y, z da posição (km): "
         + "; ".join(fmt.numero(v * UA_KM, 0) for v in pos) + "."),
        ("Aceleração gravitacional resultante",
         f"Módulo: {fmt.cientifico(np.linalg.norm(acel) * conversao_acel, 3, 'm/s²')}.\n"
         "Componentes x, y, z (m/s²): "
         + "; ".join(fmt.cientifico(v * conversao_acel, 2) for v in acel) + "."),
        ("A matemática usada pelo modelo",
         "Centro de massa: R = Σ(GMᵢ · rᵢ) / Σ GMᵢ.\n"
         "Velocidade do centro: V = Σ(GMᵢ · vᵢ) / Σ GMᵢ.\n"
         "Aceleração do Sol: a = Σⱼ GMⱼ · (rⱼ − r☉) / |rⱼ − r☉|³.\n\n"
         "Cada planeta puxa o Sol. As contribuições são vetores: algumas "
         "se reforçam e outras se cancelam. O integrador usa esta mesma lei "
         "para avançar todos os corpos."),
        ("Contribuição de cada sistema planetário",
         "Módulo da aceleração causada por cada um, em m/s²:\n"
         + "\n".join(f"{nome}: {fmt.cientifico(valor, 3, 'm/s²')}"
                      for nome, valor in contribuicoes)),
        ("Por que não há elipse de Kepler aqui",
         "A tela de Fourier dos planetas reconstrói uma elipse heliocêntrica "
         "de dois corpos. O Sol é a referência dessa elipse; sua trajetória "
         "em torno do centro de massa resulta de várias atrações ao mesmo "
         "tempo e não tem um período orbital único. Esta janela mostra as "
         "grandezas que a simulação realmente calcula para ele."),
    ]


def _caixa_matematica_sol(app):
    cx = Caixa("cx_matematica_sol", "Matemática do Sol",
               _blocos_matematica_sol(app),
               [("btn_fechar_mat_sol", "Fechar", Fechar())],
               largura=720, altura=610)
    cx.dados_ao_vivo = _blocos_matematica_sol
    return cx


def _blocos_comparar(app):
    a, b = app.ui.selecionado, app.ui.comparando
    ia, ib = app.indice(a), app.indice(b)
    intro = ("Trocar A ou B: clique no seletor, ou use Tab e as setas esquerda/direita. "
             "Todos os oito planetas estão disponíveis. Enter passa ao próximo.")
    if ia in (None, 0) or ib in (None, 0):
        return [("Escolha A e B", intro),
                (None, "Selecione dois planetas para ver os resultados aqui, nesta janela.")]
    if a == b:
        return [("A e B são iguais", "Escolha planetas diferentes para comparar."),
                ("Controles", intro)]
    blocos = [(None, f"{app.relogio.data_curta()} — t = {fmt.numero(app.estado.t_dias, 1)} dias. "
                     "Valores atualizados enquanto o tempo avança.")]
    for lado, i in (("A", ia), ("B", ib)):
        el = elementos_osculadores(app.estado, i)
        blocos.append((f"{lado} · {app.corpos[i].nome}",
            f"Distância ao Sol agora: {fmt.ua(distancia_ao_sol_ua(app.estado, i), 4)}\n"
            f"Velocidade agora: {fmt.km_por_s(km_por_s(velocidade_orbital(app.estado, i)), 2)}\n"
            f"Período osculador: {fmt.dias(el['periodo_dias'])} "
            f"({fmt.anos(el['periodo_dias'] / 365.25, 2)})"))
    blocos.extend([("O que os números significam",
        "Distância e velocidade são heliocêntricas, calculadas em 3D para os baricentros "
        "planetários no mesmo instante. O período é o da elipse osculadora, uma aproximação "
        "de dois corpos que muda com as perturbações. A velocidade varia durante a órbita; "
        "multiplicá-la pelo período não mede a distância percorrida. Nenhum percurso "
        "acumulado é apresentado aqui."), ("Controles", intro)])
    return blocos


class SeletorComparacao(Botao):
    def __init__(self, lado):
        self.lado = lado
        super().__init__("cmp_" + lado, "", MudarComparacao(lado), papel="pequeno")

    def ao_tecla(self, tecla, mods):
        if tecla in (pygame.K_LEFT, pygame.K_RIGHT):
            return MudarComparacao(self.lado, -1 if tecla == pygame.K_LEFT else 1)
        return super().ao_tecla(tecla, mods)


class CaixaComparacao(Caixa):
    def __init__(self, app):
        super().__init__("cx_comparar", "Comparar planetas", _blocos_comparar(app),
            [("btn_inverter_cmp", "Inverter A / B", InverterComparacao()),
             ("btn_fechar_cmp", "Fechar", Fechar())], largura=700, altura=580)
        self.seletores = [SeletorComparacao("A"), SeletorComparacao("B")]
        self.dados_ao_vivo = _blocos_comparar
        self._rotular(app)

    def _rotular(self, app):
        for w, chave in zip(self.seletores, (app.ui.selecionado, app.ui.comparando)):
            w.texto = f"{w.lado}: {app.nome(chave) or 'Escolher'} (trocar)"

    def dispor_em(self, areas, ctx):
        super().dispor_em(areas, ctx)
        m = ctx.metricas
        r = self.rect_conteudo
        largura = (self.rect.width - m.px(40) - m.u) // 2
        for i, w in enumerate(self.seletores):
            w.dispor(pygame.Rect(r.x + i * (largura + m.u), r.y, largura, m.alvo_min))
        self.itens = self.seletores + self.itens
        r.y += m.alvo_min + m.px(12)
        r.height -= m.alvo_min + m.px(12)
        self._medir_blocos(ctx)

    def atualizar(self, app, ctx):
        self._rotular(app)
        super().atualizar(app, ctx)


def _caixa_comparar(app):
    return CaixaComparacao(app)


def _caixa_atividades(app):
    blocos = [(None, "Cada uma pode ser respondida olhando a própria "
                     "simulação. A resposta está escrita junto, para "
                     "conferir depois de tentar.")]
    for titulo, tarefa, resposta in textos.ATIVIDADES:
        blocos.append((titulo, tarefa + "\n\nResposta: " + resposta))
    return Caixa("cx_atividades", "Coisas para experimentar", blocos,
                 [("btn_fechar_ativ", textos.BOTOES["fechar"], Fechar())],
                 largura=620, altura=520)


CONSTRUTORES = {
    "ajuda": lambda app, arg: _caixa_ajuda(app),
    "tutorial": lambda app, arg: _caixa_tutorial(app),
    "dica": lambda app, arg: _caixa_dica(app, arg),
    "detalhes": lambda app, arg: _caixa_detalhes(app, arg or app.ui.selecionado),
    "matematica_sol": lambda app, arg: _caixa_matematica_sol(app),
    "comparar": lambda app, arg: _caixa_comparar(app),
    "atividades": lambda app, arg: _caixa_atividades(app),
}


def construir(app, tela, argumento=None):
    construtor = CONSTRUTORES.get(tela)
    return construtor(app, argumento) if construtor else None
