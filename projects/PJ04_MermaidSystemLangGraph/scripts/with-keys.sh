#!/usr/bin/env bash
# with-keys.sh — load API keys from Bitwarden vault into env, then exec command.
#
# Usage:
#   ./projects/PJ04_MermaidSystemLangGraph/scripts/with-keys.sh python runtime/langgraph_sandbox/smoke_test.py
#   ./projects/PJ04_MermaidSystemLangGraph/scripts/with-keys.sh -- npm test
#
# Convention:
#   Vault items are named  api/<service>  with the key in the password field.
#   Currently loaded: api/anthropic, api/deepseek, api/openai (skipped if missing).
#
# Safety:
#   - Keys are only exported to the child process (exec), not to the parent shell.
#   - If BW_SESSION already exists, it is reused; otherwise `bw unlock --raw` runs.
#   - Existing env vars are NOT overwritten (allow ad-hoc override / CI).

set -euo pipefail

if ! command -v bw >/dev/null 2>&1; then
  echo "[with-keys] bw CLI not found. Install via 'npm i -g @bitwarden/cli' or scoop." >&2
  exit 127
fi

# --- 1. Ensure unlocked vault session -------------------------------------
if [ -z "${BW_SESSION:-}" ]; then
  echo "[with-keys] BW_SESSION not set, unlocking vault..." >&2
  BW_SESSION="$(bw unlock --raw)"
  export BW_SESSION
fi

# --- 2. Fetch keys (env var wins; missing items are silently skipped) -----
fetch() {
  local var="$1"
  local item="$2"
  if [ -n "${!var:-}" ]; then
    return 0
  fi
  local val
  if val="$(bw get password "$item" --session "$BW_SESSION" 2>/dev/null)"; then
    if [ -n "$val" ]; then
      export "$var=$val"
    fi
  fi
}

fetch ANTHROPIC_API_KEY api/anthropic
fetch DEEPSEEK_API_KEY  api/deepseek
fetch OPENAI_API_KEY    api/openai

# --- 3. Drop the args separator if present and exec ----------------------
if [ "${1:-}" = "--" ]; then
  shift
fi

if [ "$#" -eq 0 ]; then
  echo "[with-keys] no command given; loaded:" >&2
  for v in ANTHROPIC_API_KEY DEEPSEEK_API_KEY OPENAI_API_KEY; do
    if [ -n "${!v:-}" ]; then
      echo "  $v=set" >&2
    else
      echo "  $v=missing" >&2
    fi
  done
  exit 0
fi

exec "$@"
