#!/bin/bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
node "$ROOT_DIR/scripts/ops/channel-runtime.mjs" update-beta "$ROOT_DIR" "$@"
exec bash "$ROOT_DIR/scripts/beta/launch.sh"
