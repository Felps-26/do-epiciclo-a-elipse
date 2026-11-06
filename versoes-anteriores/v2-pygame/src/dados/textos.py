"""
Todo o texto que aparece na tela, num lugar so.

Motivo de estar junto: assim da para ler tudo de uma vez e conferir se a
linguagem esta acessivel, se o tom esta consistente e se nada promete mais
precisao do que a simulacao tem. Espalhado pelo codigo, ninguem revisa.

Regras de escrita adotadas aqui:
  - Nada de "órbita real" nem "exata". A trajetória é um cálculo aproximado.
  - Separar sempre três coisas: o que o JPL mediu, o que o modelo calcula e o
    que é só recurso visual.
  - Frase curta, palavra comum. Quem abre isto pode nunca ter usado um
    programa científico.
"""

ABREVIACOES = {
    "sol": "Sol", "mercurio": "Mer.", "venus": "Vên.", "terra": "Ter.",
    "marte": "Mar.", "jupiter": "Júp.", "saturno": "Sat.", "urano": "Ura.",
    "netuno": "Net.",
}

BOTOES = {
    "pausar": "Pausar",
    "continuar": "Continuar",
    "mais_rapido": "Mais rápido",
    "mais_devagar": "Mais devagar",
    "visao_geral": "Visão geral",
    "focar": "Focar planeta",
    "ajuda": "Ajuda",
    "mais_opcoes": "Mais opções",
    "inicio": "Voltar ao início",
    "detalhes": "Ver detalhes",
    "comparar": "Comparar planetas",
    "atividades": "Atividades",
    "laboratorio": "Explorar a matemática",
    "fechar": "Fechar",
    "entendi": "Entendi",
    "pular": "Pular orientação",
    "proximo": "Próximo",
}

OPCOES = {
    "estrelas": "Mostrar estrelas",
    "orbitas": "Caminhos previstos",
    "trilhas": "Rastros percorridos",
    "rotulos": "Nomes dos planetas",
    "grade": "Anéis de distância",
    "tamanho_real": "Planetas no tamanho real",
    "comprimir": "Comprimir distâncias",
    "texto_maior": "Texto maior",
    "tecnico": "Mostrar dados técnicos",
}

AJUDA_OPCOES = {
    "estrelas": "Fundo decorativo fixo, sem efeito na física ou nos cliques.",
    "orbitas": "A elipse que o planeta percorreria se só o Sol existisse. "
               "É um cálculo a partir da posição de agora.",
    "trilhas": "O caminho por onde o planeta realmente passou nesta simulação.",
    "rotulos": "Liga e desliga os nomes ao lado de cada planeta.",
    "grade": "Círculos marcando 1, 5, 10, 20 e 30 UA de distância do Sol.",
    "tamanho_real": "No tamanho real, os planetas somem: a Terra fica mil "
                    "vezes menor que um pixel na visão geral.",
    "comprimir": "Aproxima os planetas distantes para todos caberem juntos. "
                 "A simulação continua usando as distâncias reais, e os "
                 "números da ficha não mudam.",
    "texto_maior": "Aumenta todas as letras e os botões.",
    "tecnico": "Mostra passo de integração, energia e desempenho.",
}

MODOS = {
    "sistema": "Sistema completo",
    "internos": "Planetas internos",
    "acompanhar": "Acompanhar planeta",
}

