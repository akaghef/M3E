#!/usr/bin/env bash
set -euo pipefail

branch="$(git branch --show-current 2>/dev/null || true)"
reducer_summary=""

if [[ "$branch" =~ ^prj/([0-9]+)_(.+)$ ]]; then
  pj_id="${BASH_REMATCH[1]}"
  pj_name="${BASH_REMATCH[2]}"
  pj_dir="projects/PJ${pj_id}_${pj_name}"

  # T-2-3: checkpoint JSON 前提の resume 呼び出し。
  # reducer が走らない状態（build 未実行・CLI 不在）では silent fail せず instruction だけ返す。
  if [[ -f "beta/dist/node/workflow_cli.js" && -d "${pj_dir}/runtime/checkpoints" ]]; then
    reducer_summary="$(node beta/dist/node/workflow_cli.js \
        --tasks "${pj_dir}/tasks.yaml" \
        --runtime "${pj_dir}/runtime" \
        --reviews "${pj_dir}/reviews" \
        --resume 2>&1 || echo "[workflow_cli --resume failed; fall back to manual resume]")"
  fi

  context="[sub-pj-resume] You are on ${branch}. Follow .claude/skills/sub-pj/phase/resume.md before doing anything else. Read ${pj_dir}/resume-cheatsheet.md and ${pj_dir}/tasks.yaml, then enter the deterministic loop in phase/2_session.md."
  if [[ -n "${reducer_summary}" ]]; then
    context+=$'\n\n[workflow_reducer checkpoint]\n'"${reducer_summary}"
  fi
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
