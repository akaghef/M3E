#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/ops/worktree.sh new <task>
  scripts/ops/worktree.sh list
  scripts/ops/worktree.sh clean
  scripts/ops/worktree.sh rm <task>
  scripts/ops/worktree.sh help

Worktrees:
  path:   $HOME/dev/M3E-<task>
  branch: codex/<task>
  base:   dev-beta
USAGE
}

repo_root() {
  git rev-parse --show-toplevel
}

require_task() {
  if [[ $# -ne 1 || -z "${1:-}" ]]; then
    echo "error: task is required" >&2
    usage >&2
    exit 2
  fi
  if [[ "$1" == -* || "$1" == */* ]]; then
    echo "error: task must not start with '-' or contain '/': $1" >&2
    exit 2
  fi
}

worktree_path() {
  printf '%s/dev/M3E-%s\n' "$HOME" "$1"
}

branch_name() {
  printf 'codex/%s\n' "$1"
}

cmd_new() {
  require_task "$@"
  local task="$1"
  local root path branch
  root="$(repo_root)"
  path="$(worktree_path "$task")"
  branch="$(branch_name "$task")"

  if [[ -e "$path" ]]; then
    echo "error: worktree path already exists: $path" >&2
    exit 1
  fi

  cd "$root"
  git check-ref-format --branch "$branch" >/dev/null
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    git worktree add "$path" "$branch"
  else
    git worktree add -b "$branch" "$path" dev-beta
  fi
}

cmd_list() {
  local root prunable
  root="$(repo_root)"
  cd "$root"
  git worktree list

  prunable="$(git worktree list --porcelain | awk '
    /^worktree / { path = substr($0, 10) }
    /^prunable / { print path " -- " substr($0, 10) }
  ')"
  if [[ -n "$prunable" ]]; then
    printf '\nPrunable worktrees:\n%s\n' "$prunable"
  fi
}

cmd_clean() {
  local root
  root="$(repo_root)"
  cd "$root"
  git worktree prune -v
}

cmd_rm() {
  require_task "$@"
  local root task path
  root="$(repo_root)"
  task="$1"
  path="$(worktree_path "$task")"

  cd "$root"
  if ! git worktree remove "$path"; then
    cat >&2 <<EOF
error: git worktree remove refused to remove:
  $path

The worktree may contain uncommitted or untracked work. Resolve it manually;
this helper never uses --force.
EOF
    exit 1
  fi
}

main() {
  local cmd="${1:-help}"
  if [[ $# -gt 0 ]]; then
    shift
  fi

  case "$cmd" in
    new) cmd_new "$@" ;;
    list) cmd_list "$@" ;;
    clean) cmd_clean "$@" ;;
    rm) cmd_rm "$@" ;;
    help|-h|--help) usage ;;
    *)
      echo "error: unknown subcommand: $cmd" >&2
      usage >&2
      exit 2
      ;;
  esac
}

main "$@"
