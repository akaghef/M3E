# M3E 運用スクリプト

M3E の各環境を日常利用するための起動・更新・migration スクリプト置き場。

## 環境構成

| 環境 | ディレクトリ | 状態 | 用途 |
|------|-------------|------|------|
| Alpha | `mvp/` | 開発停止予定 | 参照・検証のみ |
| Beta | `beta/` | **現行開発** | 継続開発・日常利用 |
| Final | `final/` | 安定版 | 本番運用・配布 |

## スクリプト一覧

### Alpha (`scripts/alpha/`)

> Alpha は MVP と同義。新機能追加は停止予定。参照・検証専用。

| スクリプト | 用途 |
|-----------|------|
| `launch.bat` | Alpha を起動（ビルド済み前提） |
| `update-and-launch.bat` | 初回セットアップ・依存更新時のみ使用 |

### Beta (`scripts/beta/`)

> Beta が現行の開発・利用環境。通常はこちらを使う。

| スクリプト | 用途 |
|-----------|------|
| `launch.bat` | Beta を起動（ビルド済み前提）**← 日常利用** |
| `update-and-launch.bat` | git pull → install → build → 起動 |

### Final (`scripts/final/`)

> Beta で検証された安定版。本番運用・配布向け。

| スクリプト | 用途 |
|-----------|------|
| `launch.bat` | Final を起動（ビルド済み前提）**← 本番利用** |
| `update-and-launch.bat` | Final を更新して起動（migration 実行） |
| `migrate-from-beta.bat` | Beta → Final の sync・build・data migration・起動 |

## 推奨運用フロー

```
日常利用:
  scripts/beta/launch.bat

コード更新を取り込む:
  scripts/beta/update-and-launch.bat

Final に反映する:
  scripts/final/migrate-from-beta.bat

Final を更新して起動する:
  scripts/final/update-and-launch.bat
```

## エージェント開始コマンド

通常 codex（non-Copilot）で role/bootstrap を揃える場合は次を実行する。

```powershell
pwsh -File scripts/ops/setrole.ps1 codex1
# codex2 / claude も同様
```

このコマンドは role -> worktree -> branch の整合を確認し、
`codex1` / `codex2` の場合は `origin/dev-beta` への rebase チェックを実行する。

## デスクトップから使う

1. `scripts/beta/` を開く
2. `launch.bat` を右クリック → `送る` → `デスクトップ (ショートカットを作成)`
3. ショートカット名を `M3E Beta 起動` などに変更

## データの扱い

| 環境 | データファイル |
|------|-------------|
| Alpha (mvp) | `mvp/data/rapid-mvp.sqlite` |
| Beta | `beta/data/m3e.sqlite` |
| Final | `final/data/m3e.sqlite` |

- `.sqlite` ファイルはリポジトリに含まれない（`.gitignore` で除外）
- Final migration 時、`m3e.sqlite` は自動バックアップされる（`final/data/backup/`）

## 前提条件

`launch.bat` はビルド済み状態が前提。初回は `update-and-launch.bat` または `migrate-from-beta.bat` を使うこと。

Node.js が PATH に通っていること。
