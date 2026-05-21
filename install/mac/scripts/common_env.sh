#!/usr/bin/env bash
set -euo pipefail

M3E_APP_NAME="M3E"
M3E_ENV_WORKSPACE_ID_SET="${M3E_WORKSPACE_ID+x}"
M3E_ENV_WORKSPACE_LABEL_SET="${M3E_WORKSPACE_LABEL+x}"
M3E_ENV_MAP_ID_SET="${M3E_MAP_ID+x}"
M3E_ENV_MAP_LABEL_SET="${M3E_MAP_LABEL+x}"
M3E_ENV_MAP_SLUG_SET="${M3E_MAP_SLUG+x}"
M3E_ENV_DATA_DIR_SET="${M3E_DATA_DIR+x}"
M3E_ENV_DB_FILE_SET="${M3E_DB_FILE+x}"
M3E_ENV_PORT_SET="${M3E_PORT+x}"
M3E_ENV_HOST_SET="${M3E_HOST+x}"
M3E_HOME="${HOME}/Library/Application Support/M3E"
M3E_LOG_HOME="${HOME}/Library/Logs/M3E"
M3E_RUNTIME="${M3E_HOME}/runtime"
M3E_APP="${M3E_HOME}/app"
M3E_SEEDS="${M3E_HOME}/seeds"
M3E_WORKSPACES="${M3E_HOME}/workspaces"
M3E_WORKSPACE_ID="${M3E_WORKSPACE_ID:-ws_A98E70JM9GAXCVXVMQBW7N0YGZ}"
M3E_WORKSPACE_LABEL="${M3E_WORKSPACE_LABEL:-Personal}"
M3E_MAP_ID="${M3E_MAP_ID:-map_09N0MQPFEQN9D4K66VNMT1F69V}"
M3E_MAP_LABEL="${M3E_MAP_LABEL:-tutorial}"
M3E_MAP_SLUG="${M3E_MAP_SLUG:-final-tutorial}"
M3E_DATA_DIR="${M3E_DATA_DIR:-${M3E_WORKSPACES}/${M3E_WORKSPACE_ID}}"
M3E_DB_FILE="${M3E_DB_FILE:-data.sqlite}"
M3E_BACKUP="${M3E_HOME}/backup"
M3E_TMP="${M3E_HOME}/tmp"
M3E_REPORTS="${M3E_HOME}/reports"
M3E_CONF="${M3E_HOME}/m3e.conf"
M3E_VERSION_JSON="${M3E_HOME}/version.json"
M3E_SEED_DB="${M3E_SEEDS}/core-seed.sqlite"
M3E_DB="${M3E_DATA_DIR}/${M3E_DB_FILE}"
M3E_LOCK_FILE="${M3E_TMP}/app.lock"
M3E_DEFAULT_PORT="38482"
M3E_PORT="${M3E_PORT:-${M3E_DEFAULT_PORT}}"
M3E_HOST="${M3E_HOST:-127.0.0.1}"

M3E_SETUP_LOG="${M3E_LOG_HOME}/setup.log"
M3E_STARTUP_LOG="${M3E_LOG_HOME}/startup.log"
M3E_VERIFY_LOG="${M3E_LOG_HOME}/verify.log"
M3E_MIGRATION_LOG="${M3E_LOG_HOME}/migration.log"
M3E_CRASH_LOG="${M3E_LOG_HOME}/crash.log"
M3E_REPORT_LOG="${M3E_LOG_HOME}/report.log"

M3E_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
M3E_PACKAGE_ROOT=""
if [[ -d "${M3E_SCRIPT_DIR}/../payload" ]]; then
  M3E_PACKAGE_ROOT="$(cd "${M3E_SCRIPT_DIR}/.." && pwd)"
fi

if [[ -n "${M3E_PACKAGE_ROOT}" ]]; then
  M3E_PAYLOAD="${M3E_PACKAGE_ROOT}/payload"
  M3E_PAYLOAD_RUNTIME="${M3E_PAYLOAD}/runtime"
  M3E_PAYLOAD_APP="${M3E_PAYLOAD}/app"
  M3E_PAYLOAD_SCRIPTS="${M3E_PAYLOAD}/scripts"
  M3E_PAYLOAD_SEEDS="${M3E_PAYLOAD}/seeds"
  M3E_MANIFEST="${M3E_PACKAGE_ROOT}/manifest.json"
else
  M3E_PAYLOAD=""
  M3E_PAYLOAD_RUNTIME=""
  M3E_PAYLOAD_APP=""
  M3E_PAYLOAD_SCRIPTS=""
  M3E_PAYLOAD_SEEDS=""
  M3E_MANIFEST=""
fi

if [[ -x "${M3E_RUNTIME}/bin/node" ]]; then
  M3E_NODE_EXE="${M3E_RUNTIME}/bin/node"
elif [[ -x "${M3E_RUNTIME}/node" ]]; then
  M3E_NODE_EXE="${M3E_RUNTIME}/node"
