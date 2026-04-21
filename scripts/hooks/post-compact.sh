#!/usr/bin/env bash
set -euo pipefail

branch="$(git branch --show-current 2>/dev/null || true)"
reducer_summary=""

if [[ "$branch" =~ ^prj/([0-9]+)_(.+)$ ]]; then
  pj_id="${BASH_REMATCH[1]}"
  pj_name="${BASH_REMATCH[2]}"
  pj_dir="projects/PJ${pj_id}_${pj_name}"

  # T-2-3: compaction 後も checkpoint JSON から resume を dump。
  if [[ -f "beta/dist/node/workflow_cli.js" && -d "${pj_dir}/runtime/checkpoints" ]]; then
    reducer_summary="$(node beta/dist/node/workflow_cli.js \
        --tasks "${pj_dir}/tasks.yaml" \
        --runtime "${pj_dir}/runtime" \
        --reviews "${pj_dir}/reviews" \
        --resume 2>&1 || echo "[workflow_cli --resume failed post-compact; fall back to manual resume]")"
  fi

  context="[compaction-recovery] Compaction happened on ${branch}. Re-read .claude/skills/sub-pj/phase/resume.md, update ${pj_dir}/plan.md progress log, regenerate ${pj_dir}/resume-cheatsheet.md if state changed, and continue from tasks.yaml without asking the human unless E1/E2/E3 applies."
  if [[ -n "${reducer_summary}" ]]; then
    context+=$'\n\n[workflow_reducer checkpoint post-compact]\n'"${reducer_summary}"
  fi
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
