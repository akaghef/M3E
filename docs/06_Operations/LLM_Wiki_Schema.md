# LLM Wiki Schema for M3E Documents

Status: working-agreement
Source: `docs/ideas/260627_llm_wiki_pattern.md`
Scope: `docs/`

## Purpose

M3E の `docs/` を、既存の正本構造を壊さずに LLM Wiki 型で運用する。

ここでいう LLM Wiki 型とは、raw source を保存し、LLM が索引・要約・相互参照・ログを継続更新する運用である。M3E では既存の仕様書や運用文書が正本なので、全ファイルを新しい wiki ディレクトリへ移動しない。索引とログを上に重ねる。

## Layers

### 1. Source Layer

Raw source / historical source / draft source.

- `docs/ideas/`: 未確定の発想、stow された外部メモ、会話由来の草案
- `docs/research/`: 調査、会話抽出、根拠資料
- `docs/daily/`: 日次ログ。追記中心で、過去ログを通常編集しない
- `docs/for-akaghef/`: Akaghef 向け共有物、demo、説明資料
- `docs/legacy/`: 現行方針ではない旧設計
- `docs/competitive_research/`: 競合・周辺ツール調査

この layer は、明示指示なしに削除・大規模移動しない。必要な場合は、まず `docs/06_Operations/Decision_Pool.md` で判断を残す。

### 2. Canonical Layer

現在の M3E の正本または準正本。

- `docs/00_Home/`: 入口、現在地、用語辞書
- `docs/01_Vision/`: Principle / Vision / Strategy
- `docs/03_Spec/`: 機能仕様
- `docs/04_Architecture/`: 実装構造
- `docs/06_Operations/`: 運用ルール、判断プール、手順
- `docs/09_Decisions/`: ADR

この layer は LLM が編集してよいが、該当 scope と検証観点を先に定義する。`Current_Status.md` は短期 Strategy スナップショットだけを書く。

### 3. Navigation Layer

LLM と人間が `docs/` を横断するための生成・維持物。

- `docs/index.md`: content-oriented index。LLM はまずここを読んでから詳細ファイルへ進む
- `docs/log.md`: chronological log。ingest / organize / lint / query の履歴
- `docs/_generated/`: 明示的な生成物。正本として直接編集しない

## Operations

### Ingest

1. Raw source を適切な Source Layer に stow する。
2. Source が外部メモなら、verbatim 保存を優先する。
3. 必要なら Canonical Layer へ昇格する候補を `Decision_Pool.md` に書く。
4. `docs/index.md` を更新する。
5. `docs/log.md` に `ingest` entry を追記する。

### Query

1. `docs/index.md` を先に読む。
2. 関連する Canonical Layer を読む。
3. 根拠が必要な場合だけ Source Layer へ掘る。
4. 回答が再利用価値を持つ場合は、ユーザー指示または明確な必要性がある時だけ文書化する。

### Lint

1. `node scripts/ops/check-docs-index.mjs --check` で索引 coverage を確認する。
2. orphan / stale / duplicate / broken link は、削除せず候補として報告する。
3. Canonical Layer への反映が必要なものは `Decision_Pool.md` または該当 spec / architecture / ADR へ送る。

## Safety Rules

- 既存文書の一括移動・削除・リネームは、この schema の通常運用には含めない。
- Raw source と generated navigation を混同しない。
- `docs/_generated/` は projection であり、正本ではない。
- `docs/daily/` は append-only を基本にする。
- `map` / `scope` / `node` など M3E 正規語は `docs/00_Home/Glossary.md` に従う。
