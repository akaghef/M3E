#!/usr/bin/env bash
set -euo pipefail

branch="$(git branch --show-current 2>/dev/null || true)"

if [[ "$branch" =~ ^prj/([0-9]+)_(.+)$ ]]; then
  pj_id="${BASH_REMATCH[1]}"
  pj_name="${BASH_REMATCH[2]}"
  pj_dir="projects/PJ${pj_id}_${pj_name}"
  context="[compaction-recovery] Compaction happened on ${branch}. Re-read .claude/skills/sub-pj/phase/resume.md, update ${pj_dir}/plan.md progress log, regenerate ${pj_dir}/resume-cheatsheet.md if state changed, and continue from tasks.yaml without asking the human unless E1/E2/E3 applies."
else
  context="[compaction-recovery] Compaction happened. Re-establish current task before continuing."
fi

python - "$context" <<'PY'
import json
import sys

context = sys.argv[1]
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PostCompact",
        "additionalContext": context,
    }
}))
PY
