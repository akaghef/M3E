---
mode: agent
description: "Use when: initialize role at session start with /setrole visual|data|data2|team|manage. Enforces worktree and branch alignment and runs required sync checks."
---
# Set Role

Run this prompt as:

- `/setrole visual`
- `/setrole data`
- `/setrole data2`
- `/setrole team`
- `/setrole manage`

## Required behavior

1. Parse the role from user input. If missing or invalid, ask for one of: `visual`, `data`, `data2`, `team`, `manage`.
2. Map role to target:
   - `visual` -> branch `dev-visual`, worktree `C:/Users/Akaghef/dev/M3E-dev-visual`
   - `data` -> branch `dev-data`, worktree `C:/Users/Akaghef/dev/M3E`
   - `data2` -> branch `dev-data2`, worktree `C:/Users/Akaghef/dev/M3E-dev-data2`
   - `team` -> branch `dev-team`, worktree `C:/Users/Akaghef/dev/M3E-dev-team`
   - `manage` -> branch `dev-beta`, worktree `C:/Users/Akaghef/dev/M3E`
3. Immediately run terminal checks:
   - show current branch
   - move to target worktree
   - verify current branch
4. If branch is not target, switch to target branch.
5. For role `visual` / `data` / `data2` / `team`, enforce sync before new implementation work:
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
