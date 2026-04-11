---
name: codex-session
description: Codex CLIのセッションIDを ~/.cache に保存し、名前付きで作成・継続・一覧・削除できるようにする。
---

# Codex Session Manager

Codex CLI のセッションIDを `~/.cache/ai-agent-sessions/codex-session-<name>` に保存し、複数セッションを混同せずに継続できるようにする。

> **Note**: このスキルは Bash スクリプト群で、`codex` コマンドを別セッションとして起動・継続するためのものです。  
> Claude Code / Codex どちらの環境からでもシェルコマンドとして実行できます（スラッシュコマンドによる自動実行ではありません）。

## 使い方

### セッション作成（ID保存）

```bash
~/.claude/skills/codex-session/scripts/start.sh [--cd <dir>] <name> "<初期プロンプト>"
```

例:
```bash
~/.claude/skills/codex-session/scripts/start.sh reviewer "コードレビュー役として動いてください"

# 作業ディレクトリを分離したい場合（このディレクトリの文脈/AGENTSから切り離す）
~/.claude/skills/codex-session/scripts/start.sh --cd /path/to/project reviewer "このリポジトリをレビューして"
```

### セッション継続（保存済みIDでresume）

```bash
~/.claude/skills/codex-session/scripts/send.sh [--cd <dir>] <name> "<追加プロンプト>"
```

例:
```bash
# start 時と同じディレクトリを自動再利用（--cd省略可）
~/.claude/skills/codex-session/scripts/send.sh reviewer "この差分をレビューして"

# 明示的に上書きしたい場合
~/.claude/skills/codex-session/scripts/send.sh --cd /path/to/project reviewer "この差分をレビューして"
```

### セッション一覧

```bash
~/.claude/skills/codex-session/scripts/list.sh
```

### セッション削除

```bash
# 特定のセッションを削除
~/.claude/skills/codex-session/scripts/clear.sh <name>

# 全セッションを削除
~/.claude/skills/codex-session/scripts/clear.sh --all
```

## 注意事項

- セッションIDは `~/.cache/ai-agent-sessions` に保存される
- 推論強度は `high`（`REASONING_EFFORT=high`）で実行される
- Codexの401エラーが頻発する場合は `codex logout && codex login` を試す
- 実装は共通コアに統一され、ログ探索結果をメタ情報として再利用するため、継続実行時の無駄な探索を減らしている
