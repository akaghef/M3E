#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PORT=4173
if [[ -z "${M3E_HOME:-}" ]]; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    export M3E_HOME="$HOME/Library/Application Support/M3E"
  else
    export M3E_HOME="${XDG_DATA_HOME:-$HOME/.local/share}/M3E"
  fi
fi
export M3E_SEED_DB_PATH="${M3E_SEED_DB_PATH:-$M3E_HOME/seeds/core-seed.sqlite}"
export M3E_DATA_DIR="${M3E_DATA_DIR:-$M3E_HOME/workspaces/sandbox}"
export M3E_DB_FILE="${M3E_DB_FILE:-data.sqlite}"
export M3E_DOC_ID="${M3E_DOC_ID:-akaghef-beta}"
export M3E_WORKSPACE_ID="${M3E_WORKSPACE_ID:-sandbox}"
mkdir -p "$M3E_DATA_DIR" "$(dirname "$M3E_SEED_DB_PATH")"
if [[ ! -f "$M3E_SEED_DB_PATH" && -f "$ROOT_DIR/install/assets/seeds/core-seed.sqlite" ]]; then
  cp "$ROOT_DIR/install/assets/seeds/core-seed.sqlite" "$M3E_SEED_DB_PATH"
fi
if [[ ! -f "$M3E_DATA_DIR/$M3E_DB_FILE" && -f "$M3E_SEED_DB_PATH" ]]; then
  cp "$M3E_SEED_DB_PATH" "$M3E_DATA_DIR/$M3E_DB_FILE"
fi
URL="http://localhost:${PORT}/viewer.html?workspaceId=${M3E_WORKSPACE_ID}&localDocId=${M3E_DOC_ID}&cloudDocId=${M3E_DOC_ID}"

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

kill_port

echo "[1/5] Git fetch..."
git fetch --all

echo "[2/5] Git pull..."
git pull --ff-only

echo "[3/5] Install dependencies (beta)..."
npm --prefix beta ci

echo "[4/5] Build (beta)..."
npm --prefix beta run build

echo "[5/5] Launch..."
trap cleanup INT TERM EXIT

cd "$ROOT_DIR"
npm --prefix beta start &
APP_PID=$!

if wait_for_server; then
  open "$URL"
else
  echo "[WARN] Server did not become ready in time. Open ${URL} manually."
fi

wait "$APP_PID"
