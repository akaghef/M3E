# AI Instruction Routing

## Purpose

Codex / Claude / GPT Pro / worker agents に、重複・古い・矛盾した M3E 指示が渡ることを防ぐ。

## Four layers

1. `docs/03_Spec/`: product meaning
2. `protocols/`: agent operating contract
3. `agent_instructions/skills_canonical/`: skill source
4. `.codex/skills/` `.claude/skills/` `.agents/skills/`: generated mirror

## Rule of thumb

- M3E の概念が何を意味するかを書く文は `docs/03_Spec/` に置く。
- AI がどう動くべきかを書く文は `protocols/` に置く。
- Map Manager の operational SSOT は `protocols/map-manager/` package に置く。
- tool auto-trigger や反復 workflow 実行に必要な文は skill に置く。
- directory entry pointer だけなら `AGENTS.md` に置く。
- raw logs / old draft contracts / wrapper docs は active instruction surface に置かない。必要なら archive / evidence として参照する。

## Map Manager routing

次を含む map task は、mutation 前に Map Manager を通す。

- scope / scopen / unscopen
- scope granularity
- layouting / display intent
- edge vs GraphLink vs node-level link
- alias vs move
- cross-facet operation
- worker handoff
- ambiguous path

Map Manager は target resolution / projection / gates / audit を担当する。Worker に storage 形状や cross-facet relation の判断を渡さない。

## Worker routing

worker へ渡すのは最小限にする。

- target path/scope
- task objective
- allowed changes
- forbidden changes
- relevant spec/protocol links
- verification requirements

証拠として必要な場合を除き、worker に full historical raw logs は渡さない。
M3E storage を変更する場合、worker は direct API / SQLite / runtime file write を行わず、Map Manager handoff または明示された `m3e-map` 実行経路を返す。
