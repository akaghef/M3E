#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE="$SCRIPT_DIR/../../.shared/codex-session-core.sh"
exec env SESSION_PREFIX="codex-session-" MODEL="gpt-5.2" REASONING_EFFORT="high" SESSION_DISPLAY_NAME="Codex" "$CORE" list "$@"
