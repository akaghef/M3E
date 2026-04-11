---
name: codex-review
description: Codex CLI の `codex review` を定型実行し、冗長ログではなく最終レビュー本文だけを抽出して表示する。
---

# Codex Review Helper

`codex review` の実行と結果抽出を安定化するための skill。

## 使うべきとき

- 未コミット差分のレビューを毎回同じ手順で実行したい
- `codex review` の生ログではなく、最終レビュー本文だけ読みたい
- `session id` / JSONL ログ探索を手作業でやりたくない

## 実行コマンド

### 未コミット差分レビュー

```bash
~/.claude/skills/codex-review/scripts/review-uncommitted.sh [--cd <dir>] [--model <model>] [--max-wait-seconds <seconds>] [--prompt "<追加指示>"]
```

例:

```bash
~/.claude/skills/codex-review/scripts/review-uncommitted.sh \
  --cd /Users/hayatefukashiro/Desktop/product/Musubu \
  --model gpt-5.3-codex \
  --max-wait-seconds 1200 \
  --prompt "Critical/Warningのみ。ファイルと行番号必須"
```

### ベースブランチ差分レビュー

```bash
~/.claude/skills/codex-review/scripts/review-base.sh <base-branch> [--cd <dir>] [--model <model>] [--max-wait-seconds <seconds>] [--prompt "<追加指示>"]
```

## 出力仕様

- 標準出力は原則「最終レビュー本文のみ」
- `session id` が取れない場合は `codex review` の生出力へフォールバック
- JSONL に `output_text` が見つからない場合も生出力へフォールバック
- 既定の最大待機時間は20分（`--max-wait-seconds 1200`）
- タイムアウト時はレビューを停止し、取得済みの部分結果を表示して終了（終了コード: `124`）

## 注意

- ログ探索先は既定で `~/.codex/sessions`
- 必要なら `LOG_ROOT` 環境変数で上書き可能
- `codex review` 側制約により、`--uncommitted` / `--base` 実行時の追加PROMPTは現状非対応（`--prompt` は警告して無視）
