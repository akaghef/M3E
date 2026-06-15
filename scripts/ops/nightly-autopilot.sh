#!/usr/bin/env bash
# Unattended nightly M3E dev-beta autopilot and data snapshot orchestrator.

set -euo pipefail
export PATH="/opt/homebrew/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

DRY_RUN=0
NO_PR=0
NO_CI_FIX=0
NO_DATA=0
TODAY="$(date +%F)"
START_EPOCH="$(date +%s)"
WALL_BUDGET="${WALL_BUDGET:-5400}"
MAX_CI_FIX="${MAX_CI_FIX:-3}"
CURRENT_STEP="startup"
LOCK_DIR="${TMPDIR:-/tmp}/m3e-nightly-autopilot.lock"
REPORT_DIR="$ROOT_DIR/logs"
REPORT_PATH="$REPORT_DIR/nightly-autopilot-$TODAY.md"

HEAD_BEFORE="unknown"
HEAD_AFTER="unknown"
STAGE_DATA="not-run"
STAGE_DEV_BETA="not-run"
STAGE_PR="not-run"
STAGE_CI="not-run"
SKIP_CODE_STAGES=0
AUTO_COMMIT="none"
PUSH_RESULT="not-run"
SNAPSHOT_OUTPUT=""
MERGED_PRS=""
SKIPPED_PRS=""
CI_RUNS=""
CI_FINAL="not-run"
CI_ATTEMPTS=0
ABORTS=""

on_error() {
  local status=$?
  echo "ERROR: nightly autopilot failed during: $CURRENT_STEP" >&2
  exit "$status"
}

trap on_error ERR

usage() {
  cat <<'EOF'
Usage: scripts/ops/nightly-autopilot.sh [--dry-run] [--no-pr] [--no-ci-fix] [--no-data]

  --dry-run     Read and report only; no commits, pushes, PR merges, codex runs, or repo log writes.
  --no-pr       Skip green PR merge stage.
  --no-ci-fix   Poll/report CI but do not invoke codex to fix failures.
  --no-data     Skip m3e-data SQL snapshot stage.
  -h, --help    Show this help.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --no-pr) NO_PR=1 ;;
    --no-ci-fix) NO_CI_FIX=1 ;;
    --no-data) NO_DATA=1 ;;
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

print_block_or_none() {
  local value="$1"
  if [[ -n "$value" ]]; then
    printf '%s\n' "$value"
  else
    printf 'none\n'
  fi
}

record_abort() {
  local message="$1"
  ABORTS+="- $message"$'\n'
  log "ABORT: $message"
}

elapsed_seconds() {
  local now
  now="$(date +%s)"
  echo $((now - START_EPOCH))
}

budget_remaining() {
  local elapsed
  elapsed="$(elapsed_seconds)"
  echo $((WALL_BUDGET - elapsed))
}

check_budget() {
  local remaining
  remaining="$(budget_remaining)"
  if [[ "$remaining" -le 0 ]]; then
    record_abort "wall budget exhausted (${WALL_BUDGET}s)"
    return 1
  fi
  return 0
}

acquire_lock() {
  CURRENT_STEP="acquire single-instance lock"
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "ERROR: another nightly autopilot appears to be running: $LOCK_DIR" >&2
    exit 1
  fi
  trap 'rm -rf "$LOCK_DIR"' EXIT
}

stage_data_snapshot() {
  CURRENT_STEP="stage A data snapshot"
  if [[ "$NO_DATA" -eq 1 ]]; then
    STAGE_DATA="skipped (--no-data)"
    return 0
  fi

  local args=()
  if [[ "$DRY_RUN" -eq 1 ]]; then
    args+=(--dry-run)
  fi

  set +e
  SNAPSHOT_OUTPUT="$(bash scripts/ops/m3e-data-snapshot.sh "${args[@]}" 2>&1)"
  local status=$?
  set -e
  printf '%s\n' "$SNAPSHOT_OUTPUT"

  if [[ "$status" -eq 0 ]]; then
    STAGE_DATA="pass"
  else
    STAGE_DATA="fail ($status)"
    record_abort "data snapshot failed with status $status"
  fi
  return 0
}

