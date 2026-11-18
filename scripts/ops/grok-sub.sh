#!/usr/bin/env bash
# Run one sub agent on Grok Build with the model and effort fixed by SUBAGENTS.md.
#
#   scripts/ops/grok-sub.sh run [--background] [--write --cwd <task worktree>] [--prompt-file <brief>] [prompt]
#   scripts/ops/grok-sub.sh runs|show|stop [run-id]
#
# The model and effort are fixed here; passing --model or --effort is refused.
# A --write run must name its own worktree under M3E-worktrees with --cwd, so a
# sub agent never edits the main checkout or another task's worktree.
set -euo pipefail

MODEL="grok-4.7-build-fast"
EFFORT="high"

bridge="$(ls -d "$HOME"/.claude/plugins/cache/xai-grok-build/grok-build/*/scripts/grok-bridge.mjs 2>/dev/null | sort -V | tail -1 || true)"
if [[ -z "$bridge" ]]; then
  echo "grok-sub: Grok Build bridge not found; install the xai-grok-build plugin" >&2
  exit 2
fi

command="${1:-}"
if [[ -z "$command" ]]; then
  echo "usage: grok-sub.sh run|runs|show|stop ..." >&2
  exit 2
fi
shift

if [[ "$command" != "run" ]]; then
  exec node "$bridge" "$command" "$@"
fi

write=0
cwd=""
args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do
  case "${args[$i]}" in
    --model|--model=*|--effort|--effort=*)
      echo "grok-sub: model and effort are fixed ($MODEL, $EFFORT); see SUBAGENTS.md" >&2
      exit 2
      ;;
    --write) write=1 ;;
    --cwd) cwd="${args[$((i + 1))]:-}" ;;
    --cwd=*) cwd="${args[$i]#--cwd=}" ;;
  esac
done

if [[ "$write" == 1 ]]; then
  resolved="$(cd "${cwd:-.}" 2>/dev/null && pwd -P || true)"
  case "$resolved" in
    */M3E-worktrees/*) ;;
    *)
      echo "grok-sub: a --write run needs --cwd <its own worktree under M3E-worktrees>; got '${cwd:-current directory}'" >&2
      exit 2
      ;;
  esac
fi

exec node "$bridge" run --model "$MODEL" --effort "$EFFORT" "$@"
