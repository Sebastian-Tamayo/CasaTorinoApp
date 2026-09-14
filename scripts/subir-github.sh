#!/usr/bin/env bash
# Respaldo rápido a GitHub (ejecutar en tu máquina con acceso al repo).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
MSG=${1:-"backup: snapshot ecosistema Casa Torino"}
bash web/scripts/assert-light-theme.sh || {
  echo "ABORTADO: la web pública no está en tema claro" >&2
  exit 1
}
git add -A
git status -sb | head -40
git commit -m "$MSG" || echo "(sin cambios que commitear)"
git push -u origin HEAD
echo "OK → https://github.com/Sebastian-Tamayo/CasaTorinoApp"
