#!/usr/bin/env bash
# Sincroniza la web clara (Vercel) en CasaTorinoApp
set -euo pipefail
WORKDIR="${TMPDIR:-/tmp}/casatorino-web-sync-$$"
mkdir -p "$WORKDIR" && cd "$WORKDIR"
URL="https://github.com/Sebastian-Tamayo/CasaTorinoApp/raw/main/docs/ops/sync/casa-torino-web-light-v3.tar.gz"
echo "==> Descargando web actualizada"
curl -fsSL -L -o web.tgz "$URL"
echo "==> Clonando CasaTorinoApp"
git clone https://github.com/Sebastian-Tamayo/CasaTorinoApp.git repo
cd repo
tar -xzf ../web.tgz
git add web
git commit -m "feat(web): tema claro Colombia-España + terraza vertical en hero" || true
git push origin main
echo "OK -> https://github.com/Sebastian-Tamayo/CasaTorinoApp"
echo "Live -> https://casa-torino-web.vercel.app"
