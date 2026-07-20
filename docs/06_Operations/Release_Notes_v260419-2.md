# Release Notes v260419-2

日付: 2026-04-19

## 概要

`v260419-2` は、同じ `final` 製品をそのまま team cloud client として使えるようにするための更新。
Supabase を使った shared cloud sync 導線を public 側の packaging に取り込み、起動時の診断と
cloud sync UX の荒さを一段整理した。

## 主な変更

### 1. generic cloud sync packaging

- `scripts/final/launch.bat` が `m3e.conf` から `M3E_CLOUD_*` / `M3E_SUPABASE_*` を読めるようになった
- 同一の `final` 製品を personal / team cloud の両方で使い分けられるようになった
- 追加スクリプト:
  - `scripts/final/configure-cloud-sync-mode.bat`
  - `scripts/final/configure-personal-mode.bat`
  - `scripts/final/diagnose-cloud-sync.bat`
  - `scripts/ops/launch-cloud-sync-template.bat`

### 2. Supabase team cloud 導線

- team cloud は `workspace id` / `map id` を固定して shared map を扱う前提に整理
- `final/README.md` と `scripts/README.md` に team rollout の説明を追加
- same product / different mode の運用を明示

### 3. cloud sync diagnostics

- 起動時ログに cloud sync の解決値を追加
  - `CLOUD_SYNC`
  - `CLOUD_TRANSPORT`
  - `AUTO_SYNC`
  - `SUPABASE_URL`
  - key が設定されているか
- `scripts/final/diagnose-cloud-sync.bat` で
  - `m3e.conf`
  - `M3E_*` env override
  - `launch.log`
  をまとめて確認可能にした

### 4. self-conflict 緩和

- `M3E_AUTO_SYNC=0` のときは、local save 後に cloud push しない
- 同一タブ内の cloud push を直列化し、保存連打で自分自身と conflict しにくくした

## 既知の制約

- Home 画面の map 一覧は local SQLite ベースであり、shared cloud index ではない
- 今回の team cloud は realtime collab ではなく shared cloud sync
- `Pull / Push` ベースの運用が前提
- lock / heartbeat / scope merge を伴う本格的な共同編集は次段階

## 検証メモ

- リリース実行時の build / test / VM テストは今回はスキップ
- 手元確認の主眼は
  - cloud sync 設定の永続化
  - shared map の `Pull / Push`
  - conflict 導線
  に置いた

## 関連タグ

- 前回: `v260419`
- 今回: `v260419-2`
