---
name: nightly-autopilot
description: >
  M3E の「夜間オートパイロット」。寝ている間に一発で回す無人ジョブで、(1) M3E
  workspace データの SQL ダンプ版管理バックアップ、(2) dev-beta の pending を
  commit/push、(3) green な Pull Request の自動マージ、(4) CI が赤なら Codex で
  自動修正(最大3回)、(5) 朝の報告、までを Codex に行わせる。production(final/ や
  main)には一切触れない。次のような時は必ずこのスキルを使うこと:「夜間自動」
  「寝てる間に同期」「/nightly-autopilot」「overnight でデータ同期と CI と PR を
  片付けたい」「夜のうちに dev-beta を最新かつ green にしておきたい」「daily-sync
  の後継」。data sync・CI 通し・PR 解決を無人でまとめて回す話なら、明示的に
  スキル名を言われなくてもトリガーする。
---

# nightly-autopilot

`scripts/ops/nightly-autopilot.sh` を回す無人オーケストレータ。**Claude 不在(深夜)で
自走する shell + `codex exec` + `gh`** 構成。`daily-sync` の後継として 03:00 の
LaunchAgent が実行する。

## 何をするか（5 ステージ）

| Stage | 内容 |
|---|---|
| **A. data snapshot** | `scripts/ops/m3e-data-snapshot.sh` を呼ぶ。3つの M3E workspace（M3E / Akaghef System / Ops）の sqlite を **lock-safe にダンプ**（`.backup`→`.dump`）し、private repo `akaghef/m3e-data` の `snapshots` ブランチ（orphan / テキストのみ）に日付コミット/push。**Syncthing のライブ同期を補完する版管理バックアップ**（Syncthing 自体は触らない）。 |
| **0. dev-beta latest** | dev-beta を確保し `pull --ff-only`（非 fast-forward なら abort）、`git add -u` で pending を `chore: nightly auto-commit (日付)` にして push。 |
| **1. green PR 自動マージ** | dev-beta 宛の open PR のうち **mergeable かつ CI 全 success** のものだけ `gh pr merge --squash --delete-branch`。赤/競合/保留は触らず理由を記録。 |
| **2. CI green 化** | dev-beta HEAD の CI を完了までポーリング。赤なら失敗ログを添えて `codex exec` で**最小修正**→push→再ポーリング（**最大 `MAX_CI_FIX`=3 回**）。それでも赤なら停止して報告。 |
| **3. report** | `logs/nightly-autopilot-YYYY-MM-DD.md` に全結果（HEAD前後/snapshot/commit/マージ&skip PR/CI結末/中断理由/総合判定 PASS·PARTIAL·FAIL）を出力し、1 行サマリを stdout へ。 |

## 触らないもの（安全境界）

- **final/ ディレクトリと main ブランチには一切触れない。** 本番昇格は別途 `majorupdate` で人間が行う。
- **Syncthing 設定は変更しない。** データ同期の定常運用(DP2)は Syncthing が担う。

## ガードレール（完全自律＝無人だが暴走防止つき）

- 単一インスタンスロック（多重起動拒否）
- ウォールクロック予算 `WALL_BUDGET`=5400s(90分) 超過で打ち切り→報告
- CI 自動修正は `MAX_CI_FIX`=3 回で打ち切り（無限ループ/トークン暴走防止）
- **force-push しない**／非 fast-forward は abort
- ステージは best-effort 分離：1つ失敗しても独立ステージは続行し、報告に残す

## 使い方（オンデマンド）

```bash
# 本番フル実行（破壊的：commit/push/PRマージ/codex起動/データpush が走る）
scripts/ops/nightly-autopilot.sh

# 何も書かずに意図だけ確認（commit/push/merge/codex 一切なし、レポートは temp）
scripts/ops/nightly-autopilot.sh --dry-run

# 部分実行
scripts/ops/nightly-autopilot.sh --no-pr        # PR マージを飛ばす
scripts/ops/nightly-autopilot.sh --no-ci-fix    # CI は見るだけ、Codex 修正なし
scripts/ops/nightly-autopilot.sh --no-data      # データスナップショットを飛ばす

# データバックアップ単体
scripts/ops/m3e-data-snapshot.sh [--dry-run]
```

新しい挙動を入れたら**まず `--dry-run` で副作用ゼロを確認**してから本番を回すこと。

## スケジューリング（daily-sync を置き換える）

LaunchAgent `~/Library/LaunchAgents/com.m3e.daily-sync.plist` の `ProgramArguments`
を `scripts/ops/nightly-autopilot.sh` に差し替える（PATH に `/opt/homebrew/bin` を
含める＝arm64 node、push は osxkeychain/ssh で無人）。管理:
`launchctl bootout/bootstrap gui/$(id -u) <plist>`。

```xml
<key>ProgramArguments</key>
<array>
  <string>/bin/bash</string>
  <string>/Users/nisimoriyuuya/dev/M3E/scripts/ops/nightly-autopilot.sh</string>
</array>
```

## 前提

- `gh` が認証済（`gh auth status`）— Stage 1/2 に必須。
- `codex` が起動可能（`scripts/codex.sh` 経由の arm64 node）— Stage 2 に必須。
- `sqlite3` が利用可能 — Stage A に必須。
- `akaghef/m3e-data`（private）への push 権限。初回は自動 clone（`--filter=blob:none`）。
