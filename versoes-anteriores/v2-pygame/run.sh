#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -x .venv/bin/python ]]; then
  if command -v python3.13 >/dev/null 2>&1; then
    python3.13 -m venv .venv
  else
    python3 -m venv .venv
  fi
fi

if ! .venv/bin/python -c 'import numpy, pygame, scipy' >/dev/null 2>&1; then
  .venv/bin/python -m pip install -r requirements.txt
fi

exec .venv/bin/python main.py
