#!/bin/bash
set -euo pipefail
echo "Retired: copying current Beta into Final is not a release. See docs/06_Operations/Channel_Release_Policy.md. Use update-and-launch.sh --release <published-tag> for an existing release." >&2
exit 2
