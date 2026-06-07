#!/bin/bash

set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

if [[ -z "${M3E_HOME:-}" ]]; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    M3E_HOME="$HOME/Library/Application Support/M3E"
  else
    M3E_HOME="${XDG_DATA_HOME:-$HOME/.local/share}/M3E"
  fi
fi

CONFIG_FILE="$M3E_HOME/m3e.conf"
mkdir -p "$M3E_HOME"

cat > "$CONFIG_FILE" <<'EOF'
M3E_LAUNCH_MODE=personal
M3E_WORKSPACE_ID=ws_A98E70JM9GAXCVXVMQBW7N0YGZ
M3E_WORKSPACE_LABEL=Personal
M3E_MAP_ID=map_09N0MQPFEQN9D4K66VNMT1F69V
M3E_MAP_LABEL=tutorial
M3E_MAP_SLUG=final-tutorial
M3E_CLOUD_SYNC=0
M3E_AUTO_SYNC=0
EOF

echo "[configure-personal-mode] wrote $CONFIG_FILE"
