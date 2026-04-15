#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ -z "${M3E_HOME:-}" ]]; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    export M3E_HOME="$HOME/Library/Application Support/M3E"
  else
    export M3E_HOME="${XDG_DATA_HOME:-$HOME/.local/share}/M3E"
  fi
fi
export M3E_SEED_DB_PATH="${M3E_SEED_DB_PATH:-$M3E_HOME/seeds/core-seed.sqlite}"
export M3E_WORKSPACE_ID="${M3E_WORKSPACE_ID:-ws_A98E70JM9GAXCVXVMQBW7N0YGZ}"
export M3E_WORKSPACE_LABEL="${M3E_WORKSPACE_LABEL:-Personal}"
export M3E_MAP_ID="${M3E_MAP_ID:-map_09N0MQPFEQN9D4K66VNMT1F69V}"
export M3E_MAP_LABEL="${M3E_MAP_LABEL:-tutorial}"
export M3E_MAP_SLUG="${M3E_MAP_SLUG:-final-tutorial}"
export M3E_DATA_DIR="${M3E_DATA_DIR:-$M3E_HOME/workspaces/$M3E_WORKSPACE_ID}"
export M3E_DB_FILE="${M3E_DB_FILE:-data.sqlite}"
export M3E_DOC_ID="${M3E_DOC_ID:-$M3E_MAP_ID}"
export M3E_PORT="${M3E_PORT:-38482}"
PORT="$M3E_PORT"
mkdir -p "$M3E_DATA_DIR" "$(dirname "$M3E_SEED_DB_PATH")"
if [[ ! -f "$M3E_SEED_DB_PATH" && -f "$ROOT_DIR/install/assets/seeds/core-seed.sqlite" ]]; then
  cp "$ROOT_DIR/install/assets/seeds/core-seed.sqlite" "$M3E_SEED_DB_PATH"
fi
if [[ ! -f "$M3E_DATA_DIR/$M3E_DB_FILE" && -f "$M3E_SEED_DB_PATH" ]]; then
  cp "$M3E_SEED_DB_PATH" "$M3E_DATA_DIR/$M3E_DB_FILE"
fi
FIRST_RUN_MARKER="$M3E_DATA_DIR/.m3e-launched"
URL="http://localhost:${PORT}/viewer.html?ws=${M3E_WORKSPACE_ID}&map=${M3E_DOC_ID}"
if [[ ! -f "$FIRST_RUN_MARKER" ]]; then
  URL="${URL}&scope=n_1775650869381_rns0cp"
fi

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
