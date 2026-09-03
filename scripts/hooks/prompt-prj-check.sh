#!/usr/bin/env bash
set -euo pipefail

branch="$(git branch --show-current 2>/dev/null || true)"
payload="$(cat || true)"

if [[ "$branch" =~ ^prj/ ]]; then
  context="[sub-pj-guard] On prj/* branches, stop only for E1/E2/E3 in .claude/skills/sub-pj/phase/escalation.md. Otherwise pool ambiguity, keep the inner loop moving, and write state back to boards / tasks.yaml / resume-cheatsheet.md."
else
  context=""
fi

prompt_text="$(PAYLOAD="$payload" python - <<'PY'
import json
import os

raw = os.environ.get("PAYLOAD", "")
if not raw:
    print("")
    raise SystemExit

def collect_strings(value, out):
    if isinstance(value, str):
        out.append(value)
    elif isinstance(value, dict):
        for key, item in value.items():
            if str(key).lower() in {"prompt", "userprompt", "user_prompt", "message", "text", "input"}:
                collect_strings(item, out)
            elif isinstance(item, (dict, list)):
                collect_strings(item, out)
    elif isinstance(value, list):
        for item in value:
            collect_strings(item, out)

try:
    parsed = json.loads(raw)
except Exception:
    print(raw)
else:
    strings = []
    collect_strings(parsed, strings)
    print("\n".join(strings))
PY
)"

if printf '%s\n' "$prompt_text" | grep -Eiq 'recurrence[[:space:]-]+prevention|prevent[[:space:]-]+recurrence|再発防止'; then
  persistent_rule_context="[persistent-rule] Recurrence prevention requested. Treat this as a durable rule-system change. Use skill-creator when creating/updating a skill or trigger. Do not report completion with only a chat promise."
  if [[ -n "$context" ]]; then
    context+=$'\n'"$persistent_rule_context"
  else
    context="$persistent_rule_context"
  fi
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
