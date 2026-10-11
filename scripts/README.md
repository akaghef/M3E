# 起動・更新の正規経路

運用正本: [Beta / Final](../docs/06_Operations/Channel_Release_Policy.md)。Beta は launch / update-and-launch、Final 更新は update-and-launch --release <公開済みタグ>。migrate-from-beta / sync-beta-to-final は廃止し副作用なしで終了する。

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
| `launch.bat` | Beta を起動（版・入力を検査し必要時に再ビルド）**← 日常利用** |
| `launch.sh` | Beta を Mac / Linux で起動（版・入力を検査し必要時に再ビルド） |
| `codex-app-server.sh` | Codex App server として Beta を起動（ブラウザ自動 open なし） |
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
| `launch.bat` | Final を起動（版・入力を検査し必要時に再ビルド）**← 本番利用** |
| `launch.sh` | Final を Mac / Linux で起動（設定ファイル対応・依存/ビルドの軽修復あり） |
| `configure-cloud-sync-mode.bat` | 同じ Final 製品を team cloud / Supabase sync 用に設定 |
| `configure-cloud-sync-mode.sh` | Mac / Linux で team cloud / Supabase sync 用に設定 |
| `configure-personal-mode.bat` | Final を personal/local 用設定に戻す |
| `configure-personal-mode.sh` | Mac / Linux で Final を personal/local 用設定に戻す |
| `update-and-launch.bat` | 公開済みタグを指定して構築・起動 |
| `update-and-launch.sh` | 公開済みタグを指定して構築・起動（Mac / Linux） |
| `migrate-from-beta.bat` | 廃止（暗黙昇格を拒否） |
| `migrate-from-beta.sh` | 廃止（暗黙昇格を拒否）（Mac / Linux） |

補足:

- `scripts/final/launch.bat` と `scripts/final/launch.sh` は mode-aware。
- `M3E_LAUNCH_MODE=personal` なら通常の local Final を起動する。
- `M3E_LAUNCH_MODE=remote` なら設定済みの remote workspace を browser で開く。
- `configure-cloud-sync-mode.bat` / `.sh` は `%LOCALAPPDATA%\M3E\m3e.conf`
  または `~/Library/Application Support/M3E/m3e.conf` に
  `M3E_CLOUD_*` / `M3E_SUPABASE_*` を書き込み、同じ Final 製品を
  team cloud client として使えるようにする。

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
  scripts/final/update-and-launch.bat --release <published-tag>

Final を更新して起動する:
  scripts/final/update-and-launch.bat --release <published-tag>
```

macOS / Linux:
```bash
./scripts/beta/launch.sh
./scripts/beta/codex-app-server.sh
./scripts/beta/update-and-launch.sh
./scripts/final/configure-personal-mode.sh
./scripts/final/launch.sh
./scripts/final/configure-cloud-sync-mode.sh <supabase-url> <anon-key>
./scripts/final/update-and-launch.sh --release <published-tag>
./scripts/final/update-and-launch.sh --release <published-tag>
```

## エージェント開始コマンド

Windows / PowerShell 上の通常 codex（non-Copilot）で role/bootstrap を揃える場合は次を実行する。

```powershell
pwsh -File scripts/ops/setrole.ps1 codex1
# codex2 / claude も同様
```

macOS / Linux 上の通常 Codex では PowerShell bootstrap を呼ばない。`pwd`、`git status --short --branch`、`git branch --show-current`、mandatory context 読み込みで session gate を通す。

このコマンドは role -> worktree -> branch の整合を確認し、
`codex1` / `codex2` の場合は `origin/dev-beta` への rebase チェックを実行する。

## デスクトップから使う

1. `scripts/beta/` を開く
2. `launch.bat` を右クリック → `送る` → `デスクトップ (ショートカットを作成)`
3. ショートカット名を `M3E Beta 起動` などに変更

macOS ではターミナルから `./scripts/beta/launch.sh` を実行する。

## データの扱い

アプリの版とデータを分ける。既存 M3E_DATA_DIR と workspace 設定を保持する。未設定時は M3E_HOME/workspaces/<workspace-id>/data.sqlite。Final は既存 m3e.conf も読む。更新では個人 DB をコピー・移行しない。schema が変わる場合は別途検証済み migration / 復元手順が必要。

## 前提条件

起動前に版・入力・ビルドを検査する。初回は `update-and-launch.bat` （Final は --release 必須） を使うこと。

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
