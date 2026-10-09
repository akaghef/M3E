#!/usr/bin/env bash
# Daily unattended M3E dev-beta -> final sync.

set -euo pipefail
export PATH="/opt/homebrew/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

DRY_RUN=0
NO_FINAL=1
TODAY="$(date +%F)"
DEV_COMMITTED=0
FINAL_COMMITTED=0
FINAL_UPDATED=0
FINAL_GATE="skipped"
CURRENT_STEP="startup"

on_error() {
  local status=$?
  echo "ERROR: daily sync failed during: $CURRENT_STEP" >&2
  if [[ "$DEV_COMMITTED" -eq 1 ]]; then
    echo "NOTE: the dev-beta auto-commit/push step already completed before this failure." >&2
  fi
  exit "$status"
}

trap on_error ERR

usage() {
  cat <<'EOF'
Usage: scripts/ops/daily-sync.sh [--dry-run] [--no-final] [--with-final]

  --dry-run   Print planned actions only; do not checkout, commit, push, sync, build, or test.
  --no-final  Sync clean dev-beta only (default).
  --with-final  Explicitly requested beta -> final sync and verification.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --no-final) NO_FINAL=1 ;;
    --with-final) NO_FINAL=0 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

header() {
  echo ""
  echo "=== $1 ==="
}

run() {
  echo "+ $*"
  "$@"
}

dry_run_plan() {
  header "DRY RUN: planned daily sync"
  cat <<EOF
Repository: $ROOT_DIR
Date: $TODAY

Planned sequence:
1. Require dev-beta, clean working tree, and no unpublished local commits.
2. Fetch origin/dev-beta and fast-forward only. Never collect dirty work or push unknown commits.
EOF
  if [[ "$NO_FINAL" -eq 1 ]]; then
    cat <<'EOF'
4. Skip final sync because --no-final was supplied.
EOF
  else
    cat <<EOF
4. Run scripts/final/sync-beta-to-final.sh
5. If final/ changed, gate final:
   - cd final
   - npm ci if final/package-lock.json changed
   - otherwise npm install --no-audit --no-fund only when final/node_modules is missing
   - npm run build
   - npm run test with a 600s timeout
6. If final/ changes remain after a passing gate:
   - git add final/
   - git commit -m "chore(final): daily sync from beta ($TODAY)"
   - git push origin dev-beta
7. Print summary.
EOF
  fi
  echo ""
  echo "Dry run only: no git/build changes were made."
}

run_with_timeout() {
  local seconds="$1"
  shift

  if command -v gtimeout >/dev/null 2>&1; then
    gtimeout "$seconds" "$@"
    return $?
  fi

  if command -v timeout >/dev/null 2>&1; then
    timeout "$seconds" "$@"
    return $?
  fi

  "$@" &
  local pid=$!
  local elapsed=0
  while kill -0 "$pid" >/dev/null 2>&1; do
    if [[ "$elapsed" -ge "$seconds" ]]; then
      echo "Command timed out after ${seconds}s: $*" >&2
      kill "$pid" >/dev/null 2>&1 || true
      sleep 2
      kill -9 "$pid" >/dev/null 2>&1 || true
      wait "$pid" 2>/dev/null || true
      return 124
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  wait "$pid"
}

if [[ "$DRY_RUN" -eq 1 ]]; then
  dry_run_plan
  exit 0
fi

header "1. Sync clean dev-beta"
CURRENT_STEP="sync clean dev-beta"
if [[ "$(git branch --show-current)" != "dev-beta" || -n "$(git status --porcelain)" ]]; then
  echo "ERROR: require clean dev-beta; preserve unfinished work." >&2
  exit 1
fi
run git fetch origin dev-beta
if ! git merge-base --is-ancestor HEAD origin/dev-beta; then
  echo "ERROR: unpublished or diverged local commits; task owner must deliver them." >&2
  exit 1
fi
run git merge --ff-only origin/dev-beta

if [[ "$NO_FINAL" -eq 1 ]]; then
  header "4. Final sync skipped"
  echo "Default/--no-final: skipping beta/ -> final/ sync and final gate."
else
  header "4. Sync beta/ into final/"
  CURRENT_STEP="sync beta into final"
  run bash scripts/final/sync-beta-to-final.sh

  if [[ -z "$(git status --porcelain -- final/)" ]]; then
    echo "final/ unchanged after sync; skipping build/test and final commit."
  else
    FINAL_UPDATED=1
    if [[ -z "$(git status --porcelain -- final/package-lock.json)" ]]; then
      LOCK_CHANGED=0
    else
      LOCK_CHANGED=1
    fi

    header "5. Build/test final gate"
    CURRENT_STEP="build/test final gate"
    pushd final >/dev/null
    if [[ "$LOCK_CHANGED" -eq 1 ]]; then
      run npm ci
    elif [[ -d node_modules ]]; then
      echo "node_modules exists and package-lock.json did not change; skipping npm install."
    else
      run npm install --no-audit --no-fund
    fi
    run npm run build
    echo "+ timeout 600 npm run test"
    run_with_timeout 600 npm run test
    popd >/dev/null
    FINAL_GATE="pass"

    header "6. Commit final/ update"
    CURRENT_STEP="commit final update"
    if [[ -n "$(git status --porcelain -- final/)" ]]; then
      run git add final/
      run git commit -m "chore(final): daily sync from beta ($TODAY)"
      FINAL_COMMITTED=1
      CURRENT_STEP="push final update"
      run git push origin dev-beta
    else
      echo "No final/ changes to commit after gate."
    fi
  fi
fi

header "7. Summary"
if [[ "$DEV_COMMITTED" -eq 1 ]]; then
  echo "dev-beta commit: created and pushed"
else
  echo "dev-beta commit: nothing to do"
fi

if [[ "$NO_FINAL" -eq 1 ]]; then
  echo "final sync: skipped (--no-final)"
elif [[ "$FINAL_UPDATED" -eq 1 ]]; then
  echo "final sync: changed; gate=$FINAL_GATE"
  if [[ "$FINAL_COMMITTED" -eq 1 ]]; then
    echo "final commit: created and pushed"
  else
    echo "final commit: nothing to do"
  fi
else
  echo "final sync: nothing to do"
fi

echo "Result: pass"
