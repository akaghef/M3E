---
pj_id: PJ04
project: MermaidSystemLangGraph
date: 2026-04-22
status: active
owner: akaghef
related: plan.md
---

# PJ04 — Mermaid + System Diagram + LangGraph

M3E 上で **system diagram を graph-first に authoring** し、その graph を LangGraph runtime に接続するための sandbox PJ。
PJ03 で本当はやりたかったが、groundwork / demo / projection と混線した主題を、まっさらな器でやり直す。

## Vision

### 問題

現状の M3E は tree-like knowledge base としては強いが、

- Mermaid 的な graph notation を scope に自然に置くこと
- system diagram を graph-first に編集すること
- その graph を LangGraph runtime に compile / run すること

が一体として成立していない。

PJ03 ではこの論点が

- workflow groundwork
- system demo
- LangGraph lab
- projection

に分散し、graph authoring 本体が主題として閉じなかった。

### 完了像

固定 map 上で `plan6/cycle2/canonical_mermaid.html` のような system diagram を graph-first に描画・編集できる。
Mermaid canonical source と M3E graph structure が対応し、HTML / SVG で比較可能な描画結果を持ち、LangGraph に compile できる最小 graph authoring loop が成立する。

### In Scope

- 固定 map 上の system diagram graph authoring
- Mermaid canonical flow を使った scope 生成
- node / edge / scope semantics の graph-first 設計
- M3E 既存コードを参照した graph layer 設計
- LangGraph compile / inspect の最小 loop
- 操作追加の設計と最小実装

### Out of Scope

- PJ03 の後方互換整理
- 複数 map / 複数 graph editor の一般化
- 完成した graph IDE
- 本番品質の repo bridge 全部入り

## 主成果物

1. **graph-first plan / spec** — Mermaid, system diagram, LangGraph を 1 本に束ねる設計文書
2. **render target definition** — `canonical_mermaid.html` / `canonical_rendered.svg` を基準にした描画要件
3. **system diagram map model** — tree projection と system projection を支える map model 定義
4. **fixed-map prototype** — 固定 map に描画される canonical system diagram
5. **LangGraph compile seed** — M3E graph から LangGraph に繋ぐ最小 runtime seed

## メタ情報

| 項目 | 値 |
|---|---|
| PJ 名 | PJ04_MermaidSystemLangGraph |
| ブランチ | `prj/04_MermaidSystemLangGraph` |
| kickoff 日 | 2026-04-22 |
| source PJ | PJ03 SelfDrive |
| 方針 | sandbox / graph-first / fixed-map |

## ドキュメント構成

- [plan.md](plan.md) — PJ04 の master plan
- [tasks.yaml](tasks.yaml) — sprint contract 正本
- [docs/canonical_subpj_flow.md](docs/canonical_subpj_flow.md) — canonical flow seed
- [docs/mermaid_parity_checklist.md](docs/mermaid_parity_checklist.md) — Mermaid parity seed
- [docs/render_target_definition.md](docs/render_target_definition.md) — fixed-map 描画要件
- [docs/system_diagram_map_model.md](docs/system_diagram_map_model.md) — system diagram での map model
- [docs/merge_strategy.md](docs/merge_strategy.md) — PJ 終了後の merge 戦略
- `plan6/cycle2/` — Mermaid canonical sample 一式
- `runtime/langgraph_lab/` — LangGraph lab seed
- `references/m3e_current/` — M3E 現行コード参照コピー

## 役割分担

| 領域 | 人間（akaghef） | Codex |
|---|---|---|
| ビジョン / layout judgment | ◎ | △ |
| graph-first 設計 | ◎ 承認 | ◎ 起草・整理 |
| fixed-map prototype | ◎ viewer 判断 | ◎ 生成・修正 |
| LangGraph compile seed | △ | ◎ |
| phase / gate 判定 | ◎ 必ず人間 | × 勝手に進めない |

## 運用ルール（要点）

- この PJ では **固定 map** を前提にする
- canonical source は Mermaid を使ってよいが、最終正本は graph semantics で判断する
- `map model` を正本とし、`tree` / `system` は projection として扱う
- 描画ターゲットは `plan6/cycle2/canonical_mermaid.html` 相当の情報密度を下回らないこと
- notes 描画と scope 構造は混同しない
- tree-first な convenience に流れたら失敗扱い

## Seed 資産（PJ03 から持ち込んだもの）

- `plan6/cycle2/canonical.mmd`
- `plan6/cycle2/canonical_rendered.svg`
- `plan6/cycle2/canonical_mermaid.html`
- `docs/canonical_subpj_flow.md`
- `docs/mermaid_parity_checklist.md`
- `runtime/langgraph_lab/pj04_lab_seed.py`
- `runtime/langgraph_sandbox/requirements.txt`
- `runtime/langgraph_sandbox/smoke_test.py`
- `references/m3e_current/markdown_renderer.ts`
- `references/m3e_current/graph_types.ts`
- `references/m3e_current/graph_runtime.ts`

## Future Work

- fixed-map から一般 graph authoring layer への拡張
- M3E 本体への本格統合
- Mermaid import/export round-trip
- LangGraph inspection の richer projection
