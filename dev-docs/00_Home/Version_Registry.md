# Version Registry

リリースタグとデータスキーマバージョンの対応表。
launch-final 実行時に更新する。

## タグ ↔ Data Schema 対応

| タグ | data schema | 日付 | 主な変更 |
|------|-------------|------|---------|
| v260411 | v1 | 2026-04-11 | 初回配布バージョン（修正済み） |

## Data Schema Version 履歴

| schema | 導入タグ | 変更内容 |
|--------|---------|---------|
| v1 | v260411 | 初版。nodes, links (optional) |

## 注意

- schema version が変わる場合は migration script を用意すること
- ADR_006 で Resource 追加時の version 方針を検討中
