#!/usr/bin/env bash
# Make sure public/decks points at the knowledge-slides dist tree.
# Works both for local sibling-clone layout and for CI where
# SLIDES_REPO is set to $GITHUB_WORKSPACE/knowledge-slides.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SLIDES_REPO="${SLIDES_REPO:-$SCRIPT_DIR/../knowledge-slides}"
TARGET="$SLIDES_REPO/dist"

if [[ ! -d "$TARGET" ]]; then
  echo "WARN: $TARGET does not exist — public/decks will dangle." >&2
fi

mkdir -p "$SCRIPT_DIR/public"
ln -sfn "$TARGET" "$SCRIPT_DIR/public/decks"
echo "prebuild: linked public/decks -> $TARGET"
