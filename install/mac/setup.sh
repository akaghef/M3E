#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./scripts/common_env.sh
source "${SCRIPT_DIR}/scripts/common_env.sh"

CREATE_DESKTOP_LINK=0
RUN_VERIFY=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --desktop-link)
      CREATE_DESKTOP_LINK=1
      ;;
    --no-verify)
      RUN_VERIFY=0
      ;;
    --help)
      echo "Usage: setup.sh [--desktop-link] [--no-verify]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
  shift
done

m3e_ensure_dirs
m3e_log "${M3E_SETUP_LOG}" INFO "setup start packageRoot=${M3E_PACKAGE_ROOT:-none}"

if [[ -z "${M3E_PACKAGE_ROOT}" ]]; then
  m3e_fail "${M3E_SETUP_LOG}" 21 "setup.sh must run from install/mac package root"
  exit $?
fi

PAYLOAD_NODE="$(m3e_find_payload_node || true)"
if [[ -z "${PAYLOAD_NODE}" && -x "${SCRIPT_DIR}/scripts/build-package.sh" ]]; then
  m3e_log "${M3E_SETUP_LOG}" INFO "payload runtime missing; trying build-package.sh"
  "${SCRIPT_DIR}/scripts/build-package.sh" --skip-build >> "${M3E_SETUP_LOG}" 2>&1 || true
  PAYLOAD_NODE="$(m3e_find_payload_node || true)"
fi

if [[ -z "${PAYLOAD_NODE}" ]]; then
  m3e_fail "${M3E_SETUP_LOG}" 22 "missing payload runtime node (expected payload/runtime/bin/node)"
  exit $?
fi
if [[ ! -f "${M3E_PAYLOAD_APP}/dist/node/start_viewer.js" ]]; then
  m3e_fail "${M3E_SETUP_LOG}" 23 "missing payload app start_viewer.js"
  exit $?
fi

if [[ -x "${M3E_HOME}/scripts/stop_running.sh" ]]; then
  "${M3E_HOME}/scripts/stop_running.sh" --wait 20 >> "${M3E_SETUP_LOG}" 2>&1 || {
    m3e_fail "${M3E_SETUP_LOG}" 24 "failed stopping running process"
    exit $?
  }
fi

rm -rf "${M3E_RUNTIME}" "${M3E_APP}"
ditto "${M3E_PAYLOAD_RUNTIME}" "${M3E_RUNTIME}"
ditto "${M3E_PAYLOAD_APP}" "${M3E_APP}"

mkdir -p "${M3E_HOME}/scripts"
if [[ -d "${M3E_PAYLOAD_SCRIPTS}" ]]; then
  ditto "${M3E_PAYLOAD_SCRIPTS}" "${M3E_HOME}/scripts"
fi

for f in launch.sh verify.sh collect_report.sh uninstall.sh setup.sh manifest.json; do
  if [[ -f "${M3E_PACKAGE_ROOT}/${f}" ]]; then
    cp -f "${M3E_PACKAGE_ROOT}/${f}" "${M3E_HOME}/${f}"
  fi
done
if [[ -d "${M3E_PACKAGE_ROOT}/scripts" ]]; then
  rm -rf "${M3E_HOME}/scripts"
  ditto "${M3E_PACKAGE_ROOT}/scripts" "${M3E_HOME}/scripts"
fi
chmod +x "${M3E_HOME}"/*.sh "${M3E_HOME}/scripts"/*.sh || true

if [[ -d "${M3E_PAYLOAD_SEEDS}" ]]; then
  mkdir -p "${M3E_SEEDS}"
  ditto "${M3E_PAYLOAD_SEEDS}" "${M3E_SEEDS}"
fi

if [[ ! -f "${M3E_CONF}" ]]; then
  m3e_write_default_conf
else
  m3e_set_conf M3E_HOME "${M3E_HOME}"
  m3e_set_conf M3E_WORKSPACE_ID "${M3E_WORKSPACE_ID}"
  m3e_set_conf M3E_WORKSPACE_LABEL "${M3E_WORKSPACE_LABEL}"
  m3e_set_conf M3E_MAP_ID "${M3E_MAP_ID}"
  m3e_set_conf M3E_MAP_LABEL "${M3E_MAP_LABEL}"
  m3e_set_conf M3E_MAP_SLUG "${M3E_MAP_SLUG}"
  m3e_set_conf M3E_DATA_DIR "${M3E_DATA_DIR}"
  m3e_set_conf M3E_DB_FILE "${M3E_DB_FILE}"
  m3e_set_conf M3E_PORT "${M3E_DEFAULT_PORT}"
  m3e_set_conf M3E_HOST "${M3E_HOST}"
fi

if [[ -f "${M3E_SEED_DB}" && ! -f "${M3E_DB}" ]]; then
  mkdir -p "$(dirname "${M3E_DB}")"
  cp -f "${M3E_SEED_DB}" "${M3E_DB}"
fi

if [[ -f "${M3E_MANIFEST}" ]]; then
  cp -f "${M3E_MANIFEST}" "${M3E_VERSION_JSON}"
else
  cat > "${M3E_VERSION_JSON}" <<JSON
{"app":{"version":"unknown"},"build":{"timestamp":"$(date -u +%FT%TZ)","channel":"mac"}}
JSON
fi

if [[ ${CREATE_DESKTOP_LINK} -eq 1 ]]; then
  cat > "${HOME}/Desktop/M3E.command" <<EOF
#!/usr/bin/env bash
exec "${M3E_HOME}/launch.sh"
EOF
  chmod +x "${HOME}/Desktop/M3E.command"
fi

if [[ ${RUN_VERIFY} -eq 1 ]]; then
  "${M3E_HOME}/verify.sh" --post-setup >> "${M3E_SETUP_LOG}" 2>&1 || {
    m3e_fail "${M3E_SETUP_LOG}" 25 "verify failed"
    exit $?
  }
fi

m3e_log "${M3E_SETUP_LOG}" INFO "setup completed"
echo "Setup completed. Launch with: ${M3E_HOME}/launch.sh"
