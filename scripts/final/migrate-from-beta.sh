#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PORT=38482
URL="http://localhost:${PORT}/viewer.html"

if [[ -z "${M3E_DATA_DIR:-}" ]]; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    export M3E_DATA_DIR="$HOME/Library/Application Support/M3E"
  else
    export M3E_DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/M3E"
  fi
fi
mkdir -p "$M3E_DATA_DIR"

kill_port() {
  local pids
  pids="$(lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "Stopping existing process on port ${PORT}: ${pids}"
    kill $pids 2>/dev/null || true
    sleep 1
  fi
}

cleanup() {
  if [[ -n "${APP_PID:-}" ]] && kill -0 "$APP_PID" 2>/dev/null; then
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
}

wait_for_server() {
  local attempt
  for attempt in {1..50}; do
    if curl -fsS "http://localhost:${PORT}/" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done
  return 1
}

echo "============================================================"
echo " M3E Final Migration: Beta -> Final (exclude mode)"
echo "============================================================"
echo

kill_port

echo "[1/6] Git fetch & pull..."
git -C "$ROOT_DIR" fetch --all
git -C "$ROOT_DIR" pull --ff-only

echo "[2/6] Syncing beta/ -> final/ (exclude mode)..."
/bin/mkdir -p "$ROOT_DIR/final"
/usr/bin/rsync -a --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .env \
  --exclude Beta_Policy.md \
  --exclude prompts \
  --exclude tmp \
  --exclude public \
  --exclude e2e_test_server.js \
  --exclude playwright.e2e.config.js \
  --exclude 'data/M3E_dataV1.sqlite' \
  --exclude 'data/backups' \
  --exclude 'data/audit' \
  --exclude 'data/conflict-backups' \
  --exclude 'data/.m3e-launched' \
  "$ROOT_DIR/beta/" "$ROOT_DIR/final/"
# Restore final-only files
git -C "$ROOT_DIR" checkout -- final/FINAL_POLICY.md 2>/dev/null || true
echo "  Sync complete."

echo "[3/6] Install dependencies (final)..."
npm --prefix "$ROOT_DIR/final" ci

echo "[4/6] Build (final)..."
npm --prefix "$ROOT_DIR/final" run build

echo "[5/6] Data migration..."
if [[ -f "$M3E_DATA_DIR/M3E_dataV1.sqlite" ]]; then
  /bin/mkdir -p "$M3E_DATA_DIR/backup"
  timestamp="$(date '+%Y%m%d_%H%M')"
  /bin/cp "$M3E_DATA_DIR/M3E_dataV1.sqlite" "$M3E_DATA_DIR/backup/M3E_dataV1_${timestamp}.sqlite"
  echo "  Backup saved to $M3E_DATA_DIR/backup/"
fi
echo "  Data migration: no schema changes (pass-through)."

echo "[6/6] Launching Final..."
trap cleanup INT TERM EXIT

cd "$ROOT_DIR"
npm --prefix final start &
APP_PID=$!

if wait_for_server; then
  open "$URL"
else
  echo "[WARN] Server did not become ready in time. Open ${URL} manually."
fi

wait "$APP_PID"
