# Integração com Astropy — Parâmetros Orbitais Dinâmicos

## Como rodar

> Pré-requisito: Python 3.8+ instalado.

**1. Instale as dependências** (só precisa fazer uma vez):

```bash
pip install -r requirements.txt
```

**2. Execute o programa:**

```bash
python main.py
```

**3. Responda as perguntas que aparecerem:**

```
Qual planeta simular? → ex: Júpiter
Número de termos de Fourier? → ex: 5  (quanto mais, mais preciso)
```

**4. Um gráfico vai abrir** mostrando a elipse de Kepler do planeta (colorida) e a aproximação por Série de Fourier (tracejado preto). Feche o gráfico para encerrar.

> Prefere Jupyter? Abra `ipynb/simulacao_orbitas.ipynb` — ele roda célula a célula e já tem exemplos prontos.

---

## O que mudou

Antes desta implementação, os parâmetros orbitais (semi-eixo maior, excentricidade e período) de apenas três planetas estavam **hardcoded** em `utils/lib.py` como um dicionário estático, copiados da tabela 1 do TCC de referência:

```python
# Antes
PLANET_DATA = {
    'Marte':    {'semi_major': 1.524, 'ecc': 0.0934, 'period': 686.98, ...},
    'Vênus':    {'semi_major': 0.723, 'ecc': 0.0068, 'period': 224.7,  ...},
    'Mercúrio': {'semi_major': 0.387, 'ecc': 0.2056, 'period': 87.97,  ...},
}
```

Agora os parâmetros são **calculados dinamicamente** via Astropy a partir dos vetores de estado, convertidos para o referencial heliocêntrico, e o suporte foi expandido para os oito planetas.

---

## Como funciona

### 1. Fonte de dados — `get_body_barycentric_posvel`

A função `_orbital_elements(body, epoch)` em `utils/lib.py` consulta as efemérides embutidas do Astropy (`solar_system_ephemeris = 'builtin'`) para obter os vetores de posição e velocidade na época J2000.

Como o nome diz, esses vetores são **baricêntricos**: medidos a partir do baricentro do Sistema Solar, não do Sol. As fórmulas de dois corpos usadas em seguida exigem o estado **relativo ao corpo central**, então é preciso subtrair o estado do Sol:

```python
with solar_system_ephemeris.set('builtin'):
    pos, vel = get_body_barycentric_posvel(body, epoch)
    sun_pos, sun_vel = get_body_barycentric_posvel('sun', epoch)

r_vec = (pos - sun_pos).xyz.to(u.m).value
v_vec = (vel - sun_vel).xyz.to(u.m / u.s).value
```

