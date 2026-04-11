#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE="$SCRIPT_DIR/../../.shared/claude-session-core.sh"
exec env SESSION_PREFIX="claude-session-" SESSION_DISPLAY_NAME="Claude" "$CORE" send "$@"
