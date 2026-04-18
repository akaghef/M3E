# M3E 運用スクリプト

M3E の各環境を日常利用するための起動・更新・migration スクリプト置き場。

## 環境構成

| 環境 | ディレクトリ | 状態 | 用途 |
|------|-------------|------|------|
| Beta | `beta/` | **現行開発** | 継続開発・日常利用 |
| Final | `final/` | 安定版 | 本番運用・配布 |

## スクリプト一覧

### Beta (`scripts/beta/`)

> Beta が現行の開発・利用環境。通常はこちらを使う。

| スクリプト | 用途 |
|-----------|------|
| `launch.bat` | Beta を起動（ビルド済み前提）**← 日常利用** |
| `launch.sh` | Beta を Mac / Linux で起動（ビルド済み前提） |
| `update-and-launch.bat` | git pull → install → build → 起動 |
| `update-and-launch.sh` | git pull → install → build → 起動（Mac / Linux） |
| `install-ollama-gemma3-4b.ps1` | Ollama 導入 + `gemma3:4b` 取得（ローカル AI 準備） |
| `launch-with-local-gemma.bat` | Bitwarden なしで Ollama + `gemma3:4b` で Beta を起動 |
| `launch-with-ai.bat` | Bitwarden から AI API key を注入して Beta を起動 |
| `update-and-launch-with-ai.bat` | 更新後、Bitwarden から AI API key を注入して Beta を起動 |

### Final (`scripts/final/`)

> Beta で検証された安定版。本番運用・配布向け。

| スクリプト | 用途 |
|-----------|------|
| `launch.bat` | Final を起動（ビルド済み前提）**← 本番利用** |
| `launch.sh` | Final を Mac / Linux で起動（ビルド済み前提） |
| `update-and-launch.bat` | Final を更新して起動（migration 実行） |
| `update-and-launch.sh` | Final を更新して起動（migration 実行、Mac / Linux） |
| `migrate-from-beta.bat` | Beta → Final の sync・build・data migration・起動 |
| `migrate-from-beta.sh` | Beta → Final の sync・build・data migration・起動（Mac / Linux） |

補足:

- `scripts/final/launch.bat` は mode-aware。
- `M3E_LAUNCH_MODE=personal` なら通常の local Final を起動する。
- `M3E_LAUNCH_MODE=remote` なら設定済みの remote workspace を browser で開く。

## 推奨運用フロー

```
日常利用:
  scripts/beta/launch.bat

AI 機能込みで日常利用:
  scripts/beta/launch-with-ai.bat <bitwarden-item>

コード更新を取り込む:
  scripts/beta/update-and-launch.bat

AI 機能込みで更新して起動:
  scripts/beta/update-and-launch-with-ai.bat <bitwarden-item>

Final に反映する:
  scripts/final/migrate-from-beta.bat

Final を更新して起動する:
  scripts/final/update-and-launch.bat
```

macOS / Linux:
```bash
./scripts/beta/launch.sh
./scripts/beta/update-and-launch.sh
./scripts/final/launch.sh
./scripts/final/migrate-from-beta.sh
./scripts/final/update-and-launch.sh
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

macOS ではターミナルから `./scripts/beta/launch.sh` を実行する。

## データの扱い

| 環境 | データファイル |
|------|-------------|
| Beta | `%APPDATA%\M3E\M3E_dataV1.sqlite` |
| Final | `%APPDATA%\M3E\M3E_dataV1.sqlite` |

- `.sqlite` ファイルはリポジトリに含まれない（`.gitignore` で除外）
- Final migration 時、`M3E_dataV1.sqlite` は自動バックアップされる（`%APPDATA%\M3E\backup\`）

## 前提条件

`launch.bat` はビルド済み状態が前提。初回は `update-and-launch.bat` または `migrate-from-beta.bat` を使うこと。

Node.js が PATH に通っていること。

AI 連携を使う場合は追加で以下が必要。

- Bitwarden CLI `bw` が PATH に通っていること
- `bw unlock` 実行済みで `BW_SESSION` が有効なこと
- Bitwarden item の `password` に API key を入れること
- custom field は必要に応じて以下を使用できる
  - `provider`
  - `transport`
  - `base_url`
  - `model`
