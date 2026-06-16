#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKAGE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${PACKAGE_ROOT}/../.." && pwd)"
FINAL_ROOT="${REPO_ROOT}/final"
PAYLOAD_ROOT="${PACKAGE_ROOT}/payload"
PAYLOAD_APP="${PAYLOAD_ROOT}/app"
PAYLOAD_RUNTIME="${PAYLOAD_ROOT}/runtime"
PAYLOAD_SEEDS="${PAYLOAD_ROOT}/seeds"

SKIP_BUILD=0
RUNTIME_MODE="auto"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build)
      SKIP_BUILD=1
      ;;
    --runtime)
      RUNTIME_MODE="${2:-auto}"
      shift
      ;;
    --help)
      echo "Usage: build-package.sh [--skip-build] [--runtime auto|download|installed|none]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
  shift
done

if [[ ! -f "${FINAL_ROOT}/package.json" ]]; then
  echo "Missing final/package.json" >&2
  exit 11
fi

if [[ "${SKIP_BUILD}" -eq 0 ]]; then
  (cd "${FINAL_ROOT}" && npm run build)
fi

if [[ ! -f "${FINAL_ROOT}/dist/node/start_viewer.js" ]]; then
  echo "Missing final/dist/node/start_viewer.js; run without --skip-build first" >&2
  exit 12
fi

rm -rf "${PAYLOAD_APP}"
mkdir -p "${PAYLOAD_APP}" "${PAYLOAD_SEEDS}"

ditto "${FINAL_ROOT}/dist" "${PAYLOAD_APP}/dist"
for f in package.json package-lock.json viewer.html viewer.css home.html; do
  [[ -f "${FINAL_ROOT}/${f}" ]] && cp -f "${FINAL_ROOT}/${f}" "${PAYLOAD_APP}/${f}"
done
if [[ -d "${FINAL_ROOT}/node_modules" ]]; then
  ditto "${FINAL_ROOT}/node_modules" "${PAYLOAD_APP}/node_modules"
else
  (cd "${FINAL_ROOT}" && npm ci --omit=dev)
  ditto "${FINAL_ROOT}/node_modules" "${PAYLOAD_APP}/node_modules"
fi

if [[ -f "${REPO_ROOT}/install/assets/seeds/core-seed.sqlite" ]]; then
  cp -f "${REPO_ROOT}/install/assets/seeds/core-seed.sqlite" "${PAYLOAD_SEEDS}/core-seed.sqlite"
elif [[ -f "${REPO_ROOT}/install/assets/tutorial/M3E_dataV1.sqlite" ]]; then
  cp -f "${REPO_ROOT}/install/assets/tutorial/M3E_dataV1.sqlite" "${PAYLOAD_SEEDS}/core-seed.sqlite"
fi

copy_installed_runtime() {
  local installed="${HOME}/Library/Application Support/M3E/runtime"
  if [[ -x "${installed}/bin/node" ]]; then
    rm -rf "${PAYLOAD_RUNTIME}"
    ditto "${installed}" "${PAYLOAD_RUNTIME}"
    return 0
  fi
  return 1
}

download_runtime() {
  local node_version
  node_version="$(node -p 'process.versions.node')"
  local arch
  case "$(uname -m)" in
    arm64) arch="arm64" ;;
    x86_64) arch="x64" ;;
    *) echo "Unsupported macOS arch: $(uname -m)" >&2; return 1 ;;
  esac
  local name="node-v${node_version}-darwin-${arch}"
  local url="https://nodejs.org/dist/v${node_version}/${name}.tar.gz"
  local tmp
  tmp="$(mktemp -d)"
  curl -fsSL "${url}" -o "${tmp}/node.tar.gz"
  tar -xzf "${tmp}/node.tar.gz" -C "${tmp}"
  rm -rf "${PAYLOAD_RUNTIME}"
  ditto "${tmp}/${name}" "${PAYLOAD_RUNTIME}"
  rm -rf "${tmp}"
}

case "${RUNTIME_MODE}" in
  auto)
    download_runtime
    ;;
  installed)
    copy_installed_runtime
    ;;
  download)
    download_runtime
    ;;
  none)
    ;;
  *)
    echo "Unknown runtime mode: ${RUNTIME_MODE}" >&2
    exit 13
    ;;
esac

NODE_VERSION="unknown"
if [[ -x "${PAYLOAD_RUNTIME}/bin/node" ]]; then
  NODE_VERSION="$("${PAYLOAD_RUNTIME}/bin/node" --version | sed 's/^v//')"
  if [[ -x "${PAYLOAD_RUNTIME}/bin/npm" ]]; then
    (
      cd "${PAYLOAD_APP}"
      PATH="${PAYLOAD_RUNTIME}/bin:${PATH}" "${PAYLOAD_RUNTIME}/bin/npm" rebuild better-sqlite3
    )
  fi
fi

cat > "${PACKAGE_ROOT}/manifest.json" <<JSON
{
  "app": {
    "name": "M3E",
    "version": "0.1.0"
  },
  "node": {
    "version": "${NODE_VERSION}",
    "platform": "darwin",
    "arch": "$(uname -m)"
  },
  "build": {
    "timestamp": "$(date -u +%FT%TZ)",
    "channel": "mac"
  }
}
JSON

chmod +x "${PACKAGE_ROOT}"/*.sh "${SCRIPT_DIR}"/*.sh
echo "Built mac package at ${PACKAGE_ROOT}"
