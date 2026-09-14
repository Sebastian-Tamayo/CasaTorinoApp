#!/usr/bin/env bash
# Publica el ecosistema saneado en Sebastian-Tamayo/CasaTorinoApp.
# Ejecutar en TU máquina (Cursor no tiene push a ese repo).
set -euo pipefail
BRANCH="${BRANCH:-main}"
WORKDIR="${TMPDIR:-/tmp}/casatorino-publish-$$"
REL="https://github.com/Sebastian-Tamayo/Proyeccion/releases/download/casatorino-eco-safe-v1/CasaTorinoApp-ecosistema-safe.tar.gz"
RAW="https://github.com/Sebastian-Tamayo/Proyeccion/raw/main/docs/casatorino-sync/CasaTorinoApp-ecosistema-safe.tar.gz"
# Overlay canónico Edge Config (evita republicar el store CrudCrud vacío)
SYNC_RAW_BASE="https://raw.githubusercontent.com/Sebastian-Tamayo/Proyeccion/cursor/web-carta-produccion/docs/casatorino-sync"
mkdir -p "$WORKDIR" && cd "$WORKDIR"
echo "==> 1/5 Descargando paquete (sin secretos)"
if curl -fsSL -o eco.tar.gz "$REL"; then echo "    release"; elif curl -fsSL -L -o eco.tar.gz "$RAW"; then echo "    raw"; else echo "ERROR tarball" >&2; exit 1; fi
echo "==> 2/5 Clonando CasaTorinoApp"
git clone https://github.com/Sebastian-Tamayo/CasaTorinoApp.git dest
cd dest && git checkout "$BRANCH"
echo "==> 3/5 Aplicando módulos"
mkdir -p _pkg && tar -xzf ../eco.tar.gz -C _pkg
rm -rf web && cp -a _pkg/web web
cp -a _pkg/reservas/. reservas/
cp -a _pkg/erp/. erp/
mkdir -p docs scripts
cp -f _pkg/docs/RECUPERACION.md docs/RECUPERACION.md
cp -f _pkg/scripts/restaurar-modulo.sh scripts/restaurar-modulo.sh
cp -f _pkg/scripts/publicar-en-casatorinoapp.sh scripts/publicar-en-casatorinoapp.sh || true
cp -f _pkg/README.md README.md
cp -f _pkg/package.json package.json 2>/dev/null || true
cp -f _pkg/vercel.json vercel.json 2>/dev/null || true
chmod +x scripts/*.sh || true
rm -rf _pkg

echo "==> 4/5 Overlay reservas Edge Config (anti-regresión)"
mkdir -p reservas/server reservas/api/reservas
curl -fsSL -o reservas/server/reservas-store.js "$SYNC_RAW_BASE/reservas/server/reservas-store.js"
curl -fsSL -o reservas/api/reservas.js "$SYNC_RAW_BASE/reservas/api/reservas.js"
curl -fsSL -o reservas/api/reservas/\[id\].js "$SYNC_RAW_BASE/reservas/api/reservas/[id].js"
curl -fsSL -o reservas/api/reservas-health.js "$SYNC_RAW_BASE/reservas/api/reservas-health.js"
curl -fsSL -o reservas/vercel.json "$SYNC_RAW_BASE/reservas/vercel.json"
curl -fsSL -o reservas/.env.example "$SYNC_RAW_BASE/reservas/.env.example" || true
curl -fsSL -o docs/RECUPERACION.md "$SYNC_RAW_BASE/RECUPERACION.md" || true
if ! grep -q "Edge Config" reservas/server/reservas-store.js; then
  echo "ERROR: reservas-store.js no es la versión Edge Config — abortando" >&2
  exit 1
fi

echo "==> 5/5 Commit + push"
git add -A
git status -sb | head -40
git commit -m "$(cat <<'MSG'
chore: backup ecosistema + reservas Edge Config (anti-caída)

- TPV con PIN solo en env (TPV_PIN), sync Edge Config
- Reservas: Edge Config (sin CrudCrud / STORE vacío)
- Sin PINs ni tokens en el código
- docs/RECUPERACION.md: restaurar todo o por módulo
MSG
)" || echo "(sin cambios)"
git push -u origin "$BRANCH"
echo
echo "OK → https://github.com/Sebastian-Tamayo/CasaTorinoApp"
echo "IMPORTANTE reservas:"
echo "  - En Vercel: RESERVAS_EDGE_CONFIG_ID / RESERVAS_TEAM_ID / RESERVAS_VERCEL_TOKEN"
echo "  - No reconectar Git al proyecto reservas-casatorino hasta verificar el store"
echo "  - Deploy reservas solo con: vercel deploy --prod"
echo "Configura TPV_PIN y resto de env en Vercel (docs/RECUPERACION.md)"
