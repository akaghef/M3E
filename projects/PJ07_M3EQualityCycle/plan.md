---
pj_id: PJ07
project: M3EQualityCycle
title: PJ07 Parent Plan
status: draft
date: 2026-05-17
references:
  - README.md
  - tasks.yaml
  - docs/ai_quality_improvement_cycle_plan.md
---

# PJ07 — Parent Plan

## 1. North Star

M3E の既存資産を、AI による自動整理ではなく、**品質観測 -> 差分提案 -> 人間レビュー -> 採用知識の昇格**という安全な制御系に載せる。

## 2. In Scope

- M3E 関連 GPT 会話歴の source index 化
- `idea/` / backlog / docs からの workset 作成
- ScopeQualityReport / PatchProposal の実データ検証
- accepted / rejected の採否ログ化
- distilled knowledge の M3E map / docs への export 設計

## 3. Out of Scope

- raw GPT vault の repo 内全コピー
- 正本 map への無レビュー自動 apply
- GPT 会話歴から Deep template への即時昇格
- LangGraph bridge 自体の実装

## 4. 作業原則

| ID | 原則 | 内容 |
|---|---|---|
| PR1 | raw は動かさない | 元 vault / repo の原本を直接編集しない |
| PR2 | workset は小さく切る | 20〜50 件単位で評価器を育てる |
| PR3 | proposal は apply しない | 初期は review まで。apply は別 gate |
| PR4 | accepted だけ distilled へ | 生成物を全部知識化しない |
| PR5 | M3E export は最後 | docs/map へ戻すのは採用済みだけ |

## 5. 最初の流れ

```text
source_index.yaml
  -> batch_001_m3e_design
  -> quality reports
  -> proposal review
  -> accepted distilled notes
  -> export candidate
```

## 6. 次の判断

最初に決める必要があるのは、source の取り込み粒度だけである。

候補:

| ID | 対象 | 推奨 |
|---|---|---|
| DS1 | GPT 会話歴から GraphSpec / LangGraph 系だけ | 最初にやる |
| DS2 | `idea/` から M3E product / system 系だけ | DS1 と並行可 |
| DS3 | 数学・仕様文書 calibration | evaluator 実装時に追加 |
