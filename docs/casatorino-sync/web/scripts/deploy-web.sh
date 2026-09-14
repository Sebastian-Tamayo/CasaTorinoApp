#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
bash scripts/assert-light-theme.sh
export PATH="/home/ubuntu/.npm/_npx/67eb4586ca667318/node_modules/@vercel/vc-native-linux-x64/bin:$PATH"
vercel deploy --prod --yes --scope sebas3212
