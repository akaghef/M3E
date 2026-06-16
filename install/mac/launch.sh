#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./scripts/common_env.sh
source "${SCRIPT_DIR}/scripts/common_env.sh"

m3e_load_conf_defaults
m3e_resolve_workspace_paths
m3e_ensure_dirs
m3e_log "${M3E_STARTUP_LOG}" INFO "launch start workspace=${M3E_WORKSPACE_ID} map=${M3E_MAP_ID}"

[[ -x "${M3E_NODE_EXE}" ]] || { m3e_fail "${M3E_STARTUP_LOG}" 41 "missing runtime node: ${M3E_NODE_EXE}"; exit $?; }
[[ -f "${M3E_START_JS}" ]] || { m3e_fail "${M3E_STARTUP_LOG}" 42 "missing start script: ${M3E_START_JS}"; exit $?; }

PORT="${M3E_PORT:-$(m3e_conf_get M3E_PORT "${M3E_DEFAULT_PORT}")}"
APP_VERSION="$(m3e_manifest_version)"
LOCK_PID="$(m3e_read_lock_value pid || true)"
LOCK_PORT="$(m3e_read_lock_value port || true)"

GUARD_DIR="${M3E_TMP}/launch.guard"
if ! mkdir "${GUARD_DIR}" 2>/dev/null; then
  m3e_log "${M3E_STARTUP_LOG}" WARN "another launch sequence in progress"
  sleep 2
fi
trap 'rmdir "${GUARD_DIR}" >/dev/null 2>&1 || true' EXIT

if [[ -n "${LOCK_PID}" ]] && kill -0 "${LOCK_PID}" 2>/dev/null; then
  if [[ -n "${LOCK_PORT}" ]] && m3e_probe_http "${LOCK_PORT}"; then
    m3e_log "${M3E_STARTUP_LOG}" INFO "already running pid=${LOCK_PID} port=${LOCK_PORT}"
    open "$(m3e_viewer_url "${LOCK_PORT}")" >/dev/null 2>&1 || true
    exit 0
  fi
  m3e_log "${M3E_STARTUP_LOG}" WARN "lock exists but no healthy response; attempting stop"
  "${SCRIPT_DIR}/scripts/stop_running.sh" --force >> "${M3E_STARTUP_LOG}" 2>&1 || true
fi

if [[ -f "${M3E_SEED_DB}" && ! -f "${M3E_DB}" ]]; then
  mkdir -p "$(dirname "${M3E_DB}")"
  cp -f "${M3E_SEED_DB}" "${M3E_DB}"
fi

rm -f "${M3E_LOCK_FILE}"
PORT="$(m3e_choose_port "${PORT}")" || { m3e_fail "${M3E_STARTUP_LOG}" 43 "no available port"; exit $?; }

M3E_PORT="${PORT}" \
M3E_HOST="${M3E_HOST}" \
M3E_CHANNEL="${M3E_CHANNEL:-final}" \
M3E_WORKSPACE_ID="${M3E_WORKSPACE_ID}" \
M3E_WORKSPACE_LABEL="${M3E_WORKSPACE_LABEL}" \
M3E_MAP_ID="${M3E_MAP_ID}" \
M3E_MAP_LABEL="${M3E_MAP_LABEL}" \
M3E_MAP_SLUG="${M3E_MAP_SLUG}" \
M3E_DATA_DIR="${M3E_DATA_DIR}" \
M3E_DB_FILE="${M3E_DB_FILE}" \
  "${M3E_NODE_EXE}" "${M3E_START_JS}" >> "${M3E_STARTUP_LOG}" 2>&1 &
NODE_PID=$!

m3e_write_lock "${NODE_PID}" "${PORT}" "${APP_VERSION}"

for _ in $(seq 1 30); do
  if m3e_probe_http "${PORT}"; then
    m3e_log "${M3E_STARTUP_LOG}" INFO "server ready pid=${NODE_PID} port=${PORT}"
    open "$(m3e_viewer_url "${PORT}")" >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 1
  if ! kill -0 "${NODE_PID}" 2>/dev/null; then
    break
  fi
done

kill "${NODE_PID}" >/dev/null 2>&1 || true
rm -f "${M3E_LOCK_FILE}"
m3e_fail "${M3E_STARTUP_LOG}" 44 "startup timeout or process exited early"
exit $?
