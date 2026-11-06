#!/usr/bin/env bash
# Roda toda a validação. Nenhum teste abre janela nem usa internet.
set -uo pipefail
cd "$(dirname "$0")"

PY=.venv/bin/python
[[ -x "$PY" ]] || PY=python3

TESTES=(
  test_arquitetura
  test_tema
  test_layout
  test_rotulos
  test_atalhos
  test_fisica_nbody
  test_efemeride
  test_projecao
  test_vista3d
  test_fisica_lab
  test_interface
  test_interacoes
)

falhou=0
for t in "${TESTES[@]}"; do
  printf '%-22s' "$t"
  if saida=$(SDL_VIDEODRIVER=dummy "$PY" -m "tests.$t" 2>&1); then
    echo "ok"
  else
    echo "FALHOU"
    # Inclui falhas de unittest e dos validadores anteriores.
    echo "$saida" | tail -70
    falhou=1
  fi
done

echo
if [[ $falhou -eq 0 ]]; then
  echo "Todos os testes passaram."
else
  echo "Houve falhas. Veja a saída acima."
fi
exit $falhou
