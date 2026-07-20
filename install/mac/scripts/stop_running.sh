#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./common_env.sh
source "${SCRIPT_DIR}/common_env.sh"

WAIT_SECONDS=10
FORCE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --wait)
      WAIT_SECONDS="${2:-10}"
      shift
      ;;
    --force)
      FORCE=1
      ;;
    --help)
      echo "Usage: stop_running.sh [--wait seconds] [--force]"
      exit 0
      ;;
  esac
  shift
done

PID="$(m3e_read_lock_value pid || true)"
PORT="$(m3e_read_lock_value port || true)"

if [[ -z "${PID}" && -n "${PORT}" ]]; then
  PID="$(lsof -tiTCP:"${PORT}" -sTCP:LISTEN | head -n1 || true)"
fi

if [[ -z "${PID}" ]]; then
  rm -f "${M3E_LOCK_FILE}"
  exit 0
fi

if ! kill -0 "${PID}" 2>/dev/null; then
  rm -f "${M3E_LOCK_FILE}"
  exit 0
fi

kill "${PID}" >/dev/null 2>&1 || true
for _ in $(seq 1 "${WAIT_SECONDS}"); do
  if ! kill -0 "${PID}" 2>/dev/null; then
    rm -f "${M3E_LOCK_FILE}"
    exit 0
  fi
  sleep 1
done

if [[ "${FORCE}" -eq 1 ]]; then
  kill -9 "${PID}" >/dev/null 2>&1 || true
  rm -f "${M3E_LOCK_FILE}"
fi
