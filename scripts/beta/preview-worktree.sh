#!/usr/bin/env bash
# Retired: unmerged browser bundles must never overwrite normal Beta.
set -euo pipefail
cat >&2 <<'EOF'
preview-worktree.sh is retired: copying worktree assets into normal Beta caused fixes to disappear on rebuild.
Use an isolated worktree server with a separate port and temporary workspace.
For normal Beta, integrate source into dev-beta, build there, and verify the original symptom.
See docs/06_Operations/Worktree_Separation_Rules.md. No files or services were changed.
EOF
exit 2
