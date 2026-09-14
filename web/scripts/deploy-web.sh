#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
bash scripts/assert-light-theme.sh
export PATH="/home/ubuntu/.npm/_npx/67eb4586ca667318/node_modules/@vercel/vc-native-linux-x64/bin:$PATH:${PATH:-}"
# Siempre el proyecto de producción (no el genérico "web")
mkdir -p .vercel
cat > .vercel/project.json <<'EOF'
{"projectId":"prj_YrLr62ys2WkZzYKrjix0NK4WmtES","orgId":"team_JNQ3Bn97PBn7QHSYkTZw7wXy","projectName":"casa-torino-web"}
EOF
vercel deploy --prod --yes --scope sebas3212
