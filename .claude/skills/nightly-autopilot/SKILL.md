---
name: nightly-autopilot
description: >
  M3E の夜間オートパイロット（ハイブリッド）。エージェント(主に Codex)が一発で回す保守ジョブで、
  (1) M3E workspace データの SQL ダンプ版管理バックアップ、(2) dev-beta の pending を commit/push、
  (3) green な Pull Request の自動マージ、(4) CI が赤なら最小修正(最大3回)、(5) 報告、までを行う。
  決定論パート(1)(2)は `scripts/ops/nightly-autopilot.sh` が担い、PR マージ判断と CI 修正は
  エージェントが判断して実行する。production(final/ や main)・Syncthing には一切触れない。
  2つのモードがある:「1-shot(朝・手動)」と「scheduled(夜・Codex automation)」。
  次のような時は必ずこのスキルを使う:「夜間自動」「朝の1-shot」「/nightly-autopilot」
  「overnight でデータ同期と CI と PR を片付けたい」「dev-beta を最新かつ green に」「daily-sync の後継」。
  data sync・CI 通し・PR 解決を無人/半自動でまとめて回す話なら、スキル名を言われなくてもトリガーする。
---

# nightly-autopilot

dev-beta を「最新かつ green」に保ち、M3E データを版管理バックアップする保守ジョブ。
**ハイブリッド**構成：決定論パートは shell スクリプト、判断が要る PR/CI はエージェントが担う。
**production(final/・main)と Syncthing には一切触れない。**

## 2つのモード

| モード | 起動 | 用途 |
|---|---|---|
| **1-shot（朝・手動）** | エージェントにこのスキルを実行させる（`/nightly-autopilot` 等） | 夜間が失敗した時の取り戻し／日中の手動同期 |
| **scheduled（夜・自動）** | **Codex automation**（`~/.codex/automations/.../automation.toml`、`rrule` 定期、prompt がこのスキルを起動） | 寝ている間の無人実行 |

どちらも実行内容は同じ。launchd LaunchAgent は使わない（撤去済み）。

## 実行手順（ハイブリッド）

### Step 1 — 決定論パート（スクリプト）

```bash
scripts/ops/nightly-autopilot.sh --no-pr --no-ci-fix
```

これが **Stage A: データ SQL ダンプ・バックアップ**（3 ws を lock-safe に `.backup`→`.dump` →
`akaghef/m3e-data` の `snapshots` ブランチへ日付 commit/push）と **Stage 0: dev-beta 最新化**
（`pull --ff-only`→`git add -u`→`chore: nightly auto-commit (日付)`→push）を実行し、
`logs/nightly-autopilot-YYYY-MM-DD.md` に途中経過を残す。ガードレール（単一ロック・90分予算・
**force-push 禁止**・非ff abort）はスクリプト側で効く。**まず `--dry-run` を付けて副作用ゼロを確認**してから本番を。

### Step 2 — green PR マージ（エージェント判断）

```bash
gh pr list --base dev-beta --state open --json number,title,mergeable,statusCheckRollup,headRefName
```

各 PR について：CI(`statusCheckRollup`)が全 success で、`mergeable == MERGEABLE` のものだけ
`gh pr merge <n> --squash --delete-branch`。
**重要**：GitHub は mergeability を非同期算出し初回は `UNKNOWN` を返す（既知の落とし穴）。
`UNKNOWN` の時は数秒待って再照会し、`MERGEABLE`/`CONFLICTING` が確定してから判断する。
赤・競合・保留は触らず理由を記録。マージ後は `git pull --ff-only origin dev-beta`。

### Step 3 — CI green 化（エージェント判断・最小修正）

push 後、`gh run list --branch dev-beta` で現 HEAD の run が登録されるのを少し待ってから完了までポーリング
（直後は run 未登録のことがある／対象ワークフローが無いコミットは neutral 扱い）。
赤い run があれば `gh run view <id> --log-failed` でログを取り、**最小修正**を dev-beta に commit→push→再確認。
**最大3回**で打ち切り、それでも赤なら停止して報告。**final/・main は触らない／force-push しない。**

### Step 4 — 報告

実施内容（データ snapshot / auto-commit / マージ&skip した PR＋理由 / CI 結末 / 中断理由 / 総合判定）を簡潔に報告。

## 触らないもの（安全境界）

- **final/ と main には一切触れない。** 本番昇格は別途 `majorupdate` で人間が行う。
- **Syncthing 設定は変更しない。** データの定常同期(DP2)は Syncthing が担い、本ジョブは版管理バックアップ(Stage A)のみ。

## scheduled モード = Codex automation の作り方

`~/.codex/automations/m3e-nightly-autopilot/automation.toml` を作る（Codex アプリ経由。`target_thread_id` はアプリが付与）：

```toml
version = 1
id = "m3e-nightly-autopilot"
kind = "heartbeat"
name = "M3E nightly autopilot"
status = "ACTIVE"            # 準備中は "PAUSED"
rrule = "FREQ=DAILY;BYHOUR=3;BYMINUTE=0"   # 毎晩 03:00（就寝時間に合わせて調整）
prompt = """
Run the M3E nightly-autopilot skill (.claude/skills/nightly-autopilot). Hybrid:
1) Deterministic: run `scripts/ops/nightly-autopilot.sh --no-pr --no-ci-fix` from the
   M3E repo root (data SQL-dump backup + dev-beta commit/push). Use arm64 bash.
2) Merge green dev-beta PRs: only mergeable==MERGEABLE with all-success checks; if
   mergeable is UNKNOWN, wait a few seconds and re-query before deciding. Squash + delete branch.
3) CI green-up on dev-beta HEAD: wait for runs, fix any red with a minimal commit (max 3 attempts).
Never touch final/ or main. Never force-push. Report what was done.
"""
```

## 前提

- `gh` 認証済（`gh auth status`）— Step 2/3 に必須。
- `sqlite3` 利用可 — Step 1 のデータダンプに必須。
- `akaghef/m3e-data`（private）への push 権限。初回は自動 clone（`--filter=blob:none`）。
- スクリプトは macOS `/bin/bash`(3.2) でも動く（bash 3.2 安全化済み）が、arm64 bash 推奨。