# Dicas curtas, acionadas pelo usuário. Nunca aparecem sozinhas.
DICAS = {
    "mercurio_rapido": (
        "Por que Mercúrio parece mais rápido?",
        "Porque ele é. Mercúrio está treze vezes mais perto do Sol que "
        "Júpiter, e quanto mais perto, mais forte a gravidade puxa e mais "
        "depressa o planeta precisa andar para não cair.\n\n"
        "Uma volta de Mercúrio leva 88 dias. Uma de Netuno leva 60 mil. "
        "Todos aqui andam no mesmo relógio: se você deixar rodando, "
        "Mercúrio dá centenas de voltas antes de Netuno completar uma."
    ),
    "tamanho_planetas": (
        "Por que os planetas são desenhados maiores?",
        "Porque no tamanho certo você não veria nenhum.\n\n"
        "A Terra tem 12.742 km de diâmetro e fica a 150 milhões de km do "
        "Sol. Se o Sol tivesse o tamanho de uma bola de futebol, a Terra "
        "seria um grão de areia a 25 metros dela.\n\n"
        "As posições são projetadas em 2D. Com Comprimir distâncias ligado, "
        "nem as distâncias desenhadas são proporcionais às reais."
    ),
    "distancias": (
        "Por que os quatro primeiros ficam amontoados?",
        "Também porque é assim mesmo. Netuno está 77 vezes mais longe do Sol "
        "que Mercúrio.\n\n"
        "Use \"Planetas internos\" para chegar perto dos quatro de dentro, ou "
        "ligue \"Comprimir distâncias\" em Mais opções para ver os oito "
        "espalhados — lembrando que aí o desenho deixa de estar em escala."
    ),
    "orbitas_mudam": (
        "A órbita muda de forma?",
        "Um pouco, sim. Cada planeta puxa os outros, e isso faz a elipse "
        "girar e mudar de formato devagar, ao longo de séculos.\n\n"
        "O caminho previsto que aparece na tela é a elipse deste instante. "
        "Daqui a mil anos simulados ela estará um pouco diferente."
    ),
    "sol_se_move": (
        "O Sol está se mexendo?",
        "Está. Júpiter é grande o bastante para balançar o Sol: os dois "
        "giram em torno de um ponto comum que fica um pouco fora da "
        "superfície solar.\n\n"
        "Nesta simulação o Sol sente a gravidade dos oito planetas, como "
        "eles sentem a dele. Em doze anos ele se desloca mais que o próprio "
        "raio."
    ),
    "data": (
        "De onde vem a data?",
        "A simulação começa em 1º de janeiro de 2026, com as posições e "
        "velocidades medidas pelo JPL, da NASA.\n\n"
        "A partir daí o programa calcula o resto, avançando de meio em meio "
        "dia. A data mostrada sempre corresponde ao que está desenhado."
    ),
}

# Os três blocos que o requisito pede separados.
HONESTIDADE = {
    "calcula": (
        "O que a simulação calcula",
        "A atração gravitacional entre o Sol e os oito planetas, todos ao "
        "mesmo tempo. Cada corpo puxa todos os outros, inclusive o Sol.\n\n"
        "As posições e velocidades de partida foram medidas pelo JPL, da "
        "NASA, para 1º de janeiro de 2026. Daí em diante o programa avança "
        "o tempo de meio em meio dia simulado.\n\n"
        "Distâncias, velocidades e datas mostradas vêm desse cálculo."
    ),
    "simplifica": (
        "O que a tela simplifica",
        "Os planetas são desenhados muito maiores que o tamanho real. No "
        "tamanho certo nenhum apareceria.\n\n"
        "A vista 2D olha de cima da eclíptica. Use Vista 3D (V) para "
        "orbitar a câmera e enxergar as inclinações reais. A vista 3D é "
        "ortográfica, sem perspectiva; os discos e segmentos são ordenados "
        "por profundidade, com oclusão aproximada.\n\n"
        "Se você ligar \"Comprimir distâncias\", as distâncias desenhadas "
        "deixam de ser proporcionais. O campo de visão indica a escala visual "
        "comprimida; as fichas continuam mostrando distâncias físicas em 3D."
    ),
    "nao_inclui": (
        "O que o modelo não inclui",
        "A Lua não entra como corpo separado: a Terra e a Lua contam como um "
        "ponto só, no centro de massa dos dois. Esse ponto fica a uns 4.700 "
        "km do centro da Terra — invisível nesta escala.\n\n"
        "Plutão, os asteroides e as demais luas não existem aqui.\n\n"
        "A relatividade geral também não. O efeito maior seria girar "
        "lentamente a órbita de Mercúrio.\n\n"
        "Por isso os resultados se afastam devagar das medidas do JPL. "
        "Comparando com a efeméride de referência, o desvio fica abaixo de "
        "0,5% da distância ao Sol ao longo de cem anos para frente ou para "
        "trás — Mercúrio é o caso mais difícil. É uma simulação para "
        "entender como o sistema se move, não um substituto da efeméride."
    ),
}

TUTORIAL = [
    ("Observe os oito planetas",
     "O Sol está no centro e os oito planetas se movem ao mesmo tempo, cada "
     "um na sua velocidade. Repare que os quatro de dentro ficam apertados "
     "perto do Sol: as distâncias na tela estão em escala."),
    ("Clique em um planeta",
     "Aparece uma ficha com a distância atual até o Sol, a velocidade e "
     "quanto tempo ele leva para dar uma volta. Clique duplo abre a ficha "
     "completa. Clique esquerdo escolhe A; direito escolhe B. Use Comparar planetas para abrir a comparação."),
    ("Mude a velocidade do tempo",
     "Use \"Mais rápido\" e \"Mais devagar\". A tela sempre mostra quanto "
     "tempo simulado passa a cada segundo real, e a data acompanha."),
]

