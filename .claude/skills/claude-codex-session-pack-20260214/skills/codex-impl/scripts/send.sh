#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE="$SCRIPT_DIR/../../.shared/codex-session-core.sh"
exec env SESSION_PREFIX="codex-impl-session-" MODEL="gpt-5.3-codex" REASONING_EFFORT="xhigh" SESSION_DISPLAY_NAME="Codex Impl" "$CORE" send "$@"
