---
name: codex-impl
description: Codex CLI（gpt-5.3-codex モデル）で実装を行うセッション管理。
---

# Codex Impl Session Manager

Codex CLI（**gpt-5.3-codex** モデル）を使った実装用セッション管理。

> `/cx`（gpt-5.2）は計画・設計用、`/cxi`（gpt-5.3-codex）は実装用として使い分ける。

## 使い方

### セッション作成

```bash
~/.claude/skills/codex-impl/scripts/start.sh [--cd <dir>] <name> "<初期プロンプト>"
```

### セッション継続

```bash
~/.claude/skills/codex-impl/scripts/send.sh [--cd <dir>] <name> "<追加プロンプト>"
```

- `--cd` を省略した場合、`start.sh` 時の作業ディレクトリ設定を再利用します。

### セッション一覧

```bash
~/.claude/skills/codex-impl/scripts/list.sh
```

### セッション削除

```bash
~/.claude/skills/codex-impl/scripts/clear.sh <name>
~/.claude/skills/codex-impl/scripts/clear.sh --all
```

## 注意事項

- セッションIDは `~/.cache/ai-agent-sessions/codex-impl-session-<name>` に保存される
- 推論強度は `xhigh`（`REASONING_EFFORT=xhigh`）で実行される
- `/cx` のセッションとは別管理（混同しない）
- 実装は共通コア化され、継続時はログ探索結果を再利用する
