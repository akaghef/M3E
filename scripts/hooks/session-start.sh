#!/usr/bin/env bash
set -euo pipefail

branch="$(git branch --show-current 2>/dev/null || true)"

if [[ "$branch" =~ ^prj/([0-9]+)_(.+)$ ]]; then
  pj_id="${BASH_REMATCH[1]}"
  pj_name="${BASH_REMATCH[2]}"
  pj_dir="projects/PJ${pj_id}_${pj_name}"
  context="[sub-pj-resume] You are on ${branch}. Follow .claude/skills/sub-pj/phase/resume.md before doing anything else. Read ${pj_dir}/resume-cheatsheet.md and ${pj_dir}/tasks.yaml, then enter the deterministic loop in phase/2_session.md."
else
  context=""
fi

python - "$context" <<'PY'
import json
import sys

context = sys.argv[1]
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": context,
    }
}))
PY
