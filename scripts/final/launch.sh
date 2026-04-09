#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PORT=38482
FIRST_RUN_MARKER="${M3E_DATA_DIR:-.}/.m3e-launched"
if [[ ! -f "$FIRST_RUN_MARKER" ]]; then
  URL="http://localhost:${PORT}/viewer.html?scopeId=n_1775650869381_rns0cp"
else
  URL="http://localhost:${PORT}/viewer.html"
fi

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

kill_port

trap cleanup INT TERM EXIT

cd "$ROOT_DIR"
npm --prefix final start &
APP_PID=$!

if wait_for_server; then
  open "$URL"
  [[ ! -f "$FIRST_RUN_MARKER" ]] && date -Iseconds > "$FIRST_RUN_MARKER" 2>/dev/null || true
else
  echo "[WARN] Server did not become ready in time. Open ${URL} manually."
fi

wait "$APP_PID"
