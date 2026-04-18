---
name: sub-pj-plan
description: |
  sub-PJ の plan 段階専用スキル。kickoff、planning、Gate 1 / Gate 2、runtime 正本設計を扱う。
  以下の場面でトリガーする:
  - 「新しいPJを立ち上げる」「PJ作る」「sub-pj kickoff」と言われたとき
  - 「plan作って」「計画を詰めよう」「Gate 1 / Gate 2 を確認」と言われたとき
  - 「次のPhaseに進めるか」「gate 確認」と言われたとき
  - `plan -> do` の前段をやりたいとき
---

# sub-pj-plan — Kickoff / Planning / Gate

`sub-pj-plan` は「何をやるか」を固める skill。
task 正本、runtime 正本、facet 設計、Phase 設計、do 開始前の map 初期化までを扱う。

## Core Terms

- `facet`: PJ 固有の意味軸。何を主役に読む map / scope かを決める
- `facet type`: facet の汎用パターン
- `view`: runtime 上で人間に見せる画面構成
- `sprint contract`: `tasks.yaml` の task。`done_when` / `eval_criteria` を含む

## Read Order

1. `../sub-pj/protocol.md`
2. 必要な phase:
   - kickoff: `../sub-pj/phase/0_kickoff.md`
   - planning: `../sub-pj/phase/1_planning.md`
   - gate: `../sub-pj/phase/3_gate.md`
3. 必要時のみ:
   - `../sub-pj/references/glossary.md`
   - `../sub-pj/references/overview.md`
   - `../sub-pj/references/facet/*.md`
   - `../sub-pj/references/lessons.md`

## Scope

- README / plan.md / tasks.yaml / runtime 骨格を作る
- facet を設計する
- gate 通過後、決定済み facet に基づいて map を初期化する
- Gate 1 / Gate 2 readiness を判断材料つきで提示する
- gate 通過自体は人間に委ねる

## Non-Goals

- 自走ループを回さない
- Generator / Evaluator を起動しない
- session resume をしない

## Output Bias

- plan は短く、後で loop が読める形に寄せる
- runtime は traceability を前提にする
- `plan -> do` の handoff を作る
- `do` 開始時には、Generator が書く facet / scope が確定している状態にする
