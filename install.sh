#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "==> npm install"
  npm install
fi

echo "==> prebuild (link public/decks)"
bash prebuild.sh

echo "==> done. run:  npm run dev"
