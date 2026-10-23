#!/usr/bin/env bash
# Despliega SOLO la carpeta reservas/ a producción en Vercel
# (el dominio reservas-casatorino.vercel.app).
set -euo pipefail

WORKDIR=$(mktemp -d)
echo "Workdir: $WORKDIR"
cd "$WORKDIR"

echo "==> 1/4 Clonando CasaTorinoApp (código ya con store nuevo)"
git clone --depth 1 https://github.com/Sebastian-Tamayo/CasaTorinoApp.git app
cd app/reservas

echo "==> 2/4 Instalando deps"
npm install

echo "==> 3/4 Login Vercel (si hace falta)"
npx vercel whoami >/dev/null 2>&1 || npx vercel login

echo "==> 4/4 Deploy producción (carpeta reservas)"
# Enlaza/crea proyecto y publica
npx vercel pull --yes --environment=production || true
npx vercel --prod --yes \
  --name reservas-casatorino \
  -e RESERVAS_STORE_URL=https://crudcrud.com/api/c0b4ee5b6c0745b4adf479e7b4a1d208/reservas

echo
echo "Prueba:"
echo "  curl -s https://reservas-casatorino.vercel.app/api/reservas"
echo "Debe devolver JSON, no error 500."
