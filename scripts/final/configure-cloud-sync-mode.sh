#!/bin/bash

set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

usage() {
  cat <<'EOF'
Usage:
  scripts/final/configure-cloud-sync-mode.sh <supabase-url> <anon-key> [workspace-id] [workspace-label] [map-id] [map-label] [map-slug] [auto-sync]
Example:
  scripts/final/configure-cloud-sync-mode.sh https://YOUR-PROJECT.supabase.co eyJ... ws_team_swingby "Swingby Team" map_team_swingby_home team-home team-home 0
EOF
}

if [[ $# -lt 2 ]]; then
  usage
  exit 1
fi

SUPABASE_URL="$1"
SUPABASE_ANON_KEY="$2"
WORKSPACE_ID="${3:-ws_team_workspace}"
WORKSPACE_LABEL="${4:-Team Workspace}"
MAP_ID="${5:-map_team_home}"
MAP_LABEL="${6:-team-home}"
MAP_SLUG="${7:-team-home}"
AUTO_SYNC="${8:-0}"

if [[ -z "${M3E_HOME:-}" ]]; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    M3E_HOME="$HOME/Library/Application Support/M3E"
  else
    M3E_HOME="${XDG_DATA_HOME:-$HOME/.local/share}/M3E"
  fi
fi

CONFIG_FILE="$M3E_HOME/m3e.conf"
mkdir -p "$M3E_HOME"

cat > "$CONFIG_FILE" <<EOF
M3E_LAUNCH_MODE=personal
M3E_WORKSPACE_ID=$WORKSPACE_ID
M3E_WORKSPACE_LABEL=$WORKSPACE_LABEL
M3E_MAP_ID=$MAP_ID
M3E_MAP_LABEL=$MAP_LABEL
M3E_MAP_SLUG=$MAP_SLUG
M3E_CLOUD_SYNC=1
M3E_CLOUD_TRANSPORT=supabase
M3E_SUPABASE_URL=$SUPABASE_URL
M3E_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
M3E_AUTO_SYNC=$AUTO_SYNC
M3E_AUTO_SYNC_INTERVAL_MS=8000
EOF

echo "[configure-cloud-sync-mode] wrote $CONFIG_FILE"
echo "[configure-cloud-sync-mode] workspace=$WORKSPACE_ID map=$MAP_ID auto_sync=$AUTO_SYNC"
