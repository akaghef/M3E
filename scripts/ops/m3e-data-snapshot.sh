#!/usr/bin/env bash
# Versioned SQL-dump snapshots of selected M3E workspace SQLite databases.

set -euo pipefail
export PATH="/opt/homebrew/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

DRY_RUN=0
TODAY="$(date +%F)"
CURRENT_STEP="startup"
SOURCE_ROOT="$HOME/Library/Application Support/M3E/workspaces"
DATA_REPO_DIR="${M3E_DATA_DIR:-$HOME/.m3e-data}"
DATA_REPO="akaghef/m3e-data"
SNAPSHOT_BRANCH="snapshots"
DUMP_ROOT=""

WORKSPACE_IDS=(
  "ws_REMH1Z5TFA7S93R3HA0XK58JNR"
  "ws_A98E70JM9GAXCVXVMQBW7N0YGZ"
  "ws_team_swingby"
)
WORKSPACE_NAMES=(
  "M3E"
  "Akaghef System"
  "Ops"
)

on_error() {
  local status=$?
  echo "ERROR: data snapshot failed during: $CURRENT_STEP" >&2
  exit "$status"
}

trap on_error ERR

usage() {
  cat <<'EOF'
Usage: scripts/ops/m3e-data-snapshot.sh [--dry-run]

  --dry-run   Create the three SQL dumps in a temp directory only; do not clone, commit, or push.
  -h, --help  Show this help.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

log() {
  echo "[$(timestamp)] $*"
}

header() {
  echo ""
  log "=== $1 ==="
}

run() {
  log "+ $*"
  "$@"
}

slug_for_workspace() {
  local name="$1"
  case "$name" in
    "M3E") echo "m3e" ;;
    "Akaghef System") echo "akaghef-system" ;;
    "Ops") echo "ops" ;;
    *) echo "$name" | tr '[:upper:] ' '[:lower:]-' ;;
  esac
}

discover_sqlite() {
  local workspace_dir="$1"
  local preferred="$workspace_dir/data.sqlite"
  local candidate

  if [[ -f "$preferred" ]]; then
    echo "$preferred"
    return 0
  fi

  while IFS= read -r candidate; do
    echo "$candidate"
    return 0
  done < <(
    find "$workspace_dir" -maxdepth 2 -type f \
      -name '*.sqlite' \
      ! -name '*-wal' \
      ! -name '*-shm' \
      ! -iname '*backup*' \
      ! -path '*/backups/*' \
      ! -path '*/backup/*' \
      ! -path '*/conflict-backups/*' \
      | sort
  )

  return 1
}

maps_count() {
  local sqlite_path="$1"
  local count

  set +e
  count="$(/usr/bin/sqlite3 "$sqlite_path" 'select count(*) from maps;' 2>/dev/null)"
  local status=$?
  set -e

  if [[ "$status" -eq 0 && -n "$count" ]]; then
    echo "$count"
  else
    echo "unavailable"
  fi
}

dump_workspace() {
  local workspace_id="$1"
  local workspace_name="$2"
  local slug
  local workspace_dir
  local sqlite_path
  local tmp_sqlite
  local dest_sql
  local count

  slug="$(slug_for_workspace "$workspace_name")"
  workspace_dir="$SOURCE_ROOT/$workspace_id"
  dest_sql="$DUMP_ROOT/snapshots/$slug.sql"

  if [[ ! -d "$workspace_dir" ]]; then
    log "SKIP $workspace_name ($workspace_id): workspace directory missing: $workspace_dir"
    return 0
  fi

  if ! sqlite_path="$(discover_sqlite "$workspace_dir")"; then
    log "SKIP $workspace_name ($workspace_id): primary .sqlite not found"
    return 0
  fi

  count="$(maps_count "$sqlite_path")"
  log "Dump $workspace_name ($workspace_id): source=$sqlite_path maps=$count"

  tmp_sqlite="$(mktemp "${TMPDIR:-/tmp}/m3e-${slug}.XXXXXX.sqlite")"
  /usr/bin/sqlite3 "$sqlite_path" ".backup main '$tmp_sqlite'"
  /usr/bin/sqlite3 "$tmp_sqlite" .dump > "$dest_sql"
  rm -f "$tmp_sqlite"
  log "WROTE $dest_sql"
}

