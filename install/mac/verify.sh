#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./scripts/common_env.sh
source "${SCRIPT_DIR}/scripts/common_env.sh"

"${SCRIPT_DIR}/scripts/verify_install.sh" "$@"
