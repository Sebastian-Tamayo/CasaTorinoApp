#!/usr/bin/env bash
# Publica el ecosistema Vercel (web+erp+reservas) en CasaTorinoApp
set -euo pipefail
BRANCH="${BRANCH:-main}"
WORKDIR="${TMPDIR:-/tmp}/casatorino-publish-$$"
mkdir -p "$WORKDIR"
cd "$WORKDIR"

TARBALL_URL_RELEASE="https://github.com/Sebastian-Tamayo/CasaTorinoApp/raw/main/docs/ops/sync/CasaTorinoApp-vercel-ecosistema.tar.gz"
TARBALL_URL_RAW="https://github.com/Sebastian-Tamayo/CasaTorinoApp/raw/main/docs/ops/sync/CasaTorinoApp-vercel-ecosistema.tar.gz"

echo "==> 1/4 Descargando paquete ecosistema Vercel"
if curl -fsSL -o eco.tar.gz "$TARBALL_URL_RELEASE"; then
  echo "    (release casatorino-vercel-v2)"
elif curl -fsSL -L -o eco.tar.gz "$TARBALL_URL_RAW"; then
  echo "    (raw docs/casatorino-sync)"
else
  echo "ERROR: no se pudo descargar el tarball" >&2
  exit 1
fi

echo "==> 2/4 Clonando CasaTorinoApp"
git clone https://github.com/Sebastian-Tamayo/CasaTorinoApp.git dest
cd dest
git checkout "$BRANCH"

echo "==> 3/4 Aplicando web/ + docs + reservas + erp"
mkdir -p _pkg
tar -xzf ../eco.tar.gz -C _pkg
rm -rf web
cp -a _pkg/web web
# merge reservas/erp without wiping unknown local-only files too aggressively
cp -a _pkg/reservas/. reservas/
cp -a _pkg/erp/. erp/
cp -f _pkg/README.md README.md
mkdir -p docs scripts
cp -f _pkg/docs/ECOSISTEMA.md docs/ECOSISTEMA.md
cp -f _pkg/docs/SUBIR-GITHUB.md docs/SUBIR-GITHUB.md 2>/dev/null || true
[[ -f _pkg/scripts/subir-github.sh ]] && cp -f _pkg/scripts/subir-github.sh scripts/subir-github.sh
cp -f _pkg/package.json package.json 2>/dev/null || true
cp -f _pkg/vercel.json vercel.json 2>/dev/null || true
rm -rf _pkg

echo "==> 4/4 Commit + push"
git add -A
git status -sb | head -40
git commit -m "$(cat <<'MSG'
feat: web Vercel principal + Instagram/Facebook + archivo Netlify

- web/ carta, menú, equipo, hub interno, redes sociales
- badges/README apuntan a casa-torino-web.vercel.app
- Netlify inauguración solo en web/archivo/inauguracion/
MSG
)" || echo "(sin cambios)"
git push -u origin "$BRANCH"

echo
echo "OK -> https://github.com/Sebastian-Tamayo/CasaTorinoApp"
echo "Web: https://casa-torino-web.vercel.app (IG/FB incluidos)"
