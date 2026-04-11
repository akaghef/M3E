# Claude/Codex Skills Pack

Claude Code から Codex を、Codex から Claude を呼び出すための Skills 一式です。

## 同梱内容

- `skills/.shared/` — 共通コアスクリプト
- `skills/claude-session/` — Claude セッション管理
- `skills/codex-session/` — Codex セッション管理（gpt-5.2）
- `skills/codex-impl/` — Codex 実装セッション管理（gpt-5.3-codex）
- `skills/codex-spark/` — Codex Spark セッション管理（gpt-5.3-codex-spark）
- `skills/codex-review/` — Codex コードレビュー（gpt-5.3-codex）

## 前提条件

- `claude` コマンドが使えること
- `codex` コマンドが使えること（`codex login` 済み）
- 対応モデルへのアクセス権があること

## インストール

```bash
cp -a skills/. "$HOME/.claude/skills/"
```

インストール後は Claude Code / Codex が SKILL.md を読み取って自動で呼び出します。

## モデル・推論強度のカスタマイズ

同梱のモデル設定は作者の環境に合わせたものです。利用可能なモデルやプランに応じて書き換えてください。

各スキルの `scripts/start.sh` と `scripts/send.sh` にある以下の部分を変更します。

```
exec env ... MODEL="ここ" REASONING_EFFORT="ここ" ...
```

REASONING_EFFORT の選択肢: `low` / `medium` / `high` / `xhigh`

## 注意

- 本パックは無保証です。自己責任で利用してください。
- モデル名・推論強度は配布時点のものです。最新の利用可能モデルに合わせて適宜変更してください。