stage_dev_beta_latest() {
  CURRENT_STEP="stage 0 dev-beta latest"
  HEAD_BEFORE="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    local current_branch
    current_branch="$(git branch --show-current)"
    STAGE_DEV_BETA="dry-run"
    log "Dry run: current branch=$current_branch head=$HEAD_BEFORE"
    log "Dry run: would ensure dev-beta, pull --ff-only, commit tracked changes, and push origin dev-beta."
    HEAD_AFTER="$HEAD_BEFORE"
    return 0
  fi

  if ! run git fetch origin dev-beta; then
    STAGE_DEV_BETA="fail (git fetch)"
    SKIP_CODE_STAGES=1
    record_abort "git fetch origin dev-beta failed; code stages skipped"
    return 0
  fi

  local current_branch
  current_branch="$(git branch --show-current)"
  if [[ "$current_branch" == "main" ]]; then
    STAGE_DEV_BETA="fail (current branch main)"
    SKIP_CODE_STAGES=1
    record_abort "refusing to operate from main branch"
    return 0
  fi

  if [[ "$current_branch" != "dev-beta" ]]; then
    if ! run git checkout dev-beta; then
      STAGE_DEV_BETA="fail (checkout dev-beta)"
      SKIP_CODE_STAGES=1
      record_abort "git checkout dev-beta failed; code stages skipped"
      return 0
    fi
  fi

  set +e
  git pull --ff-only origin dev-beta
  local pull_status=$?
  set -e
  if [[ "$pull_status" -ne 0 ]]; then
    STAGE_DEV_BETA="fail (non-fast-forward)"
    SKIP_CODE_STAGES=1
    record_abort "dev-beta is not fast-forwardable from origin/dev-beta; code stages skipped"
    return 0
  fi

  if ! run git add -u; then
    STAGE_DEV_BETA="fail (git add -u)"
    SKIP_CODE_STAGES=1
    record_abort "git add -u failed; code stages skipped"
    return 0
  fi
  if git diff --cached --quiet; then
    AUTO_COMMIT="none"
  else
    if ! run git commit -m "chore: nightly auto-commit ($TODAY)"; then
      STAGE_DEV_BETA="fail (auto-commit)"
      SKIP_CODE_STAGES=1
      record_abort "nightly auto-commit failed; code stages skipped"
      return 0
    fi
    AUTO_COMMIT="$(git rev-parse --short HEAD)"
  fi

  if ! run git push origin dev-beta; then
    STAGE_DEV_BETA="fail (push dev-beta)"
    SKIP_CODE_STAGES=1
    record_abort "git push origin dev-beta failed; code stages skipped"
    return 0
  fi
  PUSH_RESULT="pushed"
  HEAD_AFTER="$(git rev-parse --short HEAD)"
  STAGE_DEV_BETA="pass"
}

