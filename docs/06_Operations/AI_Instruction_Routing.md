# AI Instruction Routing

最終更新: 2026-06-14

## Purpose

Codex / Claude / GPT Pro に、重複・古い・矛盾した M3E 指示が渡ることを防ぐ。

## Operating Authority

Claude-facing operating authority:

1. `CLAUDE.md`
2. `docs/06_Operations/Director_Playbook.md`

Current execution model:

- Claude = Director only: route, decompose, handoff, dispatch, review, worktree / PR management.
- Codex (`codex exec`) = sole worker: implementation, spec writing, refactoring, investigation, tests.
- Claude sub-agent workers (`manage` / `visual` / `data` / `team`) are obsolete.

## Instruction Layers

1. `docs/03_Spec/`: product meaning.
2. `protocols/`: operating protocols shared by handoffs and tools.
3. `CLAUDE.md` + `Director_Playbook.md`: Director procedure.
4. `.codex/skills/` `.claude/skills/` `.agents/skills/`: generated or compatibility skill mirrors when present.

## Rule of Thumb

- M3E の概念が何を意味するかを書く文は `docs/03_Spec/` に置く。
- AI がどう動くべきかを書く文は `protocols/` に置く。
- Claude の Director 手順は `CLAUDE.md` と `Director_Playbook.md` に置く。
- Codex task の scope family は `docs/06_Operations/Codex_Task_Scope_Reference.md` を参照する。
- Map Manager の operational SSOT は `protocols/map-manager/` package に置く。
- directory entry pointer だけなら `AGENTS.md` に置く。
- raw logs / old draft contracts / wrapper docs は active instruction surface に置かない。必要なら archive / evidence として参照する。

## Map Manager Routing

次を含む map task は、mutation 前に Map Manager を通す。

- scope / scopen / unscopen
- scope granularity
- layouting / display intent
- edge vs GraphLink vs node-level link
- alias vs move
- cross-facet operation
- Codex handoff involving map mutation
- ambiguous path

Map Manager は target resolution / projection / gates / audit を担当する。
Codex に storage 形状や cross-facet relation の判断を渡さない。

## Codex Handoff Routing

Codex へ渡すのは最小限にする。

- objective
- target repo / worktree / branch
- target path / map scope
- allowed changes
- forbidden changes
- relevant spec / protocol links
- verification requirements

証拠として必要な場合を除き、Codex に full historical raw logs は渡さない。
M3E storage を変更する場合、Codex は direct API / SQLite / runtime file write を行わず、Map Manager handoff または明示された `m3e-map` 実行経路を返す。
