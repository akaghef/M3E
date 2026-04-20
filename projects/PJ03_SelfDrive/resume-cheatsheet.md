# PJ03 SelfDrive — Resume Cheatsheet

- Phase: 0 — 再設計成果物の確定（reframed plan）
- Next task: `T-0-1` finalize 最小 workflow state set (9 states)
- Parallel-ready: `T-0-1`, `T-0-2`, `T-0-3`, `T-0-4` are independent
- Gate 0→1: `T-0-5` consolidates Phase 0 artifacts; Gate 1 is human
- Open reviews: 1
  - `Qn_initial` — runtime host choice (ScheduleWakeup + CronCreate 併用 / tentative)
  - `Qn2_stale_docs` — RESOLVED 2026-04-21 (option 1: Claude が README/runtime 整合)
- Latest commit: (pending first PJ03 reframed commit)
- Agent Status: idle → ready to start T-0-1..T-0-4 inner loop
- Last session: 2026-04-21 Qn2 tentative default 適用。README.md / runtime/README.md を workflow engine フレームに整合。Phase 0 inner loop 着手可能。
- Archived: `tasks_v1_friction.yaml.bak` (旧 friction-observation 5 tasks)

## Inner loop expectation

- pick next `pending` task from tasks.yaml (T-0-1..T-0-4 are parallelizable)
- run Generator; if `eval_required: true`, run Evaluator
- writeback `status` / `round` / `last_feedback`; regenerate this cheatsheet
- once T-0-1..T-0-4 all done → T-0-5 gate-check → report Gate 1 readiness to akaghef

## Stop conditions

- Phase gate readiness reached → report, do not advance（Gate 1 / Gate 2 は akaghef）
- Env collapse: tool missing, map server down, build broken beyond quick fix
- Scope drift: reframed plan.md の Out of Scope に触れる判断
- Destructive git ops required

## If ambiguity appears

Pool into `reviews/Qn{n}_{slug}.md` with tentative default and decision-owner. Continue with tentative default. Do not block inner loop.
