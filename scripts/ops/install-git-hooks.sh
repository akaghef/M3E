#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
current="$(git config --get core.hooksPath || true)"
if [[ -n "$current" && "$current" != .githooks ]]; then
  echo "Refusing to overwrite core.hooksPath=$current; reconcile the existing hooks first." >&2
  exit 1
fi
if [[ ! -x .githooks/pre-push ]]; then
  echo 'Missing executable .githooks/pre-push in this checkout.' >&2
  exit 1
fi
git config --local core.hooksPath .githooks
echo 'Installed core.hooksPath=.githooks (shared config; Git resolves hooks in each worktree).'
