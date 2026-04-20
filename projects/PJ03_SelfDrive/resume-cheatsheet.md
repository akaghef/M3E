# PJ03 SelfDrive — Resume Cheatsheet

- Phase: 0 — friction observation and MVP spec
- Next task: `T-0-1` extract human intervention points from PJ01/PJ02
- Open reviews: 1 (`Qn_initial` — harness runtime host choice)
- Latest commit: (pending first PJ03 commit)
- Agent Status: idle -> set to working on resume
- Last session: 2026-04-20 kickoff, skeleton generated
- Inner loop expectation:
  - pick next `pending` task from tasks.yaml
  - run Generator, then Evaluator if `eval_required: true`
  - writeback status and round; regenerate this file
- Stop conditions:
  - Phase gate readiness reached → report, do not advance
  - env collapse (tool missing, map server down, build broken beyond quick fix)
  - scope drift (Out of Scope of plan.md)
  - destructive git ops required
- If ambiguity appears: pool into `reviews/Qn{n}_{slug}.md` with tentative default, continue
