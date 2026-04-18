---
name: launch-beta
description: |
  指定ワークツリーの beta サーバーを立ち上げる軽量スキル。
  `scripts/beta/launch.bat` を実行するだけ。port 4173 は自動で解放される。
  以下の場面でトリガーする:
  - 「/launch-beta」「launchして」「beta起動」「立ち上げて」と言われたとき
  - ロール名（visual / data / main）と一緒に「起動」「サーバー」と言われたとき
  - HOME画面や viewer の動作確認をする前
---

# launch-beta — 指定ワークツリーの beta 起動

ロール指定でワークツリーを選び、`scripts/beta/launch.bat` をバックグラウンド実行する。

## Usage

```
/launch-beta {role}
```

ロール → ブランチ → ワークツリー対応:

| role | branch | worktree path |
|------|--------|--------------|
| `beta` | `dev-beta` | `c:\Users\Akaghef\dev\M3E-dev-beta\` |
| `data` (既定) | `dev-data` | `c:\Users\Akaghef\dev\M3E\` |
| `visual` | `dev-visual` | `c:\Users\Akaghef\dev\M3E-dev-visual\` |

役割名を省略した場合は、現在の CWD のワークツリーで起動する。

## 実行手順

1. `git worktree list` でロールに対応するワークツリーの存在を確認する。
   存在しなければ、その旨をユーザーに報告して中断する
   （`git worktree add` はこのスキルでは行わない — 別途用意が必要）。

2. ロール名から launch.bat の絶対パスを決定する:
   - beta → `c:/Users/Akaghef/dev/M3E-dev-beta/scripts/beta/launch.bat`
   - data → `c:/Users/Akaghef/dev/M3E/scripts/beta/launch.bat`
   - visual → `c:/Users/Akaghef/dev/M3E-dev-visual/scripts/beta/launch.bat`

2. Bash ツールで `run_in_background: true` で実行:
   ```
   <launch.bat 絶対パス>
   ```

3. ユーザーには `http://localhost:4173/viewer.html` および `http://localhost:4173/home.html` が
   開けることを案内する（どちらのページが必要かはタスクによる）。

## 備考

- launch.bat は `%~dp0\..\..` で自身のワークツリーを解決するので、どこから呼んでも正しいパスで起動する。
- port 4173 は launch.bat 内で自動解放される（既存プロセスがあれば kill）。
- ビルド物がない場合は失敗する。その場合は先に `npm --prefix beta run build` が必要。
- このスキルはサーバー起動「だけ」を行う。ビルド・テスト・ブラウザ起動は別スキルに任せる。
