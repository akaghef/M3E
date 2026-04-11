# M3E Setup — 配布・検証ガイド

科学研究のための思考支援マインドマップツール。
仮説の分解、前提の比較、設計判断など、構造を持った思考を可視化し、意思決定を加速します。

## ダウンロード

**[M3E をダウンロード (zip)](https://github.com/akaghef/M3E/archive/refs/heads/main.zip)**

ダウンロード後、zip を展開して `install\setup.bat` を実行してください。
Node.js などの事前インストールは不要です。セットアップがすべて自動で準備します。

---

## ファイル構成

| ファイル | 用途 |
|---------|------|
| `install/setup.bat` | セットアップ本体 |
| `install/windows/m3e.iss` | Inno Setup インストーラー定義 |
| `install/windows/build-installer.ps1` | インストーラー `.exe` ビルド |
| `install/windows/verify-distribution.ps1` | **ワンコマンド検証**（ビルド→テスト→レポート） |
| `install/windows/run-local-test.ps1` | ローカル検証（全エディション対応） |
| `install/windows/run-sandbox.ps1` | Sandbox 検証（Pro/Enterprise のみ、Home は自動フォールバック） |
| `install/assets/icons/` | アイコン資産 |
| `install/artifacts/` | ビルド済みインストーラー `.exe` の出力先 |

## 前提条件

| 必須 | インストール方法 |
|------|----------------|
| **Inno Setup 6** | `winget install JRSoftware.InnoSetup` |
| **Node.js** | システムに入っていなければ `setup.bat` が自動ダウンロード |

## セットアップ（手動）

1. `install\setup.bat` を実行する
2. セットアップ完了後、デスクトップの `M3E` から起動する

## セットアップ（無人実行）

```bat
install\setup.bat --silent --no-launch --log "%LOCALAPPDATA%\M3E\logs\setup.log"
```

オプション:
- `--silent` — プロンプトなし
- `--no-launch` — 完了後に起動しない
- `--data-dir "D:\M3EData"` — データ保存先を変更
- `--log "C:\path\to\setup.log"` — ログファイル出力

## 配布物の検証

### ワンコマンド（推奨）

```powershell
powershell -File install\windows\verify-distribution.ps1
```

これ一つで以下を自動実行する:

1. 前提チェック（Inno Setup, Node.js, OS エディション）
2. インストーラー `.exe` のビルド
3. 一時ディレクトリへのサイレントインストール
4. ファイル構成の検証（必須ファイル・ディレクトリ・node_modules）
5. config/データディレクトリの検証
6. サーバー起動テスト（ポート待ち受け + HTTP 応答）
7. アンインストールテスト
8. クリーンアップ
9. JSON レポート出力（`install/artifacts/test-report-*.json`）

テスト後にファイルを残したい場合:

```powershell
powershell -File install\windows\verify-distribution.ps1 -SkipCleanup
```

### 個別実行

```powershell
# ビルドのみ
powershell -File install\windows\build-installer.ps1

# テストのみ（ビルド済み exe を自動検出）
powershell -File install\windows\run-local-test.ps1 -SkipBuild

# 特定の exe を指定
powershell -File install\windows\run-local-test.ps1 -InstallerPath install\artifacts\M3E-Setup-vMMYYDD.exe
```

### Windows エディションと検証方式

| エディション | 方式 | 備考 |
|------------|------|------|
| **Home** | `run-local-test.ps1` | 一時ディレクトリでローカル検証 |
| **Pro / Enterprise** | `run-sandbox.ps1` | Windows Sandbox で隔離検証 |

`run-sandbox.ps1` は Home エディションを検出すると自動的に `run-local-test.ps1` へフォールバックする。
`verify-distribution.ps1` はエディションを問わず動作する。

## トラブルシューティング

### EPERM: better_sqlite3.node

```
npm error [Error: EPERM: operation not permitted, unlink '...\better_sqlite3.node']
```

M3E サーバーが起動中にセットアップを実行した場合に発生する。
`setup.bat` はポート 38482 のプロセスを自動停止するが、他のプロセスがファイルをロックしている場合は手動で停止する:

```bat
netstat -ano | findstr :38482
taskkill /PID <PID> /F
```

### Inno Setup が見つからない

```
winget install JRSoftware.InnoSetup
```

インストール後、新しいターミナルを開く（PATH 反映のため）。

### Windows Sandbox が使えない

Home エディションでは利用不可。`verify-distribution.ps1` は自動的にローカルテストを使う。
Pro/Enterprise で有効化する場合:

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM
# 要再起動
```

## 注意

- アイコン差し替え時は `install/assets/icons/README.md` の手順に従う
