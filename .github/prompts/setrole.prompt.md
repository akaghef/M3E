---
mode: agent
description: "Use when: initialize role at session start with /setrole codex1|codex2|claude. Enforces worktree and branch alignment and runs required sync checks."
---
# Set Role

Run this prompt as:

- `/setrole codex1`
- `/setrole codex2`
- `/setrole claude`

## Required behavior

1. Parse the role from user input. If missing or invalid, ask for one of: `codex1`, `codex2`, `claude`.
2. Map role to target:
   - `codex1` -> branch `dev-beta-visual`, worktree `C:/Users/Akaghef/dev/M3E-dev-beta-visual`
   - `codex2` -> branch `dev-beta-data`, worktree `C:/Users/Akaghef/dev/M3E-dev-beta-data`
   - `claude` -> branch `dev-beta`, worktree `C:/Users/Akaghef/dev/M3E`
3. Immediately run terminal checks:
   - show current branch
   - move to target worktree
   - verify current branch
4. If branch is not target, switch to target branch.
5. If role is `codex1` or `codex2`, enforce sync before new implementation work:
   - `git fetch origin`
   - `git rebase origin/dev-beta`
6. Report a short checklist result:
   - role
   - worktree path
   - active branch
   - rebase/sync result (if applicable)

## Guardrails

- Do not continue implementation if role/worktree/branch are misaligned.
- If rebase conflict cannot be resolved safely, stop and escalate to `akaghef`.
- Do not use destructive history commands.
