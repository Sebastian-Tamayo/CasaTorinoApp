#!/usr/bin/env bash
# Ejecutar en un PC donde hayas iniciado sesión en GitHub (gh auth login o HTTPS).
set -euo pipefail
cd "$(dirname "$0")/.."
echo "Commits pendientes de subir:"
git log --oneline origin/main..HEAD || true
git push origin main
echo "OK — GitHub actualizado."
