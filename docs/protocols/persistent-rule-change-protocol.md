# Persistent Rule Change Protocol

This protocol governs agent behavior when a user asks for recurrence prevention or a durable rule-system change.

## Trigger

Apply this protocol when any of the following is true:

- the user asks to prevent recurrence after an agent failure,
- the user says a prior rule was not followed and asks for a mechanism, guard, or permanent fix.

## Requirement

Do not satisfy the request with a chat-only promise. A triggered task must produce a durable rule-system change or report a concrete blocker.

Durable targets are:

- root `AGENTS.md` for repo-wide agent behavior,
- `docs/protocols/` for human-readable agent contracts,
- `docs/protocols/contracts/` for machine-checkable contracts,
- `agent_instructions/skills_canonical/` for skill behavior,
- generated skill mirrors after canonical skill updates,
- `scripts/hooks/` for lifecycle reminders,
- `scripts/ops/` or CI workflows for enforceable checks.

If a skill or skill trigger is added or changed, use `skill-creator` and update the skill frontmatter `description`. The description is the trigger surface; body-only "when to use" text is insufficient.

## Completion Gate

Before reporting completion:

1. Name the procedural failure being fixed.
2. Edit at least one durable target listed above.
3. Sync generated skill mirrors when canonical skills changed.
4. Run `scripts/ops/check-persistent-rule-gate.sh` when present.
5. Report changed durable files and verification.

If any step cannot be completed, report the task as blocked or in-progress. Do not say the recurrence prevention is done.

## Live Data Guard

Do not create fixture, test, or temporary maps in the active beta personal workspace for verification. Use Playwright fixtures, isolated `testRun` state, a separate temporary workspace, or an explicit backup/restore flow. If a live workspace must be touched because the bug only exists there, announce the destructive or persistent effect first and verify cleanup through API and SQLite before reporting completion.

## Worktree Classification Guard

Do not infer that every repository write requires a new task worktree. Classify the write first:

- implementation, existing-file edits, canon promotion, or concurrent/conflict-prone work: task worktree required;
- new public-safe append-only bundle under a unique `docs/ideas/` subtree: primary-checkout stow is allowed when only the parent idea README and generated docs index are touched adjacently.

If placement, overwrite risk, or public/private classification is unclear, stop and resolve it before writing.