pr_checks_success_expr() {
  cat <<'EOF'
.[] |
[
  (.number | tostring),
  (.title | gsub("\t"; " ") | gsub("\n"; " ")),
  .mergeable,
  .headRefName,
  (
    if ([.statusCheckRollup[]? |
      select(
        ((.status? // "COMPLETED") != "COMPLETED") or
        ((.conclusion? // "SUCCESS") != "SUCCESS")
      )
    ] | length) == 0 then "checks-success" else "checks-not-success" end
  )
] | @tsv
EOF
}

stage_green_pr_merge() {
  CURRENT_STEP="stage 1 green PR merge"
  if [[ "$NO_PR" -eq 1 ]]; then
    STAGE_PR="skipped (--no-pr)"
    return 0
  fi

  if [[ "$SKIP_CODE_STAGES" -eq 1 ]]; then
    STAGE_PR="skipped (stage 0 failed)"
    return 0
  fi

  set +e
  gh auth status -h github.com >/dev/null 2>&1
  local auth_status=$?
  set -e
  if [[ "$auth_status" -ne 0 ]]; then
    STAGE_PR="fail (gh auth)"
    record_abort "gh auth status failed; PR merge stage skipped"
    return 0
  fi

  local pr_lines
  set +e
  pr_lines="$(gh pr list --base dev-beta --state open --json number,title,mergeable,headRefName,statusCheckRollup --jq "$(pr_checks_success_expr)" 2>&1)"
  local list_status=$?
  set -e
  if [[ "$list_status" -ne 0 ]]; then
    STAGE_PR="fail (gh pr list)"
    record_abort "gh pr list failed: $pr_lines"
    return 0
  fi

  if [[ -z "$pr_lines" ]]; then
    STAGE_PR="pass (no open PRs)"
    return 0
  fi

  local number title mergeable head_ref checks
  while IFS=$'\t' read -r number title mergeable head_ref checks; do
    if [[ -z "${number:-}" ]]; then
      continue
    fi

    if [[ "$mergeable" == "MERGEABLE" && "$checks" == "checks-success" ]]; then
      if [[ "$DRY_RUN" -eq 1 ]]; then
        MERGED_PRS+="- #$number $title ($head_ref): would squash merge"$'\n'
      else
        if run gh pr merge "$number" --squash --delete-branch; then
          MERGED_PRS+="- #$number $title ($head_ref)"$'\n'
        else
          SKIPPED_PRS+="- #$number $title ($head_ref): merge command failed"$'\n'
        fi
      fi
    else
      SKIPPED_PRS+="- #$number $title ($head_ref): mergeable=$mergeable checks=$checks"$'\n'
    fi
  done <<< "$pr_lines"

  if [[ "$DRY_RUN" -eq 0 && -n "$MERGED_PRS" ]]; then
    if run git pull --ff-only origin dev-beta; then
      HEAD_AFTER="$(git rev-parse --short HEAD)"
    else
      STAGE_PR="partial (post-merge pull failed)"
      record_abort "post-merge git pull --ff-only failed"
      return 0
    fi
  fi

  STAGE_PR="pass"
}

run_list_for_head() {
  local head_sha="$1"
  gh run list --branch dev-beta --limit 30 \
    --json databaseId,status,conclusion,workflowName,url,headSha \
    --jq ".[] | select(.headSha == \"$head_sha\") | [.databaseId, .status, (.conclusion // \"\"), .workflowName, .url] | @tsv"
}

summarize_ci_runs() {
  local runs="$1"
  local id status conclusion workflow url
  CI_RUNS=""
  while IFS=$'\t' read -r id status conclusion workflow url; do
    if [[ -z "${id:-}" ]]; then
      continue
    fi
    CI_RUNS+="- $workflow: status=$status conclusion=${conclusion:-none} id=$id url=$url"$'\n'
  done <<< "$runs"
}

ci_runs_are_complete() {
  local runs="$1"
  local id status conclusion workflow url
  while IFS=$'\t' read -r id status conclusion workflow url; do
    if [[ -n "${id:-}" && "$status" != "completed" ]]; then
      return 1
    fi
  done <<< "$runs"
  return 0
}

ci_runs_all_success() {
  local runs="$1"
  local id status conclusion workflow url
  while IFS=$'\t' read -r id status conclusion workflow url; do
    if [[ -n "${id:-}" && "$conclusion" != "success" ]]; then
      return 1
    fi
  done <<< "$runs"
  return 0
}

first_failed_run_id() {
  local runs="$1"
  local id status conclusion workflow url
  while IFS=$'\t' read -r id status conclusion workflow url; do
    if [[ -n "${id:-}" && "$status" == "completed" && "$conclusion" != "success" ]]; then
      echo "$id"
      return 0
    fi
  done <<< "$runs"
  return 1
}

failed_run_workflow() {
  local runs="$1"
  local target_id="$2"
  local id status conclusion workflow url
  while IFS=$'\t' read -r id status conclusion workflow url; do
    if [[ "$id" == "$target_id" ]]; then
      echo "$workflow"
      return 0
    fi
  done <<< "$runs"
  echo "unknown"
}

poll_ci_for_head() {
  local head_sha="$1"
  local runs

  while true; do
    if ! check_budget; then
      return 124
    fi

    set +e
    runs="$(run_list_for_head "$head_sha" 2>&1)"
    local status=$?
    set -e
    if [[ "$status" -ne 0 ]]; then
      CI_RUNS="- gh run list failed: $runs"$'\n'
      CI_FINAL="unknown (gh run list failed)"
      return "$status"
    fi

    summarize_ci_runs "$runs"
    if [[ -z "$runs" ]]; then
      CI_FINAL="unknown (no runs for head $head_sha)"
      return 2
    fi

    if ci_runs_are_complete "$runs"; then
      if ci_runs_all_success "$runs"; then
        CI_FINAL="green"
        return 0
      fi
      CI_FINAL="red"
      return 1
    fi

    if [[ "$DRY_RUN" -eq 1 ]]; then
      CI_FINAL="pending (dry-run did not wait)"
      return 0
    fi

    log "CI still running for $head_sha; sleeping 30s."
    sleep 30
  done
}

codex_ci_fix_once() {
  local failed_id="$1"
  local workflow="$2"
  local log_excerpt
  local handoff

  set +e
  log_excerpt="$(gh run view "$failed_id" --log-failed 2>&1 | head -c 12000)"
  local log_status=$?
  set -e
  if [[ "$log_status" -ne 0 ]]; then
    log_excerpt="Unable to fetch failed log for run $failed_id: $log_excerpt"
  fi

  handoff="$(cat <<EOF
OBJECTIVE: Fix failing CI on dev-beta.

Failing workflow: $workflow
Failed run id: $failed_id

Log excerpt:
\`\`\`
$log_excerpt
\`\`\`

Scope: this repository only.
Constraints:
- Make the minimal fix needed to restore CI.
- Commit directly on dev-beta.
- Do not touch final/ or main.
- Do not force-push.
- Run the narrowest relevant verification.
EOF
)"

  run codex exec "$handoff" < /dev/null
  run git push origin dev-beta
}

stage_ci_green_up() {
  CURRENT_STEP="stage 2 CI green-up"
  if [[ "$SKIP_CODE_STAGES" -eq 1 ]]; then
    STAGE_CI="skipped (stage 0 failed)"
    return 0
  fi

  local head_sha
  head_sha="$(git rev-parse HEAD)"

  if poll_ci_for_head "$head_sha"; then
    STAGE_CI="pass ($CI_FINAL)"
    return 0
  fi

  if [[ "$CI_FINAL" != "red" ]]; then
    STAGE_CI="partial ($CI_FINAL)"
    return 0
  fi

  if [[ "$NO_CI_FIX" -eq 1 ]]; then
    STAGE_CI="red (--no-ci-fix)"
    return 0
  fi

  while [[ "$CI_ATTEMPTS" -lt "$MAX_CI_FIX" ]]; do
    if ! check_budget; then
      STAGE_CI="red (budget exhausted)"
      return 0
    fi

    local runs failed_id workflow
    set +e
    runs="$(run_list_for_head "$head_sha" 2>&1)"
    local list_status=$?
    set -e
    if [[ "$list_status" -ne 0 ]]; then
      CI_RUNS="- gh run list failed during CI-fix attempt: $runs"$'\n'
      STAGE_CI="partial (gh run list failed)"
      return 0
    fi
    failed_id="$(first_failed_run_id "$runs" || true)"
    if [[ -z "$failed_id" ]]; then
      STAGE_CI="partial (no failed run id)"
      return 0
    fi
    workflow="$(failed_run_workflow "$runs" "$failed_id")"

    CI_ATTEMPTS=$((CI_ATTEMPTS + 1))
    if [[ "$DRY_RUN" -eq 1 ]]; then
      log "Dry run: would invoke codex for failed CI run $failed_id ($workflow)."
      STAGE_CI="red (dry-run no codex)"
      return 0
    fi

    set +e
    codex_ci_fix_once "$failed_id" "$workflow"
    local fix_status=$?
    set -e
    if [[ "$fix_status" -ne 0 ]]; then
      STAGE_CI="red (codex fix failed)"
      record_abort "codex CI fix attempt $CI_ATTEMPTS failed with status $fix_status"
      return 0
    fi
    head_sha="$(git rev-parse HEAD)"
    if poll_ci_for_head "$head_sha"; then
      STAGE_CI="pass after $CI_ATTEMPTS CI-fix attempt(s)"
      return 0
    fi

    if [[ "$CI_FINAL" != "red" ]]; then
      STAGE_CI="partial ($CI_FINAL)"
      return 0
    fi
  done

  STAGE_CI="red after $CI_ATTEMPTS CI-fix attempt(s)"
}

overall_verdict() {
  if [[ "$STAGE_DATA" == fail* || "$STAGE_DEV_BETA" == fail* || "$STAGE_PR" == fail* || "$STAGE_CI" == red* ]]; then
    echo "FAIL"
  elif [[ "$STAGE_DATA" == skipped* || "$STAGE_PR" == skipped* || "$STAGE_CI" == partial* || "$STAGE_CI" == skipped* || "$STAGE_CI" == *pending* ]]; then
    echo "PARTIAL"
  else
    echo "PASS"
  fi
}

write_report() {
  CURRENT_STEP="stage 3 report"
  HEAD_AFTER="$(git rev-parse --short HEAD 2>/dev/null || echo "$HEAD_AFTER")"
  local verdict
  verdict="$(overall_verdict)"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    local dry_dir
    dry_dir="$(mktemp -d "${TMPDIR:-/tmp}/m3e-nightly-autopilot-report.XXXXXX")"
    REPORT_PATH="$dry_dir/nightly-autopilot-$TODAY.md"
  else
    mkdir -p "$REPORT_DIR"
  fi

  {
    echo "# Nightly Autopilot Report - $TODAY"
    echo ""
    echo "- started: $(date -r "$START_EPOCH" '+%Y-%m-%d %H:%M:%S')"
    echo "- finished: $(timestamp)"
    echo "- dry_run: $DRY_RUN"
    echo "- wall_budget_seconds: $WALL_BUDGET"
    echo "- head_before: $HEAD_BEFORE"
    echo "- head_after: $HEAD_AFTER"
    echo "- verdict: $verdict"
    echo ""
    echo "## Stages"
    echo ""
    echo "- data_snapshot: $STAGE_DATA"
    echo "- dev_beta_latest: $STAGE_DEV_BETA"
    echo "- green_pr_merge: $STAGE_PR"
    echo "- ci_green_up: $STAGE_CI"
    echo ""
    echo "## Data Snapshot"
    echo ""
    printf '```text\n%s\n```\n' "$SNAPSHOT_OUTPUT"
    echo ""
    echo "## Dev Beta"
    echo ""
    echo "- auto_commit: $AUTO_COMMIT"
    echo "- push_result: $PUSH_RESULT"
    echo ""
    echo "## Pull Requests"
    echo ""
    echo "### Merged"
    print_block_or_none "$MERGED_PRS"
    echo ""
    echo "### Skipped"
    print_block_or_none "$SKIPPED_PRS"
    echo ""
    echo "## CI"
    echo ""
    echo "- final_status: $CI_FINAL"
    echo "- ci_fix_attempts: $CI_ATTEMPTS"
    print_block_or_none "$CI_RUNS"
    echo ""
    echo "## Aborts And Timeouts"
    echo ""
    print_block_or_none "$ABORTS"
  } > "$REPORT_PATH"

  log "Report: $REPORT_PATH"
  echo "nightly-autopilot: $(overall_verdict) data=$STAGE_DATA dev-beta=$STAGE_DEV_BETA pr=$STAGE_PR ci=$STAGE_CI report=$REPORT_PATH"
}

run_stage() {
  local name="$1"
  shift
  header "$name"
  set +e
  "$@"
  local status=$?
  set -e
  if [[ "$status" -ne 0 ]]; then
    record_abort "$name failed with status $status"
  fi
}

main() {
  acquire_lock
  run_stage "Stage A: data snapshot" stage_data_snapshot
  run_stage "Stage 0: dev-beta latest" stage_dev_beta_latest
  run_stage "Stage 1: green PR merge" stage_green_pr_merge
  run_stage "Stage 2: CI green-up" stage_ci_green_up
  run_stage "Stage 3: report" write_report
}

main
