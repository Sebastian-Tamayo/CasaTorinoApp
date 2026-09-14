#!/usr/bin/env bash
# Bloquea deploys que pisen la web pública con tema oscuro.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CSS="$ROOT/styles.css"
IDX="$ROOT/index.html"

fail() { echo "ERROR tema claro: $*" >&2; exit 1; }

[[ -f "$CSS" ]] || fail "falta styles.css"
[[ -f "$IDX" ]] || fail "falta index.html"

grep -qF -- '--bg: #fff8e8' "$CSS" || fail "styles.css no tiene --bg: #fff8e8 (tema claro)"
grep -qF 'theme-color" content="#fff8e8"' "$IDX" || fail "index.html theme-color no es #fff8e8"

if grep -qE -- '--bg:[[:space:]]*#(070d1a|0b0f14|0a1224)' "$CSS"; then
  fail "styles.css parece tema oscuro"
fi
if grep -qF 'theme-color" content="#0a1224"' "$IDX"; then
  fail "index.html tiene theme-color oscuro"
fi

echo "OK tema claro verificado"
