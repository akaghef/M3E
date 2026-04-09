#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PORT=4173
URL="http://localhost:${PORT}/viewer.html"

export M3E_DATA_DIR="$ROOT_DIR/beta/data"
mkdir -p "$M3E_DATA_DIR"

# --- Cloud Sync ---
export M3E_CLOUD_SYNC=1
export M3E_CLOUD_TRANSPORT="${M3E_CLOUD_TRANSPORT:-file}"
export M3E_CLOUD_DIR="${M3E_CLOUD_DIR:-$M3E_DATA_DIR/cloud-sync}"

# --- Collab ---
export M3E_COLLAB=1

# --- AI (must be configured externally or via env vars) ---
export M3E_AI_ENABLED="${M3E_AI_ENABLED:-1}"

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

trap cleanup INT TERM EXIT

echo "Launching M3E Beta (full mode: Cloud Sync + Collab + AI)"
echo "  Cloud Sync: ${M3E_CLOUD_TRANSPORT} (${M3E_CLOUD_DIR})"
echo "  Collab:     enabled"
echo "  AI:         ${M3E_AI_PROVIDER:-not set} / ${M3E_AI_MODEL:-not set}"
echo ""

cd "$ROOT_DIR"
npm --prefix beta start &
APP_PID=$!

if wait_for_server; then
  if command -v open &>/dev/null; then
    open "$URL"
  elif command -v xdg-open &>/dev/null; then
    xdg-open "$URL"
  else
    echo "Open ${URL} in your browser."
  fi
else
  echo "[WARN] Server did not become ready in time. Open ${URL} manually."
fi

wait "$APP_PID"
