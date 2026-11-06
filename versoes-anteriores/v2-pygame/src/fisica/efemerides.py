"""
Le grandezas uteis a partir do estado atual: distancia, velocidade, elementos
da elipse que o corpo esta percorrendo neste instante.

Sobre "elementos osculadores": a orbita de um planeta nao e uma elipse fixa.
Os outros planetas puxam, e a elipse muda de forma devagar. O que se calcula
aqui e a elipse que o corpo seguiria SE, a partir deste instante, so o Sol
existisse. E uma foto instantanea, nao uma promessa sobre o futuro.

Ponto importante -- e exatamente o erro que a versao anterior do projeto tinha
em versoes-anteriores/v1-fourier/utils/lib.py: para calcular elementos HELIOCENTRICOS e
preciso usar posicao e velocidade RELATIVAS AO SOL. Usar os vetores
baricentricos com a gravidade solar mistura dois referenciais. O Sol se move
cerca de 0,005 UA em torno do baricentro (puxado principalmente por Jupiter),
e para Venus isso chega a inflar a excentricidade calculada em 2,5 vezes.
"""

import numpy as np

UA_KM = 149597870.7
DIA_S = 86400.0


def _relativo_ao_sol(estado, i, i_sol=0):
    """Posicao e velocidade do corpo i vistas do Sol. A base de tudo aqui."""
    return estado.pos[i] - estado.pos[i_sol], estado.vel[i] - estado.vel[i_sol]


def distancia_ao_sol_ua(estado, i, i_sol=0) -> float:
    r, _ = _relativo_ao_sol(estado, i, i_sol)
    return float(np.linalg.norm(r))


def velocidade_orbital(estado, i, i_sol=0) -> float:
    """Velocidade relativa ao Sol, em UA/dia."""
    _, v = _relativo_ao_sol(estado, i, i_sol)
    return float(np.linalg.norm(v))


def km_por_s(ua_por_dia: float) -> float:
    return ua_por_dia * UA_KM / DIA_S


def elementos_osculadores(estado, i, i_sol=0) -> dict:
    """Elipse instantanea do corpo i em torno do Sol.

    mu = GM(Sol) + GM(corpo): o problema de dois corpos depende da massa
    total, nao so da do Sol. Para Jupiter a diferenca no semieixo e de 0,1%.

    Devolve semieixo maior (UA), excentricidade, perielio e afelio (UA),
    periodo (dias) e inclinacao em relacao a ecliptica (graus).
    """
    r_vec, v_vec = _relativo_ao_sol(estado, i, i_sol)
    mu = float(estado.gm[i_sol] + estado.gm[i])

    r = float(np.linalg.norm(r_vec))
    v2 = float(v_vec @ v_vec)

    # Energia especifica: eps = v^2/2 - mu/r, e a = -mu/(2 eps)
    energia = v2 / 2.0 - mu / r
    if energia >= 0:
        return {"ligada": False, "a": float("inf"), "e": float("nan"),
                "perielio": float("nan"), "afelio": float("nan"),
                "periodo_dias": float("nan"), "inclinacao_graus": float("nan")}
    a = -mu / (2.0 * energia)

    h_vec = np.cross(r_vec, v_vec)                 # momento angular especifico
    h = float(np.linalg.norm(h_vec))
    e_vec = np.cross(v_vec, h_vec) / mu - r_vec / r   # vetor de Laplace-Runge-Lenz
    e = float(np.linalg.norm(e_vec))

    inclinacao = float(np.degrees(np.arccos(np.clip(h_vec[2] / h, -1.0, 1.0)))) if h else 0.0

    return {"ligada": True, "a": float(a), "e": e,
            "perielio": float(a * (1 - e)), "afelio": float(a * (1 + e)),
            "periodo_dias": float(2 * np.pi * np.sqrt(a ** 3 / mu)),
            "inclinacao_graus": inclinacao}


def elipse_osculadora(estado, i, n_pontos=360, i_sol=0) -> np.ndarray:
    """Pontos (n,3) da elipse instantanea, em UA, ja no referencial da cena.

    Serve para desenhar o caminho previsto. E desenhada em torno da posicao
    atual do Sol, entao acompanha o Sol quando ele se desloca.
    """
    r_vec, v_vec = _relativo_ao_sol(estado, i, i_sol)
    mu = float(estado.gm[i_sol] + estado.gm[i])
    r = float(np.linalg.norm(r_vec))
    v2 = float(v_vec @ v_vec)
    energia = v2 / 2.0 - mu / r
    if energia >= 0:
        return np.empty((0, 3))

    a = -mu / (2.0 * energia)
    h_vec = np.cross(r_vec, v_vec)
    e_vec = np.cross(v_vec, h_vec) / mu - r_vec / r
    e = float(np.linalg.norm(e_vec))

    # Base ortonormal do plano da orbita: P aponta para o perielio, Q completa.
    if e > 1e-12:
        p_hat = e_vec / e
    else:                                    # orbita quase circular: base livre
        p_hat = r_vec / r
    w_hat = h_vec / np.linalg.norm(h_vec)
    q_hat = np.cross(w_hat, p_hat)

    # Parametrizacao pela anomalia excentrica: distribui pontos pela geometria.
    E = np.linspace(0.0, 2 * np.pi, n_pontos, endpoint=True)
    x = a * (np.cos(E) - e)
    y = a * np.sqrt(max(0.0, 1 - e * e)) * np.sin(E)
    return estado.pos[i_sol] + x[:, None] * p_hat + y[:, None] * q_hat


def fracao_de_volta(angulo_varrido_rad: float) -> float:
    return angulo_varrido_rad / (2 * np.pi)


def angulo_heliocentrico(estado, i, i_sol=0) -> float:
    """Angulo do corpo no plano da ecliptica, em radianos. Base da comparacao
    entre dois planetas: quanto cada um girou no mesmo intervalo."""
    r, _ = _relativo_ao_sol(estado, i, i_sol)
    return float(np.arctan2(r[1], r[0]))
