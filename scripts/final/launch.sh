#!/bin/bash

set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

# ============================================================
# M3E Final launch script for macOS / Linux
# - Daily startup entry point
# - Mirrors the Windows mode-aware launcher
# ============================================================

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

if [[ -z "${M3E_HOME:-}" ]]; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    export M3E_HOME="$HOME/Library/Application Support/M3E"
  else
    export M3E_HOME="${XDG_DATA_HOME:-$HOME/.local/share}/M3E"
  fi
fi

CONFIG_FILE="$M3E_HOME/m3e.conf"

set_default() {
  local name="$1"
  local value="$2"
  if [[ -z "${!name:-}" ]]; then
    export "$name=$value"
  fi
}

load_config() {
  [[ -f "$CONFIG_FILE" ]] || return 0
  local key value current
  while IFS='=' read -r key value || [[ -n "${key:-}" ]]; do
    [[ -n "${key:-}" && "$key" != \#* ]] || continue
    case "$key" in
      M3E_HOME|M3E_SEED_DB_PATH|M3E_DATA_DIR|M3E_DB_FILE|M3E_WORKSPACE_ID|\
      M3E_WORKSPACE_LABEL|M3E_MAP_ID|M3E_MAP_LABEL|M3E_MAP_SLUG|\
      M3E_MAIN_DATA_DIR|M3E_MAIN_DB_FILE|M3E_MAIN_DOC_ID|M3E_MAIN_WORKSPACE_ID|\
      M3E_PORT|M3E_LAUNCH_MODE|M3E_REMOTE_BASE_URL|M3E_REMOTE_WORKSPACE_ID|\
      M3E_REMOTE_MAP_ID|M3E_CLOUD_SYNC|M3E_CLOUD_TRANSPORT|M3E_CLOUD_DIR|\
      M3E_SUPABASE_URL|M3E_SUPABASE_ANON_KEY|M3E_AUTO_SYNC|\
      M3E_AUTO_SYNC_INTERVAL_MS)
        current="${!key:-}"
        if [[ -z "$current" ]]; then
          export "$key=$value"
        fi
        ;;
    esac
  done < "$CONFIG_FILE"
}

open_url() {
  local url="$1"
  if command -v open >/dev/null 2>&1; then
    open "$url"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url"
  else
    echo "Open $url in your browser."
  fi
}

kill_port() {
  command -v lsof >/dev/null 2>&1 || return 0
  local pids
  pids="$(lsof -ti tcp:"$M3E_PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "Stopping existing process on port ${M3E_PORT}: ${pids}"
    kill $pids 2>/dev/null || true
    sleep 1
  fi
}

find_node() {
  NODE_CMD="node"
  NPM_CMD=""
  if [[ -x "$ROOT_DIR/install2/node/bin/node" ]]; then
    NODE_CMD="$ROOT_DIR/install2/node/bin/node"
    NPM_CMD="$ROOT_DIR/install2/node/bin/npm"
  elif [[ -x "$ROOT_DIR/install/node/bin/node" ]]; then
    NODE_CMD="$ROOT_DIR/install/node/bin/node"
    NPM_CMD="$ROOT_DIR/install/node/bin/npm"
  fi
  if [[ -z "$NPM_CMD" ]] && command -v npm >/dev/null 2>&1; then
    NPM_CMD="$(command -v npm)"
  fi
  if ! command -v "$NODE_CMD" >/dev/null 2>&1 && [[ ! -x "$NODE_CMD" ]]; then
    echo "[ERROR] Node.js not found. Install Node.js or run setup first."
    exit 1
  fi
  if [[ "$NODE_CMD" == */* ]]; then
    export PATH="$(dirname "$NODE_CMD"):$PATH"
  fi
}

repair_dependencies() {
  if [[ -z "$NPM_CMD" ]]; then
    echo "[ERROR] npm not found. Install Node.js or run setup first."
    exit 1
  fi
  echo "[launch] Final dependencies missing. Repairing..."
  if ! "$NPM_CMD" --prefix "$FINAL_DIR" ci --legacy-peer-deps; then
    echo "[launch] npm ci failed. Falling back to npm install..."
    "$NPM_CMD" --prefix "$FINAL_DIR" install --legacy-peer-deps
  fi
}

rebuild_final() {
  if [[ -z "$NPM_CMD" ]]; then
    echo "[ERROR] npm not found. Install Node.js or run setup first."
    exit 1
  fi
  echo "[launch] Final build output missing. Rebuilding..."
  "$NPM_CMD" --prefix "$FINAL_DIR" run build
}

load_config

set_default M3E_LAUNCH_MODE "personal"
set_default M3E_SEED_DB_PATH "$M3E_HOME/seeds/core-seed.sqlite"
set_default M3E_WORKSPACE_ID "ws_A98E70JM9GAXCVXVMQBW7N0YGZ"
set_default M3E_WORKSPACE_LABEL "Personal"
set_default M3E_MAP_ID "map_09N0MQPFEQN9D4K66VNMT1F69V"
set_default M3E_MAP_LABEL "tutorial"
set_default M3E_MAP_SLUG "final-tutorial"
set_default M3E_DATA_DIR "$M3E_HOME/workspaces/$M3E_WORKSPACE_ID"
set_default M3E_DB_FILE "data.sqlite"
set_default M3E_PORT "38482"
set_default M3E_MAIN_DATA_DIR "$M3E_DATA_DIR"
set_default M3E_MAIN_DB_FILE "$M3E_DB_FILE"
set_default M3E_MAIN_DOC_ID "$M3E_MAP_ID"
set_default M3E_MAIN_WORKSPACE_ID "$M3E_WORKSPACE_ID"
set_default M3E_REMOTE_BASE_URL "http://127.0.0.1:4173"
set_default M3E_REMOTE_WORKSPACE_ID "$M3E_WORKSPACE_ID"
set_default M3E_REMOTE_MAP_ID ""
set_default M3E_CLOUD_SYNC "0"
set_default M3E_CLOUD_TRANSPORT "file"
set_default M3E_CLOUD_DIR "$M3E_DATA_DIR/cloud-sync"
set_default M3E_AUTO_SYNC "0"
set_default M3E_AUTO_SYNC_INTERVAL_MS "30000"
export M3E_DOC_ID="$M3E_MAP_ID"

LOG_FILE="$M3E_HOME/launch.log"

if [[ "$M3E_LAUNCH_MODE" == "remote" ]]; then
  base="${M3E_REMOTE_BASE_URL%/}"
  remote_url="$base/home.html?ws=$M3E_REMOTE_WORKSPACE_ID"
  if [[ -n "$M3E_REMOTE_MAP_ID" ]]; then
    remote_url="$remote_url&map=$M3E_REMOTE_MAP_ID"
  fi
  echo "[launch] mode=remote"
  echo "[launch] opening $remote_url"
  open_url "$remote_url"
  exit 0
fi

mkdir -p "$M3E_HOME" "$M3E_DATA_DIR" "$(dirname "$M3E_SEED_DB_PATH")"
if [[ ! -f "$M3E_SEED_DB_PATH" && -f "$ROOT_DIR/install/assets/seeds/core-seed.sqlite" ]]; then
  cp "$ROOT_DIR/install/assets/seeds/core-seed.sqlite" "$M3E_SEED_DB_PATH"
fi
if [[ ! -f "$M3E_DATA_DIR/$M3E_DB_FILE" && -f "$M3E_SEED_DB_PATH" ]]; then
  cp "$M3E_SEED_DB_PATH" "$M3E_DATA_DIR/$M3E_DB_FILE"
fi

find_node
kill_port

FINAL_DIR="$ROOT_DIR/final"
ENTRY_JS="$FINAL_DIR/dist/node/start_viewer.js"
DOTENV_JS="$FINAL_DIR/node_modules/dotenv/config.js"

[[ -f "$DOTENV_JS" ]] || repair_dependencies
[[ -f "$ENTRY_JS" ]] || rebuild_final

if [[ ! -f "$DOTENV_JS" ]]; then
  echo "[ERROR] Missing runtime dependency: $DOTENV_JS"
  echo "[ERROR] Run setup or update-and-launch to repair Final."
  exit 1
fi
if [[ ! -f "$ENTRY_JS" ]]; then
  echo "[ERROR] Missing build output: $ENTRY_JS"
  echo "[ERROR] Run setup or update-and-launch to rebuild Final."
  exit 1
fi

NODE_VER_FILE="$FINAL_DIR/.node_version"
CURRENT_NODE_VER="$("$NODE_CMD" -v)"
LAST_NODE_VER=""
[[ -f "$NODE_VER_FILE" ]] && LAST_NODE_VER="$(cat "$NODE_VER_FILE")"
if [[ "$CURRENT_NODE_VER" != "$LAST_NODE_VER" ]]; then
  if [[ -n "$NPM_CMD" ]]; then
    echo "Rebuilding native modules for Node.js $CURRENT_NODE_VER..." >> "$LOG_FILE"
    (cd "$FINAL_DIR" && "$NPM_CMD" rebuild) >> "$LOG_FILE" 2>&1
    echo "$CURRENT_NODE_VER" > "$NODE_VER_FILE"
  else
    echo "[WARN] npm not found; skipping native module rebuild for $CURRENT_NODE_VER." >> "$LOG_FILE"
  fi
fi

echo "[launch] mode=personal"
echo "[launch] log=$LOG_FILE"
"$NODE_CMD" "$ENTRY_JS" > "$LOG_FILE" 2>&1
