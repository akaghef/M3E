#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${M3E_PORT:-4173}"

export M3E_PORT="$PORT"
export M3E_OPEN_BROWSER="${M3E_OPEN_BROWSER:-0}"
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

mkdir -p "$M3E_DATA_DIR" "$(dirname "$M3E_SEED_DB_PATH")"
if [[ ! -f "$M3E_SEED_DB_PATH" && -f "$ROOT_DIR/install/assets/seeds/core-seed.sqlite" ]]; then
  cp "$ROOT_DIR/install/assets/seeds/core-seed.sqlite" "$M3E_SEED_DB_PATH"
fi
if [[ ! -f "$M3E_DATA_DIR/$M3E_DB_FILE" && -f "$M3E_SEED_DB_PATH" ]]; then
  cp "$M3E_SEED_DB_PATH" "$M3E_DATA_DIR/$M3E_DB_FILE"
fi

cd "$ROOT_DIR"

ENTRY_JS="$ROOT_DIR/beta/dist/node/start_viewer.js"
STALE_SOURCE="$(find "$ROOT_DIR/beta/src" "$ROOT_DIR/beta/home.html" "$ROOT_DIR/beta/viewer.html" "$ROOT_DIR/beta/viewer.css" -newer "$ENTRY_JS" -print -quit 2>/dev/null || true)"
if [[ ! -f "$ENTRY_JS" || -n "$STALE_SOURCE" ]]; then
  echo "[codex-app-server] beta build output missing or stale; building..."
  npm --prefix beta run build
fi

echo "[codex-app-server] M3E Beta serving on http://127.0.0.1:${PORT}/viewer.html?ws=${M3E_WORKSPACE_ID}&map=${M3E_MAP_ID}"
exec npm --prefix beta start
