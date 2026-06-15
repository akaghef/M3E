---
name: daily-sync
description: |
  M3E の dev-beta を日次で自動同期する軽量スキル。
  dev-beta の pending work を commit/push し、beta/ を final/ へ同期し、
  final/ の build/test を通った場合だけ final 更新を commit/push する。
  以下の場面でトリガーする:
  - 「毎日同期」「デイリー同期」「/daily-sync」「daily sync」と言われたとき
  - 「commitしてpushしてfinal更新」「dev-betaをpushしてfinal同期」と言われたとき
  - unattended / cron / launchd で beta → final の日次同期をしたいと言われたとき
---

# daily-sync — dev-beta 日次同期

`scripts/ops/daily-sync.sh` を実行するだけの薄いスキル。

## 実行

```bash
/Users/nisimoriyuuya/dev/M3E/scripts/ops/daily-sync.sh
```

確認だけなら:

```bash
/Users/nisimoriyuuya/dev/M3E/scripts/ops/daily-sync.sh --dry-run
```

final/ 同期を省く場合:

```bash
/Users/nisimoriyuuya/dev/M3E/scripts/ops/daily-sync.sh --no-final
```

## ルーチン

1. `dev-beta` に移動し、`origin/dev-beta` を `--ff-only` で取り込む
2. tracked change だけを `git add -u` で stage し、必要なら日次 commit
3. `dev-beta` を push
4. `scripts/final/sync-beta-to-final.sh` で beta/ → final/ を同期
5. final/ が変わった場合だけ install / build / bounded test を実行
6. gate が通った場合だけ final/ 更新を commit して push

## 安全保証

- pull は fast-forward only。divergence は自動 merge せず停止する
- untracked file は commit しない。secret 混入を避けるため `git add -A` は使わない
- dev-beta の pending work は final gate より前に commit/push される
- final build/test が fail または timeout した場合、final/ は commit しない
- script 先頭で `/opt/homebrew/bin` を PATH 優先し、arm64 Node を使う

## やらないこと

main merge、tag、GitHub Release、VM test、人間 gate は実行しない。
それらが必要な正式リリースは `launch-final` を使う。

## Scheduling

スキルと script は scheduler-agnostic。登録はユーザーが選ぶ。

crontab 例:

```cron
17 5 * * * /Users/nisimoriyuuya/dev/M3E/scripts/ops/daily-sync.sh >> /Users/nisimoriyuuya/dev/M3E/logs/daily-sync.log 2>&1
```

LaunchAgent plist 例の保存先:

```text
~/Library/LaunchAgents/com.m3e.daily-sync.plist
```

plist 例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.m3e.daily-sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/nisimoriyuuya/dev/M3E/scripts/ops/daily-sync.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>5</integer>
    <key>Minute</key>
    <integer>17</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/Users/nisimoriyuuya/dev/M3E/logs/daily-sync.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/nisimoriyuuya/dev/M3E/logs/daily-sync.err.log</string>
  <key>WorkingDirectory</key>
  <string>/Users/nisimoriyuuya/dev/M3E</string>
</dict>
</plist>
```
