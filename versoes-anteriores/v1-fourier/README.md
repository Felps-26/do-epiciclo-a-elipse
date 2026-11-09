# Simulação de órbitas planetárias com série de Fourier (v1)

Primeira versão do projeto, anterior à simulação gravitacional da [v2](../v2-pygame/README.md) e ao [simulador atual](../../simulador/). Ela aproxima a elipse de Kepler de cada planeta somando senos e cossenos (série de Fourier), a partir de um TCC da Maria Farias que está em `others/`. Não integra a gravitação: serve de referência científica para os elementos orbitais. Foi escrita antes da v2, iniciada em setembro de 2026.

O simulador que o artigo descreve está em [`simulador/`](../../simulador/).

## Como rodar no Windows

Precisa de Python 3.9 ou mais novo. No PowerShell, dentro desta pasta:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe main.py
```

O programa pergunta qual planeta simular (Mercúrio, Vênus, Terra, Marte, Júpiter, Saturno, Urano ou Netuno) e quantos termos de Fourier usar; de 3 a 10 termos é uma faixa razoável. Depois abre um gráfico com duas curvas:

- **Elipse de Kepler** (colorida): a elipse do problema de dois corpos, calculada a partir dos elementos orbitais da época J2000. Não é a trajetória exata do planeta, porque a órbita verdadeira muda devagar com a atração dos outros planetas.
- **Aproximação de Fourier** (tracejada preta): a mesma elipse reconstruída somando ondas. Quanto mais termos, mais próxima.

Para conferir os elementos orbitais contra valores tabelados:

```powershell
.venv\Scripts\python.exe -m tests.test_elementos_orbitais
```

No macOS e no Linux, troque `.venv\Scripts\python.exe` por `.venv/bin/python`.

## Estrutura

```
v1-fourier/
├── utils/lib.py
├── others/            notebook original e o TCC de referência
├── docs/              integração com o Astropy
├── tests/
├── main.py
└── requirements.txt
```

## Comparações

Os parâmetros orbitais são calculados dinamicamente via Astropy (`get_body_barycentric_posvel`) usando as efemérides embutidas no époco J2000, em vez de valores fixos no código.

| Planeta   | Semi-eixo ref. (UA) | Astropy (UA) | Exc. ref. | Astropy | Período ref. (dias) | Astropy (dias) |
|-----------|:-------------------:|:------------:|:---------:|:-------:|:-------------------:|:--------------:|
| Mercúrio  | 0.387               | 0.394        | 0.2056    | 0.1965  | 87.97               | 90.26          |
| Vênus     | 0.723               | 0.739        | 0.0068    | 0.0173  | 224.7               | 231.89         |
| Marte     | 1.524               | 1.505        | 0.0934    | 0.0867  | 686.98              | 674.47         |
| Júpiter   | ---                 | 5.177        | ---       | 0.0459  | ---                 | 4302.52        |
| Saturno   | ---                 | 9.514        | ---       | 0.0530  | ---                 | 10718.86       |
| Urano     | ---                 | 19.206       | ---       | 0.0483  | ---                 | 30742.77       |
| Netuno    | ---                 | 30.057       | ---       | 0.0068  | ---                 | 60187.71       |

As diferenças existem porque o TCC usa **elementos médios** (médias de longo prazo) enquanto o Astropy calcula **elementos osculadores instantâneos** no époco J2000 - ambos são fisicamente corretos e representam a mesma órbita em contextos diferentes.

## Conceitos

- **Órbita elíptica**: Trajetória natural dos planetas ao redor do Sol
- **Série de Fourier**: Método matemático para aproximar funções periódicas usando senos e cossenos
- **Termos de Fourier**: Quanto mais termos, melhor a aproximação
- **Elementos osculadores**: Parâmetros orbitais instantâneos calculados a partir dos vetores de posição e velocidade
- **Elementos médios**: Parâmetros tabelados que representam a órbita média filtrada de perturbações gravitacionais
