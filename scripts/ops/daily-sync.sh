#!/usr/bin/env bash
# Fast-forward clean dev-beta only. Never promote Final or collect unfinished work.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --no-final) ;;
    --with-final) echo "Final promotion is separate; use Channel_Release_Policy.md." >&2; exit 2 ;;
    -h|--help) echo "Usage: daily-sync.sh [--dry-run] [--no-final]"; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Require clean dev-beta and no unpublished commits; fetch and fast-forward only. Final is unchanged."
  exit 0
fi
if [[ "$(git branch --show-current)" != "dev-beta" || -n "$(git status --porcelain)" ]]; then
  echo "ERROR: require clean dev-beta; preserve unfinished work." >&2
  exit 1
fi
git fetch origin dev-beta
if ! git merge-base --is-ancestor HEAD origin/dev-beta; then
  echo "ERROR: unpublished or diverged local commits; task owner must deliver them." >&2
  exit 1
fi
git merge --ff-only origin/dev-beta
echo "Result: source synchronized; runtime verification is separate. Final unchanged."
