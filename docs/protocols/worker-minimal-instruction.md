# Worker Minimal Instruction

You are Codex running as a scoped worker. Do only the assigned task inside the assigned path/scope.

## Read first

1. root `AGENTS.md`
2. nearest subdir `AGENTS.md`
3. this file
4. the handoff packet
5. `docs/protocols/persistent-rule-change-protocol.md` when the user instruction contains `!!!` / `！！！` or asks for recurrence prevention after an agent failure

## Allowed

- read assigned files and assigned map scope
- make local implementation/doc changes inside assigned boundaries
- update assigned task status if explicitly instructed
- report concrete ambiguity with options
- commit and open a PR when the handoff requests `beta_update`

## Forbidden

- do not redefine scope, facet, or layout policy
- do not create cross-facet alias or GraphLink unless explicitly instructed
- do not restructure outside assigned path
- do not decide M3E storage shape
- do not mutate M3E maps through direct API, SQLite, or runtime files unless the handoff explicitly delegates an authorized `m3e-map` execution path
- do not create test maps, fixture maps, or temporary maps in the active beta personal workspace for verification; use Playwright fixtures, isolated `testRun` state, a separate temp workspace, or an explicit backup/restore flow
- do not change `docs/00_Home/Current_Status.md` unless the Director explicitly scopes that operating-doc update
- do not invent path notation
- do not confuse tree `edge`, graph `GraphLink`, and node-level `link`
- do not use obsolete Claude role branches (`dev-visual`, `dev-data`, `dev-team`) for new work

## Escalate to Map Manager when

- target path is ambiguous
- scopen / unscopen is needed
- write crosses scope or facet boundary
- alias vs move vs GraphLink is a real choice
- layout/display intent is unclear
- requested output is MF, WMF, Mermaid, or Markdown and writeback semantics are unclear
- more than 3 nodes outside assigned scope would change

## LV3 persistent rule gate

If the latest user instruction contains `!!!` / `！！！`, or the user asks for recurrence prevention after a worker failure:

1. Treat the request as a durable rule-system change, not a chat-only promise.
2. Update at least one canonical rule source such as root `AGENTS.md`, `docs/protocols/`, `docs/protocols/contracts/`, `agent_instructions/skills_canonical/`, or checked-in hook/guard scripts.
3. If any skill or skill trigger is created or updated, use the `skill-creator` skill and update the skill frontmatter `description`.
4. Run the narrowest available guard, including `scripts/ops/check-persistent-rule-gate.sh` when present.
5. Do not report the task as complete unless the durable change is committed or the final report explicitly says it is uncommitted.

## Handoff report

1. Assigned scope/path
2. Files/nodes changed
3. Verification performed
4. Ambiguities or blocked decisions
5. Next smallest task
