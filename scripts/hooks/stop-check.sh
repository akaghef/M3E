#!/usr/bin/env bash
set -euo pipefail

branch="$(git branch --show-current 2>/dev/null || true)"
context=""

if [[ "$branch" =~ ^prj/([0-9]+)_(.+)$ ]]; then
  pj_id="${BASH_REMATCH[1]}"
  pj_name="${BASH_REMATCH[2]}"
  pj_dir="projects/PJ${pj_id}_${pj_name}"
  dirty="$(git status --porcelain 2>/dev/null || true)"
  if [[ -n "$dirty" ]]; then
    touched="$(git diff --name-only HEAD -- "${pj_dir}/tasks.yaml" "${pj_dir}/resume-cheatsheet.md" 2>/dev/null || true)"
    if [[ -z "$touched" ]]; then
      context="[sub-pj-stop-reminder] Worktree has changes on ${branch}, but ${pj_dir}/tasks.yaml and ${pj_dir}/resume-cheatsheet.md were not updated since HEAD. Before stopping, check whether task state / round / next-task summary needs writeback."
    fi
  fi
fi

python - "$context" <<'PY'
import json
import sys

context = sys.argv[1]
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "Stop",
        "additionalContext": context,
    }
}))
PY
