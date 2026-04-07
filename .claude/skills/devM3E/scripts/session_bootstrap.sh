#!/bin/bash
# devM3E: セッション開始時のブートストラップスクリプト
# Assess phase の自動化。現在地を素早く把握するための情報を出力する。

set -euo pipefail

M3E_ROOT="${1:-.}"

echo "=== devM3E Session Bootstrap ==="
echo "Date: $(date '+%Y-%m-%d %H:%M')"
echo ""

# 1. Git状態
echo "--- Git Status ---"
cd "$M3E_ROOT"
echo "Branch: $(git branch --show-current 2>/dev/null || echo 'not a git repo')"
echo "Clean: $(git status --porcelain 2>/dev/null | wc -l | tr -d ' ') uncommitted changes"
echo ""

# 2. Current Status の要約（先頭30行）
echo "--- Current Status (excerpt) ---"
head -20 dev-docs/00_Home/Current_Status.md 2>/dev/null || echo "(not found)"
echo ""

# 3. Todo Pool の active items
echo "--- Active Todo Pool Items ---"
grep -A5 'State: \(ready\|doing\|blocked\)' dev-docs/06_Operations/Todo_Pool.md 2>/dev/null || echo "(none)"
echo ""

# 4. 直近の daily note
echo "--- Latest Daily Note ---"
LATEST_DAILY=$(ls -t dev-docs/daily/*.md 2>/dev/null | head -1)
if [ -n "$LATEST_DAILY" ]; then
    echo "File: $LATEST_DAILY"
    head -30 "$LATEST_DAILY"
else
    echo "(no daily notes found)"
fi
echo ""

echo "=== Bootstrap Complete ==="
