#!/usr/bin/env bash
# Invoke the OpenAI Codex CLI with the arm64 Homebrew node.
# The system PATH puts an old x86_64 node (v14, Rosetta) first, which makes
# codex resolve a non-existent darwin-x64 native package and fail. Forcing
# /opt/homebrew/bin to the front selects the arm64 node v26 that matches the
# installed codex-darwin-arm64 binary.
set -euo pipefail
export PATH="/opt/homebrew/bin:${PATH}"

# For `exec` subcommands, grant write access to Akaghef-Bridge so that
# a2a / inko skills can deliver packets without permission errors.
#
# `exec --final`: print ONLY Codex's last agent message instead of the full
# session transcript. A plain `codex exec` dumps the entire run (often >1MB) to
# stdout, which the Director then has to tail to find the actual report. With
# --final we run `--json` and emit just the final answer. Use it for handoffs
# where you only care about Codex's conclusion, not its step-by-step log.
if [[ "${1:-}" == "exec" ]]; then
  shift
  if [[ "${1:-}" == "--final" ]]; then
    shift
    codex exec --json --add-dir "/Users/nisimoriyuuya/Akaghef-Bridge" "$@" \
      | python3 -c '
import sys, json
# codex exec --json streams events; the final answer arrives as
#   {"type":"item.completed","item":{"type":"agent_message","text":"..."}}
final = ""
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        obj = json.loads(line)
    except Exception:
        continue
    if obj.get("type") == "item.completed":
        item = obj.get("item") or {}
        if item.get("type") == "agent_message" and item.get("text"):
            final = item["text"]
    elif obj.get("type") in ("error", "turn.failed"):
        sys.stderr.write(json.dumps(obj.get("error") or obj, ensure_ascii=False) + "\n")
print(final)
'
    exit "${PIPESTATUS[0]}"
  fi
  exec codex exec \
    --add-dir "/Users/nisimoriyuuya/Akaghef-Bridge" \
    "$@"
fi

exec codex "$@"
