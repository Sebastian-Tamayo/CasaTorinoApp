#!/usr/bin/env bash
# En TU PC (con acceso a CasaTorinoApp): trae el espejo de Proyeccion y súbelo.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "==> Fetch espejo Proyeccion (backup/casa-torino-app)"
git fetch https://github.com/Sebastian-Tamayo/Proyeccion.git backup/casa-torino-app:refs/remotes/proyeccion/backup
echo "==> Commits locales pendientes:"
git log --oneline origin/main..HEAD || true
echo
echo "Opciones:"
echo "  1) Si solo quieres subir lo ya commiteado aquí:"
echo "       git push origin main"
echo "  2) Si quieres reemplazar main con el espejo completo:"
echo "       git reset --hard proyeccion/backup"
echo "       git push origin main --force-with-lease"
echo
read -r -p "¿Ejecutar opción 1 ahora? [y/N] " ans
if [[ "${ans:-}" =~ ^[yY]$ ]]; then
  git push origin main
  echo "OK → https://github.com/Sebastian-Tamayo/CasaTorinoApp"
fi
