# PJ03 SelfDrive — Resume Cheatsheet

- Phase: 0 — 設計分岐の確定（T-0-1..T-0-4 done、T-0-5 gate-check ready）
- Next task: `T-0-5` gate-check (Gate 1 readiness consolidation) — akaghef 承認待ち
- Parallel-ready: 無し（Gate 1 を挟む）
- Gate 0→1: T-0-5 の Gate 1 readiness report を akaghef が承認 → Phase 1 tasks.yaml 具体化
- Open reviews: 1
  - `Qn_initial` — resolution-proposed (option 3: ScheduleWakeup + CronCreate 併用、Gate 1 で確定)
  - `Qn2_stale_docs` — resolved 2026-04-21
- Latest commit: `fcf951a docs(PJ03): align README and runtime docs to reframed workflow engine frame (Qn2)`
- Agent Status: working → Gate 1 readiness 報告で一時待機
- Last session: 2026-04-21 T-0-1..T-0-4 docs 4 本生成 → Evaluator 4/4 pass → plan.md 確定事項追記

## Phase 0 成果物 (authoritative)

- [docs/workflow_state_set.md](docs/workflow_state_set.md) — 9 state
- [docs/workflow_edges.md](docs/workflow_edges.md) — 17 edges
- [docs/legacy_asset_mapping.md](docs/legacy_asset_mapping.md) — 8 asset + 5 gap
- [docs/stop_reason_taxonomy.md](docs/stop_reason_taxonomy.md) — 11 停止理由 + 4 問 rubric

## Inner loop expectation

- Gate 1 が akaghef 承認されたら T-0-5 を done にして Phase 1 に入る
- Phase 1 は T-1-1（TypeScript 型定義）から着手。parallelizable: false
- T-1-1..T-1-6 は sequential、T-1-7 で Gate 2

## Stop conditions

- Phase gate readiness reached → 報告済、akaghef 判断待ち（Gate 1 = E1）
- Env collapse: tool missing, map server down, build broken beyond quick fix
- Scope drift: reframed plan.md の Out of Scope に触れる判断
- Destructive git ops required

## If ambiguity appears

Pool into `reviews/Qn{n}_{slug}.md` with tentative default and decision-owner. Continue with tentative default. Do not block inner loop.

## Tentative defaults の履歴

- Qn_initial: option 3（ScheduleWakeup + CronCreate 併用）→ T-0-3 に反映済
- Qn2_stale_docs: option 1（Claude 一括リライト）→ 適用済
- plan.md 未存在セクション参照（§基本遷移・§S3 等）: T-0-5 で plan.md 確定事項から docs/ に逆参照を張る方式で解消（適用済）
