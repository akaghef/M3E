#!/usr/bin/env bash
# Preview a worktree's browser changes through the MAIN checkout's beta server.
#
# Why this exists: code-writing Codex tasks run in worktrees (/…/M3E-<task>),
# but a worktree has no `better-sqlite3` native binding, so `npm start` crashes
# there. The only way to *see* a worktree's UI change is to build its browser
# bundle, drop the dist artifacts into the main checkout, and let the main
# server (which DOES have the native binding) serve them. This collapses that
# 3-step manual dance (build → copy dist → (re)start server) into one command.
#
# Usage:
#   scripts/beta/preview-worktree.sh <worktree-path>
#
# After it runs, just RELOAD the browser at http://localhost:4173 — the server
# serves dist/browser statically, so copied files show up on reload.
set -euo pipefail

# arm64 node: the system PATH puts an old Rosetta x64 node v14 first, which dies
# on modern syntax (`??=`) during the vite build. Force Homebrew arm64 node v26.
export PATH="/opt/homebrew/bin:${PATH}"

MAIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKTREE="${1:?usage: preview-worktree.sh <worktree-path>}"
PORT=4173

WORKTREE="$(cd "$WORKTREE" && pwd)"  # normalize to absolute
if [[ ! -d "$WORKTREE/beta" ]]; then
  echo "[preview] not an M3E worktree (no beta/): $WORKTREE" >&2
  exit 1
fi
if [[ "$WORKTREE" == "$MAIN_DIR" ]]; then
  echo "[preview] target is the main checkout — just run scripts/beta/launch.sh" >&2
  exit 1
fi

echo "[preview] building browser bundle in $WORKTREE"
npm --prefix "$WORKTREE/beta" run build:browser

echo "[preview] syncing dist/browser → main checkout"
# No --delete: the main build may carry assets build:browser doesn't regenerate.
rsync -a "$WORKTREE/beta/dist/browser/" "$MAIN_DIR/beta/dist/browser/"

if lsof -ti tcp:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[preview] server already live on :$PORT — RELOAD your browser to see changes"
else
  echo "[preview] no server on :$PORT — starting main server"
  ( cd "$MAIN_DIR" && nohup npm --prefix beta start >/tmp/m3e-beta-"$PORT".log 2>&1 & )
  echo "[preview] started in background (log: /tmp/m3e-beta-$PORT.log)"
  echo "[preview] give it a few seconds, then open http://localhost:$PORT"
fi