else
  M3E_NODE_EXE="${M3E_RUNTIME}/bin/node"
fi
M3E_START_JS="${M3E_APP}/dist/node/start_viewer.js"

m3e_ts() {
  date +"%Y%m%d_%H%M%S"
}

m3e_ensure_dirs() {
  mkdir -p "${M3E_HOME}" "${M3E_LOG_HOME}" "${M3E_SEEDS}" "${M3E_WORKSPACES}" \
    "${M3E_DATA_DIR}" "${M3E_BACKUP}" "${M3E_TMP}" "${M3E_REPORTS}"
}

m3e_log() {
  local log_file="$1"
  shift
  local level="$1"
  shift
  local msg="$*"
  mkdir -p "$(dirname "${log_file}")"
  printf '[%s] [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${level}" "${msg}" | tee -a "${log_file}"
}

m3e_fail() {
  local log_file="$1"
  local code="$2"
  shift 2
  local msg="$*"
  m3e_log "${log_file}" "ERROR" "${msg}"
  echo "Log: ${log_file}"
  echo "For diagnostics run: ${M3E_HOME}/collect_report.sh"
  return "${code}"
}

m3e_port_in_use() {
  local port="$1"
  lsof -n -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
}

m3e_probe_http() {
  local port="$1"
  curl -fsS --max-time 1 "http://127.0.0.1:${port}/viewer.html" >/dev/null 2>&1
}

m3e_choose_port() {
  local start_port="$1"
  local max_try="50"
  local p="${start_port}"
  while [[ "${max_try}" -gt 0 ]]; do
    if ! m3e_port_in_use "${p}"; then
      echo "${p}"
      return 0
    fi
    p="$((p + 1))"
    max_try="$((max_try - 1))"
  done
  return 1
}

m3e_read_lock_value() {
  local key="$1"
  local lock_file="${2:-${M3E_LOCK_FILE}}"
  [[ -f "${lock_file}" ]] || return 1
  awk -F'=' -v k="${key}" '$1==k {sub(/^[[:space:]]+/, "", $2); print $2; exit}' "${lock_file}"
}

m3e_write_lock() {
  local pid="$1"
  local port="$2"
  local version="$3"
  cat > "${M3E_LOCK_FILE}" <<LOCK
pid=${pid}
port=${port}
startedAt=$(m3e_ts)
version=${version}
LOCK
}

m3e_conf_get() {
  local key="$1"
  local def="${2:-}"
  if [[ ! -f "${M3E_CONF}" ]]; then
    echo "${def}"
    return 0
  fi
  local value
  value="$(awk -F= -v k="${key}" '$1==k {sub(/^[[:space:]]+/, "", $2); print $2; exit}' "${M3E_CONF}")"
  if [[ -z "${value}" ]]; then
    echo "${def}"
  else
    echo "${value}"
  fi
}

m3e_set_conf() {
  local key="$1"
  local value="$2"
  mkdir -p "$(dirname "${M3E_CONF}")"
  if [[ ! -f "${M3E_CONF}" ]]; then
    printf '%s=%s\n' "${key}" "${value}" > "${M3E_CONF}"
    return 0
  fi
  local tmp
  tmp="$(mktemp)"
  awk -F= -v k="${key}" -v v="${value}" '
    BEGIN { done=0 }
    $1==k { print k "=" v; done=1; next }
    { print }
    END { if (!done) print k "=" v }
  ' "${M3E_CONF}" > "${tmp}"
  mv "${tmp}" "${M3E_CONF}"
}

m3e_write_default_conf() {
  cat > "${M3E_CONF}" <<CONF
M3E_HOME=${M3E_HOME}
M3E_SEED_DB_PATH=${M3E_SEED_DB}
M3E_WORKSPACE_ID=${M3E_WORKSPACE_ID}
M3E_WORKSPACE_LABEL=${M3E_WORKSPACE_LABEL}
M3E_MAP_ID=${M3E_MAP_ID}
M3E_MAP_LABEL=${M3E_MAP_LABEL}
M3E_MAP_SLUG=${M3E_MAP_SLUG}
M3E_DATA_DIR=${M3E_DATA_DIR}
M3E_DB_FILE=${M3E_DB_FILE}
M3E_CHANNEL=final
M3E_PORT=${M3E_DEFAULT_PORT}
M3E_HOST=${M3E_HOST}
CONF
}

