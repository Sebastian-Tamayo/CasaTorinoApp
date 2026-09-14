#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOD="${1:-}"
usage() { echo "Uso: $0 <web|reservas|erp|all>"; exit 1; }
[[ -z "$MOD" ]] && usage

check_no_secrets() {
  local dir="$1"
  if command -v rg >/dev/null 2>&1; then
    if rg -n -e "pin: 'CHANGEME'" -e "TPV_PIN=" "$dir" >/dev/null; then
      echo "OK: placeholders presentes en $dir (sin PIN real)"
    fi
    if rg -n -e "pin: '[0-9]{4}'" -e "pin\": \"[0-9]{4}\"" -e "const PIN = '[0-9]" "$dir" 2>/dev/null | head -10; then
      echo "AVISO: posibles PINs literales en $dir" >&2
    fi
  fi
}

case "$MOD" in
  web)
    echo "==> web/TPV → $ROOT/web"
    echo "    Vercel Root Directory: web"
    echo "    Env: ver web/.env.example (TPV_PIN, Edge Config...)"
    test -f "$ROOT/web/api/tpv-auth.js" && test -f "$ROOT/web/api/tpv-sync.js"
    check_no_secrets "$ROOT/web"
    ;;
  reservas)
    echo "==> reservas → $ROOT/reservas"
    echo "    Env: RESERVAS_STORE_URL + PINs reales en runtime (staff.example.json)"
    check_no_secrets "$ROOT/reservas"
    ;;
  erp)
    echo "==> erp → $ROOT/erp"
    echo "    Env: ver erp/.env.example (Supabase)"
    check_no_secrets "$ROOT/erp"
    ;;
  all)
    "$0" web; echo; "$0" reservas; echo; "$0" erp
    ;;
  *) usage ;;
esac
echo
echo "Docs: docs/RECUPERACION.md"
