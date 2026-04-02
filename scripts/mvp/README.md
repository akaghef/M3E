# MVP 運用スクリプト

このフォルダには、Rapid MVP を日常利用するための起動用バッチを置いています。

## ファイル

- `launch-beta.bat`
  - 通常起動専用です。
  - 更新は行わず、ビルド済みの状態から最短で起動します。
  - 実行コマンド: `npm --prefix mvp start`

- `update-and-launch-beta.bat`
  - 最新版に更新してから起動します。
  - `git fetch/pull` → `npm --prefix mvp ci` → `npm --prefix mvp run build` → `npm --prefix mvp start` の順で実行します。
  - 途中で失敗した場合は停止します。

## 推奨運用

| 場面 | 使うバッチ |
|------|-----------|
| 日常起動 | `launch-beta.bat` |
| コードの更新を取り込むとき | `update-and-launch-beta.bat` |

## デスクトップから使う手順

1. `scripts/mvp` を開く
2. 各 `.bat` を右クリック
3. `送る` → `デスクトップ (ショートカットを作成)`
4. ショートカット名を分かりやすく変更
   - `M3E 起動`
   - `M3E 更新して起動`

## データの扱い

ユーザーデータ（`.sqlite`）はリポジトリに含まれません（`.gitignore` で除外）。
データファイルの場所: `mvp/data/rapid-mvp.sqlite`

バックアップは手動で行ってください。
起動時に `mvp/data/rapid-sample.json` が自動生成されます（これもリポジトリ管理外）。

## 前提条件

`launch-beta.bat` を使うには事前にビルドが完了している必要があります。
初回または依存関係を変更した後は `update-and-launch-beta.bat` を使ってください。
