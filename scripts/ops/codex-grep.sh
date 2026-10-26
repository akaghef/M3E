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
#   CODEX_SESSIONS_DIR overrides ~/.codex/sessions (recursive .jsonl/.jsonl.zst).
#   Archives are excluded by default; set it to ~/.codex/archived_sessions
#   to search archived sessions instead. Compressed logs require zstd on PATH.
#
# Prints newest-first: session file + the matching user message (truncated).
set -euo pipefail

QUERY="${1:?usage: codex-grep.sh <query> [context-keyword]}"
CONTEXT="${2:-}"
SESSIONS="${CODEX_SESSIONS_DIR:-$HOME/.codex/sessions}"

python3 - "$QUERY" "$CONTEXT" "$SESSIONS" <<'PY'
import sys, os, glob, json, subprocess
from contextlib import contextmanager

query, context, sessions = sys.argv[1], sys.argv[2], sys.argv[3]
files = sorted(
    [path for suffix in ("*.jsonl", "*.jsonl.zst")
     for path in glob.glob(os.path.join(sessions, "**", suffix), recursive=True)],
    reverse=True,
)

@contextmanager
def open_session(path):
    if not path.endswith('.zst'):
        with open(path, encoding='utf-8', errors='replace') as fh:
            yield fh
        return
    try:
        process = subprocess.Popen(
            ['zstd', '-q', '-d', '-c', '--', path], stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, encoding='utf-8', errors='replace',
        )
    except FileNotFoundError:
        sys.exit('codex-grep: zstd is required to read .jsonl.zst files')
    with process, process.stdout as fh:
        yield fh
    if process.returncode:
        sys.exit(f'codex-grep: zstd decompression failed: {os.path.basename(path)}')


# Codex also records injected context (AGENTS.md, environment, skills, app pages)
# as role=user input_text; those parts are not the human's words.
INJECTED_PREFIXES = (
    '<environment_context>', '# AGENTS.md instructions', '<user_instructions>',
    '<skill>', '<external_codex_apps_open_page>',
)


def user_message(record):
    if not isinstance(record, dict):
        return None
    if record.get('type') == 'user_message':
        return record.get('message')
    payload = record.get('payload')
    if not isinstance(payload, dict):
        return None
    if record.get('type') == 'event_msg' and payload.get('type') == 'user_message':
        return payload.get('message')
    if (record.get('type') == 'response_item' and payload.get('type') == 'message'
            and payload.get('role') == 'user'):
        content = payload.get('content')
        if isinstance(content, list):
            texts = [part['text'] for part in content
                     if isinstance(part, dict) and part.get('type') == 'input_text'
                     and isinstance(part.get('text'), str)
                     and not part['text'].lstrip().startswith(INJECTED_PREFIXES)]
            return '\n'.join(texts) if texts else None
    return None


hits = 0
for path in files:
    try:
        with open_session(path) as fh:
            for line in fh:
                try:
                    # Parse whole records: field order/spacing and JSON escapes
                    # (including Japanese, quotes and newlines) are significant.
                    msg = user_message(json.loads(line))
                except ValueError:
                    # A live session may end with an unfinished JSON line.
                    continue
                if isinstance(msg, str) and query in msg and (not context or context in msg):
                    print(f"\n=== {os.path.basename(path)} ===")
                    print(msg[:800])
                    hits += 1
    except OSError:
        continue

print(f"\n[{hits} match(es) for {query!r}"
      + (f" + {context!r}" if context else "") + "]", file=sys.stderr)
PY
