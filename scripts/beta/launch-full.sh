#!/bin/bash
set -euo pipefail
export M3E_CLOUD_SYNC=1 M3E_COLLAB=1
export M3E_CLOUD_TRANSPORT="${M3E_CLOUD_TRANSPORT:-file}"
export M3E_AI_ENABLED="${M3E_AI_ENABLED:-1}"
exec bash "$(dirname "$0")/launch.sh"
