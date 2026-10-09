#!/usr/bin/env bash
# Preview a worktree on an isolated port and temporary database.
# Never copy unmerged browser assets into the primary Beta checkout.
set -euo pipefail

WORKTREE="${1:?usage: preview-worktree.sh <worktree-path>}"
WORKTREE="$(cd "$WORKTREE" && pwd)"
PORT="${M3E_PREVIEW_PORT:-14175}"

if [[ ! -f "$WORKTREE/beta/package.json" ]]; then
  echo "[preview] not an M3E worktree: $WORKTREE" >&2
  exit 2
fi
if [[ ! "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1 || PORT > 65535 || PORT == 4173 )); then
  echo "[preview] use a dedicated port other than 4173 (M3E_PREVIEW_PORT)." >&2
  exit 2
fi
if lsof -ti tcp:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[preview] port $PORT is already in use." >&2
  exit 2
fi
if ! node -e 'const major = Number(process.versions.node.split(".")[0]); process.exit([20,22,23,24,25].includes(major) ? 0 : 1)'; then
  echo "[preview] use a Node.js version supported by better-sqlite3 (20, 22-25)." >&2
  exit 2
fi
if [[ ! -d "$WORKTREE/beta/node_modules" ]]; then
  echo "[preview] install worktree dependencies first: npm --prefix '$WORKTREE/beta' ci" >&2
  exit 2
fi

npm --prefix "$WORKTREE/beta" run build
echo "[preview] isolated sample map: http://127.0.0.1:$PORT/viewer.html"
echo "[preview] this server uses temporary data and exits with Ctrl-C."
cd "$WORKTREE/beta"
M3E_PORT="$PORT" exec node ./e2e_test_server.js
