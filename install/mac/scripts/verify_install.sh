#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./common_env.sh
source "${SCRIPT_DIR}/common_env.sh"

m3e_load_conf_defaults
m3e_resolve_workspace_paths
m3e_ensure_dirs
m3e_log "${M3E_VERIFY_LOG}" INFO "verify start"

[[ -x "${M3E_NODE_EXE}" ]] || { m3e_fail "${M3E_VERIFY_LOG}" 51 "missing runtime node: ${M3E_NODE_EXE}"; exit $?; }
[[ -f "${M3E_START_JS}" ]] || { m3e_fail "${M3E_VERIFY_LOG}" 52 "missing start_viewer.js: ${M3E_START_JS}"; exit $?; }

NATIVE_ADDON="$(m3e_find_native_addon || true)"
[[ -n "${NATIVE_ADDON}" ]] || { m3e_fail "${M3E_VERIFY_LOG}" 53 "missing better-sqlite3 native addon"; exit $?; }

for target in "${M3E_DATA_DIR}/verify_data.tmp" "${M3E_LOG_HOME}/verify_logs.tmp" "${M3E_TMP}/verify_tmp.tmp"; do
  echo verify > "${target}" || { m3e_fail "${M3E_VERIFY_LOG}" 54 "not writable: ${target}"; exit $?; }
  rm -f "${target}"
done

(
  cd "${M3E_APP}"
  "${M3E_NODE_EXE}" -e "require('better-sqlite3'); console.log('better-sqlite3-ok')"
) >> "${M3E_VERIFY_LOG}" 2>&1 || {
  m3e_fail "${M3E_VERIFY_LOG}" 55 "failed to load better-sqlite3"
  exit $?
}

cat > "${M3E_TMP}/verify_lock.tmp" <<LOCK
pid=0
port=${M3E_DEFAULT_PORT}
startedAt=verify
LOCK
V_PID="$(m3e_read_lock_value pid "${M3E_TMP}/verify_lock.tmp")"
V_PORT="$(m3e_read_lock_value port "${M3E_TMP}/verify_lock.tmp")"
rm -f "${M3E_TMP}/verify_lock.tmp"
[[ "${V_PID}" == "0" ]] || { m3e_fail "${M3E_VERIFY_LOG}" 56 "lock parse failed (pid)"; exit $?; }
[[ "${V_PORT}" == "${M3E_DEFAULT_PORT}" ]] || { m3e_fail "${M3E_VERIFY_LOG}" 57 "lock parse failed (port)"; exit $?; }

m3e_log "${M3E_VERIFY_LOG}" INFO "verify completed"
echo "Verify completed successfully."