prepare_dry_run_dump_root() {
  CURRENT_STEP="prepare dry-run temp dump directory"
  DUMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/m3e-data-snapshot-dry-run.XXXXXX")"
  mkdir -p "$DUMP_ROOT/snapshots"
  header "DRY RUN: workspace SQL dumps"
  log "Temp dump directory: $DUMP_ROOT"
  log "Dry run only: no gh clone, git commit, or git push will run."
}

prepare_data_repo() {
  CURRENT_STEP="prepare data repository"
  header "Prepare data repository"

  if [[ ! -d "$DATA_REPO_DIR/.git" ]]; then
    run gh repo clone "$DATA_REPO" "$DATA_REPO_DIR" -- --filter=blob:none
  else
    log "Using existing clone: $DATA_REPO_DIR"
  fi

  cd "$DATA_REPO_DIR"
  set +e
  run git fetch origin "$SNAPSHOT_BRANCH"
  local fetch_status=$?
  set -e
  if [[ "$fetch_status" -ne 0 ]]; then
    log "Remote branch origin/$SNAPSHOT_BRANCH not found; will use local branch or create an orphan branch."
  fi

  if git show-ref --verify --quiet "refs/remotes/origin/$SNAPSHOT_BRANCH"; then
    if git show-ref --verify --quiet "refs/heads/$SNAPSHOT_BRANCH"; then
      run git checkout "$SNAPSHOT_BRANCH"
      run git pull --ff-only origin "$SNAPSHOT_BRANCH"
    else
      run git checkout -b "$SNAPSHOT_BRANCH" "origin/$SNAPSHOT_BRANCH"
    fi
  elif git show-ref --verify --quiet "refs/heads/$SNAPSHOT_BRANCH"; then
    run git checkout "$SNAPSHOT_BRANCH"
  else
    run git checkout --orphan "$SNAPSHOT_BRANCH"
    log "+ git rm -rf ."
    git rm -rf . >/dev/null 2>&1 || true
    find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
    log "Created orphan branch: $SNAPSHOT_BRANCH"
  fi

  mkdir -p snapshots
  DUMP_ROOT="$DATA_REPO_DIR"
}

commit_and_push() {
  CURRENT_STEP="commit and push snapshots"
  header "Commit snapshots"
  cd "$DATA_REPO_DIR"

  local snapshot_files=()
  local snapshot_file
  while IFS= read -r -d '' snapshot_file; do
    snapshot_files+=("$snapshot_file")
  done < <(find snapshots -maxdepth 1 -type f -name '*.sql' -print0)

  if [[ "${#snapshot_files[@]}" -eq 0 ]]; then
    log "No SQL dump files were produced; skipping commit and push."
    return 0
  fi

  run git add ${snapshot_files[@]+"${snapshot_files[@]}"}
  if git diff --cached --quiet; then
    log "No snapshot changes; skipping commit and push."
    return 0
  fi

  run git commit -m "chore(data): nightly workspace snapshot ($TODAY)"
  run git push origin "$SNAPSHOT_BRANCH"
}

main() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    prepare_dry_run_dump_root
  else
    prepare_data_repo
  fi

  CURRENT_STEP="dump workspaces"
  header "Dump workspaces"
  local idx
  for idx in "${!WORKSPACE_IDS[@]}"; do
    dump_workspace "${WORKSPACE_IDS[$idx]}" "${WORKSPACE_NAMES[$idx]}"
  done

  if [[ "$DRY_RUN" -eq 1 ]]; then
    header "Dry-run summary"
    log "SQL dumps are available under: $DUMP_ROOT/snapshots"
    log "Result: pass"
    return 0
  fi

  commit_and_push
  header "Summary"
  log "Result: pass"
}

main
