#!/usr/bin/env bash
# Sincroniza el monorepo unificado CasaTorinoApp → GitHub
# Ejecutar en Git Bash / WSL (tú tienes permiso de push; el agente no).
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Sebastian-Tamayo/CasaTorinoApp.git}"
WORKDIR="${WORKDIR:-$HOME/CasaTorinoApp}"
# Carpeta con el paquete generado por el agente (ajusta la ruta si lo bajaste a Descargas)
SRC="${SRC:-}"

echo "==> Repo: $REPO_URL"
echo "==> Destino: $WORKDIR"

if [[ -d "$WORKDIR/.git" ]]; then
  cd "$WORKDIR"
  git fetch origin
  git checkout main
  git pull --ff-only origin main || git pull origin main --no-rebase || true
else
  git clone "$REPO_URL" "$WORKDIR"
  cd "$WORKDIR"
fi

if [[ -n "$SRC" && -d "$SRC" ]]; then
  echo "==> Copiando paquete unificado desde $SRC"
  rsync -a --delete \
    --exclude node_modules --exclude .next --exclude .vercel --exclude dist --exclude .env.local \
    "$SRC/web/" "$WORKDIR/web/"
  rsync -a \
    --exclude node_modules --exclude .vercel --exclude dist --exclude .env.local \
    "$SRC/reservas/" "$WORKDIR/reservas/"
  rsync -a \
    --exclude node_modules --exclude .next --exclude .vercel --exclude .env.local \
    "$SRC/erp/" "$WORKDIR/erp/"
  cp -f "$SRC/README.md" "$WORKDIR/README.md"
  mkdir -p "$WORKDIR/docs"
  cp -f "$SRC/docs/ECOSISTEMA.md" "$WORKDIR/docs/ECOSISTEMA.md"
fi

echo "==> Estado"
git status -sb

git add README.md docs/ECOSISTEMA.md web reservas erp
git status

git commit -m "$(cat <<'EOF'
feat: web principal unificada + archivo inauguración

- web/ pasa a ser la página permanente (carta, menú, equipo, hub interno)
- web/archivo/inauguracion/ conserva la landing Netlify histórica
- README y ECOSISTEMA apuntan a casa-torino-web.vercel.app como principal
- reservas PIN interno 3212 (sin mostrarlo) + store operativo
EOF
)" || echo "(sin cambios nuevos que commitear)"

echo "==> Push a GitHub"
git push -u origin main

echo
echo "Listo. Comprueba:"
echo "  https://github.com/Sebastian-Tamayo/CasaTorinoApp"
echo "  Web principal: https://casa-torino-web.vercel.app"
echo "  Inauguración (archivo): https://casatorino.netlify.app"
echo "  Reservas: https://reservas-casatorino.vercel.app"
echo "  ERP: https://casa-torino-app.vercel.app/login"
