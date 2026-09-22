#!/usr/bin/env bash
# Respaldo manual del tip de main → rama backup/daily-YYYY-MM-DD + tag.
# No despliega, no fuerza main. Uso opcional en tu PC:
#   bash scripts/daily-backup.sh
#   KEEP_DAYS=14 bash scripts/daily-backup.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

KEEP="${KEEP_DAYS:-14}"
DAY="$(TZ=Europe/Madrid date +%F)"
BRANCH="backup/daily-${DAY}"
TAG="backup-${DAY}"
DEFAULT_BRANCH="$(git remote show origin | awk '/HEAD branch/{print $NF}')"
DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"

echo "==> Fetch origin/${DEFAULT_BRANCH}"
git fetch origin "$DEFAULT_BRANCH" --tags

if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  echo "OK ya existe ${BRANCH} — nada que hacer."
else
  echo "==> Crear ${BRANCH} desde origin/${DEFAULT_BRANCH}"
  git branch -f "$BRANCH" "origin/${DEFAULT_BRANCH}"
  git push origin "refs/heads/${BRANCH}"
fi

if ! git ls-remote --exit-code --tags origin "refs/tags/${TAG}" >/dev/null 2>&1; then
  git tag -f -a "$TAG" "origin/${DEFAULT_BRANCH}" -m "Respaldo diario ${DAY} Europe/Madrid"
  git push origin "refs/tags/${TAG}"
fi

CUTOFF="$(TZ=Europe/Madrid date -d "${KEEP} days ago" +%F)"
echo "==> Purga backup/daily-* anteriores a ${CUTOFF}"
git fetch origin --prune
git branch -r | sed 's/^ *//' | grep -E '^origin/backup/daily-[0-9]{4}-[0-9]{2}-[0-9]{2}$' | while read -r ref; do
  name="${ref#origin/}"
  day="${name#backup/daily-}"
  if [[ "$day" < "$CUTOFF" ]]; then
    echo "  delete ${name}"
    git push origin --delete "$name" || true
  fi
done

echo "OK respaldo ${BRANCH} (main/prod intactos)"
