#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "==> npm install"
  npm install
fi

if [ -L public/decks ] || [ -d public/decks ]; then
  echo "==> public/decks already exists"
else
  echo "==> linking public/decks -> ../knowledge-slides/dist"
  ln -s ../../knowledge-slides/dist public/decks
fi

echo "==> done. run:  npm run dev"