ATIVIDADES = [
    ("Quem dá a volta primeiro?",
     "Coloque o tempo em 30 dias por segundo e observe Mercúrio e a Terra. "
     "Conte quantas voltas Mercúrio dá enquanto a Terra dá uma.",
     "Mercúrio leva 88 dias e a Terra, 365. Mercúrio dá pouco mais de "
     "quatro voltas no tempo de uma da Terra."),
    ("Terra e Marte: quem está mais longe?",
     "Clique na Terra e anote a distância até o Sol. Depois clique em Marte "
     "e compare.",
     "A Terra fica a cerca de 1 UA do Sol e Marte, entre 1,38 e 1,67 UA. "
     "Marte está sempre mais longe, mas a distância dele varia bem mais, "
     "porque a órbita é mais alongada."),
    ("O Sol fica parado?",
     "Use \"Planetas internos\", aumente o zoom bem perto do Sol e deixe o "
     "tempo correr rápido por um tempo.",
     "O Sol desenha um lacinho em volta de um ponto. Quem manda nisso é "
     "Júpiter, que puxa o Sol enquanto dá a volta de doze anos."),
    ("Por que Netuno demora tanto?",
     "Acompanhe Netuno na velocidade máxima e veja a data avançar enquanto "
     "ele completa uma volta.",
     "Netuno leva cerca de 165 anos. Ele está trinta vezes mais longe do "
     "Sol que a Terra, e quanto mais longe, mais devagar o planeta anda."),
]

RODAPE = {
    "ampliado": "Planetas desenhados maiores que o tamanho real",
    "comprimido": "DISTÂNCIAS COMPRIMIDAS — o desenho não está em escala",
    "atrasado": "Seu computador não está acompanhando esta velocidade",
    "escala_nao_linear": "escala não-linear — veja as distâncias na ficha",
}

ATALHOS = [
    ("V", "alterna entre vista 2D e 3D ortográfica"),
    ("T", "alinha a câmera 3D com a eclíptica"),
    (".", "pausa e avança um passo de 0,5 dia"),
    ("Espaço", "pausa e continua"),
    ("1, 2, 3", "troca o modo de exploração"),
    ("+ e -", "aumenta e diminui o zoom"),
    ("[ e ]", "muda a velocidade do tempo"),
    ("Tab", "anda pelos controles pelo teclado"),
    ("Enter", "aciona o controle em foco"),
    ("Setas", "move a vista"),
    ("H", "volta à visão geral"),
    ("R", "volta à data inicial"),
    ("F1 ou ?", "abre esta ajuda"),
    ("C", "abre a comparação"),
    ("D", "abre os detalhes do planeta"),
    ("S", "salva uma imagem da tela"),
    ("Esc", "fecha a caixa aberta"),
]


ESCALA_FICHA = (
    "As posições e velocidades físicas são 3D. Há vista superior 2D e câmera "
    "orbital 3D ortográfica, com inclinações reais e oclusão aproximada. "
    "Os discos são ampliados por padrão. Com Comprimir distâncias ligado, "
    "os raios visuais seguem a raiz quadrada da distância ao Sol "
    "(no plano XY em 2D, espacial em 3D); "
    "o desenho não está em escala linear. O campo de visão informa a extensão "
    "do menor lado do canvas em coordenadas visuais (não uma distância física "
    "uniforme quando comprimido). As medidas desta ficha não mudam com o zoom "
    "nem com a compressão."
)

CONTROLES = (
    "No canvas: clique esquerdo escolhe A, clique direito escolhe B. "
    "Clique no fundo com o esquerdo para limpar A ou com o direito para limpar B. "
    "A comparação só abre pelo botão Comparar planetas ou pelo atalho C. "
    "Arraste com o esquerdo para mover a vista 2D ou orbitar em 3D; "
    "roda ou trackpad dão zoom. As setas deslocam a câmera. "
    "V alterna 2D/3D; T alinha a câmera 3D com a eclíptica. "
    "Ponto (.) pausa e avança 0,5 dia. O botão Vista 3D/2D fica no canvas; "
    "vista superior e avanço unitário também estão em Mais opções.\n\n"
    "Clique duplo em um planeta no canvas ou na lista abre a ficha completa. "
    "O clique simples seleciona imediatamente; o segundo clique abre os detalhes. "
    "Na lista, Tab e Enter escolhem A; Shift+Enter escolhe B; D abre detalhes. "
    "Comparar planetas permite trocar qualquer lado e inverter A/B.\n\n"
    "Se o Sol estiver selecionado, Explorar a matemática mostra seu movimento "
    "e a atração exercida por cada planeta sobre ele. Focar Sol acompanha sua posição.\n\n"
    "Nas caixas: roda/trackpad, barra arrastável, setas para cima/baixo, "
    "Page Up/Down e Home/End rolam o texto. Tab percorre os controles; "
    "Esc ou Fechar fecham a caixa. No seletor A/B, esquerda/direita trocam o planeta. "
    "No painel lateral, Page Up/Down e Home/End também permitem rolar."
)
