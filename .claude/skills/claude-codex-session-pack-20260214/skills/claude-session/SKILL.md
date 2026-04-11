---
name: claude-session
description: Claude Code CLIのセッションIDを ~/.cache に保存し、名前付きで作成・継続・一覧・削除できるようにする。
---

# Claude Session Manager

Claude Code CLI のセッションIDを `~/.cache/ai-agent-sessions/claude-session-<name>` に保存し、複数セッションを混同せずに継続できるようにする。

## 使い方

### セッション作成（ID保存）

```bash
~/.claude/skills/claude-session/scripts/start.sh <name> "<初期プロンプト>"
```

例:
```bash
~/.claude/skills/claude-session/scripts/start.sh analyst "調査役として動いてください"
```

### セッション継続（保存済みIDでresume）

```bash
~/.claude/skills/claude-session/scripts/send.sh <name> "<追加プロンプト>"
```

例:
```bash
~/.claude/skills/claude-session/scripts/send.sh analyst "この結果を要約して"
```

### セッション一覧

```bash
~/.claude/skills/claude-session/scripts/list.sh
```

### セッション削除

```bash
# 特定のセッションを削除
~/.claude/skills/claude-session/scripts/clear.sh <name>

# 全セッションを削除
~/.claude/skills/claude-session/scripts/clear.sh --all
```

## 注意事項

- セッションIDは `~/.cache/ai-agent-sessions` に保存される
- 実装は共通コアに統一され、ログ探索結果をメタ情報として再利用する
