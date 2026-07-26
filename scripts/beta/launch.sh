#!/bin/bash

set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${M3E_PORT:-4173}"
if [[ -z "${M3E_HOME:-}" ]]; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    export M3E_HOME="$HOME/Library/Application Support/M3E"
  else
    export M3E_HOME="${XDG_DATA_HOME:-$HOME/.local/share}/M3E"
  fi
fi
export M3E_SEED_DB_PATH="${M3E_SEED_DB_PATH:-$M3E_HOME/seeds/core-seed.sqlite}"
export M3E_CHANNEL="${M3E_CHANNEL:-beta}"
export M3E_WORKSPACE_ID="${M3E_WORKSPACE_ID:-ws_REMH1Z5TFA7S93R3HA0XK58JNR}"
export M3E_WORKSPACE_LABEL="${M3E_WORKSPACE_LABEL:-Akaghef-personal}"
export M3E_MAP_ID="${M3E_MAP_ID:-map_BG9BZP6NRDTEH1JYNDFGS6S3T5}"
export M3E_MAP_LABEL="${M3E_MAP_LABEL:-開発}"
export M3E_MAP_SLUG="${M3E_MAP_SLUG:-beta-dev}"
export M3E_DATA_DIR="${M3E_DATA_DIR:-$M3E_HOME/workspaces/$M3E_WORKSPACE_ID}"
export M3E_DB_FILE="${M3E_DB_FILE:-data.sqlite}"
export M3E_PORT="$PORT"
LOG_FILE="$M3E_HOME/beta-launch.log"
mkdir -p "$M3E_DATA_DIR" "$(dirname "$M3E_SEED_DB_PATH")"
if [[ ! -f "$M3E_SEED_DB_PATH" && -f "$ROOT_DIR/install/assets/seeds/core-seed.sqlite" ]]; then
  cp "$ROOT_DIR/install/assets/seeds/core-seed.sqlite" "$M3E_SEED_DB_PATH"
fi
if [[ ! -f "$M3E_DATA_DIR/$M3E_DB_FILE" && -f "$M3E_SEED_DB_PATH" ]]; then
  cp "$M3E_SEED_DB_PATH" "$M3E_DATA_DIR/$M3E_DB_FILE"
fi
URL="http://localhost:${PORT}/viewer.html?ws=${M3E_WORKSPACE_ID}&map=${M3E_MAP_ID}"

find_runtime() {
  NODE_CMD="$(command -v node || true)"
  NPM_CMD="$(command -v npm || true)"
  if [[ -z "$NODE_CMD" ]]; then
    echo "[ERROR] Node.js not found. Install Node.js with Homebrew or run setup first." >&2
    exit 1
  fi
  if [[ -z "$NPM_CMD" ]]; then
    echo "[ERROR] npm not found. Install Node.js with Homebrew or run setup first." >&2
    exit 1
  fi
}

repair_dependencies() {
  echo "[launch] Beta dependencies missing. Repairing..."
  if ! "$NPM_CMD" --prefix "$ROOT_DIR/beta" ci --legacy-peer-deps; then
    echo "[launch] npm ci failed. Falling back to npm install..."
    "$NPM_CMD" --prefix "$ROOT_DIR/beta" install --legacy-peer-deps
  fi
}

rebuild_beta() {
  echo "[launch] Beta build output missing. Rebuilding..."
  "$NPM_CMD" --prefix "$ROOT_DIR/beta" run build
}

kill_port() {
  command -v lsof >/dev/null 2>&1 || return 0
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
  for attempt in {1..80}; do
    if curl -fsS --max-time 2 "http://localhost:${PORT}/api/maps/${M3E_MAP_ID}" >/dev/null 2>&1; then
      return 0
    fi
    if ! kill -0 "$APP_PID" 2>/dev/null; then
      return 1
    fi
    sleep 0.25
  done
  return 1
}

find_runtime

BETA_DIR="$ROOT_DIR/beta"
ENTRY_JS="$BETA_DIR/dist/node/start_viewer.js"
DOTENV_JS="$BETA_DIR/node_modules/dotenv/config.js"

[[ -f "$DOTENV_JS" ]] || repair_dependencies
[[ -f "$ENTRY_JS" ]] || rebuild_beta

if [[ ! -f "$DOTENV_JS" ]]; then
  echo "[ERROR] Missing runtime dependency after repair: $DOTENV_JS" >&2
  exit 1
fi
if [[ ! -f "$ENTRY_JS" ]]; then
  echo "[ERROR] Missing build output after rebuild: $ENTRY_JS" >&2
  exit 1
fi

kill_port

trap cleanup INT TERM EXIT

cd "$ROOT_DIR"
"$NODE_CMD" "$ENTRY_JS" >> "$LOG_FILE" 2>&1 &
APP_PID=$!

if wait_for_server; then
  if command -v open >/dev/null 2>&1; then
    open "$URL"
  else
    echo "Open $URL in your browser."
  fi
else
  echo "[ERROR] Server did not become ready for map ${M3E_MAP_ID}." >&2
  echo "[ERROR] See ${LOG_FILE}" >&2
  exit 1
fi

wait "$APP_PID"
