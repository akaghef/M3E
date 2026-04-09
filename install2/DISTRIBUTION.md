# M3E Setup v2 Guide

旧フロー（`install/`）は維持したまま、次世代の配布導線を `install2/` に集約する。

## 対象

- セットアップ本体: `install2/setup.bat`
- インストーラー定義: `install2/windows/m3e.iss`
- ビルド補助: `install2/windows/build-installer.ps1`
- Sandbox 検証補助: `install2/windows/run-sandbox.ps1`
- アイコン資産: `install2/assets/icons/`

## 使い方（手動）

1. `install2\setup.bat` を実行する
2. セットアップ完了後、デスクトップの `M3E` から起動する

## 使い方（無人実行）

```bat
install2\setup.bat --silent --no-launch --log "%LOCALAPPDATA%\M3E\logs\setup-v2.log"
```

利用可能オプション:

- `--silent`
- `--no-launch`
- `--data-dir "D:\M3EData"`
- `--log "C:\path\to\setup.log"`

## 注意

- `install/` は旧配布導線としてそのまま残す
- `install2/` は新配布導線の実装・検証用
- アイコン差し替え時は `install2/assets/icons/README.md` の手順に従う
