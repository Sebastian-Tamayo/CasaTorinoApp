#!/usr/bin/env bash
set -euo pipefail
NEW='https://crudcrud.com/api/c0b4ee5b6c0745b4adf479e7b4a1d208/reservas'
WORKDIR=$(mktemp -d)
echo "Workdir: $WORKDIR"
cd "$WORKDIR"
git clone https://github.com/Sebastian-Tamayo/CasaTorinoApp.git app
cd app
FILE=reservas/server/reservas-store.js
python - <<'PY'
from pathlib import Path
import re
p = Path("reservas/server/reservas-store.js")
t = p.read_text(encoding="utf-8")
t2 = re.sub(r"https://crudcrud.com/api/[a-f0-9]+/reservas", "https://crudcrud.com/api/c0b4ee5b6c0745b4adf479e7b4a1d208/reservas", t)
if t == t2 and "https://crudcrud.com/api/c0b4ee5b6c0745b4adf479e7b4a1d208/reservas" not in t:
    raise SystemExit("No se encontró URL de CrudCrud en " + str(p))
p.write_text(t2, encoding="utf-8")
print("Store actualizado a:", "https://crudcrud.com/api/c0b4ee5b6c0745b4adf479e7b4a1d208/reservas")
PY
grep crudcrud "$FILE"
git add "$FILE"
git commit -m "fix reservas: replace expired CrudCrud store (fixes 500 API)" || true
git push origin main
echo
echo "OK. Espera 1-2 min y abre:"
echo "  https://reservas-casatorino.vercel.app/api/reservas"
