---
name: sub-pj-do
description: |
  sub-PJ の do 段階専用スキル。resume、deterministic loop、Generator / Evaluator、writeback、session end を扱う。
  以下の場面でトリガーする:
  - 「/sub-pj start」「セッション開始」「今日の作業開始」と言われたとき
  - 「/sub-pj end」「ハンドオフ」「作業おわり」と言われたとき
  - 「Generator / Evaluator を回して」「自走ループで進めて」と言われたとき
  - `plan -> do` の後段をやりたいとき
---

# sub-pj-do — Runtime / Resume / Loop

`sub-pj-do` は「どう回すか」を担う skill。
gate は実行せず、ready を示して止まる。

## Core Terms

- `Generator`: 実装・詳細化担当
- `Evaluator`: 独立検証担当
- `round`: Generator -> Evaluator の 1 往復
- `Evaluation Board`: evaluator の verdict と feedback を露出する view

## Read Order

1. `../sub-pj/protocol.md`
2. `../sub-pj/phase/resume.md`
3. `../sub-pj/phase/2_session.md`
4. `../sub-pj/phase/escalation.md`
5. 必要時:
   - `../sub-pj/phase/generator.md`
   - `../sub-pj/phase/evaluator.md`
   - `../sub-pj/references/glossary.md`

## Scope

- `resume-cheatsheet.md` と `tasks.yaml` を読んで loop を始める
- Generator / Evaluator を起動する
- `tasks.yaml` / board / resume-cheatsheet に writeback する
- fail を round で戻す
- gate 条件に達したら human-ready を報告して止まる
- plan 側で初期化済みの facet / scope を前提に動く

## Non-Goals

- kickoff しない
- Gate 1 / Gate 2 を詰めない
- phase 通過を決めない

## Guardrails

- stop は E1 / E2 / E3 のみ
- review と evaluation を混ぜない
- gate は人間専権
- facet / scope が未初期化なら do を始めず、plan 側の不足として報告する
