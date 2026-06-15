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
if [[ "${1:-}" == "exec" ]]; then
  shift
  exec codex exec \
    --add-dir "/Users/nisimoriyuuya/Akaghef-Bridge" \
    "$@"
fi

exec codex "$@"
