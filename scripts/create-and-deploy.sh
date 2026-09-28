#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
gh auth status
git branch -M main
if ! git remote get-url origin >/dev/null 2>&1; then
  gh repo create knalpas/kings --public --source=. --remote=origin --push
else
  git push -u origin main
fi
npm run deploy
echo "Live at https://knalpas.github.io/kings/"
