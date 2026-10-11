#!/bin/bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
node "$ROOT_DIR/scripts/ops/channel-runtime.mjs" update-final "$ROOT_DIR" "$@"
