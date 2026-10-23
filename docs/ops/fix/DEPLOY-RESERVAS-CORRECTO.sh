#!/usr/bin/env bash
# Despliega SOLO reservas al proyecto Vercel correcto: reservas-casatorino
# (NO al proyecto casa-torino-app del ERP/Next.js)
set -euo pipefail

GOOD_STORE='https://crudcrud.com/api/c0b4ee5b6c0745b4adf479e7b4a1d208/reservas'
WORKDIR=$(mktemp -d)
echo "Workdir: $WORKDIR"
cd "$WORKDIR"

echo "==> 1/5 Clonando CasaTorinoApp"
git clone --depth 1 https://github.com/Sebastian-Tamayo/CasaTorinoApp.git app
cd app/reservas

echo "==> 2/5 Asegurando store bueno"
python - <<PY
from pathlib import Path
import re
p = Path('server/reservas-store.js')
t = p.read_text(encoding='utf-8')
good = '$GOOD_STORE'
t2 = re.sub(r'https://crudcrud.com/api/[a-f0-9]+/reservas', good, t)
p.write_text(t2, encoding='utf-8')
print('STORE =', good)
PY

echo "==> 3/5 npm install"
npm install

echo "==> 4/5 Login Vercel (si hace falta)"
npx vercel whoami >/dev/null 2>&1 || npx vercel login

echo "==> 5/5 Desenlazar proyecto incorrecto y enlazar reservas-casatorino"
rm -rf .vercel
# Crea/enlaza el proyecto Vite de reservas (NO casa-torino-app)
npx vercel link --yes --project reservas-casatorino || \
npx vercel link --yes --project reservas-casatorino --scope sebas3212 || true

# Si el proyecto no existe, --name lo crea en el primer deploy
echo "==> Deploy PRODUCCIÓN"
npx vercel env add RESERVAS_STORE_URL production <<< "$GOOD_STORE" 2>/dev/null || true
npx vercel --prod --yes \
  --name reservas-casatorino \
  -e "RESERVAS_STORE_URL=$GOOD_STORE"

echo
echo "=============================="
echo "Espera ~30s y prueba:"
echo "  https://reservas-casatorino.vercel.app/api/reservas"
echo "Debe devolver JSON ([] o lista), NO error 500."
echo
echo "Si el dominio no está en este proyecto:"
echo "  Vercel → reservas-casatorino → Settings → Domains"
echo "  añade: reservas-casatorino.vercel.app"
echo "=============================="
