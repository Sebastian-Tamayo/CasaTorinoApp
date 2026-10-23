#!/usr/bin/env bash
# Arregla producción reservas-casatorino.vercel.app
set -euo pipefail

GOOD_STORE='https://crudcrud.com/api/c0b4ee5b6c0745b4adf479e7b4a1d208/reservas'
WORKDIR=$(mktemp -d)
echo "Workdir: $WORKDIR"
cd "$WORKDIR"

echo "==> Clonando CasaTorinoApp"
git clone https://github.com/Sebastian-Tamayo/CasaTorinoApp.git app
cd app

echo "==> Actualizando store + config Vercel monorepo"
python - <<PY
from pathlib import Path
import re, json

# store
p = Path('reservas/server/reservas-store.js')
t = p.read_text(encoding='utf-8')
t = re.sub(r'https://crudcrud.com/api/[a-f0-9]+/reservas', '$GOOD_STORE', t)
p.write_text(t, encoding='utf-8')
print('store OK')

# root package.json build for ERP
pj = Path('package.json')
data = json.loads(pj.read_text(encoding='utf-8'))
scripts = data.setdefault('scripts', {})
scripts['build'] = 'npm install --prefix erp && npm run build --prefix erp'
pj.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
print('package.json OK')
PY

cat > vercel.json <<'JSON'
{
  "installCommand": "npm install --prefix erp",
  "buildCommand": "npm run build --prefix erp",
  "framework": "nextjs",
  "outputDirectory": "erp/.next"
}
JSON

git add reservas/server/reservas-store.js package.json vercel.json
git commit -m "fix: reservas store + Vercel monorepo roots" || true
git push origin main || echo "AVISO: push falló; igual desplegamos reservas con Vercel CLI"

echo "==> Deploy PRODUCCIÓN de la carpeta reservas/"
cd reservas
npm install
echo "Si pide login, confirma en el navegador..."
npx vercel login
# Force production deploy of this directory
npx vercel --prod --yes \
  -e RESERVAS_STORE_URL=$GOOD_STORE

echo
echo "=============================="
echo "Prueba en el móvil/navegador:"
echo "  https://reservas-casatorino.vercel.app"
echo "API:"
echo "  https://reservas-casatorino.vercel.app/api/reservas"
echo "Si el dominio no apunta a este deploy, en Vercel:"
echo "  Project -> Settings -> Domains -> añade reservas-casatorino.vercel.app"
echo "=============================="
