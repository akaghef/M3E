#!/usr/bin/env bash
set -euo pipefail

failed=0

require_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "missing required file: $file" >&2
    failed=1
  fi
}

require_pattern() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  require_file "$file"
  if [[ -f "$file" ]] && ! grep -Eq "$pattern" "$file"; then
    echo "missing ${label}: ${file}" >&2
    failed=1
  fi
}

require_pattern "AGENTS.md" "LV3 Persistent Rule Change Gate" "root LV3 gate"
require_pattern "AGENTS.md" "skill-creator" "skill-creator routing"
require_pattern "AGENTS.md" "chat promise" "chat-only promise prohibition"

require_pattern "protocols/persistent-rule-change-protocol.md" "!!!|！！！" "triple-bang trigger"
require_pattern "protocols/persistent-rule-change-protocol.md" "skill-creator" "skill trigger update routing"
require_pattern "protocols/persistent-rule-change-protocol.md" "Do not create fixture, test, or temporary maps" "live beta workspace data guard"

require_pattern "protocols/contracts/persistent_rule_change_contract.yaml" "m3e\\.persistent_rule_change_contract" "persistent rule contract id"
require_pattern "protocols/contracts/persistent_rule_change_contract.yaml" "use_skill_creator_when_skill_or_trigger_changes" "skill-creator contract requirement"

require_pattern "protocols/worker-minimal-instruction.md" "LV3 persistent rule gate" "worker LV3 gate"
require_pattern "protocols/worker-minimal-instruction.md" "do not create test maps" "worker live-data guard"

require_pattern "agent_instructions/skills_canonical/m3e-worker/SKILL.md" "!!!|！！！" "canonical worker skill trigger"
require_pattern "agent_instructions/skills_canonical/m3e-worker/SKILL.md" "skill-creator" "canonical worker skill creator routing"
require_pattern ".codex/skills/m3e-worker/SKILL.md" "!!!|！！！" "Codex worker skill mirror trigger"
require_pattern ".claude/skills/m3e-worker/SKILL.md" "!!!|！！！" "Claude worker skill mirror trigger"

require_pattern "scripts/hooks/prompt-prj-check.sh" "bang-persistent-rule" "prompt hook bang reminder"

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

echo "persistent rule gate checks passed"
