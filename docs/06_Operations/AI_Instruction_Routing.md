# AI Instruction Routing

最終更新: 2026-06-14

## Purpose

Codex / Claude / GPT Pro に、重複・古い・矛盾した M3E 指示が渡ることを防ぐ。

## Operating Authority

Claude-facing operating authority:

1. `CLAUDE.md`
2. `docs/06_Operations/Director_Playbook.md`

Current execution model:

- Claude = Director only: route, decompose, handoff, dispatch, review, worktree management and verified delivery.
- Codex (`codex exec`) = sole worker: implementation, spec writing, refactoring, investigation, tests.
- Claude sub-agent workers (`manage` / `visual` / `data` / `team`) are obsolete.

## Instruction Layers

1. `docs/03_Spec/`: product meaning.
2. `docs/protocols/`: operating protocols shared by handoffs and tools.
3. `CLAUDE.md` + `Director_Playbook.md`: Director procedure.
4. `.codex/skills/` `.claude/skills/` `.agents/skills/`: generated or compatibility skill mirrors when present.
5. MCP Tools / Resources / Prompts: map execution and published canonical guidance; normal operations require no local map skill.

## Rule of Thumb

- M3E の概念が何を意味するかを書く文は `docs/03_Spec/` に置く。
- AI がどう動くべきかを書く文は `docs/protocols/` に置く。
- Claude の Director 手順は `CLAUDE.md` と `Director_Playbook.md` に置く。
- Codex task の scope family は `docs/06_Operations/Codex_Task_Scope_Reference.md` を参照する。
- Map Manager の operational SSOT は `docs/protocols/map-manager/` package に置く。
- directory entry pointer だけなら `AGENTS.md` に置く。
- raw logs / old draft contracts / wrapper docs は active instruction surface に置かない。必要なら archive / evidence として参照する。

## Map Manager Routing

次の判断が未決の map task は、mutation 前に Map Manager 規約を参照する。

- scope / scopen / unscopen の目的と境界
- scope granularity
- layouting / display intent
- edge vs GraphLink vs node-level link
- alias vs move
- cross-facet operation の意味と所有範囲
- Codex handoff involving map mutation の未確定な担当範囲
- ambiguous path

Map Manager 規約は target resolution / projection / gates / audit の判断を支える。
指定済みの対象・操作は、Scope変更やworkerへの委任を含めてMCPへ直接渡せる。
規約はMCP Resources / Promptsから参照でき、独立したAgentやSkillの起動を必須にしない。
Codex に担当外のstorage形状やcross-facet relationの判断を渡さない。

## Map Execution Routing

[MCPによるMap操作](../protocols/mcp-map-operations.md)に従い、`m3e_context`、
`m3e_get`、`m3e_create`、`m3e_update`、`m3e_delete`、`m3e_feedback` を利用する。
取得済みContextと保存結果・変更通知を利用し、通常の連続操作に再GET、全状態編集、
一時書込スクリプト、Node ID生成、自動再着色を要求しない。MCPが未接続・非対応なら
その不足を報告し、旧REST Skillや直接保存へ切り替えない。

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
M3E storage を変更する場合、Codex は許可された対象へMCPの意味操作を渡す。
direct REST API / SQLite / runtime file writeは行わず、未決の構造判断はMap Manager規約に従って解決・報告する。
