#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./common_env.sh
source "${SCRIPT_DIR}/common_env.sh"

m3e_load_conf_defaults
m3e_resolve_workspace_paths
m3e_ensure_dirs

REPORT_DIR="${M3E_REPORTS}/M3E_report_$(m3e_ts)"
mkdir -p "${REPORT_DIR}"

{
  echo "M3E diagnostic report"
  echo "generatedAt=$(date -u +%FT%TZ)"
  echo "home=${M3E_HOME}"
  echo "workspace=${M3E_WORKSPACE_ID}"
  echo "map=${M3E_MAP_ID}"
  echo "dataDir=${M3E_DATA_DIR}"
  echo "dbFile=${M3E_DB_FILE}"
  echo "node=$("${M3E_NODE_EXE}" --version 2>/dev/null || true)"
  echo "startJs=${M3E_START_JS}"
} > "${REPORT_DIR}/summary.txt"

for log in "${M3E_SETUP_LOG}" "${M3E_STARTUP_LOG}" "${M3E_VERIFY_LOG}" "${M3E_MIGRATION_LOG}" "${M3E_CRASH_LOG}"; do
  if [[ -f "${log}" ]]; then
    cp -f "${log}" "${REPORT_DIR}/$(basename "${log}")"
  fi
done

m3e_mask_config_to "${M3E_CONF}" "${REPORT_DIR}/m3e.conf.masked"

if [[ -f "${M3E_LOCK_FILE}" ]]; then
  cp -f "${M3E_LOCK_FILE}" "${REPORT_DIR}/app.lock"
fi

ZIP_PATH="${REPORT_DIR}.zip"
(
  cd "$(dirname "${REPORT_DIR}")"
  zip -qr "$(basename "${ZIP_PATH}")" "$(basename "${REPORT_DIR}")"
)

m3e_log "${M3E_REPORT_LOG}" INFO "report written ${ZIP_PATH}"
echo "${ZIP_PATH}"