Ver a seção [Correção de referencial](#correção-de-referencial-baricêntrico--heliocêntrico) para o tamanho do erro que isso evita.

### 2. Cálculo dos elementos orbitais

A partir dos vetores `r` (posição) e `v` (velocidade), três grandezas são derivadas:

| Grandeza | Fórmula | Observação |
|---|---|---|
| **Semi-eixo maior** `a` | `a = -μ / (v² - 2μ/r)` | Via energia específica orbital |
| **Excentricidade** `e` | `‖e_vec‖`, onde `e_vec = (v × h)/μ − r̂` | Via vetor de Laplace-Runge-Lenz |
| **Período** `T` | `T = 2π √(a³/μ)` | Via 3ª Lei de Kepler |

Onde `μ = G · M☉` é o parâmetro gravitacional padrão do Sol, e `r` e `v` são **heliocêntricos** — medidos a partir do Sol, não do baricentro.

### 3. Construção do `PLANET_DATA`

A função `_build_planet_data()` itera sobre todos os planetas, chama `_orbital_elements` para cada um e monta o dicionário `PLANET_DATA` em tempo de importação do módulo:

```python
PLANET_DATA = _build_planet_data()  # calculado uma vez ao importar lib.py
```

---

## Planetas suportados

| Planeta   | Nome interno (Astropy)  |
|-----------|-------------------------|
| Mercúrio  | `mercury`               |
| Vênus     | `venus`                 |
| Terra     | `earth-moon-barycenter` |
| Marte     | `mars`                  |
| Júpiter   | `jupiter`               |
| Saturno   | `saturn`                |
| Urano     | `uranus`                |
| Netuno    | `neptune`               |

A Terra entra como o **baricentro Terra-Lua**, que é o ponto que o Astropy integra e o que faz sentido num problema de dois corpos com o Sol: o par Terra+Lua se desloca em torno do Sol praticamente como um ponto só. O centro da Terra fica a cerca de 4 700 km desse ponto.

---

## Como usar

Nenhuma mudança na interface pública. O uso permanece igual:

```python
from utils.lib import simulate_and_plot

# Qualquer planeta da lista acima funciona
simulate_and_plot('Júpiter', num_terms=5)
simulate_and_plot('Netuno', num_terms=3)
```

Para acessar os parâmetros calculados diretamente:

```python
from utils.lib import PLANET_DATA

print(PLANET_DATA['Saturno'])
# {'semi_major': 9.561, 'ecc': 0.0558, 'period': 10798.26, 'color': 'goldenrod'}
```

---

## Correção de referencial: baricêntrico → heliocêntrico

> Esta seção substitui uma versão anterior deste documento que apresentava os valores da coluna "com o erro" abaixo como se fossem apenas elementos osculadores, e afirmava que estavam corretos. Não estavam: havia um erro de referencial.

### O que estava errado

A função usava os vetores **baricêntricos** direto nas fórmulas de dois corpos, junto com μ = G·M☉ — a gravidade do Sol. Isso mistura dois referenciais: as medidas vinham do baricentro, a gravidade vinha do Sol.

O Sol não está no baricentro. Na época J2000 ele está a **0,00767 UA** (1,15 milhão de km) dele, puxado principalmente por Júpiter. Para os planetas internos esse deslocamento é uma fração grande da própria órbita, e o resultado saía visivelmente errado.

### Quanto isso valia

| Planeta  | `a` com o erro | desvio | `a` corrigido | desvio | `e` com o erro | `e` corrigido | `e` de referência |
|----------|:--------------:|:------:|:-------------:|:------:|:--------------:|:-------------:|:-----------------:|
| Mercúrio | 0,39378        | +1,73% | **0,38710**   | 0,00%  | 0,19654        | **0,20563**   | 0,20563           |
| Vênus    | 0,73868        | +2,12% | **0,72332**   | 0,00%  | 0,01734        | **0,00677**   | 0,00677           |
| Terra    | 0,99657        | −0,34% | **1,00000**   | 0,00%  | 0,01610        | **0,01671**   | 0,01671           |
| Marte    | 1,50514        | −1,22% | **1,52376**   | 0,00%  | 0,08668        | **0,09340**   | 0,09339           |

Referência: elementos médios em J2000 da NASA Planetary Fact Sheet.

O caso mais grave é a excentricidade de Vênus: saía **0,01734 quando o valor é 0,00677**, inflada em duas vezes e meia. Uma órbita quase circular aparecia visivelmente alongada no gráfico.

Reproduzido e verificado em `tests/test_elementos_orbitais.py`:

```bash
.venv/bin/python -m tests.test_elementos_orbitais
```

## Elementos osculadores vs. elementos médios

Feita a correção, resta uma diferença **real e esperada** nos planetas externos:

- **Elementos osculadores** (o que esta biblioteca calcula): a elipse que o planeta seguiria se, a partir daquele instante, só o Sol existisse. É uma foto do estado em J2000.
- **Elementos médios** (tabelas de referência): médias de longo prazo, que filtram as perturbações entre planetas.

Para os planetas internos os dois praticamente coincidem, e é por isso que a tabela acima fecha em 0,00%. Para Júpiter e Saturno, que se perturbam mutuamente, a elipse de um instante difere da média de longo prazo — aí a diferença é física, não erro de conta.

| Planeta   | Semi-eixo médio (UA) | Osculador J2000 (UA) | Exc. média | Osculadora | Período médio (dias) | Osculador (dias) |
|-----------|:--------------------:|:--------------------:|:----------:|:----------:|:--------------------:|:----------------:|
| Mercúrio  | 0,38710              | 0,38710              | 0,20563    | 0,20563    | 87,97                | 87,97            |
| Vênus     | 0,72333              | 0,72332              | 0,00677    | 0,00677    | 224,70               | 224,69           |
| Terra     | 1,00000              | 1,00000              | 0,01671    | 0,01671    | 365,26               | 365,26           |
| Marte     | 1,52371              | 1,52376              | 0,09339    | 0,09340    | 686,98               | 687,03           |
| Júpiter   | 5,20288              | 5,20644              | 0,04839    | 0,04943    | 4332,59              | 4339,20          |
| Saturno   | 9,53667              | 9,56100              | 0,05386    | 0,05576    | 10759,22             | 10798,26         |
| Urano     | 19,18916             | 19,22481             | 0,04726    | 0,04635    | 30685,40             | 30788,71         |
| Netuno    | 30,06992             | 30,05489             | 0,00859    | 0,00944    | 60189,00             | 60182,63         |

### Aproximação que permanece

μ usa apenas a massa do Sol. O problema de dois corpos pede μ = G(M☉ + M_planeta). Para Júpiter isso responde por cerca de 0,1% no semi-eixo maior; para os demais, bem menos. Não foi corrigido porque exigiria massas planetárias de uma fonte que o módulo não tem, e inventar valores seria pior do que declarar a aproximação.

### Terminologia

O rótulo "Órbita Real" no gráfico foi trocado por **"Elipse de Kepler"**. A curva desenhada é a solução de dois corpos com os elementos da época, não a trajetória de fato percorrida — que muda devagar por causa da atração mútua entre os planetas.

---

## Dependência

A integração requer o pacote `astropy`, já incluído em `requirements.txt`:

```
astropy
```

Para preparar o ambiente e rodar os testes:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m tests.test_elementos_orbitais
```