m3e_load_conf_defaults() {
  if [[ ! -f "${M3E_CONF}" ]]; then
    return 0
  fi
  [[ -n "${M3E_ENV_WORKSPACE_ID_SET}" ]] || M3E_WORKSPACE_ID="$(m3e_conf_get M3E_WORKSPACE_ID "${M3E_WORKSPACE_ID}")"
  [[ -n "${M3E_ENV_WORKSPACE_LABEL_SET}" ]] || M3E_WORKSPACE_LABEL="$(m3e_conf_get M3E_WORKSPACE_LABEL "${M3E_WORKSPACE_LABEL}")"
  [[ -n "${M3E_ENV_MAP_ID_SET}" ]] || M3E_MAP_ID="$(m3e_conf_get M3E_MAP_ID "${M3E_MAP_ID}")"
  [[ -n "${M3E_ENV_MAP_LABEL_SET}" ]] || M3E_MAP_LABEL="$(m3e_conf_get M3E_MAP_LABEL "${M3E_MAP_LABEL}")"
  [[ -n "${M3E_ENV_MAP_SLUG_SET}" ]] || M3E_MAP_SLUG="$(m3e_conf_get M3E_MAP_SLUG "${M3E_MAP_SLUG}")"
  [[ -n "${M3E_ENV_DATA_DIR_SET}" ]] || M3E_DATA_DIR="$(m3e_conf_get M3E_DATA_DIR "${M3E_DATA_DIR}")"
  [[ -n "${M3E_ENV_DB_FILE_SET}" ]] || M3E_DB_FILE="$(m3e_conf_get M3E_DB_FILE "${M3E_DB_FILE}")"
  [[ -n "${M3E_ENV_PORT_SET}" ]] || M3E_PORT="$(m3e_conf_get M3E_PORT "${M3E_DEFAULT_PORT}")"
  [[ -n "${M3E_ENV_HOST_SET}" ]] || M3E_HOST="$(m3e_conf_get M3E_HOST "${M3E_HOST}")"
}

m3e_resolve_workspace_paths() {
  M3E_DATA_DIR="${M3E_DATA_DIR:-${M3E_WORKSPACES}/${M3E_WORKSPACE_ID}}"
  M3E_DB_FILE="${M3E_DB_FILE:-data.sqlite}"
  M3E_DB="${M3E_DATA_DIR}/${M3E_DB_FILE}"
}

m3e_manifest_version() {
  if [[ ! -f "${M3E_VERSION_JSON}" ]]; then
    echo "unknown"
    return 0
  fi
  sed -nE 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "${M3E_VERSION_JSON}" | head -n1
}

m3e_viewer_url() {
  local port="$1"
  local url="http://127.0.0.1:${port}/viewer.html?ws=${M3E_WORKSPACE_ID}"
  if [[ -n "${M3E_MAP_ID}" ]]; then
    url="${url}&map=${M3E_MAP_ID}"
  fi
  echo "${url}"
}

m3e_mask_config_to() {
  local src="$1"
  local dst="$2"
  if [[ ! -f "${src}" ]]; then
    return 0
  fi
  sed -E \
    -e 's/("([Aa][Pp][Ii]_?[Kk][Ee][Yy]|[Tt][Oo][Kk][Ee][Nn]|[Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd]|[Ss][Ee][Cc][Rr][Ee][Tt])"[[:space:]]*:[[:space:]]*")[^"]*(")/\1***MASKED***\3/g' \
    -e 's/^((API_KEY|TOKEN|PASSWORD|SECRET)=).*/\1***MASKED***/gI' \
    "${src}" > "${dst}"
}

m3e_find_native_addon() {
  local base="${M3E_APP}/node_modules/better-sqlite3"
  [[ -d "${base}" ]] || return 1
  find "${base}" -type f -name '*.node' | head -n1
}

m3e_find_payload_node() {
  if [[ -x "${M3E_PAYLOAD_RUNTIME}/bin/node" ]]; then
    echo "${M3E_PAYLOAD_RUNTIME}/bin/node"
    return 0
  fi
  if [[ -x "${M3E_PAYLOAD_RUNTIME}/node" ]]; then
    echo "${M3E_PAYLOAD_RUNTIME}/node"
    return 0
  fi
  return 1
}

export M3E_APP_NAME M3E_HOME M3E_LOG_HOME M3E_RUNTIME M3E_APP M3E_SEEDS M3E_WORKSPACES
export M3E_WORKSPACE_ID M3E_WORKSPACE_LABEL M3E_MAP_ID M3E_MAP_LABEL M3E_MAP_SLUG
export M3E_DATA_DIR M3E_DB_FILE M3E_BACKUP M3E_TMP M3E_REPORTS M3E_CONF M3E_VERSION_JSON
export M3E_SEED_DB M3E_DB M3E_LOCK_FILE M3E_DEFAULT_PORT M3E_PORT M3E_HOST
export M3E_SETUP_LOG M3E_STARTUP_LOG M3E_VERIFY_LOG M3E_MIGRATION_LOG M3E_CRASH_LOG M3E_REPORT_LOG
export M3E_PACKAGE_ROOT M3E_PAYLOAD M3E_PAYLOAD_RUNTIME M3E_PAYLOAD_APP M3E_PAYLOAD_SCRIPTS M3E_PAYLOAD_SEEDS M3E_MANIFEST
export M3E_NODE_EXE M3E_START_JS
