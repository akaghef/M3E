---
name: codex-spark
description: Codex CLI（gpt-5.3-codex-spark モデル）で高速実装を行うセッション管理。
---

# Codex Spark Session Manager

Codex CLI（**gpt-5.3-codex-spark** モデル）を使った高速実装用セッション管理。

> `/cx`（gpt-5.2）は計画・設計用、`/cxi`（gpt-5.3-codex）は高精度実装用、`/cxs`（gpt-5.3-codex-spark）は高速実装用として使い分ける。

## 使い方

### セッション作成

```bash
~/.claude/skills/codex-spark/scripts/start.sh [--cd <dir>] <name> "<初期プロンプト>"
```

### セッション継続

```bash
~/.claude/skills/codex-spark/scripts/send.sh [--cd <dir>] <name> "<追加プロンプト>"
```

- `--cd` を省略した場合、`start.sh` 時の作業ディレクトリ設定を再利用します。

### セッション一覧

```bash
~/.claude/skills/codex-spark/scripts/list.sh
```

### セッション削除

```bash
~/.claude/skills/codex-spark/scripts/clear.sh <name>
~/.claude/skills/codex-spark/scripts/clear.sh --all
```

## 注意事項

- セッションIDは `~/.cache/ai-agent-sessions/codex-spark-session-<name>` に保存される
- 推論強度は `high`（`REASONING_EFFORT=high`）で実行される
- `/cx` `/cxi` のセッションとは別管理（混同しない）
- 実装は共通コア化され、継続時はログ探索結果を再利用する
