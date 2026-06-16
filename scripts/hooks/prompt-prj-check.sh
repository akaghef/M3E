#!/usr/bin/env bash
set -euo pipefail

branch="$(git branch --show-current 2>/dev/null || true)"

if [[ "$branch" =~ ^prj/ ]]; then
  context="[sub-pj-guard] On prj/* branches, stop only for E1/E2/E3 in .claude/skills/sub-pj/phase/escalation.md. Otherwise pool ambiguity, keep the inner loop moving, and write state back to boards / tasks.yaml / resume-cheatsheet.md."
else
  context=""
fi

python - "$context" <<'PY'
import json
import sys

context = sys.argv[1]
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": context,
    }
}))
PY
