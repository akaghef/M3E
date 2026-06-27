# M3E Software Docs

このディレクトリは、M3E の思想・戦略・仕様・アーキテクチャ・運用・判断記録を置く場所である。

LLM / 人間が横断検索する入口として、まず [index.md](./index.md) を読む。運用ログは [log.md](./log.md)、LLM Wiki 型の整理スキーマは [06_Operations/LLM_Wiki_Schema.md](./06_Operations/LLM_Wiki_Schema.md) に置く。

## Reading Order

1. [00_Home/Agent_Brief.md](./00_Home/Agent_Brief.md)
2. [00_Home/Current_Status.md](./00_Home/Current_Status.md)
3. [00_Home/Glossary.md](./00_Home/Glossary.md)
4. [00_Home/Home.md](./00_Home/Home.md)
5. [00_Home/Objective.md](./00_Home/Objective.md)
6. [01_Vision/Principle.md](./01_Vision/Principle.md)
7. [01_Vision/Vision.md](./01_Vision/Vision.md)
8. [01_Vision/Strategy.md](./01_Vision/Strategy.md)
9. [03_Spec/README.md](./03_Spec/README.md)
10. [04_Architecture/README.md](./04_Architecture/README.md)
11. [06_Operations/README.md](./06_Operations/README.md)
12. [09_Decisions/README.md](./09_Decisions/README.md)

## Directory Roles

- `00_Home/`: セッション入口、現在地、用語辞書、Planning Hierarchy 入口
- `01_Vision/`: Principle / Vision / Strategy
- `03_Spec/`: 機能仕様。何を作るか
- `04_Architecture/`: 実装構造。どう作るか
- `06_Operations/`: 運用ルール、判断プール、手順、handoff
- `09_Decisions/`: ADR
- `competitive_research/`: 競合・周辺ツール調査
- `daily/`: 日次ログ。追記中心
- `for-akaghef/`: Akaghef 向け共有物、demo、説明資料
- `ideas/`: 未確定の発想、stow された外部メモ
- `legacy/`: 現行方針ではない旧設計
- `research/`: 調査資料、会話抽出、根拠資料
- `tasks/`: Codex worker / Director handoff と task notes
- `_generated/`: 生成物。正本として直接編集しない

## Document Flow

1. 外部メモや未確定の発想は `ideas/` または `research/` に stow する。
2. 会話で決まったことは、まず `06_Operations/Decision_Pool.md` に記録する。
3. 仕様として固まったら `03_Spec/`、実装構造なら `04_Architecture/`、継続判断なら `09_Decisions/` へ昇格する。
4. 横断索引は `index.md`、時系列運用ログは `log.md` で維持する。

## Checks

```bash
node scripts/ops/check-docs-index.mjs --check
```

`docs/index.md` が stale の場合は次で再生成する。

```bash
node scripts/ops/check-docs-index.mjs --write
```
