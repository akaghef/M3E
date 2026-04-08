#!/usr/bin/env bash
# intensive_check.sh — Lightweight signal collection for intensive-develop tick
# Gathers git activity and PR status in one shot to minimize token usage.
# Output is structured for easy parsing by the orchestrator.

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo '.')"

SINCE="${1:-20 minutes ago}"

echo "=== RECENT COMMITS (since: $SINCE) ==="
git log --oneline --since="$SINCE" --all --no-merges 2>/dev/null || echo "(none)"

echo ""
echo "=== BRANCH ACTIVITY ==="
for branch in dev-beta dev-beta-visual dev-beta-data; do
  count=$(git log --oneline --since="$SINCE" "origin/$branch" 2>/dev/null | wc -l | tr -d ' ')
  echo "$branch: $count commits"
done

echo ""
echo "=== OPEN PRs (base: dev-beta) ==="
if command -v gh &>/dev/null; then
  gh pr list --base dev-beta --state open --json number,title,headRefName,updatedAt 2>/dev/null || echo "(gh not available or not authenticated)"
else
  echo "(gh CLI not installed)"
fi

echo ""
echo "=== RECENTLY MERGED PRs ==="
if command -v gh &>/dev/null; then
  gh pr list --base dev-beta --state merged --json number,title,mergedAt -L 5 2>/dev/null || echo "(gh not available)"
else
  echo "(gh CLI not installed)"
fi

echo ""
echo "=== HOSTNAME ==="
hostname 2>/dev/null || echo "unknown"

echo ""
echo "=== TIMESTAMP ==="
date -u +"%Y-%m-%dT%H:%M:%SZ"
