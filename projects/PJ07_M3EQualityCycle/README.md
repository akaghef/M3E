---
pj_id: PJ07
project: M3EQualityCycle
date: 2026-05-17
status: active
owner: akaghef
related:
  - plan.md
  - tasks.yaml
  - docs/ai_quality_improvement_cycle_plan.md
---

# PJ07 — M3E Quality Cycle

M3E 関連の GPT 会話歴、`idea/`、設計メモ、数学・仕様文書を実データとして使い、AI による品質観測・整理・差分提案・レビュー・昇格のサイクルを作る PJ。

## 目的

大量の M3E 関連素材を、AI が直接正本へ書き込むのではなく、以下の閉ループで安全に資産化する。

```text
source / idea / conversation
  -> workset
  -> quality report
  -> patch proposal
  -> human review
  -> distilled knowledge
  -> M3E map / docs export
```

## 境界

PJ04 は LangGraph / GraphSpec / runtime bridge の sandbox。
PJ07 は、その上で動かす実データ整理・品質改善ループの PJ。

## ディレクトリ

| Path | 用途 |
|---|---|
| `references/` | raw source への参照・少量の会話 export |
| `manifests/` | source index、選定 batch、除外理由 |
| `worksets/` | 実験対象として切った小バッチ |
| `runs/` | evaluator / worker の実行結果 |
| `reviews/` | 人間が採否する review board |
| `distilled/` | 採用済みの概念・判断・template 候補 |
| `exports/` | M3E map / docs / Codex task への戻し口 |
| `docs/` | 設計・計画・運用ルール |

## 既存 source

- GPT 会話歴 raw vault: `C:\Users\Akaghef\data\作業\chatGPTdata\MarkdownFiles\Projects\Akaghef\M3E`
- 既存抽出済み corpus: `docs/research/m3e_data_structure_conversations/`
- M3E repo idea pool: `idea/`
- 品質改善サイクル検討 raw: `references/chatgpt/260517_ai_quality_improvement_cycle.md`

## 最初の実データ方針

最初から全投入しない。まず `GraphSpec / LangGraph / AI proposal / data structure / idea` 系の 20〜50 件を workset に切る。

数学・仕様文書は evaluator calibration 用に使い、M3E GPT 会話歴は design-mining corpus として使う。
