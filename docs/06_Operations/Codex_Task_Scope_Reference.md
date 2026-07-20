# Codex Task Scope Reference

最終更新: 2026-06-14

この文書は、旧 Claude sub-agent 定義 (`visual` / `data` / `team`) から残す価値のある担当領域だけを保存する参照表。
実行主体は常に Codex (`codex exec`) であり、Claude は Director としてこの表を使って handoff の scope / constraints / verification を決める。

## Scope Families

| Concern | Typical files | Avoid unless explicitly scoped | Verification hints |
|---|---|---|---|
| UI / rendering / CSS / UX | `beta/src/browser/`, `beta/viewer.css`, `beta/viewer.html`, `beta/tests/visual/` | `final/`, unrelated node/shared runtime files | `cd beta && npx tsc --noEmit`; relevant Playwright or visual tests for layout/SVG/UI behavior |
| Model / controller / API / persistence | `beta/src/node/`, `beta/src/shared/`, REST API docs when API behavior changes | `final/`, unrelated browser UI files | `cd beta && npx tsc --noEmit && npx vitest run`; targeted API/unit tests |
| Collaboration / cloud sync | `beta/src/node/collab.ts`, `beta/src/node/cloud_sync.ts`, collab portions of `beta/src/node/start_viewer.ts` | `final/`, unrelated browser UI files | `cd beta && M3E_COLLAB=1 npx vitest run`; `M3E_CLOUD_SYNC=1 npx vitest run` when cloud sync behavior changes |

## Handoff Use

- This table is not a team roster and does not create Claude worker agents.
- Split large requests into separate Codex tasks when file families would collide.
- Each code-writing task gets its own `$HOME/dev/M3E-worktrees/<task>` worktree and `codex/<task>` branch.
- Scope exceptions must be explicit in the Codex handoff.
