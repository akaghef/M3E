#!/usr/bin/env bash
# Search past Codex session logs for the USER's messages matching a query.
#
# Why this exists: "find my earlier instruction about X" used to mean writing a
# throwaway python loop over ~/.codex/sessions/**/*.jsonl every time, with the
# usual JSON-parsing footguns. This is that search, done once and correctly.
#
# Usage:
#   scripts/ops/codex-grep.sh <query> [context-keyword]
#     <query>            substring that must appear in a user message
#     [context-keyword]  optional second substring the same message must contain
#                        (e.g. narrow "link" hits to ones also mentioning "viewer")
#
# Prints newest-first: session file + the matching user message (truncated).
set -euo pipefail

QUERY="${1:?usage: codex-grep.sh <query> [context-keyword]}"
CONTEXT="${2:-}"
SESSIONS="${CODEX_SESSIONS_DIR:-$HOME/.codex/sessions}"

python3 - "$QUERY" "$CONTEXT" "$SESSIONS" <<'PY'
import sys, os, re, glob, json

query, context, sessions = sys.argv[1], sys.argv[2], sys.argv[3]
files = sorted(
    glob.glob(os.path.join(sessions, "**", "*.jsonl"), recursive=True),
    reverse=True,
)

# user_message bodies are JSON-escaped; capture the raw body then let json.loads
# unescape it (handles \n, \", \uXXXX, \t correctly — naive .replace does not).
pat = re.compile(r'"type":"user_message","message":"((?:[^"\\]|\\.)*)"')
hits = 0
for path in files:
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            content = fh.read()
    except OSError:
        continue
    for m in pat.finditer(content):
        try:
            msg = json.loads('"' + m.group(1) + '"')
        except Exception:
            continue
        if query in msg and (not context or context in msg):
            print(f"\n=== {os.path.basename(path)} ===")
            print(msg[:800])
            hits += 1

print(f"\n[{hits} match(es) for {query!r}"
      + (f" + {context!r}" if context else "") + "]", file=sys.stderr)
PY
