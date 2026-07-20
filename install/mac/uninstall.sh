#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./scripts/common_env.sh
source "${SCRIPT_DIR}/scripts/common_env.sh"

MODE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift
      ;;
    --help)
      echo "Usage: uninstall.sh [--mode app|app-logs|all]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
  shift
done

if [[ -z "${MODE}" ]]; then
  echo "Select uninstall mode:"
  echo "1) app"
  echo "2) app-logs"
  echo "3) all"
  read -r -p "mode [1-3]: " sel
  case "${sel}" in
    1) MODE="app" ;;
    2) MODE="app-logs" ;;
    3) MODE="all" ;;
    *) echo "invalid selection"; exit 2 ;;
  esac
fi

m3e_ensure_dirs
m3e_log "${M3E_SETUP_LOG}" INFO "uninstall start mode=${MODE}"

if [[ -x "${SCRIPT_DIR}/scripts/stop_running.sh" ]]; then
  "${SCRIPT_DIR}/scripts/stop_running.sh" --wait 20 >> "${M3E_SETUP_LOG}" 2>&1 || true
fi

rm -rf "${M3E_RUNTIME}" "${M3E_APP}" "${M3E_HOME}/scripts"
rm -f "${M3E_HOME}/launch.sh" "${M3E_HOME}/verify.sh" "${M3E_HOME}/collect_report.sh" \
  "${M3E_HOME}/setup.sh" "${M3E_HOME}/uninstall.sh"

case "${MODE}" in
  app)
    ;;
  app-logs)
    rm -rf "${M3E_LOG_HOME}"
    ;;
  all)
    rm -rf "${M3E_LOG_HOME}" "${M3E_SEEDS}" "${M3E_WORKSPACES}" "${M3E_BACKUP}" \
      "${M3E_TMP}" "${M3E_REPORTS}" "${M3E_CONF}" "${M3E_VERSION_JSON}" "${M3E_LOCK_FILE}"
    ;;
  *)
    m3e_fail "${M3E_SETUP_LOG}" 62 "unknown uninstall mode: ${MODE}"
    exit $?
    ;;
esac

m3e_log "${M3E_SETUP_LOG}" INFO "uninstall completed mode=${MODE}"
echo "Uninstall completed (${MODE})"
