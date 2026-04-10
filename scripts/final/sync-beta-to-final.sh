#!/bin/bash
# M3E: Sync beta/ → final/ (source code only, no launch)
# Usage: ./scripts/final/sync-beta-to-final.sh
#
# Uses rsync --delete to mirror exactly.
# Safe: final-only files (FINAL_POLICY.md etc.) are excluded.
# Idempotent: running twice produces the same result.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BETA="$ROOT_DIR/beta"
FINAL="$ROOT_DIR/final"

# --- Excluded from sync (final-only files) ---
EXCLUDE_ARGS=(
  --exclude 'FINAL_POLICY.md'
  --exclude 'node_modules/'
  --exclude 'dist/'
  --exclude '.m3e-launched'
  --exclude 'backups/'
)

echo "=== M3E Sync: beta/ → final/ ==="

# --- Directory sync (rsync --delete mirrors exactly) ---
echo "[1/3] Syncing directories..."
for dir in src tests legacy; do
  if [ -d "$BETA/$dir" ]; then
    mkdir -p "$FINAL/$dir"
    rsync -a --delete "${EXCLUDE_ARGS[@]}" "$BETA/$dir/" "$FINAL/$dir/"
    echo "  $dir/ ✓"
  fi
done

# --- Single file sync ---
echo "[2/3] Syncing files..."
FILES=(
  viewer.html
  viewer.css
  package.json
  package-lock.json
  tsconfig.browser.json
  tsconfig.node.json
  playwright.config.js
  test_server.js
  vitest.config.js
)
for f in "${FILES[@]}"; do
  if [ -f "$BETA/$f" ]; then
    cp "$BETA/$f" "$FINAL/$f"
    echo "  $f ✓"
  fi
done

# --- Demo data ---
echo "[3/3] Syncing demo data..."
mkdir -p "$FINAL/data"
shopt -s nullglob
for f in "$BETA"/data/*.json "$BETA"/data/*.mm; do
  cp "$f" "$FINAL/data/"
done
shopt -u nullglob
echo "  data/ ✓"

echo ""
echo "Sync complete. Run 'cd final && npm install && npm run build' to build."
